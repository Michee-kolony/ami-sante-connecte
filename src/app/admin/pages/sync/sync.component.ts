import { Component } from '@angular/core';
import { SYNC_QUEUE } from '../../data/mock-data';

@Component({
  selector: 'app-sync',
  standalone: true,
  template: `
<div class="mx-auto max-w-6xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Synchronisation</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Chaque opération a un identifiant unique : une nouvelle tentative ne crée jamais de doublon.</p>
    </div>
    <button class="btn-primary" (click)="run()" [disabled]="running">
      <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="running"></i> {{ running ? 'Synchronisation…' : 'Relancer maintenant' }}
    </button>
  </div>

  <div class="grid gap-4 md:grid-cols-3">
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dernière synchronisation</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">18/10/2026 · 09:30</p>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-accent-600 dark:text-accent-400"><i class="fa-solid fa-circle-check"></i> Réussie</p>
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Appareil</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">TAB-CPN-02</p>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><i class="fa-solid fa-shield-halved text-brand-600 dark:text-brand-400"></i> Approuvé · stockage chiffré</p>
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">File d’attente</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{{ queue.length }} opérations</p>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ pending }} en attente · {{ conflits }} conflit</p>
    </div>
  </div>

  <div class="card overflow-hidden">
    <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-list-ul text-brand-600 dark:text-brand-400"></i> Opérations locales</h2></div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50/70 dark:bg-slate-800/50"><tr>
          <th class="table-th">Opération</th><th class="table-th">Fiche</th><th class="table-th">Action</th><th class="table-th">Date</th><th class="table-th">État</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (q of queue; track q.operationId) {
            <tr>
              <td class="table-td font-mono text-xs">{{ q.operationId }}</td>
              <td class="table-td font-mono text-xs">{{ q.fiche }}</td>
              <td class="table-td">{{ q.action }}</td>
              <td class="table-td whitespace-nowrap">{{ q.date }}</td>
              <td class="table-td">
                @switch (q.etat) {
                  @case ('en attente') { <span class="badge bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"><i class="fa-solid fa-clock"></i> En attente</span> }
                  @case ('conflit') { <span class="badge bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300"><i class="fa-solid fa-code-compare"></i> Conflit</span> }
                  @default { <span class="badge bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300"><i class="fa-solid fa-check"></i> Synchronisé</span> }
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>

  <!-- Conflit -->
  <div class="card overflow-hidden ring-1 ring-rose-200 dark:ring-rose-500/30">
    <div class="card-header bg-rose-50/60 dark:bg-rose-500/10">
      <h2 class="card-title"><i class="fa-solid fa-code-compare text-rose-500"></i> Conflit à arbitrer — AMI-2026-000140 · Téléphone principal</h2>
    </div>
    <div class="grid gap-4 p-5 md:grid-cols-2">
      @for (v of versions; track v.source) {
        <button class="rounded-2xl border-2 p-4 text-left transition"
                [class]="choix === v.source ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'"
                (click)="choix = v.source">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ v.source }}</span>
            <i class="fa-regular" [class]="choix === v.source ? 'fa-circle-dot text-brand-700 dark:text-brand-300' : 'fa-circle text-slate-300'"></i>
          </div>
          <p class="mt-2 font-mono text-lg font-semibold text-slate-900 dark:text-white">{{ v.valeur }}</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ v.auteur }} · {{ v.date }}</p>
        </button>
      }
    </div>
    <div class="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs text-slate-500 dark:text-slate-400"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Les deux valeurs restent dans l’historique.</p>
      <button class="btn-primary" [disabled]="!choix"><i class="fa-solid fa-check"></i> Retenir cette valeur</button>
    </div>
  </div>

  <div class="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:flex-row sm:items-center">
    <p class="text-sm text-slate-600 dark:text-slate-300"><i class="fa-solid fa-eraser mr-1 text-slate-400"></i> Déconnexion sécurisée et effacement des données locales (après synchronisation complète).</p>
    <button class="btn-secondary text-rose-600 dark:text-rose-400" [disabled]="pending > 0">Effacer l’appareil</button>
  </div>
</div>
  `,
})
export class SyncComponent {
  queue = SYNC_QUEUE;
  running = false;
  choix: string | null = null;
  pending = SYNC_QUEUE.filter(q => q.etat === 'en attente').length;
  conflits = SYNC_QUEUE.filter(q => q.etat === 'conflit').length;

  versions = [
    { source: 'Serveur', valeur: '+243 82 555 0193', auteur: 'J. Kalala (accueil)', date: '17/10/2026 15:02' },
    { source: 'Cet appareil', valeur: '+243 82 555 0139', auteur: 'Inf. Grâce Mbuyi', date: '17/10/2026 17:10' },
  ];

  run(): void {
    this.running = true;
    setTimeout(() => (this.running = false), 1800);
  }
}
