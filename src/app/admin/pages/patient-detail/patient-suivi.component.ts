import { Component, Input, OnChanges, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { agLisible, dateHeureChiffres, jourChiffres } from '../../data/format';
import { PatientesService, StatutRdv, SuiviPatiente } from '../../data/patientes.service';
import { messageErreur } from '../../data/session.service';

const ACTIFS: StatutRdv[] = ['Planifié', 'Confirmé', 'Reporté'];

/**
 * Vue « suivi » pour les infirmier·ères : identité, grossesse en cours et rendez-vous, en lecture
 * seule. Antécédents, risques, consultations et journal restent réservés aux médecins (le serveur
 * ne les envoie pas).
 */
@Component({
  selector: 'app-patient-suivi',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  template: `
<div class="mx-auto max-w-5xl space-y-6">
  <nav class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
    <a routerLink="/admin/patientes" class="hover:text-brand-700 dark:hover:text-brand-300">Patientes</a>
    <i class="fa-solid fa-chevron-right text-[9px]"></i>
    <span class="font-mono text-slate-700 dark:text-slate-200">{{ id }}</span>
  </nav>

  @if (chargement) {
    <div class="space-y-6" aria-hidden="true">
      <div class="card flex items-center gap-4 p-6"><div class="skeleton h-20 w-20 rounded-2xl"></div><div class="flex-1 space-y-2"><div class="skeleton h-6 w-56"></div><div class="skeleton h-4 w-72 max-w-full"></div></div></div>
      <div class="grid gap-6 md:grid-cols-2"><div class="card space-y-3 p-6"><div class="skeleton h-4 w-40"></div><div class="skeleton h-8 w-32"></div><div class="skeleton h-3 w-full rounded-full"></div></div><div class="card space-y-3 p-6"><div class="skeleton h-4 w-40"></div><div class="skeleton h-8 w-48"></div></div></div>
    </div>
    <p class="sr-only" role="status">Chargement du suivi…</p>
  } @else if (erreur || !suivi) {
    <div class="card flex flex-col items-center gap-3 p-10 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10"><i class="fa-solid fa-lock text-xl"></i></div>
      <p class="font-semibold text-slate-900 dark:text-white">Suivi inaccessible</p>
      <p class="max-w-md text-sm text-slate-500 dark:text-slate-400">{{ erreur || 'Patiente introuvable.' }}</p>
      <a routerLink="/admin/patientes" class="btn-secondary"><i class="fa-solid fa-arrow-left"></i> Retour</a>
    </div>
  } @else {
    @let p = suivi.patiente;
    @let g = suivi.grossesse;

    <!-- Identité -->
    <div class="card overflow-hidden">
      <div class="h-16 bg-gradient-to-r from-brand-900 via-brand-700 to-accent-600"></div>
      <div class="-mt-9 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
        <app-avatar [photo]="p.photoUrl ?? undefined" [prenom]="p.prenom || p.nom" [nomFamille]="p.nom" class="h-20 w-20 rounded-2xl text-2xl shadow-lg ring-4 ring-white dark:ring-slate-900" />
        <div class="flex-1">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{{ p.prenom }} {{ p.nom }} <span class="font-semibold text-slate-500 dark:text-slate-400">{{ p.postnom }}</span></h1>
          <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span class="font-mono font-semibold text-slate-700 dark:text-slate-200">{{ p.numero }}</span>
            @if (p.age != null) { <span><i class="fa-solid fa-cake-candles mr-1"></i>{{ p.age }} ans</span> }
            @if (p.telephone) { <a [href]="'tel:' + p.telephone.split(' ').join('')" class="hover:text-brand-700"><i class="fa-solid fa-phone mr-1"></i>{{ p.telephone }}</a> }
            @if (p.province) { <span><i class="fa-solid fa-location-dot mr-1"></i>{{ p.commune ? p.commune + ', ' : '' }}{{ p.province }}</span> }
          </div>
        </div>
        <span class="badge self-start bg-slate-100 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:self-end"><i class="fa-solid fa-eye"></i> Lecture seule</span>
      </div>
    </div>

    <div class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <i class="fa-solid fa-user-doctor mt-0.5 text-brand-600 dark:text-brand-400"></i>
      <p>Vue de suivi infirmier : grossesse en cours et rendez-vous. Les antécédents, facteurs de risque, consultations et résultats sont réservés aux médecins.</p>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Grossesse en cours -->
      <div class="card p-5 sm:p-6">
        <h2 class="card-title mb-4"><i class="fa-solid fa-person-pregnant text-accent-600 dark:text-accent-400"></i>
          @if (g) { Grossesse n° {{ g.numero }} · {{ g.statut }} } @else { Aucune grossesse en cours }
        </h2>
        @if (g) {
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Âge gestationnel</p>
              <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ ag(g.agJours) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">DPA estimée</p>
              <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ g.dpa ? jour(g.dpa) : 'À confirmer' }}</p>
            </div>
          </div>
          <div class="mt-6">
            <div class="mb-2 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400"><span>T1</span><span>T2</span><span>T3</span><span>40 SA</span></div>
            <div class="relative h-3 rounded-full bg-gradient-to-r from-brand-100 via-brand-100 to-accent-100 dark:from-brand-500/20 dark:via-brand-500/20 dark:to-accent-500/20">
              <div class="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-700 to-accent-600" [style.width.%]="progression"></div>
              <div class="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-brand-700 shadow dark:border-slate-900" [style.left.%]="progression"></div>
            </div>
          </div>
          @if (!g.datee) { <p class="mt-4 text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-circle-info mr-1"></i>Grossesse pas encore datée par un médecin.</p> }
        } @else {
          <p class="text-sm text-slate-500 dark:text-slate-400">Aucune grossesse en cours pour cette patiente.</p>
        }
        @if (suivi.etablissement; as e) {
          <p class="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><i class="fa-solid fa-hospital mr-1"></i>Suivie à {{ e.nom }} · {{ e.province }}</p>
        }
      </div>

      <!-- Prochain rendez-vous -->
      <div class="card p-5 sm:p-6">
        <h2 class="card-title mb-4"><i class="fa-solid fa-calendar-check text-accent-600 dark:text-accent-400"></i> Prochain rendez-vous</h2>
        @if (prochain; as r) {
          <p class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{{ dateHeure(r.date) }}</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ r.motif }} · <span class="badge {{ statutClass(r.statut) }}">{{ r.statut }}</span></p>
          @if (r.lieu) { <p class="mt-2 text-sm text-slate-600 dark:text-slate-300"><i class="fa-solid fa-location-dot mr-1"></i>{{ r.lieu }}</p> }
          @if (r.consignes) { <p class="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"><i class="fa-solid fa-circle-info mr-1"></i>{{ r.consignes }}</p> }
        } @else {
          <p class="text-sm text-slate-500 dark:text-slate-400">Aucun rendez-vous programmé.</p>
        }
      </div>
    </div>

    <!-- Tous les rendez-vous -->
    <div class="card overflow-hidden">
      <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-calendar-days text-brand-600 dark:text-brand-400"></i> Rendez-vous ({{ suivi.rendezVous.length }})</h2></div>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (r of suivi.rendezVous; track r.id) {
          <li class="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
            <div class="flex-1">
              <p class="font-medium text-slate-900 dark:text-white">{{ dateHeure(r.date) }} · {{ r.motif }}</p>
              @if (r.statut === 'Reporté' && r.historique.length) {
                <p class="text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Reporté{{ r.historique[r.historique.length - 1].motif ? ' — ' + r.historique[r.historique.length - 1].motif : '' }}</p>
              }
            </div>
            <span class="badge self-start sm:self-auto {{ statutClass(r.statut) }}">{{ r.statut }}</span>
          </li>
        } @empty {
          <li class="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Aucun rendez-vous.</li>
        }
      </ul>
    </div>
  }
</div>
  `,
})
export class PatientSuiviComponent implements OnChanges {
  @Input() id = '';
  private service = inject(PatientesService);
  ag = agLisible;
  jour = jourChiffres;
  dateHeure = dateHeureChiffres;

  suivi: SuiviPatiente | null = null;
  chargement = true;
  erreur = '';

  async ngOnChanges(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      this.suivi = await this.service.suivi(this.id);
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  get progression(): number {
    const j = this.suivi?.grossesse?.agJours;
    return j == null ? 0 : Math.max(0, Math.min(100, Math.round((j / 280) * 100)));
  }

  get prochain() {
    const maintenant = Date.now() - 12 * 3600000;
    return [...(this.suivi?.rendezVous ?? [])]
      .filter(r => ACTIFS.includes(r.statut) && new Date(r.date).getTime() >= maintenant)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }

  statutClass(s: StatutRdv): string {
    return {
      'Planifié': 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      'Confirmé': 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
      'Reporté': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      'Effectué': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      'Annulé': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      'Absent': 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    }[s];
  }
}
