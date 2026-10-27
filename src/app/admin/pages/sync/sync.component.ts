import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HorsLigneService, Operation } from '../../data/hors-ligne/hors-ligne.service';

/**
 * Synchronisation : saisies faites hors connexion sur cet appareil, en attente d'envoi ou
 * refusées par le serveur. Elles partent seules au retour du réseau ; chaque saisie garde son
 * identifiant, le serveur ne l'enregistre jamais deux fois.
 */
@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [DatePipe],
  template: `
<div class="mx-auto max-w-6xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Synchronisation</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Saisies faites sans connexion sur cet appareil. Elles sont envoyées automatiquement au serveur dès le retour du réseau ; une saisie n’est jamais enregistrée deux fois.</p>
    </div>
    <button class="btn-primary" (click)="hl.synchroniser()" [disabled]="hl.synchronisation() || !hl.enAttente()">
      <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="hl.synchronisation()"></i> {{ hl.synchronisation() ? 'Synchronisation…' : 'Synchroniser maintenant' }}
    </button>
  </div>

  <div class="grid gap-4 md:grid-cols-3">
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Réseau</p>
      @if (hl.enLigne()) {
        <p class="mt-2 flex items-center gap-2 text-xl font-bold text-accent-700 dark:text-accent-300"><i class="fa-solid fa-wifi"></i> En ligne</p>
      } @else {
        <p class="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"><i class="fa-solid fa-plane"></i> Hors connexion</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Vous pouvez continuer à travailler : les saisies sont gardées ici.</p>
      }
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dernière synchronisation</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{{ hl.derniereSynchronisation() ? (hl.derniereSynchronisation() | date: 'dd/MM/yyyy · HH:mm') : '—' }}</p>
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">File d’attente</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{{ hl.operations().length }} saisie{{ hl.operations().length > 1 ? 's' : '' }}</p>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ hl.enAttente() }} en attente · {{ hl.enEchec() }} refusée{{ hl.enEchec() > 1 ? 's' : '' }}</p>
    </div>
  </div>

  <div class="card overflow-hidden">
    <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-list-ul text-brand-600 dark:text-brand-400"></i> Saisies sur cet appareil</h2></div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50/70 dark:bg-slate-800/50"><tr>
          <th class="table-th">Saisie</th><th class="table-th">Faite le</th><th class="table-th">Par</th><th class="table-th">État</th><th class="table-th"><span class="sr-only">Actions</span></th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (op of hl.operations(); track op.operationId) {
            <tr>
              <td class="table-td">
                <p class="font-medium text-slate-900 dark:text-white">{{ op.libelle }}</p>
                <p class="font-mono text-[11px] text-slate-400">{{ op.operationId }}</p>
              </td>
              <td class="table-td whitespace-nowrap">{{ op.creeLe | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td class="table-td whitespace-nowrap">{{ op.soignantNom || '—' }}</td>
              <td class="table-td">
                @if (op.etat === 'échec') {
                  <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><i class="fa-solid fa-circle-exclamation"></i> Refusée</span>
                  <p class="mt-1 max-w-xs text-xs text-rose-700 dark:text-rose-300">{{ op.erreur }}</p>
                } @else {
                  <span class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><i class="fa-solid fa-clock"></i> En attente</span>
                }
              </td>
              <td class="table-td">
                <div class="flex justify-end gap-1">
                  @if (op.etat === 'échec') {
                    <button class="btn-ghost px-2.5 py-1.5 text-xs" (click)="hl.reessayer(op)"><i class="fa-solid fa-rotate-right"></i> Réessayer</button>
                  }
                  <button class="btn-ghost px-2.5 py-1.5 text-xs text-rose-600" (click)="supprimer(op)"><i class="fa-solid fa-trash"></i> Supprimer</button>
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="table-td py-10 text-center text-slate-500 dark:text-slate-400">
              <i class="fa-solid fa-circle-check mb-2 block text-2xl text-accent-500"></i>Tout est synchronisé : aucune saisie en attente sur cet appareil.
            </td></tr>
          }
        </tbody>
      </table>
    </div>
  </div>

  <div class="card p-5 text-sm text-slate-600 dark:text-slate-300">
    <p class="mb-2 font-semibold text-slate-900 dark:text-white"><i class="fa-solid fa-circle-info mr-1 text-brand-600 dark:text-brand-400"></i> Travailler sans connexion</p>
    <ul class="list-disc space-y-1 pl-5">
      <li>Les dossiers déjà ouverts sur cet appareil restent consultables sans réseau (patientes, CPN, salle de travail, nouveau-nés).</li>
      <li>Les saisies (consultations, rendez-vous, surveillance du travail, accouchement, post-partum, vaccins…) sont gardées ici puis envoyées dans l’ordre où elles ont été faites, avec leur heure réelle.</li>
      <li>Une saisie refusée par le serveur (dossier clôturé entre-temps, donnée invalide) reste ici avec la raison : corrigez puis réessayez, ou supprimez-la.</li>
      <li>Les saisies d’un soignant ne partent qu’avec sa propre session. À la déconnexion, les dossiers gardés sur l’appareil sont effacés ; les saisies en attente restent.</li>
    </ul>
  </div>
</div>
  `,
})
export class SyncComponent {
  hl = inject(HorsLigneService);

  supprimer(op: Operation): void {
    if (confirm(`Supprimer définitivement cette saisie (« ${op.libelle} ») ? Elle ne sera jamais envoyée au serveur.`)) this.hl.supprimer(op);
  }
}
