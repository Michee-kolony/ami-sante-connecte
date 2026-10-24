import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { aujourdhui, dateHeureFr, heureFr, jourLocal } from '../../data/format';
import { BilanRappels, PatientesService, RendezVousAgenda, StatutRdv } from '../../data/patientes.service';
import { SessionService, messageErreur } from '../../data/session.service';

type Filtre = 'À venir' | 'Aujourd’hui' | 'Absences' | 'Tous';
const ACTIFS: StatutRdv[] = ['Planifié', 'Confirmé', 'Reporté'];

/** Agenda des rendez-vous prénatals (médecins) : 30 jours passés à 90 jours à venir. */
@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="mx-auto max-w-7xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Rendez-vous & rappels</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Agenda des consultations prénatales. Rappels envoyés avec un texte discret, sans détail médical. Les reports et annulations se font depuis le dossier, avec motif.</p>
    </div>
    @if (session.estMedecin()) {
      <button class="btn-primary flex-none" (click)="confirmation.set(true); bilan.set(null); erreurRappels.set('')" [disabled]="envoi()">
        @if (envoi()) { <i class="fa-solid fa-spinner fa-spin"></i> Envoi en cours… } @else { <i class="fa-solid fa-bell"></i> Envoyer les rappels }
      </button>
    }
  </div>

  @if (confirmation()) {
    <div class="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 sm:flex-row sm:items-center dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100" role="alertdialog" aria-label="Confirmer l’envoi des rappels">
      <i class="fa-solid fa-paper-plane"></i>
      <p class="flex-1">Chaque patiente ayant un rendez-vous dans les 30 prochains jours recevra sur son téléphone une notification avec la date de son prochain rendez-vous (le sien ou celui de son enfant). Envoyer maintenant ?</p>
      <div class="flex gap-2">
        <button class="btn-secondary px-3 py-1.5 text-xs" (click)="confirmation.set(false)">Annuler</button>
        <button class="btn-primary px-3 py-1.5 text-xs" (click)="envoyerRappels()"><i class="fa-solid fa-check"></i> Envoyer</button>
      </div>
    </div>
  }
  @if (bilan(); as b) {
    <div class="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200" role="status">
      <i class="fa-solid fa-circle-check mt-0.5"></i>
      <span>
        @if (b.patientes) {
          Rappels envoyés : {{ b.notifiees }} patiente{{ b.notifiees > 1 ? 's' : '' }} sur {{ b.patientes }} ({{ b.rendezVous }} rendez-vous dans les {{ b.horizonJours }} jours).
          @if (b.patientes > b.notifiees) { Les autres n’ont pas encore installé l’application ou n’ont pas autorisé les notifications. }
        } @else {
          Aucune patiente n’a de rendez-vous dans les {{ b.horizonJours }} prochains jours : aucun rappel envoyé.
        }
      </span>
    </div>
  }
  @if (erreurRappels()) {
    <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
      <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span>{{ erreurRappels() }}</span>
    </div>
  }

  <div class="grid gap-4 sm:grid-cols-4">
    @for (s of stats(); track s.label) {
      <div class="card flex items-center gap-4 p-4">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl {{ s.color }}"><i class="fa-solid {{ s.icon }}"></i></div>
        <div>
          @if (chargement() && !rdvs().length) { <div class="skeleton mb-1.5 h-7 w-10"></div> } @else { <p class="text-2xl font-bold text-slate-900 dark:text-white">{{ s.value }}</p> }
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ s.label }}</p>
        </div>
      </div>
    }
  </div>

  @if (erreur()) {
    <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
      <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span>{{ erreur() }}</span>
    </div>
  }

  <div class="card overflow-hidden">
    <div class="card-header flex-wrap">
      <h2 class="card-title"><i class="fa-solid fa-calendar-days text-brand-600 dark:text-brand-400"></i> Agenda</h2>
      <div class="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
        @for (f of filtres; track f) {
          <button class="rounded-lg px-3 py-1.5 transition" [class]="filtre() === f ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'" (click)="filtre.set(f)">{{ f }}</button>
        }
      </div>
    </div>
    <ul class="divide-y divide-slate-100 dark:divide-slate-800">
      @if (chargement() && !rdvs().length) {
        @for (i of [1, 2, 3, 4]; track i) {
          <li class="flex items-center gap-4 px-5 py-4" aria-hidden="true"><div class="skeleton h-14 w-14 rounded-xl"></div><div class="flex-1 space-y-2"><div class="skeleton h-4 w-48"></div><div class="skeleton h-3 w-64"></div></div><div class="skeleton h-5 w-20 rounded-full"></div></li>
        }
      }
      @for (r of liste(); track r.id) {
        <li class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div class="flex flex-1 items-center gap-4">
            <div class="flex h-14 w-14 flex-none flex-col items-center justify-center rounded-xl ring-1"
                 [class]="r.statut === 'Absent' ? 'bg-rose-50 dark:bg-rose-500/10 ring-rose-200 dark:ring-rose-500/30 text-rose-700 dark:text-rose-300' : 'bg-slate-50 dark:bg-slate-800/50 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white'">
              <span class="text-lg font-bold leading-none">{{ jourLocal(r.date).slice(8) }}</span>
              <span class="text-[10px] font-semibold uppercase opacity-70">{{ mois[+jourLocal(r.date).slice(5, 7)] }}</span>
            </div>
            <div class="min-w-0">
              @if (r.patiente) {
                <a [routerLink]="['/admin/patientes', r.patiente.numero]" class="font-medium text-slate-900 dark:text-white hover:text-brand-700 dark:hover:text-brand-300">{{ r.patiente.prenom }} {{ r.patiente.nom }} {{ r.patiente.postnom }}</a>
              }
              @if (r.enfant) {
                <a [routerLink]="['/admin/enfants', r.enfant.numero]" class="badge ml-1 bg-pink-50 text-pink-700 ring-1 ring-pink-200 hover:bg-pink-100 dark:bg-pink-500/10 dark:text-pink-300 dark:ring-pink-500/30"><i class="fa-solid fa-baby"></i> {{ r.enfant.prenom || 'Bébé' }}</a>
              }
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ r.motif }} · {{ heure(r.date) }} · <span class="font-mono text-xs">{{ r.patiente?.numero }}</span></p>
              @if (r.statut === 'Reporté' && r.historique.length) {
                <p class="text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Reporté — {{ r.historique[r.historique.length - 1].motif }}</p>
              }
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:justify-end">
            @if (r.canalRappel !== 'Aucun') {
              <span class="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><i class="{{ canalIcon(r.canalRappel) }}"></i> {{ r.canalRappel }}</span>
            } @else {
              <span class="badge bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" title="Aucun rappel ne sera envoyé"><i class="fa-solid fa-ban"></i> Sans rappel</span>
            }
            <span class="badge {{ statutClass(r.statut) }}">{{ r.statut }}</span>
            @if (r.patiente) {
              <a [routerLink]="['/admin/patientes', r.patiente.numero]" class="btn-secondary px-3 py-1.5 text-xs">Dossier <i class="fa-solid fa-chevron-right text-[10px]"></i></a>
            }
          </div>
        </li>
      } @empty {
        @if (!chargement()) { <li class="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Aucun rendez-vous pour ce filtre.</li> }
      }
    </ul>
  </div>

  <div class="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
    <i class="fa-solid fa-bell mt-0.5 text-brand-600 dark:text-brand-400"></i>
    <p>Les rappels n’affichent jamais de diagnostic ni de détail de grossesse. Un rendez-vous reste visible dans l’agenda même si son rappel échoue.</p>
  </div>
</div>
  `,
})
export class AppointmentsComponent {
  private service = inject(PatientesService);
  session = inject(SessionService);
  dateHeure = dateHeureFr;
  heure = heureFr;
  jourLocal = jourLocal;
  mois = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
  filtres: Filtre[] = ['À venir', 'Aujourd’hui', 'Absences', 'Tous'];
  filtre = signal<Filtre>('À venir');

  rdvs = signal<RendezVousAgenda[]>([]);
  chargement = signal(true);
  erreur = signal('');

  // Bouton « Envoyer les rappels » (médecins) : confirmation, puis bilan de l'envoi.
  confirmation = signal(false);
  envoi = signal(false);
  bilan = signal<BilanRappels | null>(null);
  erreurRappels = signal('');

  envoyerRappels() {
    this.confirmation.set(false);
    this.envoi.set(true);
    this.service.envoyerRappelsRendezVous()
      .then(b => this.bilan.set(b))
      .catch(err => this.erreurRappels.set(messageErreur(err)))
      .finally(() => this.envoi.set(false));
  }

  constructor() {
    const du = new Date(Date.now() - 30 * 86400000);
    const au = new Date(Date.now() + 90 * 86400000);
    this.service.agenda(du, au)
      .then(l => this.rdvs.set(l))
      .catch(err => this.erreur.set(messageErreur(err)))
      .finally(() => this.chargement.set(false));
  }

  stats = computed(() => {
    const l = this.rdvs();
    const auj = aujourdhui();
    const dans7 = Date.now() + 7 * 86400000;
    return [
      { label: 'Aujourd’hui', value: l.filter(r => jourLocal(r.date) === auj && ACTIFS.includes(r.statut)).length, icon: 'fa-calendar-day', color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' },
      { label: '7 prochains jours', value: l.filter(r => ACTIFS.includes(r.statut) && new Date(r.date).getTime() >= Date.now() && new Date(r.date).getTime() <= dans7).length, icon: 'fa-calendar-week', color: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' },
      { label: 'Effectués (30 j)', value: l.filter(r => r.statut === 'Effectué').length, icon: 'fa-calendar-check', color: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' },
      { label: 'Absences (30 j)', value: l.filter(r => r.statut === 'Absent').length, icon: 'fa-calendar-xmark', color: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' },
    ];
  });

  liste = computed(() => {
    const l = this.rdvs();
    const auj = aujourdhui();
    switch (this.filtre()) {
      case 'À venir': return l.filter(r => ACTIFS.includes(r.statut) && jourLocal(r.date) >= auj);
      case 'Aujourd’hui': return l.filter(r => jourLocal(r.date) === auj);
      case 'Absences': return l.filter(r => r.statut === 'Absent' || (ACTIFS.includes(r.statut) && jourLocal(r.date) < auj)).reverse();
      default: return l;
    }
  });

  canalIcon(c: string): string {
    return { SMS: 'fa-solid fa-comment-sms', Appel: 'fa-solid fa-phone', WhatsApp: 'fa-brands fa-whatsapp' }[c] ?? 'fa-solid fa-ban';
  }

  statutClass(s: StatutRdv): string {
    return {
      'Planifié': 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
      'Confirmé': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
      'Reporté': 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
      'Effectué': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      'Annulé': 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
      'Absent': 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
    }[s];
  }
}
