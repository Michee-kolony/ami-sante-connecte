import { Component, HostListener } from '@angular/core';
import { TraduirePipe } from './i18n/traduire.pipe';

/** Bouton flottant qui apparaît après un peu de défilement et ramène en haut de la page. */
@Component({
  selector: 'app-retour-haut',
  standalone: true,
  imports: [TraduirePipe],
  template: `
    <button type="button" (click)="remonter()"
            [attr.aria-label]="'Retour en haut' | t" [title]="'Retour en haut' | t" [attr.tabindex]="visible ? 0 : -1"
            class="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/30 ring-4 ring-white/70 transition duration-300 hover:-translate-y-1 hover:bg-brand-800 focus:outline-none focus-visible:ring-brand-300 dark:bg-brand-600 dark:ring-slate-900/70 dark:hover:bg-brand-500 sm:bottom-8 sm:right-8"
            [class]="visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'">
      <i class="fa-solid fa-chevron-up"></i>
    </button>
  `,
})
export class RetourHautComponent {
  visible = false;

  @HostListener('window:scroll')
  onScroll(): void {
    this.visible = window.scrollY > 400;
  }

  remonter(): void {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduit ? 'auto' : 'smooth' });
  }
}
