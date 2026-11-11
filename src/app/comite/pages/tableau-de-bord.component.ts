import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_COMITE, ComiteSessionService } from '../comite-session.service';
import { StatistiquesEnfants, StatistiquesPatientes, StatistiquesService } from '../../admin/data/statistiques.service';
import { messageErreur } from '../../admin/data/session.service';
import { SyntheseAmiComponent } from '../../admin/components/synthese-ami.component';
import { IndicateursModulesComponent } from '../../admin/components/indicateurs-modules.component';
import { CarteRdcComponent } from '../../admin/components/carte-rdc.component';
import { AnalysePersonnelComponent, SoignantAnalyse } from '../components/analyse-personnel.component';
import { CarteEtablissementsComponent, EtablissementCarte } from '../components/carte-etablissements.component';
import { FiltrePerimetreComponent } from '../components/filtre-perimetre.component';
import { PerimetreComiteService } from '../perimetre-comite.service';

/** Totaux enregistrés par établissement (GET /comite/statistiques/etablissements). */
interface LigneEtablissement {
  id: string; code: string; nom: string; type: string; province: string; statut: 'Actif' | 'Suspendu';
  zonesSante: string[];
  soignants: number; medecinChef: boolean; patientes: number; grossessesEnCours: number;
  consultations: number; accouchements: number; enfants: number; urgences: number;
}
interface TotauxEtablissements {
  genereLe: string;
  totaux: {
    etablissements: number; actifs: number; provinces: number; zonesSante: number; sansMedecinChef: number; soignants: number;
    patientes: number; grossessesEnCours: number; consultations: number; accouchements: number; enfants: number; urgences: number;
  };
  etablissements: LigneEtablissement[];
}

type Colonne = keyof Pick<LigneEtablissement, 'patientes' | 'grossessesEnCours' | 'consultations' | 'accouchements' | 'enfants' | 'urgences' | 'soignants'>;
type Regroupement = 'etablissement' | 'zone' | 'province';

/** Ligne du tableau d'activité : un établissement, ou la somme d'une zone de santé / d'une province. */
interface LigneActivite extends Record<Colonne, number> {
  cle: string;
  libelle: string;
  sous: string;
  etablissements: number;
  badges: { texte: string; ton: 'rose' | 'amber' }[];
  /** Descente d'un niveau au clic (null : déjà au niveau le plus précis). */
  ouvrir: (() => void) | null;
}

const COLONNES: Colonne[] = ['soignants', 'patientes', 'grossessesEnCours', 'consultations', 'accouchements', 'enfants', 'urgences'];
const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Tableau de bord du comité de pilotage : mêmes indicateurs que celui d'un établissement, sur tout
 * le système ou sur le périmètre choisi (province, zone de santé, établissement). Le périmètre est
 * gardé dans l'adresse (?province=…&zone=…&etablissement=…) : la vue se partage et survit au rechargement.
 */
