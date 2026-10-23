import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { messageErreur } from '../../admin/data/session.service';
import { EspaceMamanService } from '../espace-maman.service';

/** Connexion de la maman avec l'e-mail et le mot de passe choisis à son enregistrement au centre. */
@Component({
  selector: 'app-connexion-maman',
  standalone: true,
  imports: [FormsModule, ThemeToggleComponent],
  template: `
<div class="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-brand-950 px-4 py-10">
  <div aria-hidden="true" class="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-pink-500/25 blur-3xl"></div>
  <div aria-hidden="true" class="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"></div>
  <div class="absolute right-4 top-4"><app-theme-toggle /></div>

  <div class="relative w-full max-w-sm">
    <div class="mb-8 text-center">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl text-pink-300"><i class="fa-solid fa-person-breastfeeding"></i></span>
      <h1 class="mt-4 text-2xl font-bold tracking-tight text-white">Espace maman</h1>
      <p class="mt-1 text-sm text-slate-300">Vos rendez-vous et le carnet de vaccination de votre bébé</p>
    </div>

    <form class="space-y-5 rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900" (ngSubmit)="connecter()">
      <div>
        <label class="label" for="email">Adresse e-mail</label>
        <input id="email" name="email" type="email" class="input" autocomplete="username" [(ngModel)]="email" required>
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
      <button type="submit" class="btn-primary w-full py-3" [disabled]="envoi || !email || !motDePasse">
        @if (envoi) { <i class="fa-solid fa-spinner fa-spin"></i> Connexion… } @else { Se connecter <i class="fa-solid fa-arrow-right"></i> }
      </button>
      <p class="text-center text-xs text-slate-500 dark:text-slate-400">Mot de passe oublié ? Adressez-vous à votre centre de santé.</p>
    </form>
  </div>
</div>
  `,
})
export class ConnexionMamanComponent {
  private service = inject(EspaceMamanService);
  private router = inject(Router);
  email = '';
  motDePasse = '';
  voir = false;
  envoi = false;
  erreur = '';

  async connecter(): Promise<void> {
    this.envoi = true;
    this.erreur = '';
    try {
      await this.service.connecter(this.email, this.motDePasse);
      this.router.navigateByUrl('/maman');
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
