import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { BilanRappels, PatientesService } from '../data/patientes.service';
import { messageErreur } from '../data/session.service';

/**
 * Bouton de l'en-tête (médecins) : envoie à chaque patiente ayant un rendez-vous dans les 30
 * prochains jours une notification push avec la date de son prochain rendez-vous. Confirmation,
 * puis bilan de l'envoi, dans un panneau déroulant.
 */
@Component({
  selector: 'app-rappels-rdv',
  standalone: true,
  template: `
<div class="relative">
  <button type="button" class="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
          (click)="basculer()" [disabled]="envoi()" [attr.aria-expanded]="ouvert()" title="Envoyer les rappels de rendez-vous aux patientes">
    <i class="fa-solid" [class.fa-paper-plane]="!envoi()" [class.fa-spinner]="envoi()" [class.fa-spin]="envoi()"></i>
    <span class="hidden md:inline">{{ envoi() ? 'Envoi…' : 'Rappels RDV' }}</span>
  </button>

  @if (ouvert()) {
    <div class="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-label="Rappels de rendez-vous">
      @if (bilan(); as b) {
        <p class="flex items-start gap-2 text-accent-800 dark:text-accent-200">
          <i class="fa-solid fa-circle-check mt-0.5"></i>
          <span>
            @if (b.patientes) {
              Rappels envoyés à {{ b.notifiees }} patiente{{ b.notifiees > 1 ? 's' : '' }} sur {{ b.patientes }} ({{ b.rendezVous }} rendez-vous dans les {{ b.horizonJours }} jours).
              @if (b.patientes > b.notifiees) { <span class="block mt-1 text-xs text-slate-500 dark:text-slate-400">Les autres n’ont pas encore installé l’application ou n’ont pas autorisé les notifications.</span> }
            } @else {
              Aucune patiente n’a de rendez-vous dans les {{ b.horizonJours }} prochains jours : aucun rappel envoyé.
            }
          </span>
        </p>
        <div class="mt-3 flex justify-end"><button class="btn-secondary px-3 py-1.5 text-xs" (click)="ouvert.set(false)">Fermer</button></div>
      } @else if (erreur()) {
        <p class="flex items-start gap-2 text-rose-700 dark:text-rose-300" role="alert"><i class="fa-solid fa-circle-exclamation mt-0.5"></i><span>{{ erreur() }}</span></p>
        <div class="mt-3 flex justify-end"><button class="btn-secondary px-3 py-1.5 text-xs" (click)="ouvert.set(false)">Fermer</button></div>
      } @else {
        <p class="font-semibold text-slate-900 dark:text-white"><i class="fa-solid fa-bell mr-1 text-brand-600 dark:text-brand-400"></i> Envoyer les rappels de rendez-vous ?</p>
        <p class="mt-1 text-slate-600 dark:text-slate-300">Chaque patiente ayant un rendez-vous dans les 30 prochains jours recevra sur son téléphone la date de son prochain rendez-vous (le sien ou celui de son enfant).</p>
        <div class="mt-3 flex justify-end gap-2">
          <button class="btn-secondary px-3 py-1.5 text-xs" (click)="ouvert.set(false)">Annuler</button>
          <button class="btn-primary px-3 py-1.5 text-xs" (click)="envoyer()"><i class="fa-solid fa-check"></i> Envoyer</button>
        </div>
      }
    </div>
  }
</div>
  `,
})
export class RappelsRdvComponent {
  private service = inject(PatientesService);
  private hote = inject(ElementRef<HTMLElement>);
  ouvert = signal(false);
  envoi = signal(false);
  bilan = signal<BilanRappels | null>(null);
  erreur = signal('');

  basculer() {
    this.bilan.set(null);
    this.erreur.set('');
    this.ouvert.update(o => !o);
  }

  envoyer() {
    this.ouvert.set(false);
    this.envoi.set(true);
    this.service.envoyerRappelsRendezVous()
      .then(b => this.bilan.set(b))
      .catch(err => this.erreur.set(messageErreur(err)))
      .finally(() => {
        this.envoi.set(false);
        this.ouvert.set(true);
      });
  }

  /** Clic en dehors ou touche Échap : le panneau se ferme. */
  @HostListener('document:click', ['$event'])
  clicDehors(e: MouseEvent) {
    if (this.ouvert() && !this.hote.nativeElement.contains(e.target as Node)) this.ouvert.set(false);
  }

  @HostListener('document:keydown.escape')
  echap() {
    this.ouvert.set(false);
  }
}
