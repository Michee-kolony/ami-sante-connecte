import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HorsLigneService } from '../data/hors-ligne/hors-ligne.service';
import { dateHeureChiffres, jourChiffres } from '../data/format';
import { ModuleSynthese, SyntheseEtatService } from '../data/statistiques.service';
import { fractionIndicateur, valeurIndicateur } from './synthese-ami.component';

const ONGLETS: { code: ModuleSynthese; libelle: string; icone: string }[] = [
  { code: 'dossier', libelle: 'Dossier unique', icone: 'fa-id-card' },
  { code: 'cpn', libelle: 'CPN', icone: 'fa-person-pregnant' },
  { code: 'accouchement', libelle: 'Accouchement et nouveau-né', icone: 'fa-baby-carriage' },
  { code: 'vaccination', libelle: 'Vaccination / PEV', icone: 'fa-syringe' },
  { code: 'relance', libelle: 'Relance RECO', icone: 'fa-people-arrows' },
  { code: 'alertes', libelle: 'Rendez-vous et alertes', icone: 'fa-bell' },
];

/**
 * Indicateurs détaillés par module (sections 5 à 11 du cahier), qualité des données (13) et
 * pied de page : dernière mise à jour, synchronisation, source et version des définitions.
 */
@Component({
  selector: 'app-indicateurs-modules',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="space-y-6" aria-label="Indicateurs par module">
      <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 pt-2">
        <div class="min-w-0">
          <h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Indicateurs par module</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Valeur, numérateur / dénominateur et formule de chaque indicateur{{ s() ? ' · ' + s()!.periode.libelle.toLowerCase() + ' (' + jour(s()!.periode.du) + ' – ' + jour(s()!.periode.au) + ')' : '' }}.</p>
        </div>
      </div>

      <div class="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        @for (o of onglets; track o.code) {
          <button type="button" role="tab" class="onglet" [class.onglet-actif]="onglet() === o.code" [attr.aria-selected]="onglet() === o.code" (click)="onglet.set(o.code)">
            <i class="fa-solid {{ o.icone }} text-xs"></i>{{ o.libelle }}
          </button>
        }
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @if (!s() && !etat.erreur()) {
          @for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="card h-36 p-5" aria-hidden="true"><div class="skeleton h-4 w-32"></div><div class="skeleton mt-4 h-8 w-20"></div><div class="skeleton mt-3 h-3 w-full"></div></div> }
        }
        @for (i of indicateurs(); track i.code) {
          <div class="card flex flex-col p-5">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ i.libelle }}</p>
              <span class="font-mono text-[10px] text-slate-400">{{ i.code }}</span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <p class="text-2xl font-bold tracking-tight tabular-nums" [class]="i.valeur == null ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'">{{ valeur(i) }}</p>
              @if (fraction(i)) { <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">{{ fraction(i) }}</span> }
            </div>
            @if (i.unite === '%' && i.valeur != null) {
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-brand-600 dark:bg-brand-400" [style.width.%]="i.valeur"></div></div>
            }
            @if (i.detail) { <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ i.detail }}</p> }
            <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ i.formule }}</p>
            <div class="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-[11px]">
              <span class="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ i.instantane ? 'Instantané' : 'Réf. : ' + i.reference }}</span>
              <span class="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ i.source }}</span>
              @if (i.aValider) { <span class="badge bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"><i class="fa-solid fa-flask text-[9px]"></i> Règle à valider</span> }
              @if (i.lien) { <a [routerLink]="i.lien" class="ml-auto font-semibold text-brand-600 hover:text-brand-800 dark:text-brand-400">Ouvrir la liste <i class="fa-solid fa-arrow-right"></i></a> }
            </div>
          </div>
        }
      </div>

      @if (onglet() === 'alertes' && s()?.alertesParType?.length) {
        <div class="card">
          <div class="card-header"><h3 class="card-title"><i class="fa-solid fa-bell text-amber-500"></i> Alertes ouvertes par type</h3></div>
          <ul class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (a of s()!.alertesParType; track a.type) {
              <li class="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"><span class="text-slate-700 dark:text-slate-200">{{ a.libelle }}</span><strong class="tabular-nums text-slate-900 dark:text-white">{{ a.ouvertes }}</strong></li>
            }
          </ul>
        </div>
      }

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Références et contre-références (section 11) -->
        <div class="card">
          <div class="card-header"><h3 class="card-title"><i class="fa-solid fa-route text-sky-500"></i> Références</h3><span class="text-xs text-slate-500 dark:text-slate-400">Période</span></div>
          @if (s(); as d) {
            <dl class="grid grid-cols-2 gap-px bg-slate-100 text-sm dark:bg-slate-800">
              <div class="bg-white p-4 dark:bg-slate-900"><dt class="text-xs text-slate-500">Références CPN émises</dt><dd class="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{{ d.references.cpnEmises }}</dd></div>
              <div class="bg-white p-4 dark:bg-slate-900"><dt class="text-xs text-slate-500">Évacuations obstétricales</dt><dd class="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{{ d.references.evacuationsObstetricales }}</dd></div>
              <div class="bg-white p-4 dark:bg-slate-900"><dt class="text-xs text-slate-500">Orientations communautaires abouties</dt><dd class="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{{ d.references.tauxAboutissement == null ? 'N/A' : d.references.tauxAboutissement + ' %' }} <span class="text-xs font-normal text-slate-500">{{ d.references.communautairesAbouties }} / {{ d.references.communautairesEmises }}</span></dd></div>
              <div class="bg-white p-4 dark:bg-slate-900"><dt class="text-xs text-slate-500">Délai médian orientation → prise en charge</dt><dd class="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{{ d.references.delaiMedianJours == null ? 'N/A' : d.references.delaiMedianJours + ' j' }}</dd></div>
            </dl>
            <p class="px-5 py-2.5 text-[11px] text-slate-400">Réception et contre-référence non encore enregistrées dans le prototype.</p>
          } @else { <div class="skeleton m-5 h-24"></div> }
        </div>

        <!-- Qualité des données (section 13) -->
        <div class="card">
          <div class="card-header"><h3 class="card-title"><i class="fa-solid fa-shield-halved text-violet-500"></i> Qualité des données</h3><a routerLink="/admin/synchronisation" class="text-xs font-semibold text-brand-600 dark:text-brand-400">Synchronisation</a></div>
          @if (s(); as d) {
            <ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              @for (q of qualite(); track q.libelle) {
                <li>
                  <a [routerLink]="q.lien" class="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <span class="text-slate-700 dark:text-slate-200"><i class="fa-solid {{ q.icone }} mr-2 w-4 text-center text-slate-400"></i>{{ q.libelle }}</span>
                    <strong class="tabular-nums" [class]="q.n ? 'text-amber-600 dark:text-amber-400' : 'text-accent-600 dark:text-accent-400'">{{ q.n }}</strong>
                  </a>
                </li>
              }
            </ul>
          } @else { <div class="skeleton m-5 h-24"></div> }
        </div>
      </div>

      <!-- Pied : mise à jour, synchronisation, source et version des définitions -->
      @if (s(); as d) {
        <footer class="rounded-2xl border border-dashed border-slate-300 px-5 py-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <span><i class="fa-regular fa-clock mr-1"></i>Dernière mise à jour : {{ dateHeure(d.genereLe) }}</span>
            <span><i class="fa-solid fa-rotate mr-1"></i>Synchronisation : {{ horsLigne.enLigne() ? (horsLigne.enAttente() ? horsLigne.enAttente() + ' saisie(s) en attente' : 'à jour') : 'hors ligne — chiffres possiblement incomplets' }}</span>
            <span><i class="fa-solid fa-database mr-1"></i>Source : dossiers AMI Santé Connect (serveur)</span>
            <span><i class="fa-solid fa-code-branch mr-1"></i>Définitions : version {{ d.versionRegles }}</span>
          </div>
          <p class="mt-2">Les indicateurs marqués « à valider » reposent sur des règles proposées (dénominateurs officiels, définitions PEV, RAC/ARC/RPC/IRC/TCC) : ils ne constituent pas des indicateurs officiels avant validation par les responsables métier.</p>
          <details class="mt-2">
            <summary class="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Données ou événements manquants dans le prototype ({{ d.donneesManquantes.length }})</summary>
            <ul class="mt-1.5 list-disc space-y-0.5 pl-5">
              @for (m of d.donneesManquantes; track m) { <li>{{ m }}</li> }
            </ul>
          </details>
        </footer>
      }
    </section>
  `,
})
export class IndicateursModulesComponent {
  etat = inject(SyntheseEtatService);
  horsLigne = inject(HorsLigneService);
  readonly onglets = ONGLETS;
  onglet = signal<ModuleSynthese>('cpn');

  s = computed(() => this.etat.donnees());
  indicateurs = computed(() => this.s()?.modules[this.onglet()] ?? []);

  qualite = computed(() => {
    const q = this.s()?.qualite;
    if (!q) return [];
    return [
      { libelle: 'Dossiers incomplets', n: q.dossiersIncomplets, icone: 'fa-id-card', lien: '/admin/patientes' },
      { libelle: 'Doublons présumés (arbitrage humain)', n: q.doublonsPresumes, icone: 'fa-clone', lien: '/admin/doublons' },
      { libelle: 'Consultations CPN incomplètes (période)', n: q.consultationsIncompletes, icone: 'fa-stethoscope', lien: '/admin/patientes' },
      { libelle: 'Doses incohérentes (date ou répétition)', n: q.dosesIncoherentes, icone: 'fa-syringe', lien: '/admin/enfants' },
      { libelle: 'Accouchements sans nouveau-né lié', n: q.accouchementsSansNouveauNe, icone: 'fa-link-slash', lien: '/admin/enfants' },
      { libelle: 'Conflits de synchronisation (relance)', n: q.conflitsRelance, icone: 'fa-code-merge', lien: '/admin/relance' },
    ];
  });

  valeur = valeurIndicateur;
  fraction = fractionIndicateur;
  jour = jourChiffres;
  dateHeure = dateHeureChiffres;
}
