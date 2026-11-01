import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalyseMensuelle, RouteAnalyseMensuelle, StatistiquesService, SyntheseEtatService } from '../data/statistiques.service';

const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Analyse mensuelle du tableau de bord (CPN1 à CPN4, VAT et SP…) : nombre de femmes de
 * l'établissement par ligne pour le mois choisi (en cours par défaut, mois passés consultables),
 * écart avec le mois précédent et historique des 6 mois se terminant par le mois choisi.
 * Suit les filtres province / aire de santé du bandeau de la synthèse.
 */
@Component({
  selector: 'app-analyse-mensuelle',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card">
      <div class="card-header flex-wrap gap-2">
        <h2 class="card-title"><i class="fa-solid {{ icone() }} text-brand-600 dark:text-brand-400"></i> {{ titre() }}</h2>
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" class="btn-secondary px-2.5 py-1.5" (click)="decaler(-1)" [disabled]="chargement() || !mois()" title="Mois précédent" aria-label="Mois précédent">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <input type="month" class="input w-auto py-1.5 text-sm" aria-label="Choisir le mois"
                 [max]="donnees()?.moisCourant ?? null" [ngModel]="mois()" (ngModelChange)="$event && charger($event)" />
          <button type="button" class="btn-secondary px-2.5 py-1.5" (click)="decaler(1)" [disabled]="chargement() || enCours() || !donnees()" title="Mois suivant" aria-label="Mois suivant">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
          @if (donnees() && !enCours()) {
            <button type="button" class="text-xs font-semibold text-brand-600 underline dark:text-brand-400" (click)="charger('')">Mois en cours</button>
          }
        </div>
      </div>
      <p class="px-5 pt-3 text-sm text-slate-500 dark:text-slate-400">
        {{ description() }} en <strong class="text-slate-700 dark:text-slate-200">{{ libelleMois(mois()) || 'mois en cours' }}</strong>{{ enCours() ? ' (mois en cours)' : '' }}.
      </p>
      @if (erreur()) {
        <p class="mx-5 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
          <i class="fa-solid fa-circle-exclamation mr-1"></i>{{ erreur() }}
          <button type="button" class="ml-1 font-semibold underline" (click)="charger()">Réessayer</button>
        </p>
      }
      <div class="space-y-5 p-5 transition-opacity" [class.opacity-60]="chargement()">
        @for (g of groupes(); track g.nom) {
          <section [attr.aria-label]="g.nom || titre()">
            @if (g.nom && groupes().length > 1) {
              <div class="mb-3 flex items-center gap-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ g.nom }}</h3>
                <span class="h-px flex-1 bg-slate-100 dark:bg-slate-800"></span>
              </div>
            }
            <div class="grid gap-4 sm:grid-cols-2" [class]="colonnes(g.cartes.length)">
              @for (c of g.cartes; track c.code) {
                <article class="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md
                                dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40">
                  <!-- Libellé et repère -->
                  <div class="flex items-start gap-3">
                    <span class="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      <i class="fa-solid {{ icone() }} text-sm"></i>
                    </span>
                    <div class="min-w-0">
                      <h4 class="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{{ c.libelle }}</h4>
                      @if (c.repere) {
                        <span class="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <i class="fa-regular fa-clock text-[10px]"></i>{{ c.repere }}
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Valeur du mois et variation -->
                  <div class="mt-4 flex items-end justify-between gap-2">
                    @if (chargement() && !donnees()) {
                      <div class="skeleton h-9 w-20" aria-hidden="true"></div>
                    } @else {
                      <p class="leading-none">
                        <span class="text-4xl font-bold tracking-tight tabular-nums" [class]="c.n == null ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'">{{ c.n ?? '—' }}</span>
                        <span class="ml-1 text-sm text-slate-500 dark:text-slate-400">{{ unite() }}</span>
                      </p>
                    }
                    @if (c.variation; as v) {
                      <span class="inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" [class]="v.classe" [title]="v.titre">
                        <i class="fa-solid {{ v.icone }} text-[10px]"></i>{{ v.texte }}
                      </span>
                    }
                  </div>

                  <!-- Part de la première ligne (CPN2 / CPN1…) -->
                  @if (c.largeur != null) {
                    <div class="mt-3">
                      <div class="h-1.5 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/15"><div class="h-full rounded-full bg-brand-600 dark:bg-brand-400" [style.width.%]="c.largeur"></div></div>
                      @if (c.part != null) { <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{{ c.part }} % du nombre de {{ c.reference }}</p> }
                    </div>
                  }

                  <!-- Tendance sur 6 mois : mois choisi en couleur, mois précédents atténués -->
                  @if (c.barres.length) {
                    <div class="mt-auto pt-4">
                      <div class="flex h-10 items-end gap-1" role="img" [attr.aria-label]="c.libelle + ' sur 6 mois : ' + c.resume">
                        @for (b of c.barres; track $index; let last = $last) {
                          <div class="flex h-full flex-1 items-end" [title]="b.mois + ' : ' + b.v + ' ' + unite()">
                            <div class="w-full rounded-t-[4px]" [style.height.%]="b.hauteur"
                                 [class]="last ? 'bg-brand-600 dark:bg-brand-400' : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-slate-700 dark:group-hover:bg-slate-600'"></div>
                          </div>
                        }
                      </div>
                      <div class="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                        <span>{{ c.barres[0].mois }}</span><span class="font-medium text-slate-600 dark:text-slate-300">{{ c.barres[c.barres.length - 1].mois }}</span>
                      </div>
                    </div>
                  }
                </article>
              }
            </div>
          </section>
        }
      </div>
      @if (donnees(); as d) {
        <div class="overflow-x-auto border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
          <table class="w-full text-sm">
            <caption class="mb-2 text-left text-xs text-slate-500 dark:text-slate-400">Les 6 mois jusqu’à {{ libelleMois(mois()) }} (nombre de femmes)</caption>
            <thead>
              <tr class="text-xs text-slate-500 dark:text-slate-400">
                <th class="py-1 text-left font-medium"></th>
                @for (m of d.historique.mois; track m; let last = $last) { <th class="py-1 text-right font-medium" [class.text-brand-600]="last">{{ m }}</th> }
              </tr>
            </thead>
            <tbody>
              @for (l of d.lignes; track l.code) {
                <tr class="border-t border-slate-100 dark:border-slate-800">
                  <td class="py-1.5 font-medium text-slate-700 dark:text-slate-200">{{ l.libelle }}</td>
                  @for (v of l.valeurs; track $index; let last = $last) {
                    <td class="py-1.5 text-right tabular-nums" [class]="last ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'">{{ v }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AnalyseMensuelleComponent {
  private stats = inject(StatistiquesService);
  private etat = inject(SyntheseEtatService);

  /** Route du serveur (/api/statistiques/<route>). */
  route = input.required<RouteAnalyseMensuelle>();
  titre = input.required<string>();
  icone = input('fa-chart-simple');
  /** Phrase d'introduction, complétée par « en <mois> ». */
  description = input('');
  /** Unité affichée à côté de chaque nombre. */
  unite = input('femme(s)');
  /** Barres et pourcentages rapportés à la première ligne de chaque groupe (ex. CPN2 / CPN1). */
  rapporterAuPremier = input(false);
  /** Lignes attendues avant la réponse du serveur (cartes « — »). */
  lignesAttendues = input<{ code: string; libelle: string; groupe?: string }[]>([]);

  /** Mois affiché (AAAA-MM) ; vide : mois en cours. */
  mois = signal('');
  donnees = signal<AnalyseMensuelle | null>(null);
  chargement = signal(false);
  erreur = signal<string | null>(null);
  enCours = computed(() => !!this.donnees() && this.donnees()!.mois === this.donnees()!.moisCourant);

  constructor() {
    // Rechargé quand la province ou l'aire de santé du bandeau change (le mois choisi est gardé).
    const lieu = computed(() => `${this.etat.filtres().province ?? ''}|${this.etat.filtres().aire ?? ''}`);
    effect(() => {
      lieu();
      untracked(() => this.charger());
    });
  }

  libelleMois = (cle: string) => (cle ? `${MOIS_LONGS[+cle.slice(5) - 1]} ${cle.slice(0, 4)}` : '');

  charger(mois = this.mois()): void {
    this.mois.set(mois);
    const f = this.etat.filtres();
    this.chargement.set(true);
    this.erreur.set(null);
    this.stats.analyseMensuelle(this.route(), mois, f.province, f.aire)
      .then(d => { this.donnees.set(d); this.mois.set(d.mois); })
      .catch(e => this.erreur.set(e?.error?.message ?? 'Chiffres indisponibles pour le moment.'))
      .finally(() => this.chargement.set(false));
  }

  decaler(n: number): void {
    const d = this.donnees();
    if (!this.mois() || (n > 0 && (!d || d.mois >= d.moisCourant))) return;
    const [a, m] = this.mois().split('-').map(Number);
    this.charger(new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7));
  }

  /** Cartes regroupées (VAT, SP…) ; avant la première réponse, lignes attendues sans valeur. */
  groupes = computed(() => {
    const lignes = this.donnees()?.lignes
      ?? this.lignesAttendues().map(l => ({ ...l, repere: '', n: null as number | null, precedent: null as number | null }));
    const groupes: { nom: string; cartes: ReturnType<AnalyseMensuelleComponent['carte']>[] }[] = [];
    for (const l of lignes) {
      const nom = l.groupe ?? '';
      let g = groupes.find(x => x.nom === nom);
      if (!g) groupes.push(g = { nom, cartes: [] });
      const premier = g.cartes[0];
      g.cartes.push(this.carte(l, premier ? { libelle: premier.libelle, n: premier.n } : null));
    }
    return groupes;
  });

  /** Colonnes de la grille selon le nombre de cartes du groupe. */
  colonnes(n: number): string {
    return n <= 3 ? 'lg:grid-cols-3' : n === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3 2xl:grid-cols-5';
  }

  /** Variation par rapport au mois précédent : hausse (verte), baisse (rose) ou stable (grise). */
  private variation(n: number | null, precedent: number | null) {
    if (n == null || precedent == null) return null;
    const moisPrec = this.donnees()?.historique.mois.at(-2) ?? 'mois préc.';
    const e = n - precedent;
    const titre = `${moisPrec} : ${precedent} ${this.unite()}`;
    if (e > 0) return { texte: `+${e}`, icone: 'fa-arrow-trend-up', titre, classe: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' };
    if (e < 0) return { texte: `−${-e}`, icone: 'fa-arrow-trend-down', titre, classe: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' };
    return { texte: 'Stable', icone: 'fa-equals', titre, classe: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
  }

  private carte(l: { code: string; libelle: string; repere?: string; n: number | null; precedent: number | null; valeurs?: number[] }, premier: { libelle: string; n: number | null } | null) {
    const ref = this.rapporterAuPremier() ? (premier?.n ?? l.n ?? 0) : 0;
    const valeurs = l.valeurs ?? [];
    const max = Math.max(1, ...valeurs);
    const mois = this.donnees()?.historique.mois ?? [];
    const barres = valeurs.map((v, i) => ({ v, mois: mois[i] ?? '', hauteur: v ? Math.max(8, (v / max) * 100) : 4 }));
    return {
      ...l,
      variation: this.variation(l.n, l.precedent),
      barres,
      resume: barres.map(b => `${b.mois} ${b.v}`).join(', '),
      largeur: this.rapporterAuPremier() ? (ref && l.n != null ? Math.min(100, (l.n / ref) * 100) : 0) : null,
      part: this.rapporterAuPremier() && premier && ref && l.n != null ? Math.round((l.n / ref) * 100) : null,
      reference: premier?.libelle ?? '',
    };
  }
}
