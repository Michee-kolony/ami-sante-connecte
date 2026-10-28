import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HorsLigneService, LIBELLES_STATUT, Operation, StatutSync } from '../../data/hors-ligne/hors-ligne.service';
import { PreparationHorsLigneService } from '../../data/hors-ligne/preparation.service';
import { chiffrementDisponible } from '../../data/hors-ligne/stockage';
import { SessionService, HORS_LIGNE_MAX_MS } from '../../data/session.service';

/**
 * Synchronisation (écran d'état du mode hors connexion) : réseau réel, appareil prêt, saisies faites
 * sans connexion avec leur statut (LOCAL_ONLY, PENDING, SYNCING, SYNCED, ERROR), conflits et doublons
 * à trancher, accusés de réception. Les saisies partent seules au retour du réseau ; chaque saisie
 * garde son identifiant, le serveur ne l'enregistre jamais deux fois.
 */
@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
<div class="mx-auto max-w-6xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Synchronisation</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Saisies faites sans connexion sur cet appareil. Elles sont envoyées automatiquement dès que le serveur répond ; une saisie n’est jamais enregistrée deux fois.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn-secondary" (click)="verifier()" [disabled]="verification()"><i class="fa-solid fa-satellite-dish" [class.fa-beat]="verification()"></i> Vérifier le serveur</button>
      <button class="btn-primary" (click)="hl.synchroniser(true)" [disabled]="hl.synchronisation() || !hl.enAttente()">
        <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="hl.synchronisation()"></i> {{ hl.synchronisation() ? 'Synchronisation…' : 'Synchroniser maintenant' }}
      </button>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-4">
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Serveur</p>
      @if (hl.enLigne()) {
        <p class="mt-2 flex items-center gap-2 text-xl font-bold text-accent-700 dark:text-accent-300"><i class="fa-solid fa-wifi"></i> Joignable</p>
      } @else {
        <p class="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"><i class="fa-solid fa-plane"></i> Hors connexion</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Vous pouvez continuer à travailler : les saisies sont gardées ici.@if (hl.prochainEssaiLe(); as p) { Prochain essai à {{ p | date: 'HH:mm:ss' }}. }</p>
      }
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Appareil</p>
      <p class="mt-2 flex items-center gap-2 text-lg font-bold" [class]="pret() ? 'text-accent-700 dark:text-accent-300' : 'text-amber-700 dark:text-amber-300'">
        <i class="fa-solid" [class]="pret() ? 'fa-circle-check' : 'fa-hourglass-half'"></i> {{ pret() ? 'Prêt hors connexion' : 'Pas encore prêt' }}
      </p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Application {{ prep.applicationPrete() ? 'installée sur l’appareil' : 'en cours d’installation (restez en ligne)' }} · dossiers {{ prep.bilan() ? 'copiés' : 'non copiés' }} · données {{ chiffre ? 'chiffrées' : 'non chiffrées (HTTPS requis)' }}
      </p>
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dernière synchronisation</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{{ hl.derniereSynchronisation() ? (hl.derniereSynchronisation() | date: 'dd/MM/yyyy · HH:mm') : '—' }}</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Travail hors ligne possible jusqu’au {{ limiteHorsLigne() | date: 'dd/MM/yyyy HH:mm' }}, puis connexion en ligne exigée.</p>
    </div>
    <div class="card p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">File d’attente</p>
      <p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{{ hl.operations().length }} saisie{{ hl.operations().length > 1 ? 's' : '' }}</p>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">
        @for (s of statuts; track s) { @if (compte(s)) { <span class="mr-2 whitespace-nowrap">{{ compte(s) }} · {{ libelles[s].toLowerCase() }}</span> } }
      </p>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="card-title"><i class="fa-solid fa-hard-drive text-brand-600 dark:text-brand-400"></i> Dossiers copiés sur l’appareil</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Tant que le réseau est là, les dossiers actifs sont copiés (toutes les 30 minutes) : dossier patiente et CPN, salle de travail et partogramme, carnets des enfants, établissements.</p>
        </div>
        <button class="btn-secondary flex-none py-2 text-xs" (click)="prep.preparer()" [disabled]="prep.enCours() || !hl.enLigne()">
          <i class="fa-solid fa-download" [class.fa-bounce]="prep.enCours()"></i> {{ prep.enCours() ? 'Copie…' : 'Mettre à jour' }}
        </button>
      </div>
      @if (prep.enCours()) {
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-brand-600 transition-all" [style.width.%]="prep.progression().total ? prep.progression().fait * 100 / prep.progression().total : 5"></div></div>
      }
      @if (prep.bilan(); as b) {
        <p class="mt-3 text-sm text-slate-700 dark:text-slate-200"><strong>{{ b.patientes }}</strong> patientes · <strong>{{ b.accouchements }}</strong> en salle de travail · <strong>{{ b.enfants }}</strong> enfants — copiés le {{ b.le | date: 'dd/MM HH:mm' }}</p>
        @if (b.echecs) { <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">{{ b.echecs }} élément(s) n’ont pas pu être copiés.</p> }
      } @else if (!prep.enCours()) {
        <p class="mt-3 text-sm text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> Aucun dossier encore copié : connectez-vous une fois avec internet.</p>
      }
      @if (prep.erreur()) { <p class="mt-2 text-xs text-rose-700 dark:text-rose-300">{{ prep.erreur() }}</p> }
    </div>
    <div class="card p-5">
      <h2 class="card-title"><i class="fa-solid fa-folder-plus text-brand-600 dark:text-brand-400"></i> Dossiers créés hors connexion</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Patientes, enfants et admissions enregistrés sur cet appareil : consultables et complétables (CPN, rendez-vous, vaccination, surveillance du travail, nouveau-né) avant leur synchronisation.</p>
      <p class="mt-3 text-sm"><strong>{{ locauxEnAttente() }}</strong> en attente · <strong>{{ locauxSynchronises() }}</strong> synchronisé(s)</p>
      <a routerLink="/admin/hors-ligne" class="btn-secondary mt-3 py-2 text-xs"><i class="fa-solid fa-folder-open"></i> Ouvrir les dossiers créés hors connexion</a>
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
                @if (op.detail) { <p class="text-sm text-slate-600 dark:text-slate-300">{{ op.detail }}</p> }
                @if (op.localIds?.['id']; as lid) { <a class="text-xs text-brand-700 hover:underline dark:text-brand-300" [routerLink]="['/admin/hors-ligne', lid]">Ouvrir le dossier local</a> }
                <p class="font-mono text-[11px] text-slate-400">{{ op.operationId }} · {{ op.recordType }} · révision {{ op.revision }}</p>
              </td>
              <td class="table-td whitespace-nowrap">{{ op.creeLe | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td class="table-td whitespace-nowrap">{{ op.soignantNom || '—' }}</td>
              <td class="table-td">
                <span class="badge" [class]="couleur(op.statut)"><i class="fa-solid" [class]="icone(op.statut)"></i> {{ libelles[op.statut] }}</span>
                @if (op.statut === 'LOCAL_ONLY') { <p class="mt-1 max-w-xs text-xs text-violet-700 dark:text-violet-300">{{ op.erreur ?? 'Partira dès que le dossier dont elle dépend aura son numéro serveur (mère avant enfant…).' }}</p> }
                @if (op.statut === 'ERROR') {
                  <p class="mt-1 max-w-xs text-xs text-rose-700 dark:text-rose-300">{{ op.erreur }} <span class="font-mono text-[10px] text-slate-400">({{ op.codeErreur }})</span></p>
                  @if (op.conflit) {
                    <div class="mt-2 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <p>Le dossier a été modifié sur le serveur après la version présente sur cet appareil. Rien n’a été écrasé. Ouvrez le dossier pour comparer, puis :</p>
                      <div class="mt-1.5 flex flex-wrap gap-1.5">
                        <button class="btn-secondary px-2.5 py-1.5 text-xs" (click)="hl.appliquerMalgreConflit(op)"><i class="fa-solid fa-check"></i> Appliquer ma modification</button>
                        <button class="btn-ghost px-2.5 py-1.5 text-xs" (click)="demanderAbandon(op, 'Conflit : version du serveur conservée')">Garder la version du serveur</button>
                      </div>
                    </div>
                  }
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
                        <p class="mt-1.5">Même adresse e-mail : c’est la même patiente. Abandonnez cette saisie et complétez son dossier existant (nouvelle grossesse, consultation).</p>
                      } @else {
                        <p class="mt-1.5">Si c’est la même personne, abandonnez cette saisie et complétez son dossier existant. Sinon :</p>
                        <button class="btn-secondary mt-1.5 px-2.5 py-1.5 text-xs" (click)="hl.confirmerMalgreDoublons(op)"><i class="fa-solid fa-user-check"></i> Ce n’est pas la même personne : créer le dossier</button>
                      }
                    </div>
                  }
                }
              </td>
              <td class="table-td">
                <div class="flex justify-end gap-1">
                  @if (op.statut === 'ERROR' && !op.doublons?.length && !op.conflit) {
                    <button class="btn-ghost px-2.5 py-1.5 text-xs" (click)="hl.reessayer(op)"><i class="fa-solid fa-rotate-right"></i> Réessayer</button>
                  }
                  <button class="btn-ghost px-2.5 py-1.5 text-xs text-rose-600" (click)="demanderAbandon(op)"><i class="fa-solid fa-ban"></i> Abandonner</button>
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

  <div class="card overflow-hidden">
    <div class="card-header">
      <h2 class="card-title"><i class="fa-solid fa-receipt text-brand-600 dark:text-brand-400"></i> Accusés de réception</h2>
      <span class="text-xs text-slate-500">{{ hl.journal().length }} sur cet appareil</span>
    </div>
    <ul class="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
      @for (r of hl.journal().slice(0, 100); track r.operationId) {
        <li class="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
          <span><strong>{{ r.libelle }}</strong>@if (r.detail) { · {{ r.detail }} } <span class="text-xs text-slate-500">· saisie le {{ r.creeLe | date: 'dd/MM HH:mm' }} par {{ r.soignantNom }}</span>
            @if (r.motif) { <span class="block text-xs text-slate-500">Motif : {{ r.motif }}</span> }</span>
          <span class="flex items-center gap-2">
            @if (r.serverNumero) { <span class="font-mono text-xs">{{ r.serverNumero }}</span> }
            <span class="badge" [class]="r.statut === 'SYNCED' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-slate-100 text-slate-500'">{{ r.statut === 'SYNCED' ? 'Reçue le ' : 'Abandonnée le ' }}{{ r.envoyeLe | date: 'dd/MM HH:mm' }}</span>
          </span>
        </li>
      } @empty { <li class="px-5 py-4 text-sm text-slate-500">Aucun envoi pour l’instant.</li> }
    </ul>
  </div>

  <div class="card p-5 text-sm text-slate-600 dark:text-slate-300">
    <p class="mb-2 font-semibold text-slate-900 dark:text-white"><i class="fa-solid fa-circle-info mr-1 text-brand-600 dark:text-brand-400"></i> Travailler sans connexion</p>
    <ul class="list-disc space-y-1 pl-5">
      <li>Ouvrez l’application une fois avec internet sur cet appareil : elle s’installe et copie les dossiers actifs. Elle s’ouvre ensuite sans réseau, même quand la connexion est instable.</li>
      <li>Sans réseau, vous consultez les dossiers copiés et vous saisissez : enregistrement CPN, consultations, rendez-vous, salle de travail, nouveau-né, vaccination. Chaque saisie garde son heure réelle.</li>
      <li>Les dossiers créés sans réseau reçoivent un identifiant local ; leurs liens (mère, enfant, accouchement) sont gardés et remplacés par les numéros du serveur à la synchronisation.</li>
      <li>Une saisie refusée (donnée invalide, droits, dossier qui ressemble, modification faite entre-temps sur le serveur) reste ici : rien n’est écrasé ni effacé sans votre décision, et chaque abandon est tracé.</li>
      <li>L’écran se verrouille après 10 minutes sans activité. Au-delà de 7 jours sans contact avec le serveur, une connexion en ligne est demandée. Appareil perdu : le médecin chef révoque ses sessions, et l’appareil efface ses données dès qu’il se reconnecte.</li>
    </ul>
  </div>
</div>

<!-- Abandon d'une saisie : confirmation explicite et motif (tracé dans le journal de l'appareil) -->
@if (aAbandonner(); as op) {
  <div class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titre-abandon">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="aAbandonner.set(null)" aria-hidden="true"></div>
    <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <h2 id="titre-abandon" class="text-lg font-semibold text-slate-900 dark:text-white">Abandonner cette saisie ?</h2>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300"><strong>{{ op.libelle }}</strong>@if (op.detail) { · {{ op.detail }} } — saisie le {{ op.creeLe | date: 'dd/MM/yyyy HH:mm' }}. Elle ne sera jamais envoyée au serveur. L’abandon est tracé avec votre nom, la date et le motif.</p>
      <label class="label mt-4" for="motif">Motif <span class="req">*</span></label>
      <input id="motif" class="input" [(ngModel)]="motifAbandon" placeholder="ex. saisie en double, dossier existant complété">
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-secondary" (click)="aAbandonner.set(null)">Annuler</button>
        <button type="button" class="btn bg-rose-600 text-white hover:bg-rose-700" [disabled]="!motifAbandon.trim()" (click)="abandonner()">Abandonner la saisie</button>
      </div>
    </div>
  </div>
}
  `,
})
export class SyncComponent {
  hl = inject(HorsLigneService);
  prep = inject(PreparationHorsLigneService);
  private session = inject(SessionService);

  readonly libelles = LIBELLES_STATUT;
  readonly statuts: StatutSync[] = ['LOCAL_ONLY', 'PENDING', 'SYNCING', 'ERROR'];
  readonly chiffre = chiffrementDisponible();
  readonly pret = this.prep.appareilPret;
  readonly verification = signal(false);
  readonly limiteHorsLigne = computed(() => new Date(this.session.dernierContactServeur() + HORS_LIGNE_MAX_MS));
  readonly locauxEnAttente = computed(() => this.hl.locaux().filter(l => !l.serverId && ['Patiente', 'Enfant', 'Accouchement'].includes(l.type)).length);
  readonly locauxSynchronises = computed(() => this.hl.locaux().filter(l => l.serverId && ['Patiente', 'Enfant', 'Accouchement'].includes(l.type)).length);

  aAbandonner = signal<Operation | null>(null);
  motifAbandon = '';


  compte(s: StatutSync): number {
    return this.hl.operations().filter(o => o.statut === s).length;
  }

  couleur(s: StatutSync): string {
    return s === 'ERROR' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      : s === 'LOCAL_ONLY' ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
      : s === 'SYNCING' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }

  icone(s: StatutSync): string {
    return s === 'ERROR' ? 'fa-circle-exclamation' : s === 'LOCAL_ONLY' ? 'fa-link' : s === 'SYNCING' ? 'fa-spinner fa-spin' : 'fa-clock';
  }

  async verifier(): Promise<void> {
    this.verification.set(true);
    const ok = await this.hl.verifierServeur();
    this.verification.set(false);
    if (ok) this.hl.synchroniser(true);
  }

  demanderAbandon(op: Operation, motif = ''): void {
    this.motifAbandon = motif;
    this.aAbandonner.set(op);
  }

  async abandonner(): Promise<void> {
    const op = this.aAbandonner();
    if (!op || !this.motifAbandon.trim()) return;
    await this.hl.supprimer(op, this.motifAbandon.trim());
    this.aAbandonner.set(null);
  }
}