@Component({
  selector: 'app-comite-tableau-de-bord',
  standalone: true,
  imports: [
    RouterLink, SyntheseAmiComponent, IndicateursModulesComponent, CarteRdcComponent, AnalysePersonnelComponent,
    CarteEtablissementsComponent, FiltrePerimetreComponent,
  ],
  template: `
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ dateDuJour }}</p>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bonjour {{ session.membre()?.prenom }}, voici {{ perimetre.actif() ? 'les chiffres de ' + perimetre.libelle() : 'la vue globale' }}
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ perimetre.actif() ? 'Activité des établissements du périmètre choisi.' : 'Total de tout ce que les établissements raccordés ont enregistré.' }}
            Agrégats seulement : aucune patiente n’est nommée.
          </p>
        </div>
        <a routerLink="/comite/etablissements" class="btn-primary flex-none"><i class="fa-solid fa-hospital"></i> Gérer les établissements</a>
      </div>

      <app-filtre-perimetre class="block" [chargement]="rechargement()" />

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="chargerIndicateurs()">Réessayer</button>
        </div>
      }

      @if (perimetreVide()) {
        <div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
          <i class="fa-solid fa-circle-info mt-0.5"></i>
          <span class="flex-1">Aucun établissement enregistré dans {{ perimetre.libelle() }} : les indicateurs ci-dessous sont à zéro.</span>
          <button type="button" class="font-semibold underline" (click)="perimetre.reinitialiser()">Revenir à la vue globale</button>
        </div>
      }

      <!-- Chiffres clés -->
      <div class="grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4" [class.opacity-60]="rechargement()" [attr.aria-busy]="rechargement()">
        @for (k of kpis(); track k.label) {
          <div class="card flex items-start gap-4 p-5">
            <span class="flex h-11 w-11 flex-none items-center justify-center rounded-xl {{ k.couleur }}"><i class="fa-solid {{ k.icone }}"></i></span>
            <div class="min-w-0">
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ k.label }}</p>
              @if (attente()) {
                <div class="skeleton mt-1 h-7 w-16"></div>
              } @else {
                <p class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ k.valeur.toLocaleString('fr-FR') }}</p>
              }
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ k.sous }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Localisation des établissements du périmètre (consultation seulement) -->
      <app-carte-etablissements class="block" [etablissements]="pointsCarte() ?? []" [chargement]="!pointsCarte()" [cadrage]="cleCadrage()" />

      <!-- Activité par établissement, par zone de santé ou par province -->
      <div class="card overflow-hidden">
        <div class="card-header flex-wrap gap-3">
          <h2 class="card-title"><i class="fa-solid fa-table-list text-brand-600 dark:text-brand-400"></i> Activité par {{ libelleRegroupement() }}</h2>
          <div class="flex flex-wrap items-center gap-2">
            <div class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Regrouper par">
              @for (r of regroupements; track r.code) {
                <button type="button" class="onglet px-3 py-1.5" [class.onglet-actif]="regroupement() === r.code"
                        [attr.aria-pressed]="regroupement() === r.code" (click)="regroupement.set(r.code)">
                  <i class="fa-solid {{ r.icone }} mr-1"></i>{{ r.libelle }}
                </button>
              }
            </div>
            <input type="search" class="input max-w-xs py-1.5" [placeholder]="'Rechercher ' + (regroupement() === 'etablissement' ? 'un établissement' : regroupement() === 'zone' ? 'une zone' : 'une province') + '…'"
                   [value]="recherche()" (input)="recherche.set($any($event.target).value)" aria-label="Rechercher dans le tableau">
          </div>
        </div>
        <div class="overflow-x-auto transition-opacity" [class.opacity-60]="rechargement()">
          <table class="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <thead class="bg-slate-50/70 dark:bg-slate-800/50">
              <tr>
                <th class="table-th">{{ entete() }}</th>
                @for (c of colonnes; track c.cle) {
                  <th class="table-th text-right" [attr.aria-sort]="tri() === c.cle ? 'descending' : null">
                    <button type="button" class="inline-flex items-center gap-1 font-semibold uppercase hover:text-brand-700 dark:hover:text-brand-300" (click)="tri.set(c.cle)">
                      {{ c.libelle }} @if (tri() === c.cle) { <i class="fa-solid fa-arrow-down-wide-short text-brand-600"></i> }
                    </button>
                  </th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @if (attente()) {
                @for (i of [1, 2, 3]; track i) { <tr aria-hidden="true"><td colspan="8" class="table-td"><div class="skeleton h-4 w-full"></div></td></tr> }
              }
              @for (l of lignes(); track l.cle) {
                <tr class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td class="table-td">
                    @if (l.ouvrir) {
                      <button type="button" class="group text-left" (click)="l.ouvrir()" [title]="'Afficher les chiffres de ' + l.libelle">
                        <span class="font-medium text-slate-900 group-hover:text-brand-700 group-hover:underline dark:text-white dark:group-hover:text-brand-300">{{ l.libelle }}</span>
                        <i class="fa-solid fa-arrow-right ml-1 text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100"></i>
                      </button>
                    } @else {
                      <span class="font-medium text-slate-900 dark:text-white">{{ l.libelle }}</span>
                    }
                    @for (b of l.badges; track b.texte) {
                      <span class="badge ml-1" [class]="b.ton === 'rose' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'">{{ b.texte }}</span>
                    }
                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ l.sous }}</p>
                  </td>
                  @for (c of colonnes; track c.cle) {
                    <td class="table-td text-right tabular-nums" [class]="l[c.cle] ? 'text-slate-900 dark:text-white' : 'text-slate-400'">{{ l[c.cle].toLocaleString('fr-FR') }}</td>
                  }
                </tr>
              } @empty {
                @if (!attente()) {
                  <tr><td colspan="8" class="table-td py-8 text-center text-slate-500 dark:text-slate-400">
                    @if (recherche()) {
                      Aucun résultat pour « {{ recherche() }} ».
                    } @else if (perimetre.actif()) {
                      Aucun établissement dans {{ perimetre.libelle() }}.
                    } @else {
                      Aucun établissement. <a routerLink="/comite/etablissements" class="font-semibold text-brand-700 underline dark:text-brand-300">Enregistrer le premier</a>.
                    }
                  </td></tr>
                }
              }
            </tbody>
            @if (donnees(); as d) {
              <tfoot class="bg-slate-50/70 font-semibold dark:bg-slate-800/50">
                <tr>
                  <td class="table-td text-slate-900 dark:text-white">Total · {{ pluriel(d.totaux.etablissements, 'établissement') }}</td>
                  @for (c of colonnes; track c.cle) {
                    <td class="table-td text-right tabular-nums text-slate-900 dark:text-white">{{ d.totaux[c.cle].toLocaleString('fr-FR') }}</td>
                  }
                </tr>
              </tfoot>
            }
          </table>
        </div>
        <p class="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {{ noteTableau() }} Un soignant qui exerce dans plusieurs établissements n’est compté qu’une fois dans le total.
        </p>
      </div>

      <!-- Analyse du personnel soignant du périmètre (graphiques) -->
      <app-analyse-personnel class="block pt-2" [soignants]="soignantsFiltres()" [chargement]="!soignantsRecus()" />

      <!-- Indicateurs détaillés : mêmes calculs que le tableau de bord d'un établissement, sur le périmètre -->
      <div class="pt-2">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Indicateurs consolidés</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Suivi prénatal, accouchement, vaccination et relance communautaire · {{ perimetre.actif() ? perimetre.libelle() : 'tous établissements confondus' }}.
        </p>
      </div>
      <app-synthese-ami class="block">
        <app-carte-rdc carteProvinces class="block" [effectifs]="patientes()?.provinces ?? null" [chargement]="!patientes()" [sansProvince]="patientes()?.sansProvince ?? 0" />
      </app-synthese-ami>
      <app-indicateurs-modules class="block" />
    </div>
  `,
})
export class ComiteTableauDeBordComponent {
  session = inject(ComiteSessionService);
  readonly perimetre = inject(PerimetreComiteService);
  private http = inject(HttpClient);
  private stats = inject(StatistiquesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  donnees = signal<TotauxEtablissements | null>(null);
  patientes = signal<StatistiquesPatientes | null>(null);
  enfants = signal<StatistiquesEnfants | null>(null);
  soignants = signal<SoignantAnalyse[]>([]);
  soignantsRecus = signal(false);
  /** Tous les établissements avec leurs coordonnées GPS et leurs photos (GET /comite/etablissements). */
  private tousEtablissements = signal<EtablissementCarte[] | null>(null);
  erreur = signal('');
  /** Chiffres en cours de recalcul après un changement de périmètre (les précédents restent affichés). */
  rechargement = signal(false);
  attente = computed(() => !this.donnees() && !this.erreur());
  recherche = signal('');
  tri = signal<Colonne>('patientes');
  regroupement = signal<Regroupement>('etablissement');
  /** Numéro de la dernière demande : une réponse arrivée après un nouveau changement est ignorée. */
  private demande = 0;

  readonly pluriel = pluriel;
  readonly colonnes: { cle: Colonne; libelle: string }[] = [
    { cle: 'soignants', libelle: 'Soignants' },
    { cle: 'patientes', libelle: 'Patientes' },
    { cle: 'grossessesEnCours', libelle: 'Grossesses en cours' },
    { cle: 'consultations', libelle: 'CPN' },
    { cle: 'accouchements', libelle: 'Accouchements' },
    { cle: 'enfants', libelle: 'Enfants' },
    { cle: 'urgences', libelle: 'Urgences' },
  ];
  readonly regroupements: { code: Regroupement; libelle: string; icone: string }[] = [
    { code: 'etablissement', libelle: 'Établissement', icone: 'fa-hospital' },
    { code: 'zone', libelle: 'Zone de santé', icone: 'fa-map-pin' },
    { code: 'province', libelle: 'Province', icone: 'fa-map' },
  ];

  readonly dateDuJour = (() => {
    const t = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kinshasa' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  constructor() {
    // Périmètre repris de l'adresse (lien partagé, page rechargée), sinon le dernier choisi.
    const q = this.route.snapshot.queryParamMap;
    if (q.has('province') || q.has('zone') || q.has('etablissement')) {
      this.perimetre.definir({ province: q.get('province') ?? '', zone: q.get('zone') ?? '', etablissement: q.get('etablissement') ?? '' });
    }

    // Listes complètes, chargées une fois et filtrées ici selon le périmètre.
    firstValueFrom(this.http.get<(EtablissementCarte & { photos?: string[]; zonesSante?: string[] })[]>(`${API_COMITE}/etablissements`))
      .then(l => {
        const liste = l.map(e => ({ ...e, photo: e.photos?.[0] ?? null }));
        this.tousEtablissements.set(liste);
        this.perimetre.etablissements.set(liste);
        // Choix venu de l'adresse remis en cohérence : établissement inconnu retiré, sa province placée.
        const { etablissement, province } = this.perimetre.choix();
        if (etablissement && !province) this.perimetre.choisirEtablissement(etablissement);
        else this.perimetre.definir({});
      })
      .catch(() => this.tousEtablissements.set([]));
    firstValueFrom(this.http.get<SoignantAnalyse[]>(`${API_COMITE}/soignants`))
      .then(l => { this.soignants.set(l); this.soignantsRecus.set(true); })
      .catch(() => this.soignantsRecus.set(true));

    // Chaque changement de périmètre : adresse mise à jour et indicateurs recalculés. La synthèse
    // et les analyses mensuelles se rechargent d'elles-mêmes (PERIMETRE_STATISTIQUES).
    effect(() => {
      const c = this.perimetre.choix();
      untracked(() => this.router.navigate([], {
        relativeTo: this.route, replaceUrl: true, queryParamsHandling: 'merge',
        queryParams: { province: c.province || null, zone: c.zone || null, etablissement: c.etablissement || null },
      }));
    });
    effect(() => {
      this.perimetre.params();
      untracked(() => this.chargerIndicateurs());
    });
  }

  chargerIndicateurs(): void {
    const n = ++this.demande;
    const aJour = () => n === this.demande;
    this.erreur.set('');
    this.rechargement.set(!!this.donnees());
    const params = this.perimetre.params();
    const tableau = firstValueFrom(this.http.get<TotauxEtablissements>(`${API_COMITE}/statistiques/etablissements`, { params }))
      .then(d => { if (aJour()) this.donnees.set(d); })
      .catch(err => { if (aJour()) this.erreur.set(messageErreur(err)); });
    const patientes = this.stats.patientes().then(p => { if (aJour()) this.patientes.set(p); }).catch(() => {});
    const enfants = this.stats.enfants().then(e => { if (aJour()) this.enfants.set(e); }).catch(() => {});
    Promise.all([tableau, patientes, enfants]).finally(() => { if (aJour()) this.rechargement.set(false); });
  }

  pointsCarte = computed(() => this.tousEtablissements()?.filter(e => this.perimetre.retient(e.id)) ?? null);
  cleCadrage = computed(() => JSON.stringify(this.perimetre.params()));

  /** Personnel affecté à au moins un établissement du périmètre. */
  soignantsFiltres = computed(() => {
    const p = this.perimetre;
    if (!p.actif()) return this.soignants();
    return this.soignants().filter(s => s.affectations.some(a => p.retient(a.etablissementId)));
  });

  /** Le périmètre ne contient aucun établissement (zone ou province sans établissement enregistré). */
  perimetreVide = computed(() => this.perimetre.actif() && this.donnees()?.totaux.etablissements === 0 && !this.rechargement());

  libelleRegroupement = computed(() => ({ etablissement: 'établissement', zone: 'zone de santé', province: 'province' })[this.regroupement()]);
  entete = computed(() => ({ etablissement: 'Établissement', zone: 'Zone de santé', province: 'Province' })[this.regroupement()]);
  noteTableau = computed(() => this.regroupement() === 'zone'
    ? 'Un établissement qui couvre plusieurs zones est compté dans chacune.'
    : this.regroupement() === 'province' ? 'Cliquez sur une province pour en voir le détail.' : '');

  /** Lignes du tableau : établissements, ou sommes par zone de santé / par province. */
  lignes = computed<LigneActivite[]>(() => {
    const source = this.donnees()?.etablissements ?? [];
    const p = this.perimetre;
    let lignes: LigneActivite[];

    if (this.regroupement() === 'etablissement') {
      lignes = source.map(l => ({
        cle: l.id, libelle: l.nom, sous: [l.code, l.province, l.zonesSante.join(', ')].filter(Boolean).join(' · '),
        etablissements: 1, ...this.valeurs([l]),
        badges: [
          ...(l.statut === 'Suspendu' ? [{ texte: 'Suspendu', ton: 'rose' as const }] : []),
          ...(!l.medecinChef ? [{ texte: 'Sans médecin chef', ton: 'amber' as const }] : []),
        ],
        ouvrir: p.choix().etablissement === l.id ? null : () => p.choisirEtablissement(l.id),
      }));
    } else {
      const parZone = this.regroupement() === 'zone';
      const groupes = new Map<string, { province: string; zone: string; membres: LigneEtablissement[] }>();
      for (const l of source) {
        const cles = parZone ? (l.zonesSante.length ? l.zonesSante : ['']) : [''];
        for (const zone of cles) {
          const cle = `${l.province}|${zone}`;
          const g = groupes.get(cle) ?? { province: l.province, zone, membres: [] };
          g.membres.push(l);
          groupes.set(cle, g);
        }
      }
      lignes = [...groupes].map(([cle, g]) => {
        const sansMedecin = g.membres.filter(m => !m.medecinChef).length;
        const auNiveau = parZone ? p.choix().zone === g.zone && !p.choix().etablissement : p.choix().province === g.province && !p.choix().zone && !p.choix().etablissement;
        return {
          cle,
          libelle: parZone ? (g.zone ? `ZS ${g.zone}` : 'Zone non renseignée') : g.province,
          sous: [parZone ? g.province : null, pluriel(g.membres.length, 'établissement')].filter(Boolean).join(' · '),
          etablissements: g.membres.length, ...this.valeurs(g.membres),
          badges: sansMedecin ? [{ texte: `${sansMedecin} sans médecin chef`, ton: 'amber' as const }] : [],
          ouvrir: auNiveau || (parZone && !g.zone) ? null
            : parZone ? () => p.definir({ province: g.province, zone: g.zone, etablissement: '' }) : () => p.choisirProvince(g.province),
        };
      });
    }

    const q = this.recherche().trim().toLowerCase();
    const cle = this.tri();
    return lignes
      .filter(l => !q || `${l.libelle} ${l.sous}`.toLowerCase().includes(q))
      .sort((a, b) => b[cle] - a[cle] || a.libelle.localeCompare(b.libelle, 'fr'));
  });

  private valeurs(membres: LigneEtablissement[]): Record<Colonne, number> {
    return Object.fromEntries(COLONNES.map(c => [c, membres.reduce((s, m) => s + m[c], 0)])) as Record<Colonne, number>;
  }

  kpis = computed(() => {
    const t = this.donnees()?.totaux;
    const p = this.patientes()?.totaux;
    const e = this.enfants()?.totaux;
    const portee = this.perimetre.actif() ? this.perimetre.libelle() : 'tous établissements';
    return [
      {
        label: 'Établissements sanitaires', valeur: t?.etablissements ?? 0, icone: 'fa-hospital',
        sous: t ? [pluriel(t.actifs, 'actif'), pluriel(t.zonesSante ?? 0, 'zone'), ...(this.perimetre.choix().province ? [] : [pluriel(t.provinces, 'province')]),
          ...(t.sansMedecinChef ? [`${t.sansMedecinChef} sans médecin chef`] : [])].join(' · ') : '',
        couleur: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      },
      {
        label: 'Personnel soignant', valeur: t?.soignants ?? 0, icone: 'fa-user-doctor',
        sous: `comptes actifs · ${portee}`,
        couleur: 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400',
      },
      {
        label: 'Patientes enregistrées', valeur: t?.patientes ?? 0, icone: 'fa-person-pregnant',
        sous: p ? `${pluriel(p.nouvellesCeMois, 'nouvelle')} ce mois` : '',
        couleur: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
      },
      {
        label: 'Grossesses en cours', valeur: t?.grossessesEnCours ?? 0, icone: 'fa-baby-carriage',
        sous: p?.grossessesARisque != null ? `dont ${p.grossessesARisque} avec facteur(s) de risque` : '',
        couleur: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
      },
      {
        label: 'Consultations prénatales', valeur: t?.consultations ?? 0, icone: 'fa-stethoscope',
        sous: p ? `${p.rdvAujourdhui} rendez-vous aujourd’hui · ${p.absences30Jours} absence(s) sur 30 j` : '',
        couleur: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      },
      {
        label: 'Accouchements', valeur: t?.accouchements ?? 0, icone: 'fa-heart-pulse',
        sous: 'enregistrés en salle de travail',
        couleur: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
      },
      {
        label: 'Enfants suivis', valeur: t?.enfants ?? 0, icone: 'fa-baby',
        sous: e ? `${pluriel(e.complets, 'complètement vacciné')} · ${e.enRetard} en retard` : '',
        couleur: 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400',
      },
      {
        label: 'Alertes urgence', valeur: t?.urgences ?? 0, icone: 'fa-truck-medical',
        sous: 'appels d’ambulance des patientes',
        couleur: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      },
    ];
  });
}
