import { Component, computed, inject, input } from '@angular/core';
import { PROVINCES_RDC } from '../../admin/data/carte-rdc';
import { zonesDeProvince } from '../../admin/data/zones-sante';
import { EtablissementPerimetre, PerimetreComiteService, zonesDe } from '../perimetre-comite.service';

const PROVINCES = PROVINCES_RDC.map(p => p.nom).sort((a, b) => a.localeCompare(b, 'fr'));
const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Filtre du tableau de bord du comité : tout le système, une province, une zone de santé de cette
 * province ou un établissement. Les listes se resserrent en cascade et indiquent le nombre
 * d'établissements de chaque choix ; ceux sans établissement enregistré sont grisés.
 */
@Component({
  selector: 'app-filtre-perimetre',
  standalone: true,
  template: `
    <section class="card p-4 sm:p-5" aria-labelledby="perimetre-titre">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="perimetre-titre" class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <i class="fa-solid fa-filter text-brand-600 dark:text-brand-400"></i> Périmètre d’analyse
            @if (chargement()) { <i class="fa-solid fa-spinner fa-spin text-xs text-slate-400" aria-label="Mise à jour des chiffres"></i> }
          </h2>
          <!-- Fil d'Ariane : chaque niveau ramène à une vue plus large -->
          <nav class="mt-1.5 flex flex-wrap items-center gap-1 text-xs" aria-label="Niveau affiché">
            <button type="button" class="rounded-md px-1.5 py-0.5 font-medium transition"
                    [class]="p.actif() ? 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10' : 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'"
                    [attr.aria-current]="p.actif() ? null : 'page'" (click)="p.reinitialiser()">
              <i class="fa-solid fa-earth-africa mr-1"></i>Tout le système
            </button>
            @for (e of p.chemin(); track e.niveau; let dernier = $last) {
              <i class="fa-solid fa-chevron-right text-[9px] text-slate-400" aria-hidden="true"></i>
              @if (dernier) {
                <span class="rounded-md bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" aria-current="page">{{ e.libelle }}</span>
              } @else {
                <button type="button" class="rounded-md px-1.5 py-0.5 font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                        (click)="remonterA(e.niveau)">{{ e.libelle }}</button>
              }
            }
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ resume() }}</p>
          @if (p.actif()) {
            <button type="button" class="btn-secondary py-1.5 text-xs" (click)="p.reinitialiser()"><i class="fa-solid fa-rotate-left"></i> Réinitialiser</button>
          }
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label class="label" for="perimetre-province">Province</label>
          <select id="perimetre-province" class="input" [value]="p.choix().province" (change)="p.choisirProvince($any($event.target).value)">
            <option value="">Toutes les provinces ({{ p.etablissements().length }})</option>
            <optgroup label="Avec établissement(s)">
              @for (o of provinces().avec; track o.nom) { <option [value]="o.nom" [selected]="o.nom === p.choix().province">{{ o.nom }} ({{ o.n }})</option> }
            </optgroup>
            @if (provinces().sans.length) {
              <optgroup label="Sans établissement enregistré">
                @for (o of provinces().sans; track o) { <option [value]="o" disabled>{{ o }}</option> }
              </optgroup>
            }
          </select>
        </div>
        <div>
          <label class="label" for="perimetre-zone">Zone de santé</label>
          <select id="perimetre-zone" class="input" [disabled]="!p.choix().province" [value]="p.choix().zone" (change)="p.choisirZone($any($event.target).value)"
                  [title]="p.choix().province ? '' : 'Choisissez d’abord une province'">
            @if (!p.choix().province) {
              <option value="">Choisissez d’abord une province</option>
            } @else {
              <option value="">Toutes les zones · {{ p.choix().province }} ({{ zones().nombre }})</option>
              <optgroup label="Avec établissement(s)">
                @for (o of zones().avec; track o.nom) { <option [value]="o.nom" [selected]="o.nom === p.choix().zone">{{ o.nom }} ({{ o.n }})</option> }
              </optgroup>
              @if (zones().sans.length) {
                <optgroup label="Sans établissement enregistré">
                  @for (o of zones().sans; track o) { <option [value]="o" disabled>{{ o }}</option> }
                </optgroup>
              }
            }
          </select>
        </div>
        <div>
          <label class="label" for="perimetre-etablissement">Établissement</label>
          <select id="perimetre-etablissement" class="input" [value]="p.choix().etablissement" (change)="p.choisirEtablissement($any($event.target).value)"
                  [disabled]="!candidats().length">
            <option value="">Tous les établissements ({{ candidats().length }})</option>
            @for (g of groupesCandidats(); track g.province) {
              <optgroup [label]="g.province">
                @for (e of g.etablissements; track e.id) {
                  <option [value]="e.id" [selected]="e.id === p.choix().etablissement">{{ e.nom }} · {{ e.code }}{{ e.statut === 'Suspendu' ? ' (suspendu)' : '' }}</option>
                }
              </optgroup>
            }
          </select>
        </div>
      </div>
    </section>
  `,
})
export class FiltrePerimetreComponent {
  readonly p = inject(PerimetreComiteService);
  /** Chiffres en cours de mise à jour après un changement de périmètre. */
  chargement = input(false);

