import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_COMITE } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';

/** Relais communautaire tel que renvoyé au comité (GET /comite/recos). */
interface RecoComite {
  id: string; matricule: string; prenom: string; nom: string; postnom: string; sexe: 'F' | 'M';
  telephone: string; photo: string | null; aireSante: string; zones: string[];
  statut: 'Actif' | 'Suspendu'; derniereConnexion: string | null; derniereSynchronisation: string | null;
  doitChangerMotDePasse: boolean; creeLe: string | null; ajoutePar: { nom: string; role: string } | null;
  etablissement: { id: string; code: string; nom: string; province: string; type: string; statut: 'Actif' | 'Suspendu' | null };
  superviseur: { nom: string; role: string } | null;
  taches: { ouvertes: number; enRetard: number; total: number; terminees: number };
}

/**
 * Tous les relais communautaires (RECO) de la plateforme, avec leur structure de rattachement,
 * leur secteur et leur activité de relance. Lecture seule : chaque établissement gère ses RECO.
 */
@Component({
  selector: 'app-comite-recos',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- En-tête -->
      <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-800 via-accent-700 to-brand-700 p-6 text-white shadow-xl shadow-accent-900/20 sm:p-8">
        <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"></div>
        <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Comité de pilotage</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight">Relais communautaires (RECO)</h1>
            <p class="mt-2 text-sm leading-relaxed text-white/80">Tous les RECO inscrits dans le système, avec leur structure de rattachement, leur secteur et leurs relances. Les comptes sont gérés par les superviseurs de chaque établissement.</p>
          </div>
          <div class="flex items-end gap-6">
            <div>
              @if (attente()) { <div class="h-12 w-16 animate-pulse rounded-lg bg-white/20"></div> } @else { <p class="text-5xl font-bold tabular-nums">{{ recos().length }}</p> }
              <p class="text-sm text-white/75">RECO inscrits</p>
            </div>
            <div class="border-l border-white/20 pl-6">
              <p class="text-3xl font-bold tabular-nums">{{ etablissements().length }}</p>
              <p class="text-sm text-white/75">établissements</p>
            </div>
          </div>
        </div>
      </section>

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="charger()">Réessayer</button>
        </div>
      }

      <!-- Chiffres clés -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (k of chiffres(); track k.libelle) {
          <div class="card flex items-center gap-4 p-4">
            <span class="flex h-11 w-11 flex-none items-center justify-center rounded-xl {{ k.couleur }}"><i class="fa-solid {{ k.icone }}"></i></span>
            <div>
              @if (attente()) { <div class="skeleton h-7 w-12"></div> } @else { <p class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ k.valeur }}</p> }
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ k.libelle }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Barre d'outils -->
      <div class="card space-y-3 p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="search" class="input pl-10" placeholder="Rechercher un nom, un matricule, un quartier, un téléphone…" [value]="recherche()" (input)="recherche.set($any($event.target).value)">
          </div>
          <select class="input lg:w-72" (change)="choixEtablissement.set($any($event.target).value)" aria-label="Établissement">
            <option value="" [selected]="!filtreEtablissement()">Tous les établissements</option>
            @for (e of etablissements(); track e.id) { <option [value]="e.id" [selected]="e.id === filtreEtablissement()">{{ e.nom }} ({{ e.n }})</option> }
          </select>
          <select class="input lg:w-44" (change)="statut.set($any($event.target).value)" aria-label="Statut">
            <option value="" [selected]="!statut()">Tous les statuts</option>
            <option value="Actif" [selected]="statut() === 'Actif'">Actifs</option>
            <option value="Suspendu" [selected]="statut() === 'Suspendu'">Suspendus</option>
          </select>
          <label class="flex flex-none cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600" [checked]="retardSeulement()" (change)="retardSeulement.set($any($event.target).checked)">
            Avec relances en retard
          </label>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400"><b class="text-slate-900 dark:text-white">{{ filtres().length }}</b> RECO sur {{ recos().length }}</span>
          @if (filtreActif()) {
            <button type="button" class="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300" (click)="effacerFiltres()"><i class="fa-solid fa-xmark mr-1"></i>Effacer les filtres</button>
          }
        </div>
      </div>

      <!-- Liste -->
      @if (attente()) {
        <div class="space-y-2.5">
          @for (i of [1, 2, 3, 4, 5]; track i) { <div class="card h-[5.5rem] p-3"><div class="skeleton h-full w-full"></div></div> }
        </div>
      } @else if (!filtres().length) {
        <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800"><i class="fa-solid fa-people-arrows"></i></span>
          <p class="font-medium text-slate-900 dark:text-white">{{ recos().length ? 'Aucun RECO ne correspond à ces critères.' : 'Aucun RECO n’est encore inscrit dans le système.' }}</p>
          @if (filtreActif()) { <button type="button" class="btn-secondary" (click)="effacerFiltres()">Effacer les filtres</button> }
        </div>
      } @else {
        <div class="space-y-2.5">
          @for (r of filtres(); track r.id) {
            <article class="card group flex h-[5.5rem] cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" (click)="fiche.set(r)" (keydown.enter)="fiche.set(r)" tabindex="0" [attr.aria-label]="'Voir la fiche de ' + r.prenom + ' ' + r.nom">
              <div class="relative w-20 flex-none overflow-hidden sm:w-24">
                @if (r.photo) {
                  <img [src]="r.photo" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105">
                } @else {
                  <span class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-100 to-accent-200 text-2xl font-bold text-accent-800 dark:from-accent-500/30 dark:to-accent-600/30 dark:text-accent-100">{{ r.prenom.charAt(0) }}{{ r.nom.charAt(0) }}</span>
                }
                <span class="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-accent-500 to-accent-700"></span>
              </div>

              <div class="grid min-w-0 flex-1 items-center gap-x-5 gap-y-1 px-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto]">
                <!-- Identité -->
                <div class="min-w-0">
                  <h3 class="truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{{ r.prenom }} {{ r.nom }} {{ r.postnom }}</h3>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ r.matricule }}</span> · {{ r.telephone }}</p>
                </div>
                <!-- Structure -->
                <div class="hidden min-w-0 sm:block">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100" [title]="r.etablissement.nom"><i class="fa-solid fa-hospital mr-1.5 text-xs text-slate-400"></i>{{ r.etablissement.nom }}</p>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ r.aireSante ? 'Aire de santé ' + r.aireSante : r.etablissement.province }}</p>
                </div>
                <!-- Secteur -->
                <div class="hidden min-w-0 lg:block">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Secteur</p>
                  <p class="truncate text-sm text-slate-700 dark:text-slate-200" [title]="r.zones.join(', ')">{{ r.zones.length ? r.zones.slice(0, 3).join(', ') : 'Non défini' }}@if (r.zones.length > 3) { <span class="text-xs text-slate-500"> +{{ r.zones.length - 3 }}</span> }</p>
                </div>
                <!-- Relances -->
                <div class="hidden lg:block">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Relances</p>
                  <p class="text-sm text-slate-700 dark:text-slate-200"><b class="tabular-nums">{{ r.taches.ouvertes }}</b> ouverte(s)
                    @if (r.taches.enRetard) { <span class="ml-1 rounded-full bg-rose-50 px-1.5 py-px text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{{ r.taches.enRetard }} en retard</span> }
                  </p>
                </div>
                <!-- Statut -->
                <div class="hidden items-center gap-3 lg:flex">
                  <div class="text-right">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold" [class]="r.statut === 'Actif' ? 'text-accent-700 dark:text-accent-300' : 'text-rose-700 dark:text-rose-300'">
                      <span class="h-1.5 w-1.5 rounded-full" [class]="r.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>{{ r.statut }}
                    </span>
                    <p class="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">{{ r.derniereSynchronisation ? 'Synchro ' + (r.derniereSynchronisation | date: 'dd/MM/yy') : (r.derniereConnexion ? 'Vu le ' + (r.derniereConnexion | date: 'dd/MM/yy') : 'Jamais connecté') }}</p>
                  </div>
                  <a [href]="'tel:' + r.telephone.split(' ').join('')" (click)="$event.stopPropagation()" class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-accent-600 hover:text-white dark:bg-slate-800 dark:text-slate-300" [title]="'Appeler ' + r.telephone"><i class="fa-solid fa-phone text-xs"></i></a>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>

    <!-- Fiche du RECO -->
    @if (fiche(); as r) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-fiche-reco" (keydown.escape)="fiche.set(null)">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="fiche.set(null)"></div>
        <div class="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
          <div class="relative h-32 flex-none bg-gradient-to-br from-accent-600 to-brand-700">
            <button type="button" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30" (click)="fiche.set(null)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="relative z-10 px-6">
            <div class="-mt-14 flex items-end gap-4">
              @if (r.photo) {
                <img [src]="r.photo" alt="" class="h-28 w-28 rounded-3xl object-cover shadow-lg ring-4 ring-white dark:ring-slate-900">
              } @else {
                <span class="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-100 to-accent-200 text-3xl font-bold text-accent-800 shadow-lg ring-4 ring-white dark:from-accent-500/30 dark:to-accent-600/30 dark:text-accent-100 dark:ring-slate-900">{{ r.prenom.charAt(0) }}{{ r.nom.charAt(0) }}</span>
              }
              <span class="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="r.statut === 'Actif' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'">
                <span class="h-1.5 w-1.5 rounded-full" [class]="r.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>Compte {{ r.statut === 'Actif' ? 'actif' : 'suspendu' }}
              </span>
            </div>
            <h2 id="titre-fiche-reco" class="mt-4 text-xl font-bold text-slate-900 dark:text-white">{{ r.prenom }} {{ r.nom }} {{ r.postnom }}</h2>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400"><span class="font-mono">{{ r.matricule }}</span> · Relais communautaire · {{ r.sexe === 'F' ? 'Femme' : 'Homme' }}</p>
            <a [href]="'tel:' + r.telephone.split(' ').join('')" class="btn-secondary mt-4 w-full justify-center"><i class="fa-solid fa-phone"></i> Appeler {{ r.telephone }}</a>
          </div>

          <div class="space-y-6 p-6">
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-hospital mr-1"></i> Structure de rattachement</h3>
              <div class="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <span class="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-solid fa-hospital"></i></span>
                <div class="min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white">{{ r.etablissement.nom }}
                    @if (r.etablissement.statut === 'Suspendu') { <span class="badge ml-1 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">Suspendu</span> }
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">@if (r.etablissement.code) {<span class="font-mono">{{ r.etablissement.code }}</span> · }{{ r.etablissement.type }} · {{ r.etablissement.province }}</p>
                  @if (r.aireSante) { <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Aire de santé : {{ r.aireSante }}</p> }
                </div>
              </div>
              <p class="mt-3 text-sm text-slate-600 dark:text-slate-300"><i class="fa-solid fa-user-tie mr-1.5 text-slate-400"></i>Superviseur : <b class="font-medium text-slate-900 dark:text-white">{{ r.superviseur ? r.superviseur.nom : 'Non désigné' }}</b>@if (r.superviseur) { <span class="text-xs text-slate-500"> · {{ r.superviseur.role }}</span> }</p>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-map-location-dot mr-1"></i> Secteur couvert</h3>
              <div class="flex flex-wrap gap-1.5">
                @for (z of r.zones; track z) { <span class="badge bg-accent-50 text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ z }}</span> }
                @empty { <p class="text-sm text-slate-500 dark:text-slate-400">Aucun quartier défini.</p> }
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-people-arrows mr-1"></i> Relances</h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">En cours</dt><dd class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ r.taches.ouvertes }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">En retard</dt><dd class="text-xl font-bold tabular-nums" [class]="r.taches.enRetard ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'">{{ r.taches.enRetard }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Terminées</dt><dd class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ r.taches.terminees }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Total reçu</dt><dd class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ r.taches.total }}</dd></div>
              </dl>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-shield-halved mr-1"></i> Compte</h3>
              <dl class="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Dernière connexion</dt><dd class="text-right text-slate-900 dark:text-white">{{ r.derniereConnexion ? (r.derniereConnexion | date: 'dd/MM/yyyy HH:mm') : 'Jamais' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Dernière synchronisation</dt><dd class="text-right text-slate-900 dark:text-white">{{ r.derniereSynchronisation ? (r.derniereSynchronisation | date: 'dd/MM/yyyy HH:mm') : 'Jamais' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Mot de passe</dt><dd class="text-right text-slate-900 dark:text-white">{{ r.doitChangerMotDePasse ? 'Temporaire (à changer)' : 'Personnel' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Inscrit le</dt><dd class="text-right text-slate-900 dark:text-white">{{ r.creeLe ? (r.creeLe | date: 'dd/MM/yyyy') : '—' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Inscrit par</dt><dd class="text-right text-slate-900 dark:text-white">{{ r.ajoutePar ? r.ajoutePar.nom : '—' }}@if (r.ajoutePar) {<span class="block text-xs text-slate-500 dark:text-slate-400">{{ r.ajoutePar.role }}</span>}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    }
  `,
})
export class ComiteRecosComponent {
  private http = inject(HttpClient);
  /** Filtre initial par établissement (?etablissement=<id>). */
  etablissement = input<string>('');

  recos = signal<RecoComite[]>([]);
  recu = signal(false);
  erreur = signal('');
  attente = computed(() => !this.recu() && !this.erreur());
  fiche = signal<RecoComite | null>(null);

  recherche = signal('');
  statut = signal<'' | 'Actif' | 'Suspendu'>('');
  retardSeulement = signal(false);
  choixEtablissement = signal<string | null>(null);
  filtreEtablissement = computed(() => this.choixEtablissement() ?? this.etablissement() ?? '');
  filtreActif = computed(() => !!(this.recherche().trim() || this.statut() || this.retardSeulement() || this.filtreEtablissement()));

  constructor() {
    this.charger();
  }

  charger(): void {
    this.erreur.set('');
    firstValueFrom(this.http.get<RecoComite[]>(`${API_COMITE}/recos`))
      .then(l => { this.recos.set(l); this.recu.set(true); })
      .catch(err => this.erreur.set(messageErreur(err)));
  }

  effacerFiltres(): void {
    this.recherche.set('');
    this.statut.set('');
    this.retardSeulement.set(false);
    this.choixEtablissement.set('');
  }

  etablissements = computed(() => {
    const m = new Map<string, { id: string; nom: string; n: number }>();
    for (const r of this.recos()) {
      const e = m.get(r.etablissement.id) ?? { id: r.etablissement.id, nom: r.etablissement.nom, n: 0 };
      e.n++;
      m.set(r.etablissement.id, e);
    }
    return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  chiffres = computed(() => {
    const l = this.recos();
    const somme = (f: (r: RecoComite) => number) => l.reduce((t, r) => t + f(r), 0);
    return [
      { libelle: 'RECO actifs', valeur: l.filter(r => r.statut === 'Actif').length, icone: 'fa-circle-check', couleur: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' },
      { libelle: 'Relances en cours', valeur: somme(r => r.taches.ouvertes), icone: 'fa-people-arrows', couleur: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' },
      { libelle: 'Relances en retard', valeur: somme(r => r.taches.enRetard), icone: 'fa-triangle-exclamation', couleur: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
      { libelle: 'Relances terminées', valeur: somme(r => r.taches.terminees), icone: 'fa-flag-checkered', couleur: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    ];
  });

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const etab = this.filtreEtablissement();
    return this.recos().filter(r =>
      (!etab || r.etablissement.id === etab)
      && (!this.statut() || r.statut === this.statut())
      && (!this.retardSeulement() || r.taches.enRetard > 0)
      && (!q || `${r.prenom} ${r.nom} ${r.postnom} ${r.matricule} ${r.telephone} ${r.aireSante} ${r.zones.join(' ')} ${r.etablissement.nom}`.toLowerCase().includes(q)));
  });
}
