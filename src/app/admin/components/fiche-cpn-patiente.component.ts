import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfilCpn } from '../data/patientes.service';
import { ReferentielsService } from '../data/referentiels.service';

type ListeAtcd = 'atcdMedicaux' | 'atcdGynecoChirurgicaux' | 'atcdObstetricaux';

/**
 * Saisie de la fiche CPN propre à la patiente : identité complémentaire, profil biologique et
 * antécédents à cocher (référentiel servi par le backend). Modifie l'objet `fiche` reçu.
 * `partie` permet de répartir la fiche entre les étapes d'un formulaire : 'identite', 'clinique'
 * (biologie + tous les antécédents), 'biologie', ou une seule liste d'antécédents à cocher.
 */
@Component({
  selector: 'app-fiche-cpn-patiente',
  standalone: true,
  host: { class: 'block' },
  imports: [FormsModule],
  template: `
@if (referentiels.cpn(); as r) {
  <div class="space-y-5">
    @if (voir('identite')) {
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="label" [for]="prefixe + 'ec'">État civil</label>
          <select [id]="prefixe + 'ec'" class="input" [(ngModel)]="fiche.etatCivil" [name]="prefixe + 'ec'">
            <option value="">Non renseigné</option>
            @for (v of r.ETATS_CIVILS; track v) { <option [value]="v">{{ v }}</option> }
          </select>
        </div>
        <div><label class="label" [for]="prefixe + 'occ'">Occupation</label><input [id]="prefixe + 'occ'" class="input" [(ngModel)]="fiche.occupation" [name]="prefixe + 'occ'" placeholder="ex. Commerçante"></div>
        <div><label class="label" [for]="prefixe + 'part'">Nom du partenaire</label><input [id]="prefixe + 'part'" class="input" [(ngModel)]="fiche.nomPartenaire" [name]="prefixe + 'part'"></div>
      </div>
    }

    @if (voir('biologie')) {
      <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:p-5">
        <p class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><i class="fa-solid fa-droplet text-rose-500"></i> Profil biologique</p>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label class="label text-xs" [for]="prefixe + 'gs'">Groupe sanguin</label>
            <select [id]="prefixe + 'gs'" class="input" [(ngModel)]="fiche.groupeSanguin" [name]="prefixe + 'gs'">
              <option value="">—</option>
              @for (v of r.GROUPES_SANGUINS; track v) { <option [value]="v">{{ v }}</option> }
            </select>
          </div>
          <div>
            <label class="label text-xs" [for]="prefixe + 'rh'">Rhésus</label>
            <select [id]="prefixe + 'rh'" class="input" [(ngModel)]="fiche.rhesus" [name]="prefixe + 'rh'">
              <option value="">—</option>
              @for (v of r.RHESUS; track v) { <option [value]="v">{{ v }}</option> }
            </select>
          </div>
          <div><label class="label text-xs" [for]="prefixe + 'taille'">Taille (cm)</label><input [id]="prefixe + 'taille'" type="number" min="100" max="220" class="input" [(ngModel)]="fiche.tailleCm" [name]="prefixe + 'taille'"></div>
          <div>
            <label class="label text-xs" [for]="prefixe + 'elec'">Électrophorèse Hb</label>
            <select [id]="prefixe + 'elec'" class="input" [(ngModel)]="fiche.electrophoreseHb" [name]="prefixe + 'elec'">
              <option value="">—</option>
              @for (v of r.ELECTROPHORESES; track v) { <option [value]="v">{{ v }}</option> }
            </select>
          </div>
        </div>
        @if (fiche.tailleCm != null && fiche.tailleCm < 150) {
          <p class="mt-3 text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Taille inférieure à 150 cm : penser à évaluer le bassin.</p>
        }
      </div>
    }

      @for (bloc of blocs; track bloc.k) {
        @if (voir(bloc.k)) {
        <div>
          <p class="label flex items-center gap-2"><i class="fa-solid {{ bloc.i }} text-slate-400"></i> {{ bloc.l }}</p>
          <div class="flex flex-wrap gap-2">
            @for (v of r[bloc.ref]; track v) {
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default"
                      [class]="fiche[bloc.k].includes(v) ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50'"
                      [attr.aria-pressed]="fiche[bloc.k].includes(v)" (click)="basculer(bloc.k, v)">
                @if (fiche[bloc.k].includes(v)) { <i class="fa-solid fa-check mr-1"></i> } {{ v }}
              </button>
            }
          </div>
        </div>
        }
      }

    @if (voir('atcdObstetricaux')) {
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" [for]="prefixe + 'poids'">Plus gros poids de naissance (g)</label>
          <input [id]="prefixe + 'poids'" type="number" min="300" max="7000" step="50" class="input" [(ngModel)]="fiche.plusGrosPoidsNaissanceG" [name]="prefixe + 'poids'" placeholder="ex. 3400">
        </div>
        <div>
          <label class="label" [for]="prefixe + 'dernier'">Date du dernier accouchement</label>
          <input [id]="prefixe + 'dernier'" type="date" class="input" [(ngModel)]="fiche.dernierAccouchement" [name]="prefixe + 'dernier'">
        </div>
      </div>

      @if (suggestions.length) {
        <ul class="space-y-1.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          @for (s of suggestions; track s) {
            <li class="flex flex-wrap items-center gap-2">
              <i class="fa-solid fa-lightbulb text-amber-500"></i> {{ s }} ?
              <button type="button" class="text-xs font-semibold underline" (click)="basculer('atcdObstetricaux', s)">Cocher</button>
            </li>
          }
          <li class="text-xs text-amber-700 dark:text-amber-300">Suggestions d’après les données saisies : à confirmer par le médecin.</li>
        </ul>
      }
    }
  </div>
} @else {
  <p class="text-sm text-slate-500 dark:text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Chargement de la fiche CPN…</p>
}`,
})
export class FicheCpnPatienteComponent {
  @Input({ required: true }) fiche!: ProfilCpn;
  @Input() partie: 'identite' | 'clinique' | 'tout' | 'biologie' | ListeAtcd = 'tout';
  /** Âge et parité de la patiente, pour suggérer les cases « primipare ». */
  @Input() age: number | null = null;
  @Input() parite: number | null = null;
  /** Préfixe des identifiants de champs (plusieurs fiches sur une page). */
  @Input() prefixe = 'cpn-';

