import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../../data/session.service';
import { EpidemiologieService, couleurStatutDonnee, type Donnee, type TypeDonnee } from '../../../data/epidemiologie.service';

/**
 * Barre de validation commune (Partie I §3, sous-fenêtre 10) : statut, version, soumission,
 * décision du validateur (valider, demander une correction, rejeter avec motif), archivage et
 * historique (ancienne / nouvelle valeur, motif, auteur). Le serveur applique les droits et la
 * séparation saisie / validation ; les boutons ne s'affichent que si l'action est possible.
 */
@Component({
  selector: 'app-epi-validation',
  standalone: true,
  imports: [DatePipe, FormsModule, JsonPipe],
  template: `
<div class="flex flex-wrap items-center gap-1.5">
  <span class="badge" [class]="couleur(donnee['statut'])">{{ donnee['statut'] }}</span>
  @if (donnee['version']) { <span class="text-xs text-slate-500">v{{ donnee['version'] }}</span> }
  @if (['Brouillon', 'À corriger'].includes(donnee['statut'])) {
    <button type="button" class="btn-ghost px-2 py-1 text-xs" [disabled]="envoi()" (click)="soumettre()"><i class="fa-solid fa-paper-plane"></i> Soumettre</button>
  }
  @if (donnee['statut'] === 'Soumis' && epi.droits()?.validation) {
    <button type="button" class="btn-ghost px-2 py-1 text-xs text-accent-700 dark:text-accent-300" [disabled]="envoi()" (click)="decider('valider')"><i class="fa-solid fa-stamp"></i> Valider</button>
    <button type="button" class="btn-ghost px-2 py-1 text-xs text-amber-700 dark:text-amber-300" (click)="mode.set('corriger')"><i class="fa-solid fa-rotate-left"></i> À corriger</button>
    <button type="button" class="btn-ghost px-2 py-1 text-xs text-rose-700 dark:text-rose-300" (click)="mode.set('rejeter')"><i class="fa-solid fa-ban"></i> Rejeter</button>
  }
  @if (epi.droits()?.validation && donnee['statut'] !== 'Archivé' && archivable) {
    <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="mode.set('archiver')" title="Conserver sans être active"><i class="fa-solid fa-box-archive"></i></button>
  }
  <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="voirHistorique()" title="Historique et versions"><i class="fa-solid fa-clock-rotate-left"></i></button>
</div>
@if (donnee['decision']?.motif && donnee['statut'] !== 'Validé') {
  <p class="mt-1 text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-comment"></i> {{ donnee['decision'].decision }} : {{ donnee['decision'].motif }} ({{ donnee['decision'].par?.nom }})</p>
}
@if (erreur()) { <p class="mt-1 text-xs text-rose-700 dark:text-rose-300" role="alert">{{ erreur() }}</p> }
@if (mode(); as m) {
  <form class="mt-2 flex flex-wrap items-end gap-2" (ngSubmit)="confirmer(m)">
    <div class="min-w-[14rem] flex-1">
      <label class="label text-xs" [for]="'motif-' + donnee['id']">Motif ({{ m === 'archiver' ? 'archivage' : m === 'rejeter' ? 'rejet' : 'correction demandée' }}) <span class="req">*</span></label>
      <input [id]="'motif-' + donnee['id']" name="motif" class="input py-1.5" [(ngModel)]="motif" required>
    </div>
    <button type="button" class="btn-ghost py-1.5 text-xs" (click)="mode.set(null)">Annuler</button>
    <button type="submit" class="btn-primary py-1.5 text-xs" [disabled]="envoi() || !motif.trim()">Confirmer</button>
  </form>
}
@if (historique(); as h) {
  <div class="mt-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
    <div class="mb-2 flex items-center justify-between"><strong>Historique (v{{ h['version'] }})</strong><button type="button" class="btn-ghost px-2 py-0.5 text-xs" (click)="historique.set(null)"><i class="fa-solid fa-xmark"></i></button></div>
    <ol class="space-y-1.5">
      @for (e of h['historique']; track $index) {
        <li class="border-l-2 border-brand-200 pl-2 dark:border-brand-500/40">
          <span class="font-medium">{{ e.operation }}</span> · v{{ e.version }} · {{ e.par?.nom }} ({{ e.par?.role }}) · {{ e.le | date:'dd/MM/yyyy HH:mm' }}
          @if (e.ancienStatut && e.ancienStatut !== e.nouveauStatut) { · {{ e.ancienStatut }} → {{ e.nouveauStatut }} }
          @if (e.motif) { <span class="block text-slate-500">Motif : {{ e.motif }}</span> }
          @for (c of changements(e); track c.champ) {
            <span class="block text-slate-500">{{ c.champ }} : <del>{{ c.avant | json }}</del> → <strong>{{ c.apres | json }}</strong></span>
          }
        </li>
      }
    </ol>
    @if (h['versionsPrecedentes']?.length) {
      <p class="mt-2 font-medium">Versions précédentes</p>
      <ul>@for (v of h['versionsPrecedentes']; track v.id) { <li>v{{ v.version }} — {{ v.statut }} — {{ v.le | date:'dd/MM/yyyy' }}</li> }</ul>
    }
  </div>
}`,
})
export class EpiValidationComponent {
  @Input({ required: true }) type!: TypeDonnee;
  @Input({ required: true }) donnee!: Donnee;
  @Input() archivable = true;
  @Output() change = new EventEmitter<Donnee>();

  epi = inject(EpidemiologieService);
  readonly couleur = couleurStatutDonnee;
  mode = signal<'rejeter' | 'corriger' | 'archiver' | null>(null);
  historique = signal<Donnee | null>(null);
  erreur = signal('');
  envoi = signal(false);
  motif = '';

  changements(e: Donnee): { champ: string; avant: unknown; apres: unknown }[] {
    return Object.entries(e['changements'] ?? {}).map(([champ, v]) => ({ champ, avant: (v as Donnee)['avant'], apres: (v as Donnee)['apres'] }));
  }

  private async executer(action: () => Promise<Donnee>): Promise<void> {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const d = await action();
      this.mode.set(null);
      this.motif = '';
      this.change.emit(d);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  soumettre() { return this.executer(() => this.epi.soumettre(this.type, this.donnee['id'])); }
  decider(d: 'valider') { return this.executer(() => this.epi.decider(this.type, this.donnee['id'], d)); }
  confirmer(m: 'rejeter' | 'corriger' | 'archiver') {
    return this.executer(() => (m === 'archiver' ? this.epi.archiver(this.type, this.donnee['id'], this.motif) : this.epi.decider(this.type, this.donnee['id'], m, this.motif)));
  }
  async voirHistorique() {
    if (this.historique()) return this.historique.set(null);
    try {
      this.historique.set(await this.epi.historique(this.type, this.donnee['id']));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
