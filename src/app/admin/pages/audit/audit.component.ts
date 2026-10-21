import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dateHeureFr } from '../../data/format';
import { EntreeJournal, PatientesService } from '../../data/patientes.service';
import { SessionService, messageErreur } from '../../data/session.service';

/** Journal d'audit du dossier médical (médecin chef) : ajout seul, sans contenu clinique. */
@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="mx-auto max-w-6xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Journal d’audit</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Ouvertures de dossiers, consultations, finalisations, addenda, rendez-vous et accès refusés. Ni modifiable ni supprimable ; aucun contenu clinique n’y figure.</p>
    </div>
    <div class="flex items-center gap-2">
      <div class="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800">
        @for (f of [{ k: '', l: 'Tout' }, { k: 'refusé', l: 'Refus d’accès' }]; track f.k) {
          <button type="button" class="rounded-lg px-3 py-1.5 transition" (click)="filtrer(f.k)"
                  [class]="resultat === f.k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'">{{ f.l }}</button>
        }
      </div>
      <span class="badge bg-slate-100 dark:bg-slate-800 py-1.5 text-slate-600 dark:text-slate-300"><i class="fa-solid fa-lock"></i> Lecture seule</span>
    </div>
  </div>

  @if (erreur) {
    <div class="card flex flex-col items-center gap-3 p-10 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><i class="fa-solid fa-shield-halved text-xl"></i></div>
      <p class="font-semibold text-slate-900 dark:text-white">Journal réservé au médecin chef</p>
      <p class="max-w-md text-sm text-slate-500 dark:text-slate-400">{{ erreur }}</p>
    </div>
  } @else {
    <div class="card overflow-hidden">
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @if (chargement && !entrees.length) {
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <li class="flex gap-4 px-5 py-4" aria-hidden="true"><div class="skeleton h-10 w-10 rounded-xl"></div><div class="flex-1 space-y-2"><div class="skeleton h-4 w-60"></div><div class="skeleton h-3 w-40"></div></div></li>
          }
        }
        @for (a of entrees; track a.id) {
          @let s = style(a);
          <li class="flex gap-4 px-5 py-4">
            <div class="flex h-10 w-10 flex-none items-center justify-center rounded-xl {{ s.c }}"><i class="fa-solid {{ s.i }}"></i></div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p class="font-medium text-slate-900 dark:text-white">{{ a.libelle }}</p>
                @if (a.resultat === 'refusé') { <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">refusé</span> }
                @if (a.patienteNumero) { <a [routerLink]="['/admin/patientes', a.patienteNumero]" class="font-mono text-xs text-brand-700 hover:underline dark:text-brand-300">{{ a.patienteNumero }}</a> }
              </div>
              @if (a.details?.['chemin']) { <p class="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{{ a.details?.['chemin'] }}</p> }
              <p class="mt-1 text-xs text-slate-400"><i class="fa-regular fa-user mr-1"></i>{{ a.acteur ? a.acteur.nom + ' · ' + a.acteur.role + ' · ' + a.acteur.matricule : 'Système' }}</p>
            </div>
            <time class="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{{ dateHeure(a.le) }}</time>
          </li>
        } @empty {
          @if (!chargement) { <li class="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Aucune entrée.</li> }
        }
      </ul>
      @if (total > entrees.length) {
        <button type="button" class="w-full border-t border-slate-100 px-5 py-3 text-xs font-semibold text-brand-700 hover:bg-slate-50 dark:border-slate-800 dark:text-brand-300 dark:hover:bg-slate-800/50" (click)="suite()" [disabled]="chargement">
          {{ chargement ? 'Chargement…' : 'Afficher les entrées plus anciennes (' + (total - entrees.length) + ')' }}
        </button>
      }
    </div>
  }
</div>
  `,
})
export class AuditComponent {
  private service = inject(PatientesService);
  session = inject(SessionService);
  dateHeure = dateHeureFr;

  entrees: EntreeJournal[] = [];
  total = 0;
  page = 1;
  resultat = '';
  chargement = false;
  erreur = '';

  constructor() {
    this.charger();
  }

  filtrer(resultat: string): void {
    this.resultat = resultat;
    this.page = 1;
    this.entrees = [];
    this.charger();
  }

  suite(): void {
    this.page++;
    this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement = true;
    try {
      const r = await this.service.journalGlobal(this.page, this.resultat || undefined);
      this.entrees = [...this.entrees, ...r.entrees];
      this.total = r.total;
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  style(a: EntreeJournal): { c: string; i: string } {
    if (a.resultat === 'refusé') return { c: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', i: 'fa-ban' };
    if (a.action.endsWith('.lecture') || a.action === 'patiente.recherche') return { c: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300', i: 'fa-eye' };
    if (a.action === 'patiente.creation') return { c: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400', i: 'fa-file-circle-plus' };
    if (a.action.startsWith('consultation')) return { c: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300', i: 'fa-stethoscope' };
    if (a.action.startsWith('rdv')) return { c: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400', i: 'fa-calendar-check' };
    return { c: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400', i: 'fa-pen' };
  }
}
