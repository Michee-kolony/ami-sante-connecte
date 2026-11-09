import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategorieSoignant, RoleSoignant, categorieDuRole } from '../../admin/data/soignants.service';

/** Soignant tel que renvoyé au comité (GET /comite/soignants), champs utiles à l'analyse. */
export interface SoignantAnalyse {
  id: string;
  sexe: 'F' | 'M';
  role: RoleSoignant;
  specialite: string;
  statut: 'Actif' | 'Suspendu';
  derniereConnexion: string | null;
  affectations: { etablissementId: string; nom: string }[];
}

/**
 * Couleurs des catégories, validées (dataviz/validate_palette.js) en clair sur blanc et en sombre
 * sur slate-900 : bleu / violet / vert, dans cet ordre fixe. Chaque valeur est aussi écrite en clair.
 */
const COULEUR: Record<CategorieSoignant, string> = {
  Médecin: 'bg-brand-600 dark:bg-brand-400',
  Infirmier: 'bg-violet-500',
  'Sage-femme': 'bg-accent-500',
};
const LIBELLE: Record<CategorieSoignant, string> = { Médecin: 'Médecins', Infirmier: 'Infirmier·ères', 'Sage-femme': 'Sages-femmes' };
const ORDRE: CategorieSoignant[] = ['Médecin', 'Infirmier', 'Sage-femme'];
const JOUR = 86_400_000;

/**
 * Analyse de tout le personnel soignant de la plateforme, pour le tableau de bord du comité :
 * chiffres clés, répartitions (catégorie, sexe), personnel par établissement, rôles, spécialités
 * et activité des comptes. Barres en HTML : chaque valeur est écrite, une infobulle au survol.
 */
