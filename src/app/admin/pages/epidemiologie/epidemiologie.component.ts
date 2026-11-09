import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService } from '../../data/epidemiologie.service';

interface Lien { libelle: string; chemin: string; icone: string; description: string; numero?: number }
interface Groupe { lettre: string; titre: string; couleur: string; liens: Lien[] }

const BASE = '/admin/epidemiologie';

/**
 * Module ÉPIDÉMIOLOGIE : en-tête (sous-fenêtre courante, filtres communs territoire / année), menu
 * permanent groupé selon le cahier des charges (§3) — barre latérale sur ordinateur, menu déroulant
 * sur mobile — et sous-fenêtres chargées dans la zone de contenu.
 */
@Component({
  selector: 'app-epidemiologie',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
<div class="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
  <!-- En-tête : sous-fenêtre courante et filtres communs -->
  <header class="card mb-6 overflow-hidden">
    <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex min-w-0 items-center gap-4">
        <span class="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand-700 text-lg text-white shadow-sm dark:bg-brand-600">
          <i class="fa-solid {{ courant().icone }}"></i>
        </span>
        <div class="min-w-0">
          <nav aria-label="Fil d’Ariane" class="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <a routerLink="." class="hover:text-brand-700 dark:hover:text-brand-300">Épidémiologie</a>
            @if (courant().groupe; as g) { <i class="fa-solid fa-chevron-right text-[9px] opacity-60"></i><span class="truncate">{{ g }}</span> }
          </nav>
          <h1 class="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            @if (courant().numero) { <span class="text-brand-700 dark:text-brand-300">{{ courant().numero }}.</span> }
            {{ courant().libelle }}
          </h1>
          <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ courant().description }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-0 flex-1 sm:w-80 sm:flex-none">
          <label class="label text-xs" for="epi-entite"><i class="fa-solid fa-location-dot text-slate-400"></i> Territoire</label>
          <select id="epi-entite" class="input py-2" [ngModel]="epi.entite()" (ngModelChange)="epi.entite.set($event)">
            @for (e of epi.territoires(); track e.code) {
              <option [value]="e.code">{{ indentation(e.profondeur) }}{{ e.nom }} — {{ e.niveau }}</option>
            }
          </select>
        </div>
        <div class="w-28">
          <label class="label text-xs" for="epi-annee"><i class="fa-solid fa-calendar text-slate-400"></i> Année</label>
          <select id="epi-annee" class="input py-2" [ngModel]="epi.annee()" (ngModelChange)="epi.annee.set(+$event)">
            @for (a of annees; track a) { <option [value]="a">{{ a }}</option> }
          </select>
        </div>
      </div>
    </div>
    @if (epi.entiteCourante(); as e) {
      <div class="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300">
        <span class="badge bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{{ e.niveau }}</span>
        <span class="font-medium">{{ e.nom }}</span><span class="font-mono text-slate-400">{{ e.code }}</span>
        <span class="ml-auto text-slate-400">Les données affichées couvrent ce territoire et ses niveaux inférieurs.</span>
      </div>
    }
  </header>

  @if (erreur()) { <p class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  <div class="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6">
    <!-- Menu mobile : bouton déroulant -->
    <div class="mb-5 lg:hidden">
      <button type="button" class="card flex w-full items-center gap-3 px-4 py-3 text-left" (click)="menuMobile.set(!menuMobile())" [attr.aria-expanded]="menuMobile()" aria-controls="epi-menu-mobile">
        <i class="fa-solid fa-bars text-slate-400"></i>
        <span class="flex-1 text-sm font-semibold text-slate-900 dark:text-white">{{ courant().numero ? courant().numero + '. ' : '' }}{{ courant().libelle }}</span>
        <i class="fa-solid fa-chevron-down text-xs text-slate-400 transition" [class.rotate-180]="menuMobile()"></i>
      </button>
      @if (menuMobile()) {
        <div id="epi-menu-mobile" class="card mt-2 p-2">
          @for (g of groupes; track g.titre) {
            <p class="flex items-center gap-2 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              @if (g.lettre) { <span class="flex h-4 w-4 items-center justify-center rounded text-[10px] text-white" [class]="g.couleur">{{ g.lettre }}</span> }{{ g.titre }}</p>
            @for (l of g.liens; track l.chemin) {
              <a [routerLink]="l.chemin" routerLinkActive="!bg-brand-50 !text-brand-800 dark:!bg-brand-500/10 dark:!text-white" [routerLinkActiveOptions]="{ exact: l.chemin === '.' }" (click)="menuMobile.set(false)"
                 class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60">
                <i class="fa-solid {{ l.icone }} w-4 text-center text-slate-400"></i>
                <span>@if (l.numero) { <span class="tabular-nums text-slate-400">{{ l.numero }}.</span> } {{ l.libelle }}</span>
              </a>
            }
          }
        </div>
      }
    </div>

    <!-- Menu permanent (ordinateur) -->
    <aside class="hidden lg:sticky lg:top-20 lg:block">
      <nav aria-label="Sous-fenêtres du module Épidémiologie" class="card max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
        @for (g of groupes; track g.titre; let premier = $first) {
          <div [class.mt-3]="!premier" [class.border-t]="!premier" [class.pt-3]="!premier" class="border-slate-100 dark:border-slate-800">
            <p class="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              @if (g.lettre) { <span class="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white" [class]="g.couleur">{{ g.lettre }}</span> }
              @else { <i class="fa-solid fa-gauge-high w-5 text-center"></i> }
              <span class="leading-tight">{{ g.titre }}</span>
            </p>
            <ul class="space-y-0.5">
              @for (l of g.liens; track l.chemin) {
                <li>
                  <a [routerLink]="l.chemin" routerLinkActive #rla="routerLinkActive" [routerLinkActiveOptions]="{ exact: l.chemin === '.' }" [title]="l.description"
                     class="group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition"
                     [class]="rla.isActive ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-white' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'">
                    @if (rla.isActive) { <span class="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" aria-hidden="true"></span> }
                    <span class="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs transition"
                          [class]="rla.isActive ? 'bg-brand-700 text-white dark:bg-brand-600' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'">
                      @if (l.numero) { <span class="font-bold tabular-nums">{{ l.numero }}</span> } @else { <i class="fa-solid {{ l.icone }}"></i> }
                    </span>
                    <span class="min-w-0 flex-1 leading-snug">{{ l.libelle }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>
    </aside>

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
  private router = inject(Router);
  pret = signal(false);
  erreur = signal('');
  menuMobile = signal(false);
  readonly annees = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + 1 - i);

  readonly groupes: Groupe[] = [
    { lettre: '', titre: 'Vue générale', couleur: '', liens: [
      { libelle: 'Tableau de bord épidémiologique', chemin: '.', icone: 'fa-chart-pie', description: 'Chiffres clés des dix sous-fenêtres et avancement du socle démographique.' },
    ] },
    { lettre: 'A', titre: 'Démographie et planification', couleur: 'bg-brand-600', liens: [
      { numero: 1, libelle: 'Référentiel démographique', chemin: 'demographie', icone: 'fa-people-group', description: 'Populations de référence par territoire, sexe et âge.' },
      { numero: 2, libelle: 'Paramètres et coefficients', chemin: 'parametres', icone: 'fa-sliders', description: 'Coefficients démographiques et fiches des indicateurs, versionnés et validés.' },
      { numero: 3, libelle: 'Calcul des populations cibles', chemin: 'cibles', icone: 'fa-calculator', description: 'Femmes enceintes, naissances attendues et nourrissons survivants.' },
      { numero: 4, libelle: 'Planification et répartition', chemin: 'planification', icone: 'fa-calendar-days', description: 'Objectifs annuels, trimestriels, mensuels et par structure.' },
    ] },
    { lettre: 'B', titre: 'Analyse épidémiologique', couleur: 'bg-teal-600', liens: [
      { numero: 5, libelle: 'Surveillance épidémiologique', chemin: 'surveillance', icone: 'fa-virus', description: 'Événements, cas, investigations et courbe épidémique.' },
      { numero: 6, libelle: 'Morbidité et mortalité', chemin: 'morbi-mortalite', icone: 'fa-heart-pulse', description: 'Maladies, décès et causes, mortalité maternelle et néonatale.' },
      { numero: 7, libelle: 'Couvertures sanitaires', chemin: 'couvertures', icone: 'fa-syringe', description: 'CPN, accouchements, vaccination, zéro dose et abandons.' },
    ] },
    { lettre: 'C', titre: 'Pilotage et contrôle', couleur: 'bg-amber-600', liens: [
      { numero: 8, libelle: 'Alertes et insuffisances', chemin: 'alertes', icone: 'fa-triangle-exclamation', description: 'Détection des écarts et suivi des actions correctives.' },
      { numero: 9, libelle: 'Rapports et exportation', chemin: 'rapports', icone: 'fa-file-export', description: 'Rapports sanitaires en PDF, Excel et CSV.' },
      { numero: 10, libelle: 'Historique, validation et traçabilité', chemin: 'tracabilite', icone: 'fa-clipboard-check', description: 'Validation des données, historique et journal des opérations.' },
    ] },
  ];

  /** Sous-fenêtre affichée (titre de l'en-tête et du menu mobile). */
  private url = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map(e => e.urlAfterRedirects)), { initialValue: this.router.url });
  readonly courant = computed(() => {
    const segment = this.url().split('?')[0].slice(BASE.length).replace(/^\//, '').split('/')[0] || '.';
    for (const g of this.groupes) {
      const l = g.liens.find(x => x.chemin === segment);
      if (l) return { ...l, groupe: g.lettre ? `${g.lettre}. ${g.titre}` : '' };
    }
    return { ...this.groupes[0].liens[0], groupe: '' };
  });

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
