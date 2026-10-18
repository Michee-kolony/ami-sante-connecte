import { Component, inject } from '@angular/core';
import { Langue, LangueService } from './langue.service';
import { TraduirePipe } from './traduire.pipe';

@Component({
  selector: 'app-langue-toggle',
  standalone: true,
  imports: [TraduirePipe],
  template: `
    <div class="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
         role="radiogroup" [attr.aria-label]="'Langue' | t">
      @for (o of options; track o.code) {
        <button type="button" role="radio" [attr.aria-checked]="service.langue() === o.code" [title]="o.nom"
                class="flex h-8 min-w-8 items-center justify-center rounded-full px-2 transition"
                [class]="service.langue() === o.code
                  ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'"
                (click)="service.definir(o.code)">
          {{ o.court }}
        </button>
      }
    </div>
  `,
})
export class LangueToggleComponent {
  service = inject(LangueService);

  options: { code: Langue; court: string; nom: string }[] = [
    { code: 'fr', court: 'FR', nom: 'Français' },
    { code: 'ln', court: 'LN', nom: 'Lingála' },
  ];
}