  referentiels = inject(ReferentielsService);

  readonly blocs: { k: ListeAtcd; ref: 'ATCD_MEDICAUX' | 'ATCD_GYNECO_CHIRURGICAUX' | 'ATCD_OBSTETRICAUX'; l: string; i: string }[] = [
    { k: 'atcdMedicaux', ref: 'ATCD_MEDICAUX', l: 'Antécédents médicaux', i: 'fa-heart-pulse' },
    { k: 'atcdGynecoChirurgicaux', ref: 'ATCD_GYNECO_CHIRURGICAUX', l: 'Antécédents gynécologiques et chirurgicaux', i: 'fa-scissors' },
    { k: 'atcdObstetricaux', ref: 'ATCD_OBSTETRICAUX', l: 'Antécédents obstétricaux', i: 'fa-baby' },
  ];

  constructor() {
    this.referentiels.chargerCpn().catch(() => {});
  }

  /** Section affichée pour la `partie` demandée. */
  voir(section: 'identite' | 'biologie' | ListeAtcd): boolean {
    if (this.partie === 'tout' || this.partie === section) return true;
    return this.partie === 'clinique' && section !== 'identite';
  }

  basculer(liste: ListeAtcd, v: string): void {
    const l = this.fiche[liste];
    this.fiche[liste] = l.includes(v) ? l.filter(x => x !== v) : [...l, v];
  }

  /** Cases obstétricales suggérées par l'âge, la parité, le poids et l'intervalle (jamais cochées seules). */
  get suggestions(): string[] {
    const s: string[] = [];
    const primipare = this.parite === 0;
    if (primipare && this.age != null && this.age < 19) s.push('Primipare de moins de 19 ans');
    if (primipare && this.age != null && this.age > 35) s.push('Primipare de plus de 35 ans');
    if ((this.fiche.plusGrosPoidsNaissanceG ?? 0) > 4000) s.push('Enfant de plus de 4 kg');
    if (this.fiche.dernierAccouchement) {
      const mois = (Date.now() - Date.parse(this.fiche.dernierAccouchement)) / (30.44 * 86_400_000);
      if (mois >= 0 && mois < 36) s.push('Intervalle inférieur à 3 ans');
    }
    return s.filter(x => !this.fiche.atcdObstetricaux.includes(x));
  }
}
