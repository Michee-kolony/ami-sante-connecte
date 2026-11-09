import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ComiteSessionService } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

/** Connexion des membres du comité de pilotage (comptes distincts du personnel soignant). */
@Component({
  selector: 'app-comite-connexion',
  standalone: true,
  imports: [FormsModule, RouterLink, ThemeToggleComponent],
  template: `
    <div class="grid min-h-screen lg:grid-cols-2">
      <section class="relative hidden overflow-hidden bg-brand-950 lg:flex lg:py-12">
        <div class="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl"></div>
        <div class="container relative flex max-w-xl flex-col justify-between">
          <div class="logo-plate relative w-52 rounded-xl bg-white p-3 shadow-xl shadow-black/30">
            <img src="images/logo-full.webp" alt="AMI Santé Connect" class="h-auto w-full" width="610" height="261">
          </div>
          <div class="relative max-w-lg">
            <span class="badge bg-white/10 py-1 text-accent-300 ring-1 ring-white/15"><i class="fa-solid fa-landmark"></i> Comité de pilotage</span>
            <h1 class="mt-5 text-4xl font-bold leading-tight tracking-tight text-white">Piloter le projet sur l’ensemble des établissements.</h1>
            <p class="mt-4 text-base leading-relaxed text-slate-300">Enregistrez les établissements sanitaires et leur médecin chef, et suivez les indicateurs consolidés de toute la plateforme.</p>
            <ul class="mt-10 space-y-4">
              <li class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10 text-brand-300"><i class="fa-solid fa-hospital"></i></span>
                <div><p class="font-medium text-white">Établissements</p><p class="text-sm text-slate-400">Chaque structure est raccordée avec son médecin chef.</p></div>
              </li>
              <li class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10 text-accent-300"><i class="fa-solid fa-chart-column"></i></span>
                <div><p class="font-medium text-white">Vue globale</p><p class="text-sm text-slate-400">Totaux de tout ce que les établissements enregistrent.</p></div>
              </li>
              <li class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10 text-accent-300"><i class="fa-solid fa-user-shield"></i></span>
                <div><p class="font-medium text-white">Confidentialité</p><p class="text-sm text-slate-400">Agrégats seulement : aucun dossier nominatif de patiente.</p></div>
              </li>
            </ul>
          </div>
          <p class="relative text-xs text-slate-500">AMI Santé Connect · Mère · Enfant · Communauté · Avenir</p>
        </div>
      </section>

      <section class="relative flex flex-col bg-white px-4 py-10 dark:bg-slate-950 sm:px-10">
        <div class="flex items-center justify-between">
          <a routerLink="/" class="text-sm font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400"><i class="fa-solid fa-arrow-left mr-1.5"></i>Retour au site</a>
          <app-theme-toggle />
        </div>
        <div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-solid fa-landmark"></i></span>
          <h2 class="mt-5 text-2xl font-bold text-slate-900 dark:text-white">Espace du comité de pilotage</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Connectez-vous avec le compte qui vous a été attribué.</p>

          <form class="mt-8 space-y-5" (ngSubmit)="valider()" #f="ngForm" novalidate>
            <div>
              <label class="label" for="c-email">E-mail</label>
              <input id="c-email" name="email" type="email" class="input" required autocomplete="username" [(ngModel)]="email">
            </div>
            <div>
              <label class="label" for="c-mdp">Mot de passe</label>
              <div class="relative">
                <input id="c-mdp" name="motDePasse" class="input pr-11" required autocomplete="current-password" [type]="voir ? 'text' : 'password'" [(ngModel)]="motDePasse">
                <button type="button" class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600" (click)="voir = !voir" [attr.aria-label]="voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                  <i class="fa-solid" [class]="voir ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
            </div>
            @if (erreur) {
              <p class="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert"><i class="fa-solid fa-circle-exclamation mt-0.5"></i>{{ erreur }}</p>
            }
            <button type="submit" class="btn-primary w-full py-3" [disabled]="envoi || !email || !motDePasse">
              <i class="fa-solid" [class]="envoi ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'"></i> Se connecter
            </button>
          </form>
          <p class="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">Personnel soignant ? <a routerLink="/admin/connexion" class="font-semibold text-brand-700 hover:underline dark:text-brand-300">Espace professionnel</a></p>
        </div>
      </section>
    </div>
  `,
})
export class ComiteConnexionComponent {
  private session = inject(ComiteSessionService);
  private router = inject(Router);
  email = '';
  motDePasse = '';
  voir = false;
  envoi = false;
  erreur = '';

  async valider(): Promise<void> {
    if (this.envoi) return;
    this.envoi = true;
    this.erreur = '';
    try {
      await this.session.connecter(this.email.trim(), this.motDePasse);
      this.router.navigateByUrl(this.session.membre()?.doitChangerMotDePasse ? '/comite/compte' : '/comite/tableau-de-bord');
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
