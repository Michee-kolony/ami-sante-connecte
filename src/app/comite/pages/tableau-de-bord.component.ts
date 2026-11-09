import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_COMITE, ComiteSessionService } from '../comite-session.service';
import { StatistiquesEnfants, StatistiquesPatientes, StatistiquesService } from '../../admin/data/statistiques.service';
import { messageErreur } from '../../admin/data/session.service';
import { SyntheseAmiComponent } from '../../admin/components/synthese-ami.component';
import { IndicateursModulesComponent } from '../../admin/components/indicateurs-modules.component';
import { CarteRdcComponent } from '../../admin/components/carte-rdc.component';
import { AnalysePersonnelComponent, SoignantAnalyse } from '../components/analyse-personnel.component';

/** Totaux enregistrés par établissement (GET /comite/statistiques/etablissements). */
interface LigneEtablissement {
  id: string; code: string; nom: string; type: string; province: string; statut: 'Actif' | 'Suspendu';
  soignants: number; medecinChef: boolean; patientes: number; grossessesEnCours: number;
  consultations: number; accouchements: number; enfants: number; urgences: number;
}
interface TotauxEtablissements {
  genereLe: string;
  totaux: {
    etablissements: number; actifs: number; provinces: number; sansMedecinChef: number; soignants: number;
    patientes: number; grossessesEnCours: number; consultations: number; accouchements: number; enfants: number; urgences: number;
  };
  etablissements: LigneEtablissement[];
}

type Colonne = keyof Pick<LigneEtablissement, 'patientes' | 'grossessesEnCours' | 'consultations' | 'accouchements' | 'enfants' | 'urgences' | 'soignants'>;

/**
 * Tableau de bord du comité de pilotage : mêmes indicateurs que celui d'un établissement, mais
 * consolidés sur tous les établissements, plus la comparaison établissement par établissement.
 */
