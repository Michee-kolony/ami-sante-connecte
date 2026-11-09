import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService } from '../../data/epidemiologie.service';

interface Lien { libelle: string; chemin: string; icone: string; numero?: number }

/**
 * Module ÉPIDÉMIOLOGIE : menu latéral permanent (ordre du cahier des charges, §3), filtres communs
 * (territoire, année) et sous-fenêtres chargées dans la zone de contenu.
 */
@Component({
  selector: 'app-epidemiologie',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
<div class="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
  <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">AMI Santé Connect</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Module Épidémiologie</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">Démographie, populations cibles, surveillance, couvertures, alertes et rapports.</p>
    </div>
    <!-- Filtres communs à toutes les sous-fenêtres -->
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-[16rem]">
        <label class="label text-xs" for="epi-entite">Territoire</label>
        <select id="epi-entite" class="input py-2" [ngModel]="epi.entite()" (ngModelChange)="epi.entite.set($event)">
          @for (e of epi.territoires(); track e.code) {
            <option [value]="e.code">{{ indentation(e.profondeur) }}{{ e.nom }} — {{ e.niveau }}</option>
          }
        </select>
      </div>
      <div class="w-28">
        <label class="label text-xs" for="epi-annee">Année</label>
        <select id="epi-annee" class="input py-2" [ngModel]="epi.annee()" (ngModelChange)="epi.annee.set(+$event)">
          @for (a of annees; track a) { <option [value]="a">{{ a }}</option> }
        </select>
      </div>
    </div>
  </div>

  @if (erreur()) { <p class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  <div class="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
    <!-- Menu permanent (ordinateur) / défilant (mobile) -->
    <nav aria-label="Sous-fenêtres du module Épidémiologie" class="mb-5 lg:mb-0">
      <div class="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-20 lg:block lg:space-y-4 lg:overflow-visible lg:pb-0">
        @for (g of groupes; track g.titre) {
          <div class="flex gap-1 lg:block lg:space-y-0.5">
            <p class="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 lg:block">{{ g.titre }}</p>
            @for (l of g.liens; track l.chemin) {
              <a [routerLink]="l.chemin" routerLinkActive="!bg-brand-700 !text-white dark:!bg-brand-600" [routerLinkActiveOptions]="{ exact: l.chemin === '.' }"
                 class="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white lg:whitespace-normal">
                <i class="fa-solid {{ l.icone }} w-4 text-center opacity-80"></i>
                <span>@if (l.numero) { <span class="tabular-nums">{{ l.numero }}.</span> }{{ l.libelle }}</span>
              </a>
            }
          </div>
        }
      </div>
    </nav>

    <section class="min-w-0">
      @if (pret()) { <router-outlet /> } @else {
        <div class="space-y-4" aria-hidden="true"><div class="skeleton h-28 w-full rounded-2xl"></div><div class="skeleton h-72 w-full rounded-2xl"></div></div>
      }
    </section>
  </div>
</div>`,
})
export class EpidemiologieComponent implements OnInit {
  epi = inject(EpidemiologieService);
  pret = signal(false);
  erreur = signal('');
  readonly annees = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + 1 - i);

  readonly groupes: { titre: string; liens: Lien[] }[] = [
    { titre: 'Vue générale', liens: [{ libelle: 'Tableau de bord épidémiologique', chemin: '.', icone: 'fa-chart-pie' }] },
    { titre: 'A. Démographie et planification', liens: [
      { numero: 1, libelle: 'Référentiel démographique', chemin: 'demographie', icone: 'fa-people-group' },
      { numero: 2, libelle: 'Paramètres et coefficients', chemin: 'parametres', icone: 'fa-sliders' },
      { numero: 3, libelle: 'Calcul des populations cibles', chemin: 'cibles', icone: 'fa-calculator' },
      { numero: 4, libelle: 'Planification et répartition', chemin: 'planification', icone: 'fa-calendar-days' },
    ] },
    { titre: 'B. Analyse épidémiologique', liens: [
      { numero: 5, libelle: 'Surveillance épidémiologique', chemin: 'surveillance', icone: 'fa-virus' },
      { numero: 6, libelle: 'Morbidité et mortalité', chemin: 'morbi-mortalite', icone: 'fa-heart-pulse' },
      { numero: 7, libelle: 'Couvertures sanitaires', chemin: 'couvertures', icone: 'fa-syringe' },
    ] },
    { titre: 'C. Pilotage et contrôle', liens: [
      { numero: 8, libelle: 'Alertes et insuffisances', chemin: 'alertes', icone: 'fa-triangle-exclamation' },
      { numero: 9, libelle: 'Rapports et exportation', chemin: 'rapports', icone: 'fa-file-export' },
      { numero: 10, libelle: 'Historique, validation et traçabilité', chemin: 'tracabilite', icone: 'fa-clipboard-check' },
    ] },
  ];

  indentation(n: number): string {
    // Espaces insécables : les espaces ordinaires sont réduits à un seul dans une option de liste.
    return n > 0 ? `${' '.repeat(n * 3)}└ ` : '';
  }

  async ngOnInit() {
    try {
      await this.epi.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.pret.set(true);
    }
  }
}