@Component({
  selector: 'app-analyse-personnel',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="space-y-5" aria-labelledby="titre-analyse-personnel">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titre-analyse-personnel" class="text-lg font-semibold text-slate-900 dark:text-white">Analyse du personnel soignant</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Tous les médecins, infirmier·ères et sages-femmes de la plateforme.</p>
        </div>
        <a routerLink="/comite/personnel" class="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">Voir la liste complète <i class="fa-solid fa-arrow-right ml-0.5 text-xs"></i></a>
      </div>

      <!-- Chiffres clés -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="card p-5">
          <p class="text-sm text-slate-500 dark:text-slate-400">Soignants enregistrés</p>
          @if (chargement()) { <div class="skeleton mt-2 h-12 w-20"></div> } @else { <p class="mt-1 text-5xl font-bold tabular-nums text-slate-900 dark:text-white">{{ total() }}</p> }
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">dans {{ nbEtablissements() }} établissement(s)</p>
        </div>
        <div class="card p-5">
          <p class="text-sm text-slate-500 dark:text-slate-400">Comptes actifs</p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ actifs() }} <span class="text-base font-medium text-slate-500 dark:text-slate-400">/ {{ total() }}</span></p>
          <!-- Jauge : même teinte, piste claire -->
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-accent-100 dark:bg-accent-500/15" role="meter" [attr.aria-valuenow]="pctActifs()" aria-valuemin="0" aria-valuemax="100" aria-label="Part des comptes actifs">
            <div class="h-full rounded-full bg-accent-600 dark:bg-accent-500" [style.width.%]="pctActifs()"></div>
          </div>
          <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{{ pctActifs() }} % · {{ total() - actifs() }} suspendu(s)</p>
        </div>
        <div class="card p-5">
          <p class="text-sm text-slate-500 dark:text-slate-400">Connectés ces 30 derniers jours</p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ actifs30() }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ pct(actifs30()) }} % du personnel utilise la plateforme</p>
        </div>
        <div class="card p-5">
          <p class="text-sm text-slate-500 dark:text-slate-400">Jamais connectés</p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ jamais() }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">comptes créés, pas encore utilisés</p>
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <!-- Répartition par catégorie : barre segmentée haute -->
        <div class="card p-5">
          <h3 class="card-title">Répartition par catégorie</h3>
          <div class="mt-4 flex h-12 gap-[2px] overflow-hidden rounded" role="img" [attr.aria-label]="resumeCategories()">
            @for (c of categories(); track c.cle) {
              @if (c.n) {
                <div class="group relative flex items-center justify-center first:rounded-l last:rounded-r {{ c.couleur }}" [style.width.%]="c.pct">
                  @if (c.pct >= 12) { <span class="text-sm font-semibold text-white">{{ c.pct }} %</span> }
                  <span class="pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">{{ c.libelle }} : {{ c.n }} ({{ c.pct }} %)</span>
                </div>
              }
            }
          </div>
          <ul class="mt-4 grid grid-cols-3 gap-3 text-sm">
            @for (c of categories(); track c.cle) {
              <li>
                <span class="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span class="h-2.5 w-2.5 rounded-sm {{ c.couleur }}"></span>{{ c.libelle }}</span>
                <span class="mt-0.5 block text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ c.n }}</span>
              </li>
            }
          </ul>
        </div>

        <!-- Répartition par sexe dans chaque catégorie -->
        <div class="card p-5">
          <h3 class="card-title">Répartition femmes / hommes</h3>
          <div class="mt-1 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-slate-700 dark:bg-slate-300"></span>Femmes</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-slate-400 dark:bg-slate-500"></span>Hommes</span>
          </div>
          <ul class="mt-4 space-y-3.5">
            @for (l of sexes(); track l.libelle) {
              <li>
                <div class="mb-1 flex justify-between text-sm"><span class="font-medium text-slate-700 dark:text-slate-200">{{ l.libelle }}</span><span class="tabular-nums text-slate-500 dark:text-slate-400">{{ l.f }} F · {{ l.m }} H</span></div>
                <div class="flex h-4 gap-[2px] overflow-hidden rounded">
                  @if (l.f) { <div class="group relative rounded-l bg-slate-700 dark:bg-slate-300" [class.rounded-r]="!l.m" [style.width.%]="l.pctF"><span class="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">{{ l.f }} femme(s) · {{ l.pctF }} %</span></div> }
                  @if (l.m) { <div class="group relative rounded-r bg-slate-400 dark:bg-slate-500" [class.rounded-l]="!l.f" [style.width.%]="100 - l.pctF"><span class="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">{{ l.m }} homme(s) · {{ 100 - l.pctF }} %</span></div> }
                  @if (!l.f && !l.m) { <div class="w-full rounded bg-slate-100 dark:bg-slate-800"></div> }
                </div>
              </li>
            }
          </ul>
        </div>
      </div>

      <!-- Personnel par établissement : barres empilées sur un axe commun -->
      <div class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="card-title">Personnel par établissement</h3>
          <div class="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
            @for (c of categories(); track c.cle) { <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm {{ c.couleur }}"></span>{{ c.libelle }}</span> }
          </div>
        </div>
        <ul class="mt-4 space-y-3">
          @for (e of parEtablissement(); track e.id) {
            <li class="grid grid-cols-[minmax(0,12rem)_1fr] items-center gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
              <span class="truncate text-sm text-slate-700 dark:text-slate-200" [title]="e.nom">{{ e.nom }}</span>
              <div class="flex items-center gap-2">
                <div class="flex h-5 gap-[2px]" [style.width.%]="e.largeur">
                  @for (s of e.segments; track s.cle; let dernier = $last) {
                    <div class="group relative h-full first:rounded-l-sm {{ s.couleur }}" [class.rounded-r]="dernier" [style.width.%]="s.pct">
                      <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">{{ e.nom }} — {{ s.libelle }} : {{ s.n }}</span>
                    </div>
                  }
                </div>
                <span class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ e.total }}</span>
              </div>
            </li>
          } @empty {
            <li class="text-sm text-slate-500 dark:text-slate-400">Aucun soignant n’est encore enregistré.</li>
          }
        </ul>
        <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">Un soignant qui exerce dans plusieurs établissements est compté dans chacun.</p>
      </div>

      <div class="grid gap-5 lg:grid-cols-3">
        <!-- Rôles : barres classées, une teinte -->
        <div class="card p-5">
          <h3 class="card-title">Fonctions</h3>
          <ul class="mt-4 space-y-2.5">
            @for (r of roles(); track r.libelle) {
              <li>
                <div class="mb-1 flex justify-between gap-2 text-sm"><span class="truncate text-slate-700 dark:text-slate-200">{{ r.libelle }}</span><span class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ r.n }}</span></div>
                <div class="h-2.5 rounded-r bg-brand-600 dark:bg-brand-400" [style.width.%]="r.pct" [title]="r.libelle + ' : ' + r.n"></div>
              </li>
            }
          </ul>
        </div>

        <!-- Spécialités : barres classées, une teinte -->
        <div class="card p-5">
          <h3 class="card-title">Spécialités les plus représentées</h3>
          <ul class="mt-4 space-y-2.5">
            @for (r of specialites(); track r.libelle) {
              <li>
                <div class="mb-1 flex justify-between gap-2 text-sm"><span class="truncate text-slate-700 dark:text-slate-200">{{ r.libelle }}</span><span class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ r.n }}</span></div>
                <div class="h-2.5 rounded-r bg-brand-600 dark:bg-brand-400" [style.width.%]="r.pct" [title]="r.libelle + ' : ' + r.n"></div>
              </li>
            }
          </ul>
        </div>

        <!-- Activité des comptes : échelle ordonnée, une teinte (récent = foncé) -->
        <div class="card p-5">
          <h3 class="card-title">Dernière connexion</h3>
          <ul class="mt-4 space-y-2.5">
            @for (a of activite(); track a.libelle) {
              <li>
                <div class="mb-1 flex justify-between gap-2 text-sm"><span class="text-slate-700 dark:text-slate-200">{{ a.libelle }}</span><span class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ a.n }} <span class="font-normal text-slate-500 dark:text-slate-400">({{ pct(a.n) }} %)</span></span></div>
                <div class="h-2.5 rounded-r {{ a.couleur }}" [style.width.%]="a.largeur" [title]="a.libelle + ' : ' + a.n"></div>
              </li>
            }
          </ul>
        </div>
      </div>
    </section>
  `,
})
export class AnalysePersonnelComponent {
  soignants = input<SoignantAnalyse[]>([]);
  chargement = input(false);

  total = computed(() => this.soignants().length);
  actifs = computed(() => this.soignants().filter(s => s.statut === 'Actif').length);
  pct = (n: number) => (this.total() ? Math.round((n / this.total()) * 100) : 0);
  pctActifs = computed(() => this.pct(this.actifs()));
  nbEtablissements = computed(() => new Set(this.soignants().flatMap(s => s.affectations.map(a => a.etablissementId))).size);
  private ageConnexion = (s: SoignantAnalyse) => (s.derniereConnexion ? (Date.now() - new Date(s.derniereConnexion).getTime()) / JOUR : null);
  actifs30 = computed(() => this.soignants().filter(s => { const j = this.ageConnexion(s); return j != null && j <= 30; }).length);
  jamais = computed(() => this.soignants().filter(s => !s.derniereConnexion).length);

  categories = computed(() => ORDRE.map(cle => {
    const n = this.soignants().filter(s => categorieDuRole(s.role) === cle).length;
    return { cle, libelle: LIBELLE[cle], n, pct: this.pct(n), couleur: COULEUR[cle] };
  }));
  resumeCategories = computed(() => this.categories().map(c => `${c.libelle} ${c.n} (${c.pct} %)`).join(', '));

  sexes = computed(() => [
    { libelle: 'Tout le personnel', liste: this.soignants() },
    ...ORDRE.map(c => ({ libelle: LIBELLE[c], liste: this.soignants().filter(s => categorieDuRole(s.role) === c) })),
  ].map(({ libelle, liste }) => {
    const f = liste.filter(s => s.sexe === 'F').length;
    const m = liste.length - f;
    return { libelle, f, m, pctF: liste.length ? Math.round((f / liste.length) * 100) : 0 };
  }));

  parEtablissement = computed(() => {
    const m = new Map<string, { id: string; nom: string; parCat: Record<CategorieSoignant, number> }>();
    for (const s of this.soignants()) {
      for (const a of s.affectations) {
        const e = m.get(a.etablissementId) ?? { id: a.etablissementId, nom: a.nom, parCat: { Médecin: 0, Infirmier: 0, 'Sage-femme': 0 } };
        e.parCat[categorieDuRole(s.role)]++;
        m.set(a.etablissementId, e);
      }
    }
    const lignes = [...m.values()].map(e => ({ ...e, total: ORDRE.reduce((t, c) => t + e.parCat[c], 0) })).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr'));
    const max = Math.max(1, ...lignes.map(l => l.total));
    return lignes.map(l => ({
      id: l.id, nom: l.nom, total: l.total,
      // Axe commun : la barre la plus longue occupe 88 % (le reste accueille le total écrit).
      largeur: (l.total / max) * 88,
      segments: ORDRE.filter(c => l.parCat[c]).map(c => ({ cle: c, libelle: LIBELLE[c], n: l.parCat[c], pct: (l.parCat[c] / l.total) * 100, couleur: COULEUR[c] })),
    }));
  });

  private classement(cle: (s: SoignantAnalyse) => string, limite: number) {
    const m = new Map<string, number>();
    for (const s of this.soignants()) m.set(cle(s), (m.get(cle(s)) ?? 0) + 1);
    const l = [...m.entries()].map(([libelle, n]) => ({ libelle, n })).sort((a, b) => b.n - a.n || a.libelle.localeCompare(b.libelle, 'fr'));
    const tete = l.slice(0, limite);
    const reste = l.slice(limite).reduce((t, x) => t + x.n, 0);
    if (reste) tete.push({ libelle: 'Autres', n: reste });
    const max = Math.max(1, ...tete.map(x => x.n));
    return tete.map(x => ({ ...x, pct: (x.n / max) * 100 }));
  }
  roles = computed(() => this.classement(s => s.role, 6));
  specialites = computed(() => this.classement(s => s.specialite || 'Non renseignée', 6));

  /** Échelle ordonnée : récent = foncé ; « jamais » hors échelle, en gris. */
  activite = computed(() => {
    const tranches = [
      { libelle: 'Moins de 7 jours', min: 0, max: 7, couleur: 'bg-brand-800 dark:bg-brand-300' },
      { libelle: '7 à 30 jours', min: 7, max: 30, couleur: 'bg-brand-600 dark:bg-brand-400' },
      { libelle: '30 à 90 jours', min: 30, max: 90, couleur: 'bg-brand-400 dark:bg-brand-600' },
      { libelle: 'Plus de 90 jours', min: 90, max: Infinity, couleur: 'bg-brand-300 dark:bg-brand-800' },
    ];
    const l = tranches.map(t => ({ libelle: t.libelle, couleur: t.couleur, n: this.soignants().filter(s => { const j = this.ageConnexion(s); return j != null && j >= t.min && j < t.max; }).length }));
    l.push({ libelle: 'Jamais connecté', couleur: 'bg-slate-300 dark:bg-slate-600', n: this.jamais() });
    const max = Math.max(1, ...l.map(x => x.n));
    return l.map(x => ({ ...x, largeur: x.n ? Math.max(2, (x.n / max) * 100) : 0 }));
  });
}