@Component({
  selector: 'app-comite-tableau-de-bord',
  standalone: true,
  imports: [RouterLink, SyntheseAmiComponent, IndicateursModulesComponent, CarteRdcComponent, AnalysePersonnelComponent],
  template: `
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ dateDuJour }}</p>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Bonjour {{ session.membre()?.prenom }}, voici la vue globale</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Total de tout ce que les établissements raccordés ont enregistré. Agrégats seulement : aucune patiente n’est nommée.</p>
        </div>
        <a routerLink="/comite/etablissements" class="btn-primary"><i class="fa-solid fa-hospital"></i> Gérer les établissements</a>
      </div>

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="charger()">Réessayer</button>
        </div>
      }

      <!-- Chiffres clés -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <!-- Comparaison par établissement -->
      <div class="card overflow-hidden">
        <div class="card-header flex-wrap">
          <h2 class="card-title"><i class="fa-solid fa-table-list text-brand-600 dark:text-brand-400"></i> Activité par établissement</h2>
          <input type="search" class="input max-w-xs py-1.5" placeholder="Rechercher un établissement…" [value]="recherche()" (input)="recherche.set($any($event.target).value)">
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <thead class="bg-slate-50/70 dark:bg-slate-800/50">
              <tr>
                <th class="table-th">Établissement</th>
                @for (c of colonnes; track c.cle) {
                  <th class="table-th cursor-pointer select-none text-right" (click)="trier(c.cle)" [attr.aria-sort]="tri() === c.cle ? 'descending' : null">
                    {{ c.libelle }} @if (tri() === c.cle) { <i class="fa-solid fa-arrow-down-wide-short ml-1 text-brand-600"></i> }
                  </th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @if (attente()) {
                @for (i of [1, 2, 3]; track i) { <tr aria-hidden="true"><td colspan="8" class="table-td"><div class="skeleton h-4 w-full"></div></td></tr> }
              }
              @for (l of lignes(); track l.id) {
                <tr class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td class="table-td">
                    <p class="font-medium text-slate-900 dark:text-white">{{ l.nom }}
                      @if (l.statut === 'Suspendu') { <span class="badge ml-1 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">Suspendu</span> }
                      @if (!l.medecinChef) { <span class="badge ml-1 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Sans médecin chef</span> }
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ l.code }}</span> · {{ l.province }}</p>
                  </td>
                  @for (c of colonnes; track c.cle) {
                    <td class="table-td text-right tabular-nums" [class]="l[c.cle] ? 'text-slate-900 dark:text-white' : 'text-slate-400'">{{ l[c.cle] }}</td>
                  }
                </tr>
              } @empty {
                @if (!attente()) {
                  <tr><td colspan="8" class="table-td py-8 text-center text-slate-500 dark:text-slate-400">Aucun établissement. <a routerLink="/comite/etablissements" class="font-semibold text-brand-700 underline dark:text-brand-300">Enregistrer le premier</a>.</td></tr>
                }
              }
            </tbody>
            @if (donnees(); as d) {
              <tfoot class="bg-slate-50/70 font-semibold dark:bg-slate-800/50">
                <tr>
                  <td class="table-td text-slate-900 dark:text-white">Total ({{ d.totaux.etablissements }})</td>
                  @for (c of colonnes; track c.cle) {
                    <td class="table-td text-right tabular-nums text-slate-900 dark:text-white">{{ d.totaux[c.cle] }}</td>
                  }
                </tr>
              </tfoot>
            }
          </table>
        </div>
        <p class="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">Un soignant qui exerce dans plusieurs établissements figure sur chaque ligne, mais n’est compté qu’une fois dans le total.</p>
      </div>

      <!-- Analyse de tout le personnel soignant (graphiques) -->
      <app-analyse-personnel class="block pt-2" [soignants]="soignants()" [chargement]="!soignantsRecus()" />

      <!-- Indicateurs détaillés : mêmes calculs que le tableau de bord d'un établissement, sur tous les établissements -->
      <div class="pt-2">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Indicateurs consolidés</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Suivi prénatal, accouchement, vaccination et relance communautaire, tous établissements confondus.</p>
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
  private http = inject(HttpClient);
  private stats = inject(StatistiquesService);

  donnees = signal<TotauxEtablissements | null>(null);
  patientes = signal<StatistiquesPatientes | null>(null);
  soignants = signal<SoignantAnalyse[]>([]);
  soignantsRecus = signal(false);
  enfants = signal<StatistiquesEnfants | null>(null);
  erreur = signal('');
  attente = computed(() => !this.donnees() && !this.erreur());
  recherche = signal('');
  tri = signal<Colonne>('patientes');

  readonly colonnes: { cle: Colonne; libelle: string }[] = [
    { cle: 'soignants', libelle: 'Soignants' },
    { cle: 'patientes', libelle: 'Patientes' },
    { cle: 'grossessesEnCours', libelle: 'Grossesses en cours' },
    { cle: 'consultations', libelle: 'CPN' },
    { cle: 'accouchements', libelle: 'Accouchements' },
    { cle: 'enfants', libelle: 'Enfants' },
    { cle: 'urgences', libelle: 'Urgences' },
  ];

  readonly dateDuJour = (() => {
    const t = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kinshasa' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  constructor() {
    this.charger();
  }

  charger(): void {
    this.erreur.set('');
    firstValueFrom(this.http.get<TotauxEtablissements>(`${API_COMITE}/statistiques/etablissements`))
      .then(d => this.donnees.set(d))
      .catch(err => this.erreur.set(messageErreur(err)));
    this.stats.patientes().then(p => this.patientes.set(p)).catch(() => {});
    this.stats.enfants().then(e => this.enfants.set(e)).catch(() => {});
    firstValueFrom(this.http.get<SoignantAnalyse[]>(`${API_COMITE}/soignants`))
      .then(l => { this.soignants.set(l); this.soignantsRecus.set(true); })
      .catch(() => this.soignantsRecus.set(true));
  }

  trier(cle: Colonne): void {
    this.tri.set(cle);
  }

  lignes = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const cle = this.tri();
    return (this.donnees()?.etablissements ?? [])
      .filter(l => !q || `${l.nom} ${l.code} ${l.province}`.toLowerCase().includes(q))
      .sort((a, b) => b[cle] - a[cle] || a.nom.localeCompare(b.nom, 'fr'));
  });

  kpis = computed(() => {
    const t = this.donnees()?.totaux;
    const p = this.patientes()?.totaux;
    const e = this.enfants()?.totaux;
    const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    return [
      {
        label: 'Établissements sanitaires', valeur: t?.etablissements ?? 0, icone: 'fa-hospital',
        sous: t ? `${pluriel(t.actifs, 'actif')} · ${pluriel(t.provinces, 'province')}${t.sansMedecinChef ? ` · ${t.sansMedecinChef} sans médecin chef` : ''}` : '',
        couleur: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      },
      {
        label: 'Personnel soignant', valeur: t?.soignants ?? 0, icone: 'fa-user-doctor',
        sous: 'comptes actifs, tous établissements',
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
