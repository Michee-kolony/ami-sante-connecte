import { Component } from '@angular/core';
import { CARTE_RDC_VIEWBOX, PROVINCES_RDC } from '../data/carte-rdc';
import { EFFECTIFS_PROVINCES } from '../data/mock-data';

type Indicateur = 'femmes' | 'enfants' | 'total';

interface ProvinceCarte {
  id: string;
  nom: string;
  cx: number;
  cy: number;
  d: string;
  femmes: number;
  enfants: number;
}

// Classes de remplissage, de la plus faible à la plus forte concentration (clair / sombre).
const TEINTES = [
  'fill-brand-100 dark:fill-brand-900',
  'fill-brand-200 dark:fill-brand-800',
  'fill-brand-400 dark:fill-brand-600',
  'fill-brand-600 dark:fill-brand-400',
  'fill-brand-800 dark:fill-brand-200',
];
const TEINTE_VIDE = 'fill-slate-100 dark:fill-slate-800';

/**
 * Carte choroplèthe des provinces de la RDC : plus la province est foncée,
 * plus elle compte de patientes et/ou d'enfants suivis.
 */
@Component({
  selector: 'app-carte-rdc',
  standalone: true,
  template: `
    <div class="card overflow-hidden">
      <div class="card-header flex-wrap">
        <h2 class="card-title"><i class="fa-solid fa-map-location-dot text-brand-600 dark:text-brand-400"></i> Répartition par province</h2>
        <div class="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800" role="group" aria-label="Indicateur affiché">
          @for (o of options; track o.id) {
            <button type="button" (click)="indicateur = o.id; calculerClasses()"
                    [attr.aria-pressed]="indicateur === o.id"
                    class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition"
                    [class]="indicateur === o.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'">
              <i class="fa-solid {{ o.icon }}"></i>{{ o.label }}
            </button>
          }
        </div>
      </div>

      <div class="grid gap-6 p-5 lg:grid-cols-5">
        <!-- Carte -->
        <div class="relative lg:col-span-3" (mousemove)="suivreSouris($event)" (mouseenter)="sourisSurCarte = true" (mouseleave)="sourisSurCarte = false">
          <svg [attr.viewBox]="viewBox" class="h-auto w-full" role="img"
               aria-label="Carte de la RDC colorée selon le nombre de patients par province">
            @for (p of provinces; track p.id) {
              <path [attr.d]="p.d" tabindex="0" role="button"
                    [attr.aria-label]="p.nom + ' : ' + valeur(p) + ' ' + uniteCourte"
                    class="cursor-pointer stroke-white transition-colors focus:outline-none dark:stroke-slate-900 {{ teinte(p) }}"
                    stroke-width="1" stroke-linejoin="round"
                    (mouseenter)="survol = p" (mouseleave)="survol = null"
                    (focus)="survol = p" (blur)="survol = null"
                    (click)="choisir(p)" (keydown.enter)="choisir(p)" />
            }
            <!-- Contour de la province active, dessiné au-dessus des autres -->
            @if (active; as a) {
              <path [attr.d]="a.d" fill="none" stroke-width="2.5" stroke-linejoin="round"
                    class="pointer-events-none stroke-slate-900 dark:stroke-white" />
            }
            <!-- Kinshasa est minuscule à cette échelle : repère dédié -->
            @if (kinshasa; as k) {
              <g class="pointer-events-none">
                <circle [attr.cx]="k.cx" [attr.cy]="k.cy" r="5" class="fill-none stroke-accent-600 dark:stroke-accent-400" stroke-width="2" />
                <text [attr.x]="k.cx + 9" [attr.y]="k.cy - 7" class="fill-slate-700 text-[13px] font-semibold dark:fill-slate-200">Kinshasa</text>
              </g>
            }
          </svg>

          @if (sourisSurCarte && survol; as s) {
            <div class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900"
                 [style.left.px]="souris.x" [style.top.px]="souris.y - 12">
              <p class="font-semibold">{{ s.nom }}</p>
              <p class="tabular-nums opacity-80">{{ s.femmes }} femmes · {{ s.enfants }} enfants</p>
            </div>
          }

          <!-- Légende -->
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span class="font-medium text-slate-600 dark:text-slate-300">{{ uniteLongue }} :</span>
            <span class="flex items-center gap-1.5"><svg class="h-3 w-3"><rect width="12" height="12" rx="3" class="{{ teinteVide }}" /></svg>0</span>
            @for (c of classes; track $index) {
              <span class="flex items-center gap-1.5"><svg class="h-3 w-3"><rect width="12" height="12" rx="3" class="{{ c.teinte }}" /></svg>{{ c.libelle }}</span>
            }
          </div>
        </div>

        <!-- Détail et classement -->
        <div class="space-y-5 lg:col-span-2">
          @if (active; as a) {
            <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Province</p>
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ a.nom }}</p>
                </div>
                <span class="badge bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{{ rang(a) }}<sup>{{ rang(a) === 1 ? 're' : 'e' }}</sup>&nbsp;sur 26</span>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-3 text-center">
                <div class="rounded-lg bg-white p-2.5 dark:bg-slate-900">
                  <p class="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{{ a.femmes }}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">Femmes</p>
                </div>
                <div class="rounded-lg bg-white p-2.5 dark:bg-slate-900">
                  <p class="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-400">{{ a.enfants }}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">Enfants</p>
                </div>
                <div class="rounded-lg bg-white p-2.5 dark:bg-slate-900">
                  <p class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ part(a) }} %</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">du total</p>
                </div>
              </div>
            </div>
          }

          <div>
            <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Provinces les plus concernées</p>
            <ul class="space-y-3">
              @for (p of top; track p.id) {
                <li>
                  <button type="button" (click)="choisir(p)" class="w-full text-left">
                    <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span class="font-medium" [class]="active?.id === p.id ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-100'">{{ p.nom }}</span>
                      <span class="tabular-nums font-semibold text-slate-900 dark:text-white">{{ valeur(p) }}</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div class="h-full rounded-full bg-brand-600 transition-all dark:bg-brand-400" [style.width.%]="(valeur(p) / max) * 100"></div>
                    </div>
                  </button>
                </li>
              }
            </ul>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            <i class="fa-solid fa-circle-info mr-1 text-brand-600 dark:text-brand-400"></i>
            {{ total }} {{ uniteCourte }} répartis dans {{ provincesCouvertes }} provinces. Survolez ou touchez une province pour le détail.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class CarteRdcComponent {
  viewBox = CARTE_RDC_VIEWBOX;
  teinteVide = TEINTE_VIDE;
  options: { id: Indicateur; label: string; icon: string }[] = [
    { id: 'total', label: 'Total', icon: 'fa-users' },
    { id: 'femmes', label: 'Femmes', icon: 'fa-person-pregnant' },
    { id: 'enfants', label: 'Enfants', icon: 'fa-baby' },
  ];
  indicateur: Indicateur = 'total';

  provinces: ProvinceCarte[] = PROVINCES_RDC.map(p => {
    const e = EFFECTIFS_PROVINCES.find(x => x.province === p.id);
    return { ...p, femmes: e?.femmes ?? 0, enfants: e?.enfants ?? 0 };
  });
  kinshasa = this.provinces.find(p => p.id === 'kinshasa');

  survol: ProvinceCarte | null = null;
  selection: ProvinceCarte | null = null;
  souris = { x: 0, y: 0 };
  sourisSurCarte = false;

  classes: { max: number; teinte: string; libelle: string }[] = [];
  top: ProvinceCarte[] = [];
  max = 1;
  total = 0;
  provincesCouvertes = 0;

  constructor() {
    this.calculerClasses();
  }

  /** Province mise en avant : survolée, sinon cliquée, sinon la première du classement. */
  get active(): ProvinceCarte | null {
    return this.survol ?? this.selection ?? this.top[0] ?? null;
  }

  get uniteCourte(): string {
    return { total: 'patients', femmes: 'femmes', enfants: 'enfants' }[this.indicateur];
  }

  get uniteLongue(): string {
    return { total: 'Femmes + enfants', femmes: 'Femmes suivies', enfants: 'Enfants suivis' }[this.indicateur];
  }

  valeur(p: ProvinceCarte): number {
    return this.indicateur === 'femmes' ? p.femmes : this.indicateur === 'enfants' ? p.enfants : p.femmes + p.enfants;
  }

  /** Seuils par quantiles (5 classes) sur les provinces ayant au moins un patient. */
  calculerClasses(): void {
    const tries = [...this.provinces].sort((a, b) => this.valeur(b) - this.valeur(a));
    const valeurs = tries.map(p => this.valeur(p)).filter(v => v > 0).reverse();
    this.top = tries.slice(0, 6);
    this.max = Math.max(1, ...valeurs);
    this.total = valeurs.reduce((s, v) => s + v, 0);
    this.provincesCouvertes = valeurs.length;

    const seuils = TEINTES.map((_, i) => valeurs[Math.ceil(((i + 1) * valeurs.length) / TEINTES.length) - 1] ?? 0);
    let min = 1;
    this.classes = [];
    seuils.forEach((s, i) => {
      if (s < min) return; // classe vide (peu de provinces)
      this.classes.push({ max: s, teinte: TEINTES[i], libelle: min === s ? `${s}` : `${min}–${s}` });
      min = s + 1;
    });
  }

  teinte(p: ProvinceCarte): string {
    const v = this.valeur(p);
    if (v === 0) return TEINTE_VIDE;
    return (this.classes.find(c => v <= c.max) ?? this.classes[this.classes.length - 1]).teinte;
  }

  rang(p: ProvinceCarte): number {
    const v = this.valeur(p);
    return this.provinces.filter(x => this.valeur(x) > v).length + 1;
  }

  part(p: ProvinceCarte): number {
    return this.total ? Math.round((this.valeur(p) / this.total) * 1000) / 10 : 0;
  }

  choisir(p: ProvinceCarte): void {
    this.selection = this.selection?.id === p.id ? null : p;
  }

  suivreSouris(ev: MouseEvent): void {
    const zone = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    // Garde l'infobulle (≈ 180 px de large) à l'intérieur de la zone de la carte
    const x = Math.min(Math.max(ev.clientX - zone.left, 90), Math.max(90, zone.width - 90));
    this.souris = { x, y: Math.max(ev.clientY - zone.top, 56) };
  }
}
