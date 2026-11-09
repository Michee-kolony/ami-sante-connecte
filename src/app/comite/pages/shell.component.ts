import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ComiteSessionService } from '../comite-session.service';
import { ComiteMessagerieService } from '../comite-messagerie.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

/** Cadre de l'espace du comité de pilotage : navigation latérale et contenu. */
@Component({
  selector: 'app-comite-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
  template: `
    <div class="admin-glass isolate min-h-screen lg:flex">
      <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div class="absolute -top-40 left-[25%] h-[32rem] w-[32rem] rounded-full bg-brand-300/60 blur-3xl dark:bg-brand-600/30"></div>
        <div class="absolute -right-32 top-[30%] h-[30rem] w-[30rem] rounded-full bg-accent-300/50 blur-3xl dark:bg-accent-600/20"></div>
      </div>

      @if (menuOpen) {
        <div class="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" (click)="menuOpen = false"></div>
      }

      <aside class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-brand-950/90 text-slate-300 backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
             [class.-translate-x-full]="!menuOpen">
        <a routerLink="/comite/tableau-de-bord" class="logo-plate mb-4 ml-6 mt-5 block w-32 rounded-lg bg-white p-1.5 shadow-lg shadow-black/20">
          <img src="images/logo-full.webp" alt="AMI Santé Connect" class="h-auto w-full" width="610" height="261">
        </a>
        <div class="mx-4 mb-4 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Espace</p>
          <p class="mt-1 flex items-center gap-2 text-sm font-medium text-white"><i class="fa-solid fa-landmark text-accent-400"></i> Comité de pilotage</p>
          <p class="mt-0.5 text-xs text-slate-400">Tous les établissements</p>
        </div>
        <nav class="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="!bg-white/10 !text-white" (click)="menuOpen = false"
               class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-white/5 hover:text-white">
              <i class="fa-solid {{ item.icon }} w-5 text-center text-slate-400 group-hover:text-white"></i>
              <span class="flex-1">{{ item.label }}</span>
              @if (item.path === '/comite/messages' && messagerie.totalNonLus()) {
                <span class="rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-semibold text-white">{{ messagerie.totalNonLus() }}</span>
              }
            </a>
          }
        </nav>
        @if (session.membre(); as m) {
          <div class="border-t border-white/10 p-4">
            <div class="flex items-center gap-3">
              <a routerLink="/comite/compte" title="Mon profil" class="flex-none">
                @if (m.photo) {
                  <img [src]="m.photo" alt="" class="h-10 w-10 rounded-full object-cover ring-2 ring-white/20">
                } @else {
                  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white">{{ m.prenom.charAt(0) }}{{ m.nom.charAt(0) }}</span>
                }
              </a>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-white">{{ m.prenom }} {{ m.nom }}</p>
                <p class="truncate text-xs text-slate-400">{{ m.fonction || 'Membre du comité' }}</p>
              </div>
              <button type="button" class="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" (click)="session.deconnecter()" title="Se déconnecter" aria-label="Se déconnecter">
                <i class="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </div>
        }
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/70 sm:px-6">
          <button type="button" class="btn-ghost -ml-2 px-3 lg:hidden" (click)="menuOpen = true" aria-label="Menu"><i class="fa-solid fa-bars text-lg"></i></button>
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300"><i class="fa-solid fa-landmark mr-1.5 text-brand-600 dark:text-brand-400"></i>Comité de pilotage · AMI Santé Connect</p>
          <div class="ml-auto"><app-theme-toggle /></div>
        </header>
        <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ComiteShellComponent {
  session = inject(ComiteSessionService);
  /** Messages non lus (médecins chefs et groupe de pilotage) : badge du menu, en temps réel. */
  messagerie = inject(ComiteMessagerieService);
  menuOpen = false;

  constructor() {
    // Compte relu à l'ouverture de l'espace : un changement de rôle s'applique sans reconnexion.
    this.session.rafraichir().catch(() => {});
  }
  nav = [
    { label: 'Tableau de bord', icon: 'fa-chart-pie', path: '/comite/tableau-de-bord' },
    { label: 'Établissements sanitaires', icon: 'fa-hospital', path: '/comite/etablissements' },
    { label: 'Personnel soignant', icon: 'fa-user-doctor', path: '/comite/personnel' },
    { label: 'Relais communautaires', icon: 'fa-people-arrows', path: '/comite/recos' },
    { label: 'Ambulances et chauffeurs', icon: 'fa-truck-medical', path: '/comite/flotte' },
    { label: 'Patientes et enfants', icon: 'fa-person-pregnant', path: '/comite/patientes' },
    { label: 'Messages', icon: 'fa-comments', path: '/comite/messages' },
    { label: 'Membres du comité', icon: 'fa-people-group', path: '/comite/membres' },
    { label: 'Mon profil', icon: 'fa-user-gear', path: '/comite/compte' },
  ];
}
