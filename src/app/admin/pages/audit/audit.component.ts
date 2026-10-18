import { Component } from '@angular/core';
import { AUDIT } from '../../data/mock-data';

@Component({
  selector: 'app-audit',
  standalone: true,
  template: `
<div class="mx-auto max-w-6xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Journal d’audit</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Connexions, consultations sensibles, corrections, fusions et exports. Non modifiable.</p>
    </div>
    <span class="badge bg-slate-100 dark:bg-slate-800 py-1.5 text-slate-600 dark:text-slate-300"><i class="fa-solid fa-lock"></i> Lecture seule</span>
  </div>

  <div class="card overflow-hidden">
    <ul class="divide-y divide-slate-100 dark:divide-slate-800">
      @for (a of entries; track a.date + a.action) {
        <li class="flex gap-4 px-5 py-4">
          <div class="flex h-10 w-10 flex-none items-center justify-center rounded-xl {{ style(a.type).c }}">
            <i class="fa-solid {{ style(a.type).i }}"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p class="font-medium text-slate-900 dark:text-white">{{ a.action }}</p>
              <span class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ a.cible }}</span>
            </div>
            <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{{ a.detail }}</p>
            <p class="mt-1 text-xs text-slate-400"><i class="fa-regular fa-user mr-1"></i>{{ a.auteur }} · {{ a.role }}</p>
          </div>
          <time class="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{{ a.date }}</time>
        </li>
      }
    </ul>
  </div>
</div>
  `,
})
export class AuditComponent {
  entries = AUDIT;

  style(type: string): { c: string; i: string } {
    const m: Record<string, { c: string; i: string }> = {
      'création': { c: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400', i: 'fa-file-circle-plus' },
      'modification': { c: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300', i: 'fa-pen' },
      'correction': { c: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400', i: 'fa-user-pen' },
      'consultation': { c: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300', i: 'fa-eye' },
      'connexion': { c: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400', i: 'fa-right-to-bracket' },
      'refus': { c: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', i: 'fa-ban' },
      'fusion': { c: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400', i: 'fa-code-merge' },
      'export': { c: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', i: 'fa-file-export' },
    };
    return m[type] ?? m['consultation'];
  }
}
