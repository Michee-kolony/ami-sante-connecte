import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { ArcElement, Chart, DoughnutController, Tooltip } from 'chart.js';
import { CATEGORIES, CategorieSoignant, ROLES_SOIGNANT, Soignant, categorieDuRole } from '../data/soignants.service';
import { ThemeService } from '../../shared/theme.service';

Chart.register(DoughnutController, ArcElement, Tooltip);

/** Couleurs validées (daltonisme, contraste) sur la surface claire puis sombre des cartes. */
const COULEURS = {
  clair: { F: '#c2417a', M: '#0a5fb5' },
  sombre: { F: '#d9558f', M: '#4a8fd8' },
};

/**
 * Répartition femmes / hommes du personnel soignant : anneau Chart.js, part dominante au centre
 * et détail par catégorie (médecins, infirmier·ères, sages-femmes).
 */
@Component({
  selector: 'app-repartition-sexe',
  standalone: true,
  template: `
<div class="card h-full">
  <div class="card-header">
    <h2 class="card-title"><i class="fa-solid fa-venus-mars text-brand-600 dark:text-brand-400"></i> Femmes et hommes du personnel</h2>
    <span class="text-xs text-slate-500 dark:text-slate-400">{{ total() }} soignant{{ total() > 1 ? 's' : '' }}</span>
  </div>

  <div class="p-5">
    @if (chargement) {
      <div class="flex flex-col items-center gap-6 sm:flex-row" aria-hidden="true">
        <div class="skeleton h-44 w-44 flex-none rounded-full"></div>
        <div class="w-full space-y-3"><div class="skeleton h-5 w-40"></div><div class="skeleton h-12 w-full"></div><div class="skeleton h-12 w-full"></div></div>
      </div>
    } @else if (!total()) {
      <p class="flex h-44 items-center justify-center text-sm text-slate-500 dark:text-slate-400">Aucun soignant enregistré.</p>
    } @else {
      <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <!-- Anneau -->
        <div class="relative h-44 w-44 flex-none">
          <canvas #canvas role="img" [attr.aria-label]="resume()"></canvas>
          <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{{ dominant().pct }} %</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ dominant().libelle }}</span>
          </div>
        </div>

        <!-- Légende et verdict -->
        <div class="w-full min-w-0 flex-1 space-y-3">
          <p class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
             [class]="dominant().sexe === 'F' ? 'bg-pink-50 text-pink-800 dark:bg-pink-500/10 dark:text-pink-300'
                    : dominant().sexe === 'M' ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'">
            <i class="fa-solid" [class]="dominant().sexe === 'F' ? 'fa-venus' : dominant().sexe === 'M' ? 'fa-mars' : 'fa-scale-balanced'"></i>
            {{ verdict() }}
          </p>
          @for (l of legende(); track l.sexe) {
            <div class="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <span class="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white" [style.background-color]="l.couleur">
                <i class="fa-solid" [class]="l.icone"></i>
              </span>
              <span class="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{{ l.libelle }}</span>
              <span class="text-right tabular-nums">
                <span class="block text-sm font-semibold text-slate-900 dark:text-white">{{ l.n }}</span>
                <span class="block text-xs text-slate-500 dark:text-slate-400">{{ l.pct }} %</span>
              </span>
            </div>
          }
        </div>
      </div>

      <!-- Détail par catégorie : barre femmes / hommes -->
      <ul class="mt-6 space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
        @for (c of parCategorie(); track c.categorie) {
          <li>
            <div class="mb-1.5 flex items-center justify-between text-xs">
              <span class="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200"><i class="fa-solid {{ c.icone }} text-slate-400"></i>{{ c.libelle }}</span>
              <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ c.F }} F · {{ c.M }} H</span>
            </div>
            <div class="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                 [title]="c.libelle + ' : ' + c.F + ' femme(s), ' + c.M + ' homme(s)'">
              @if (c.F) { <div class="h-full rounded-full" [style.width.%]="(c.F / c.total) * 100" [style.background-color]="couleurs().F"></div> }
              @if (c.M) { <div class="h-full rounded-full" [style.width.%]="(c.M / c.total) * 100" [style.background-color]="couleurs().M"></div> }
            </div>
          </li>
        }
      </ul>

      <!-- Vue tableau pour les lecteurs d'écran -->
      <table class="sr-only">
        <caption>Répartition du personnel soignant par sexe et par catégorie</caption>
        <thead><tr><th>Catégorie</th><th>Femmes</th><th>Hommes</th></tr></thead>
        <tbody>
          @for (c of parCategorie(); track c.categorie) { <tr><td>{{ c.libelle }}</td><td>{{ c.F }}</td><td>{{ c.M }}</td></tr> }
          <tr><td>Total</td><td>{{ legende()[0].n }}</td><td>{{ legende()[1].n }}</td></tr>
        </tbody>
      </table>
    }
  </div>
</div>
  `,
})
export class RepartitionSexeComponent implements AfterViewInit, OnDestroy {
  private theme = inject(ThemeService);
  private soignants = signal<Soignant[]>([]);
  @Input() chargement = false;
  @Input({ required: true }) set personnel(liste: Soignant[]) {
    this.soignants.set(liste);
  }

