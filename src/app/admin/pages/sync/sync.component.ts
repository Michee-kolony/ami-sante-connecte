import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Component, inject } from '@angular/core';
import { HorsLigneService, Operation } from '../../data/hors-ligne/hors-ligne.service';
import { PreparationHorsLigneService } from '../../data/hors-ligne/preparation.service';

/**
 * Synchronisation : saisies faites hors connexion sur cet appareil, en attente d'envoi ou
 * refusées par le serveur. Elles partent seules au retour du réseau ; chaque saisie garde son
 * identifiant, le serveur ne l'enregistre jamais deux fois.
 */
@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [DatePipe, RouterLink],
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

  <div class="card p-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="card-title"><i class="fa-solid fa-hard-drive text-brand-600 dark:text-brand-400"></i> Dossiers disponibles hors connexion</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Tant que le réseau est là, les dossiers actifs sont copiés sur cet appareil (automatiquement, toutes les 30 minutes) : dossier patiente et CPN, salle de travail et partogramme, carnets des enfants.</p>
      </div>
      <button class="btn-secondary flex-none" (click)="prep.preparer()" [disabled]="prep.enCours() || !hl.enLigne()">
        <i class="fa-solid fa-download" [class.fa-bounce]="prep.enCours()"></i> {{ prep.enCours() ? 'Copie en cours…' : 'Mettre à jour maintenant' }}
      </button>
    </div>
    @if (prep.enCours()) {
      <div class="mt-4">
        <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-full rounded-full bg-brand-600 transition-all" [style.width.%]="prep.progression().total ? prep.progression().fait * 100 / prep.progression().total : 5"></div>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ prep.progression().fait }} / {{ prep.progression().total || '…' }} dossiers copiés</p>
      </div>
    }
    @if (prep.bilan(); as b) {
      <div class="mt-4 grid gap-3 sm:grid-cols-4">
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-xs text-slate-500 dark:text-slate-400">Patientes suivies</p><p class="text-lg font-bold text-slate-900 dark:text-white">{{ b.patientes }}</p></div>
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-xs text-slate-500 dark:text-slate-400">Salle de travail</p><p class="text-lg font-bold text-slate-900 dark:text-white">{{ b.accouchements }}</p></div>
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-xs text-slate-500 dark:text-slate-400">Enfants</p><p class="text-lg font-bold text-slate-900 dark:text-white">{{ b.enfants }}</p></div>
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-xs text-slate-500 dark:text-slate-400">Copiés le</p><p class="text-lg font-bold text-slate-900 dark:text-white">{{ b.le | date: 'dd/MM · HH:mm' }}</p></div>
      </div>
      @if (b.echecs) { <p class="mt-2 text-xs text-amber-700 dark:text-amber-300">{{ b.echecs }} élément(s) n’ont pas pu être copiés (accès refusé ou erreur du serveur).</p> }
    } @else if (!prep.enCours()) {
      <p class="mt-4 text-sm text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> Aucun dossier encore copié sur cet appareil : connectez-vous une fois avec internet.</p>
    }
    @if (prep.erreur()) { <p class="mt-2 text-xs text-rose-700 dark:text-rose-300">{{ prep.erreur() }}</p> }
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
                @if (op.detail) { <p class="text-sm text-slate-600 dark:text-slate-300">{{ op.detail }}</p> }
                <p class="font-mono text-[11px] text-slate-400">{{ op.operationId }}</p>
              </td>
              <td class="table-td whitespace-nowrap">{{ op.creeLe | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td class="table-td whitespace-nowrap">{{ op.soignantNom || '—' }}</td>
              <td class="table-td">
                @if (op.etat === 'échec') {
                  <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><i class="fa-solid fa-circle-exclamation"></i> Refusée</span>
                  <p class="mt-1 max-w-xs text-xs text-rose-700 dark:text-rose-300">{{ op.erreur }}</p>
                  @if (op.doublons?.length) {
                    <div class="mt-2 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <p class="font-semibold">Dossier(s) qui ressemblent :</p>
                      <ul class="mt-1 space-y-0.5">
                        @for (d of op.doublons; track d.id) {
                          <li><a class="font-mono text-brand-700 hover:underline dark:text-brand-300" [routerLink]="[d.numero.startsWith('AC-ENF') ? '/admin/enfants' : '/admin/patientes', d.numero]">{{ d.numero }}</a>
                            · {{ d.prenom }} {{ d.nom }} {{ d.postnom }}@if (d.age != null) { · {{ d.age }} ans }@if (d.commune) { · {{ d.commune }} }</li>
                        }
                      </ul>
                      @if (op.emailExistant) {
                        <p class="mt-1.5">Même adresse e-mail : c’est la même patiente. Supprimez cette saisie et complétez son dossier existant (nouvelle grossesse, consultation).</p>
                      } @else {
                        <p class="mt-1.5">Si c’est la même personne, supprimez cette saisie et complétez son dossier existant. Sinon :</p>
                        <button class="btn-secondary mt-1.5 px-2.5 py-1.5 text-xs" (click)="hl.confirmerMalgreDoublons(op)"><i class="fa-solid fa-user-check"></i> Ce n’est pas la même personne : créer le dossier</button>
                      }
                    </div>
                  }
                } @else {
                  <span class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><i class="fa-solid fa-clock"></i> En attente</span>
                }
              </td>
              <td class="table-td">
                <div class="flex justify-end gap-1">
                  @if (op.etat === 'échec' && !op.doublons?.length) {
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
      <li>Les dossiers actifs copiés sur cet appareil (et tout dossier déjà ouvert) restent consultables sans réseau : dossier patiente, CPN, salle de travail et partogramme, carnet de l’enfant. La recherche de patientes fonctionne aussi.</li>
      <li>Les saisies (consultations, rendez-vous, surveillance du travail, accouchement, post-partum, vaccins…) sont gardées ici puis envoyées dans l’ordre où elles ont été faites, avec leur heure réelle.</li>
      <li><b>Nouveaux dossiers sans réseau</b> : un enregistrement CPN (avec sa première consultation) ou un nouvel enfant pour la vaccination est gardé ici avec ses photos, puis créé sur le serveur au retour du réseau. Le numéro AC-PAT ou AC-ENF est attribué à ce moment-là.</li>
      <li>Une saisie refusée par le serveur (dossier clôturé entre-temps, donnée invalide, e-mail déjà utilisé) reste ici avec la raison : corrigez puis réessayez, ou supprimez-la. Si le serveur trouve un dossier qui ressemble, vous décidez ici s’il s’agit de la même personne.</li>
      <li>Les saisies d’un soignant ne partent qu’avec sa propre session. À la déconnexion, les dossiers gardés sur l’appareil sont effacés ; les saisies en attente restent.</li>
    </ul>
  </div>
</div>
  `,
})
export class SyncComponent {
  hl = inject(HorsLigneService);
  prep = inject(PreparationHorsLigneService);

  supprimer(op: Operation): void {
    if (confirm(`Supprimer définitivement cette saisie (« ${op.libelle} ») ? Elle ne sera jamais envoyée au serveur.`)) this.hl.supprimer(op);
  }
}
