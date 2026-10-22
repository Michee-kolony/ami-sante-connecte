import { Component, model } from '@angular/core';

/**
 * Réponse oui / non de la fiche CPN : null tant que l'élément n'est pas évalué.
 * Un second clic sur la réponse choisie revient à « non évalué ». Désactivé par un
 * <fieldset disabled> parent (consultation finalisée).
 */
@Component({
  selector: 'app-oui-non',
  standalone: true,
  host: { class: 'inline-flex flex-none' },
  template: `
<span class="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold dark:border-slate-700" role="group">
  <button type="button" class="px-3 py-1.5 transition disabled:cursor-default" [attr.aria-pressed]="valeur() === true"
          [class]="valeur() === true ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'"
          (click)="choisir(true)">Oui</button>
  <button type="button" class="border-l border-slate-200 px-3 py-1.5 transition disabled:cursor-default dark:border-slate-700" [attr.aria-pressed]="valeur() === false"
          [class]="valeur() === false ? 'bg-slate-700 text-white dark:bg-slate-600' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'"
          (click)="choisir(false)">Non</button>
</span>`,
})
export class OuiNonComponent {
  readonly valeur = model<boolean | null>(null);

  choisir(v: boolean): void {
    this.valeur.set(this.valeur() === v ? null : v);
  }
}
