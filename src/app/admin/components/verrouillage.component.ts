import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HorsLigneService } from '../data/hors-ligne/hors-ligne.service';
import { HORS_LIGNE_MAX_MS, SessionService } from '../data/session.service';

/**
 * Protection de l'appareil (mode hors connexion) :
 *   - écran verrouillé après 10 minutes sans activité, déverrouillé par le mot de passe vérifié sur
 *     l'appareil (fonctionne sans réseau) ;
 *   - au-delà de 7 jours sans contact avec le serveur, travail bloqué jusqu'à une connexion en ligne
 *     (droits et comptes revérifiés) ; les saisies en attente restent sur l'appareil.
 */
@Component({
  selector: 'app-verrouillage',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
@if (session.connecte() && (session.verrouille() || session.horsLigneTropLongtemps())) {
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-brand-950/95 px-4 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="titre-verrou">
    <form class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900" (ngSubmit)="deverrouiller()">
      @if (session.horsLigneTropLongtemps()) {
        <i class="fa-solid fa-cloud-arrow-up text-3xl text-amber-500"></i>
        <h2 id="titre-verrou" class="text-lg font-semibold text-slate-900 dark:text-white">Connexion au serveur requise</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Cet appareil n’a pas joint le serveur depuis le {{ session.dernierContactServeur() | date: 'dd/MM/yyyy HH:mm' }} (plus de {{ joursMax }} jours).
          Pour la sécurité des dossiers, retrouvez une connexion internet puis reconnectez-vous. Vos {{ hl.enAttente() }} saisie(s) en attente sont gardées.
        </p>
        <button type="button" class="btn-primary w-full" (click)="verifier()" [disabled]="verification()"><i class="fa-solid fa-satellite-dish"></i> Vérifier la connexion</button>
        <button type="button" class="text-xs text-slate-500 underline" (click)="session.deconnecter()">Se reconnecter</button>
      } @else {
        <i class="fa-solid fa-lock text-3xl text-brand-600"></i>
        <h2 id="titre-verrou" class="text-lg font-semibold text-slate-900 dark:text-white">Session verrouillée</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">Verrouillée après 10 minutes sans activité. {{ session.soignant()?.prenom }} {{ session.soignant()?.nom }}, saisissez votre mot de passe (fonctionne sans réseau).</p>
        <input class="input" type="password" name="mdp" autocomplete="current-password" [(ngModel)]="motDePasse" aria-label="Mot de passe" autofocus>
        @if (erreur()) { <p class="text-sm text-rose-600" role="alert">{{ erreur() }}</p> }
        <button type="submit" class="btn-primary w-full" [disabled]="!motDePasse">Déverrouiller</button>
        <button type="button" class="text-xs text-slate-500 underline" (click)="session.deconnecter()">Ce n’est pas mon compte : se déconnecter</button>
      }
    </form>
  </div>
}
  `,
})
export class VerrouillageComponent {
  readonly session = inject(SessionService);
  readonly hl = inject(HorsLigneService);
  readonly joursMax = HORS_LIGNE_MAX_MS / 86_400_000;
  motDePasse = '';
  erreur = signal('');
  verification = signal(false);

  async deverrouiller(): Promise<void> {
    const ok = await this.session.deverrouiller(this.motDePasse);
    this.motDePasse = '';
    this.erreur.set(ok ? '' : 'Mot de passe incorrect, ou empreinte absente sur cet appareil : reconnectez-vous en ligne.');
  }

  async verifier(): Promise<void> {
    this.verification.set(true);
    await this.hl.verifierServeur();
    this.verification.set(false);
  }
}