  @ViewChild('canvas') set canvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.canvasRef = ref;
    // Le canvas apparaît après le chargement : le graphique est (re)créé à ce moment-là.
    this.chart?.destroy();
    this.chart = undefined;
    if (ref && this.vueInitialisee) this.dessiner();
  }
  private canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<'doughnut'>;
  private vueInitialisee = false;

  couleurs = computed(() => (this.theme.sombre() ? COULEURS.sombre : COULEURS.clair));

  private compte = computed(() => {
    const l = this.soignants();
    return { F: l.filter(s => s.sexe === 'F').length, M: l.filter(s => s.sexe === 'M').length };
  });
  total = computed(() => this.compte().F + this.compte().M);

  private pct(n: number): number {
    return this.total() ? Math.round((n / this.total()) * 100) : 0;
  }

  legende = computed(() => {
    const { F, M } = this.compte();
    const c = this.couleurs();
    return [
      { sexe: 'F', libelle: 'Femmes', n: F, pct: this.pct(F), couleur: c.F, icone: 'fa-venus' },
      { sexe: 'M', libelle: 'Hommes', n: M, pct: this.pct(M), couleur: c.M, icone: 'fa-mars' },
    ];
  });

  dominant = computed(() => {
    const { F, M } = this.compte();
    if (F === M) return { sexe: '=', pct: 50, libelle: 'parité' };
    return F > M ? { sexe: 'F', pct: this.pct(F), libelle: 'de femmes' } : { sexe: 'M', pct: this.pct(M), libelle: 'd’hommes' };
  });

  verdict = computed(() => {
    const { F, M } = this.compte();
    const ecart = Math.abs(F - M);
    if (!ecart) return 'Parité parfaite';
    return `${F > M ? 'Les femmes' : 'Les hommes'} dominent (+${ecart})`;
  });

  resume = computed(() => {
    const [f, m] = this.legende();
    return `Personnel soignant : ${f.n} femmes (${f.pct} %) et ${m.n} hommes (${m.pct} %). ${this.verdict()}.`;
  });

  parCategorie = computed(() => {
    const l = this.soignants();
    return ROLES_SOIGNANT.map(({ categorie }) => {
      const membres = l.filter(s => categorieDuRole(s.role) === categorie);
      const F = membres.filter(s => s.sexe === 'F').length;
      const M = membres.filter(s => s.sexe === 'M').length;
      return { categorie, libelle: CATEGORIES[categorie as CategorieSoignant].pluriel, icone: CATEGORIES[categorie].icone, F, M, total: F + M };
    }).filter(c => c.total > 0);
  });

  constructor() {
    // Nouvelles données ou changement de thème : mise à jour sans recréer le graphique.
    effect(() => {
      const { F, M } = this.compte();
      const c = this.couleurs();
      if (!this.chart) return;
      const d = this.chart.data.datasets[0];
      d.data = [F, M];
      d.backgroundColor = [c.F, c.M];
      this.chart.update();
    });
  }

  ngAfterViewInit(): void {
    this.vueInitialisee = true;
    if (this.canvasRef && !this.chart) this.dessiner();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private dessiner(): void {
    const c = this.couleurs();
    const { F, M } = this.compte();
    this.chart = new Chart(this.canvasRef!.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Femmes', 'Hommes'],
        datasets: [{
          data: [F, M],
          backgroundColor: [c.F, c.M],
          // Cartes semi-transparentes : un vrai espace sépare les segments (pas de bordure colorée).
          borderWidth: 0,
          spacing: 3,
          borderRadius: 4,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 6 },
        animation: { animateRotate: true, duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: ctx => {
                const n = Number(ctx.raw);
                return ` ${ctx.label} : ${n} (${this.pct(n)} %)`;
              },
            },
          },
        },
      },
    });
  }
}