  private compter<T>(liste: T[], cle: (x: T) => string[]): Map<string, number> {
    const n = new Map<string, number>();
    for (const x of liste) for (const k of cle(x)) n.set(k, (n.get(k) ?? 0) + 1);
    return n;
  }

  provinces = computed(() => {
    const n = this.compter(this.p.etablissements(), e => [e.province]);
    return {
      avec: PROVINCES.filter(nom => n.has(nom)).map(nom => ({ nom, n: n.get(nom)! })),
      sans: PROVINCES.filter(nom => !n.has(nom)),
    };
  });

  zones = computed(() => {
    const province = this.p.choix().province;
    const referentiel = [...zonesDeProvince(province)].sort((a, b) => a.localeCompare(b, 'fr'));
    const n = this.compter(this.p.etablissements().filter(e => e.province === province), zonesDe);
    return {
      nombre: referentiel.length,
      avec: referentiel.filter(z => n.has(z)).map(nom => ({ nom, n: n.get(nom)! })),
      sans: referentiel.filter(z => !n.has(z)),
    };
  });

  /** Établissements proposés : ceux de la province et de la zone choisies. */
  candidats = computed(() => {
    const { province, zone } = this.p.choix();
    return this.p.etablissements()
      .filter(e => (!province || e.province === province) && (!zone || zonesDe(e).includes(zone)))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  groupesCandidats = computed(() => {
    const groupes = new Map<string, EtablissementPerimetre[]>();
    for (const e of this.candidats()) groupes.set(e.province, [...(groupes.get(e.province) ?? []), e]);
    return [...groupes].sort(([a], [b]) => a.localeCompare(b, 'fr')).map(([province, etablissements]) => ({ province, etablissements }));
  });

  resume = computed(() => {
    const l = this.p.retenus();
    const provinces = new Set(l.map(e => e.province)).size;
    const zones = new Set(l.flatMap(e => zonesDe(e).map(z => `${e.province}|${z}`))).size;
    if (!this.p.etablissements().length) return '';
    if (this.p.choix().etablissement) return `${zones} zone${zones > 1 ? 's' : ''} de santé couverte${zones > 1 ? 's' : ''}`;
    return [pluriel(l.length, 'établissement'), pluriel(zones, 'zone'), ...(this.p.choix().province ? [] : [pluriel(provinces, 'province')])].join(' · ');
  });

  /** Clic sur un niveau du fil d'Ariane : on garde ce niveau et on retire les plus précis. */
  remonterA(niveau: 'province' | 'zone' | 'etablissement'): void {
    if (niveau === 'province') this.p.definir({ zone: '', etablissement: '' });
    else if (niveau === 'zone') this.p.definir({ etablissement: '' });
  }
}
