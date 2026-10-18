import { Component, inject } from '@angular/core';
import { ThemeMode, ThemeService } from './theme.service';
import { TraduirePipe } from './i18n/traduire.pipe';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [TraduirePipe],
  template: `
    <div class="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
         role="radiogroup" [attr.aria-label]="'Thème d’affichage' | t">
      @for (o of options; track o.mode) {
        <button type="button" role="radio" [attr.aria-checked]="theme.mode() === o.mode" [title]="o.label | t"
                class="flex h-8 w-8 items-center justify-center rounded-full text-sm transition"
                [class]="theme.mode() === o.mode
                  ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'"
                (click)="theme.set(o.mode)">
          <i class="fa-solid {{ o.icon }}"></i>
          <span class="sr-only">{{ o.label | t }}</span>
        </button>
      }
    </div>
  `,
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);

  options: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Mode clair', icon: 'fa-sun' },
    { mode: 'dark', label: 'Mode sombre', icon: 'fa-moon' },
    { mode: 'system', label: 'Selon l’appareil', icon: 'fa-desktop' },
  ];
}
