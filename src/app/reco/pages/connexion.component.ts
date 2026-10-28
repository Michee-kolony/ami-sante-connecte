import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { messageErreur } from '../../admin/data/session.service';
import { RecoService } from '../reco.service';

/** Connexion du relais communautaire avec le matricule et le mot de passe remis par son superviseur. */
@Component({
  selector: 'app-connexion-reco',
  standalone: true,
  imports: [FormsModule, ThemeToggleComponent],
  template: `
<div class="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-brand-950 px-4 py-10">
  <div aria-hidden="true" class="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl"></div>
  <div aria-hidden="true" class="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"></div>
  <div class="absolute right-4 top-4"><app-theme-toggle /></div>

  <div class="relative w-full max-w-sm">
    <div class="mb-8 text-center">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl text-accent-300"><i class="fa-solid fa-people-arrows"></i></span>
      <h1 class="mt-4 text-2xl font-bold tracking-tight text-white">Espace RECO</h1>
      <p class="mt-1 text-sm text-slate-300">Relance communautaire : vos tâches, même sans réseau</p>
    </div>

    <form class="space-y-5 rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900" (ngSubmit)="connecter()">
      <div>
        <label class="label" for="matricule">Matricule</label>
        <input id="matricule" name="matricule" class="input font-mono uppercase" autocomplete="username" placeholder="RECO-0001" [(ngModel)]="matricule" required>
      </div>
      <div>
        <label class="label" for="mdp">Mot de passe</label>
        <div class="relative">
          <input id="mdp" name="mdp" [type]="voir ? 'text' : 'password'" class="input pr-10" autocomplete="current-password" [(ngModel)]="motDePasse" required>
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" (click)="voir = !voir" [attr.aria-label]="voir ? 'Masquer' : 'Afficher'"><i class="fa-regular" [class]="voir ? 'fa-eye-slash' : 'fa-eye'"></i></button>
        </div>
      </div>
      @if (erreur) {
        <p class="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert"><i class="fa-solid fa-circle-exclamation mt-0.5"></i> {{ erreur }}</p>
      }
      <button type="submit" class="btn-primary w-full py-3" [disabled]="envoi || !matricule || !motDePasse">
        @if (envoi) { <i class="fa-solid fa-spinner fa-spin"></i> Connexion… } @else { Se connecter <i class="fa-solid fa-arrow-right"></i> }
      </button>
      <p class="text-center text-xs text-slate-500 dark:text-slate-400">La première connexion se fait avec du réseau. Mot de passe oublié ou téléphone perdu : prévenez votre superviseur.</p>
    </form>
  </div>
</div>
  `,
})
export class ConnexionRecoComponent {
  private service = inject(RecoService);
  private router = inject(Router);
  matricule = '';
  motDePasse = '';
  voir = false;
  envoi = false;
  erreur = '';

  async connecter(): Promise<void> {
    this.envoi = true;
    this.erreur = '';
    try {
      await this.service.connecter(this.matricule.trim().toUpperCase(), this.motDePasse);
      this.motDePasse = '';
      this.router.navigateByUrl('/reco');
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
