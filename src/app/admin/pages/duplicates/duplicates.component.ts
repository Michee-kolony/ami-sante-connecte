import { Component } from '@angular/core';

interface Champ { label: string; a: string; b: string; }

@Component({
  selector: 'app-duplicates',
  standalone: true,
  template: `
<div class="mx-auto max-w-6xl space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Doublons potentiels</h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Aucune fusion automatique. Un utilisateur habilité confirme s’il s’agit de la même personne.</p>
  </div>

  @if (decision) {
    <div class="flex items-center gap-3 rounded-xl border border-accent-200 dark:border-accent-500/30 bg-accent-50 dark:bg-accent-500/10 px-4 py-3 text-sm text-accent-900 dark:text-accent-300">
      <i class="fa-solid fa-circle-check text-accent-500"></i>
      Décision « {{ decision }} » enregistrée et journalisée avec le motif et l’auteur.
    </div>
  }

  <div class="card overflow-hidden">
    <div class="card-header">
      <h2 class="card-title"><i class="fa-solid fa-clone text-violet-500"></i> Correspondance n° 1 sur 2</h2>
      <span class="badge bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-500/30">Score de similarité : 78 %</span>
    </div>

    <div class="grid grid-cols-[1fr_auto_1fr] items-stretch gap-0 border-b border-slate-100 dark:border-slate-800 text-sm">
      <div class="p-5">
        <p class="font-mono text-xs text-slate-500 dark:text-slate-400">AMI-LOC-7F3A2C</p>
        <p class="mt-1 font-semibold text-slate-900 dark:text-white">Divine NGOMA LUSAMBA</p>
        <span class="badge mt-2 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"><i class="fa-solid fa-cloud-arrow-up"></i> Créée hors connexion</span>
      </div>
      <div class="flex items-center px-2 text-slate-300"><i class="fa-solid fa-arrows-left-right"></i></div>
      <div class="p-5 text-right">
        <p class="font-mono text-xs text-slate-500 dark:text-slate-400">AMI-2026-000097</p>
        <p class="mt-1 font-semibold text-slate-900 dark:text-white">Divine NGOMA</p>
        <span class="badge mt-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Clôturé · 2025</span>
      </div>
    </div>

    <table class="min-w-full text-sm">
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (c of champs; track c.label) {
          <tr>
            <td class="w-1/3 px-5 py-3 text-slate-800 dark:text-slate-100" [class]="c.a === c.b ? 'bg-accent-50 dark:bg-accent-500/10' : ''">{{ c.a }}</td>
            <td class="whitespace-nowrap px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
              {{ c.label }}
              <i class="fa-solid ml-1" [class]="c.a === c.b ? 'fa-equals text-accent-500' : 'fa-not-equal text-amber-500'"></i>
            </td>
            <td class="w-1/3 px-5 py-3 text-right text-slate-800 dark:text-slate-100" [class]="c.a === c.b ? 'bg-accent-50 dark:bg-accent-500/10' : ''">{{ c.b }}</td>
          </tr>
        }
      </tbody>
    </table>

    <div class="space-y-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 p-5">
      <div>
        <label class="label" for="motif">Motif de la décision <span class="req">*</span></label>
        <textarea id="motif" rows="2" class="input" placeholder="ex. Confirmé avec la patiente : même personne, nouvelle grossesse."></textarea>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button class="btn-secondary" (click)="decision = 'à revoir plus tard'"><i class="fa-regular fa-clock"></i> Plus tard</button>
        <button class="btn-secondary" (click)="decision = 'personnes différentes'"><i class="fa-solid fa-people-arrows"></i> Personnes différentes</button>
        <button class="btn-primary" (click)="decision = 'même personne'"><i class="fa-solid fa-code-merge"></i> Même personne — fusionner</button>
      </div>
    </div>
  </div>
</div>
  `,
})
export class DuplicatesComponent {
  decision: string | null = null;

  champs: Champ[] = [
    { label: 'Nom', a: 'NGOMA', b: 'NGOMA' },
    { label: 'Postnom', a: 'LUSAMBA', b: '—' },
    { label: 'Prénom', a: 'Divine', b: 'Divine' },
    { label: 'Âge / naissance', a: '22 ans', b: '21 ans (2025)' },
    { label: 'Téléphone', a: '+243 97 410 2290', b: '+243 97 410 2290' },
    { label: 'Quartier', a: 'Kokolo, Lingwala', b: 'Kokolo, Lingwala' },
    { label: 'Pièce d’identité', a: '—', b: '—' },
  ];
}
