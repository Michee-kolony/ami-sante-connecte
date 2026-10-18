import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate, RENDEZ_VOUS } from '../../data/mock-data';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="mx-auto max-w-7xl space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Rendez-vous & rappels</h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Rappels envoyés uniquement sur les canaux consentis, avec un texte discret.</p>
  </div>

  <div class="grid gap-4 sm:grid-cols-4">
    @for (s of stats; track s.label) {
      <div class="card flex items-center gap-4 p-4">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl {{ s.color }}"><i class="fa-solid {{ s.icon }}"></i></div>
        <div><p class="text-2xl font-bold text-slate-900 dark:text-white">{{ s.value }}</p><p class="text-xs text-slate-500 dark:text-slate-400">{{ s.label }}</p></div>
      </div>
    }
  </div>

  <div class="card overflow-hidden">
    <div class="card-header">
      <h2 class="card-title"><i class="fa-solid fa-calendar-days text-brand-600 dark:text-brand-400"></i> Agenda</h2>
      <div class="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
        @for (f of filtres; track f) {
          <button class="rounded-lg px-3 py-1.5 transition" [class]="filtre === f ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'" (click)="filtre = f">{{ f }}</button>
        }
      </div>
    </div>
    <ul class="divide-y divide-slate-100 dark:divide-slate-800">
      @for (r of liste; track r.patienteId + r.date) {
        <li class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div class="flex flex-1 items-center gap-4">
            <div class="flex h-14 w-14 flex-none flex-col items-center justify-center rounded-xl ring-1"
                 [class]="r.statut === 'Manqué' ? 'bg-rose-50 dark:bg-rose-500/10 ring-rose-200 dark:ring-rose-500/30 text-rose-700 dark:text-rose-300' : 'bg-slate-50 dark:bg-slate-800/50 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white'">
              <span class="text-lg font-bold leading-none">{{ r.date.slice(8) }}</span>
              <span class="text-[10px] font-semibold uppercase opacity-70">{{ mois[+r.date.slice(5, 7)] }}</span>
            </div>
            <div class="min-w-0">
              <a [routerLink]="['/admin/patientes', r.patienteId]" class="font-medium text-slate-900 dark:text-white hover:text-brand-700 dark:hover:text-brand-300">{{ r.patiente }}</a>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ r.type }} · {{ r.heure }} · <span class="font-mono text-xs">{{ r.patienteId }}</span></p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:justify-end">
            @if (r.consentement) {
              <span class="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><i class="{{ canalIcon(r.canal) }}"></i> {{ r.canal }}</span>
            } @else {
              <span class="badge bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" title="Aucun rappel ne sera envoyé"><i class="fa-solid fa-ban"></i> Sans consentement</span>
            }
            <span class="badge {{ statutClass(r.statut) }}">{{ r.statut }}</span>
            @if (r.statut === 'Manqué') {
              <button class="btn-primary px-3 py-1.5 text-xs"><i class="fa-solid fa-list-check"></i> Créer tâche de suivi</button>
            }
          </div>
        </li>
      }
    </ul>
  </div>

  <div class="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
    <i class="fa-solid fa-user-group mt-0.5 text-brand-600 dark:text-brand-400"></i>
    <p>Les tâches de suivi transmises aux <strong class="font-semibold text-slate-800 dark:text-slate-100">RECO</strong> ne contiennent que le nom, le quartier et le motif « rendez-vous à reprogrammer », pour une durée limitée et dans leur périmètre géographique.</p>
  </div>
</div>
  `,
})
export class AppointmentsComponent {
  fmt = formatDate;
  mois = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
  filtres = ['Tous', 'À venir', 'Manqués'];
  filtre = 'Tous';

  stats = [
    { label: 'Aujourd’hui', value: 6, icon: 'fa-calendar-day', color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' },
    { label: 'Cette semaine', value: 23, icon: 'fa-calendar-week', color: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: 'Rappels envoyés', value: 41, icon: 'fa-paper-plane', color: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' },
    { label: 'Manqués', value: 5, icon: 'fa-calendar-xmark', color: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  ];

  get liste() {
    const sorted = [...RENDEZ_VOUS].sort((a, b) => a.date.localeCompare(b.date));
    if (this.filtre === 'Manqués') return sorted.filter(r => r.statut === 'Manqué');
    if (this.filtre === 'À venir') return sorted.filter(r => r.statut === 'Prévu' || r.statut === 'Rappel envoyé');
    return sorted;
  }

  canalIcon(c: string): string {
    return { SMS: 'fa-solid fa-comment-sms', Appel: 'fa-solid fa-phone', WhatsApp: 'fa-brands fa-whatsapp' }[c] ?? 'fa-solid fa-ban';
  }

  statutClass(s: string): string {
    return {
      'Prévu': 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
      'Rappel envoyé': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
      'Manqué': 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
      'Honoré': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    }[s] ?? '';
  }
}
