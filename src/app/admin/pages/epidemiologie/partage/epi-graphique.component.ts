import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, effect, inject } from '@angular/core';
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, ChartType, DoughnutController, Filler, Legend, LineController, LineElement,
  LinearScale, PieController, PointElement, Tooltip,
} from 'chart.js';
import { ThemeService } from '../../../../shared/theme.service';

Chart.register(BarController, LineController, PieController, DoughnutController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

/** Palette commune des graphiques du module (lisible en clair et en sombre, daltonisme). */
export const PALETTE = ['#0a5fb5', '#0f9d76', '#d97706', '#c2417a', '#7c3aed', '#0891b2', '#64748b', '#dc2626', '#65a30d', '#9333ea'];

export interface Serie {
  libelle: string;
  valeurs: (number | null)[];
  couleur?: string;
  /** Série en ligne sur un graphique en barres (cible / réalisation). */
  ligne?: boolean;
}

/**
 * Graphique générique (barres, courbe, secteurs, anneau). Valeur absente = trou (jamais 0).
 * `horizontal` : barres horizontales (classements). `pourcent` : axe en %.
 */
@Component({
  selector: 'app-epi-graphique',
  standalone: true,
  template: `
    <div class="relative" [style.height.px]="hauteur">
      @if (!vide()) {
        <canvas #canvas role="img" [attr.aria-label]="titre"></canvas>
      } @else {
        <p class="flex h-full items-center justify-center text-sm text-slate-400">Aucune donnée à afficher.</p>
      }
    </div>`,
})
export class EpiGraphiqueComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  @Input() type: 'bar' | 'line' | 'pie' | 'doughnut' = 'bar';
  @Input() etiquettes: string[] = [];
  @Input() series: Serie[] = [];
  @Input() titre = '';
  @Input() hauteur = 260;
  @Input() horizontal = false;
  @Input() pourcent = false;
  @Input() empile = false;

  private theme = inject(ThemeService);
  private graphique?: Chart;
  private pret = false;

  constructor() {
    effect(() => {
      this.theme.sombre();
      if (this.pret) setTimeout(() => this.dessiner());
    });
  }

  vide(): boolean {
    const secteurs = this.type === 'pie' || this.type === 'doughnut';
    return !this.etiquettes.length || this.series.every(s => s.valeurs.every(v => v == null || (secteurs && v === 0)));
  }

  ngAfterViewInit(): void {
    this.pret = true;
    this.dessiner();
  }

  ngOnChanges(): void {
    if (this.pret) setTimeout(() => this.dessiner());
  }

  ngOnDestroy(): void {
    this.graphique?.destroy();
  }

  private dessiner(): void {
    this.graphique?.destroy();
    this.graphique = undefined;
    const el = this.canvas?.nativeElement;
    if (!el || this.vide()) return;
    const sombre = this.theme.sombre();
    const texte = sombre ? '#cbd5e1' : '#475569';
    const grille = sombre ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
    const secteurs = this.type === 'pie' || this.type === 'doughnut';
    this.graphique = new Chart(el, {
      type: this.type as ChartType,
      data: {
        labels: this.etiquettes,
        datasets: this.series.map((s, i) => {
          const couleur = s.couleur ?? PALETTE[i % PALETTE.length];
          return {
            label: s.libelle,
            data: s.valeurs,
            type: s.ligne ? 'line' : undefined,
            backgroundColor: secteurs ? this.etiquettes.map((_, j) => PALETTE[j % PALETTE.length]) : this.type === 'line' || s.ligne ? `${couleur}22` : couleur,
            borderColor: secteurs ? (sombre ? '#0f172a' : '#ffffff') : couleur,
            borderWidth: secteurs ? 2 : this.type === 'line' || s.ligne ? 2 : 0,
            borderRadius: this.type === 'bar' && !s.ligne ? 4 : 0,
            fill: this.type === 'line' && this.series.length === 1,
            tension: 0.25,
            spanGaps: false,
            pointRadius: this.type === 'line' || s.ligne ? 3 : 0,
          } as never;
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: this.horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: secteurs || this.series.length > 1, position: 'bottom', labels: { color: texte, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed as unknown as { y?: number; x?: number } | number;
                const n = typeof v === 'number' ? v : this.horizontal ? v.x : v.y;
                return `${ctx.dataset.label ?? ''} : ${n == null ? 'non calculable' : `${String(n).replace('.', ',')}${this.pourcent ? ' %' : ''}`}`;
              },
            },
          },
        },
        scales: secteurs ? {} : {
          x: { stacked: this.empile, ticks: { color: texte, font: { size: 11 } }, grid: { color: this.horizontal ? grille : 'transparent' } },
          y: { stacked: this.empile, beginAtZero: true, ticks: { color: texte, font: { size: 11 }, callback: (v) => (this.pourcent && !this.horizontal ? `${v} %` : v) }, grid: { color: this.horizontal ? 'transparent' : grille } },
        },
      },
    });
  }
}
