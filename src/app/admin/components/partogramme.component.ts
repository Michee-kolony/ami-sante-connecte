import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, inject } from '@angular/core';
import { Chart, LineController, LineElement, LinearScale, Plugin, PointElement, Tooltip } from 'chart.js';
import { Partogramme, Zone, classeZone } from '../data/accouchements.service';
import { ThemeService } from '../../shared/theme.service';
import { dateHeureChiffres } from '../data/format';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

const HEURE = 3_600_000;
const COULEURS_ZONE: Record<Zone, string> = { Verte: '#16a34a', Jaune: '#f59e0b', Rouge: '#e11d48' };

/** Zones verte / jaune / rouge du graphe de dilatation, dessinées sous les courbes. */
const zonesPlugin: Plugin<'line'> = {
  id: 'zonesPartogramme',
  beforeDatasetsDraw(chart, _args, options: { actif?: boolean; sombre?: boolean }) {
    if (!options?.actif) return;
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    const px = (h: number) => x.getPixelForValue(h);
    const py = (cm: number) => y.getPixelForValue(cm);
    const opacite = options.sombre ? 0.16 : 0.12;
    const xMax = x.max;
    // Ligne d'alerte : (0,4) → (6,10) ; ligne d'action : (4,4) → (10,10), puis 10 cm.
    const alerte = [[0, 4], [6, 10], [xMax, 10]];
    const action = [[4, 4], [10, 10], [Math.max(xMax, 10), 10]];
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.left, a.top, a.width, a.height);
    ctx.clip();
    const polygone = (points: number[][], couleur: string) => {
      ctx.beginPath();
      points.forEach(([h, cm], i) => (i ? ctx.lineTo(px(h), py(cm)) : ctx.moveTo(px(h), py(cm))));
      ctx.closePath();
      ctx.fillStyle = couleur;
      ctx.globalAlpha = opacite;
      ctx.fill();
    };
    // Verte : au-dessus / à gauche de la ligne d'alerte.
    polygone([[x.min, 10], [x.min, 4], ...alerte], COULEURS_ZONE.Verte);
    // Jaune : entre la ligne d'alerte et la ligne d'action.
    polygone([...alerte, ...[...action].reverse(), [4, 4], [0, 4]], COULEURS_ZONE.Jaune);
    // Rouge : à droite de la ligne d'action.
    polygone([[4, 4], [Math.max(xMax, 10) + 1, 4], ...[...action].reverse()], COULEURS_ZONE.Rouge);
    ctx.restore();
  },
};

/**
 * Partogramme de la phase active : graphe des BCF (100–180 bpm, lignes d'alerte 120 et 160) et
 * graphe de la dilatation (4–10 cm) avec ses zones. Abscisse : heures depuis le début de la phase
 * active (ou depuis l'admission tant que la phase active n'a pas commencé).
 */
@Component({
  selector: 'app-partogramme',
  standalone: true,
  template: `
<div class="grid gap-6 xl:grid-cols-2">
  <div class="card">
    <div class="card-header">
      <h3 class="card-title"><i class="fa-solid fa-heart-pulse text-rose-500"></i> Graphe 1 · BCF</h3>
      <span class="text-xs text-slate-500 dark:text-slate-400">Normale {{ p.bcf.min }}–{{ p.bcf.max }} bpm</span>
    </div>
    <div class="relative h-64 p-4">
      @if (!p.bcf.points.length) { <p class="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">Aucun BCF saisi.</p> }
      <canvas #bcf [class.hidden]="!p.bcf.points.length" role="img" [attr.aria-label]="'Courbe des BCF : ' + p.bcf.points.length + ' mesures'"></canvas>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3 class="card-title"><i class="fa-solid fa-chart-line text-brand-600 dark:text-brand-400"></i> Graphe 2 · Dilatation</h3>
      @if (p.dilatation.zoneActuelle; as z) {
        <span class="badge {{ zone(z) }}">Zone {{ z.toLowerCase() }}</span>
      } @else {
        <span class="text-xs text-slate-500 dark:text-slate-400">Phase active : dès 4 cm</span>
      }
    </div>
    <div class="relative h-64 p-4">
      @if (!p.debutPhaseActive) { <p class="flex h-full items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">Le graphe démarre à la première dilatation ≥ 4 cm.</p> }
      <canvas #dilatation [class.hidden]="!p.debutPhaseActive" role="img" aria-label="Courbe de dilatation du col avec zones verte, jaune et rouge"></canvas>
    </div>
    <div class="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-green-600/60"></span>Verte : progression normale</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-amber-500/70"></span>Jaune : au-delà de la ligne d’alerte</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-rose-600/70"></span>Rouge : au-delà de la ligne d’action</span>
    </div>
  </div>
</div>
  `,
})
export class PartogrammeComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) p!: Partogramme;
  /** Heure d'admission : origine des abscisses avant la phase active. */
  @Input() admiseLe = '';
  @ViewChild('bcf') canvasBcf?: ElementRef<HTMLCanvasElement>;
  @ViewChild('dilatation') canvasDil?: ElementRef<HTMLCanvasElement>;

  private theme = inject(ThemeService);
  private graphes: Chart<'line'>[] = [];
  private vue = false;
  zone = classeZone;

  ngAfterViewInit(): void {
    this.vue = true;
    this.dessiner();
  }

  ngOnChanges(): void {
    if (this.vue) this.dessiner();
  }

  ngOnDestroy(): void {
    this.graphes.forEach(g => g.destroy());
  }

  private origine(): number {
    return new Date(this.p.debutPhaseActive ?? this.admiseLe).getTime();
  }

  private dessiner(): void {
    this.graphes.forEach(g => g.destroy());
    this.graphes = [];
    const sombre = this.theme.sombre();
    const texte = sombre ? '#94a3b8' : '#64748b';
    const grille = sombre ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)';
    const origine = this.origine();
    const heures = (le: string) => Math.round(((new Date(le).getTime() - origine) / HEURE) * 100) / 100;
    const axeX = (min: number, max: number) => ({
      type: 'linear' as const, min, max,
      title: { display: true, text: this.p.debutPhaseActive ? 'Heures depuis le début de la phase active' : 'Heures depuis l’admission', color: texte },
      ticks: { color: texte, stepSize: 1 }, grid: { color: grille },
    });
    const infobulle = {
      backgroundColor: '#0f172a', padding: 10, cornerRadius: 8,
      callbacks: { title: (items: { raw: unknown }[]) => dateHeureChiffres((items[0]?.raw as { le?: string })?.le ?? null) },
    };

    if (this.canvasBcf && this.p.bcf.points.length) {
      const points = this.p.bcf.points.map(b => ({ x: heures(b.le), y: b.bcf, le: b.le, anormal: b.anormal }));
      const xMin = Math.min(0, Math.floor(Math.min(...points.map(q => q.x))));
      const xMax = Math.max(12, Math.ceil(Math.max(...points.map(q => q.x))) + 1);
      const ligne = (y: number) => ({
        data: [{ x: xMin, y }, { x: xMax, y }], borderColor: '#e11d48', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHitRadius: 0,
      });
      this.graphes.push(new Chart(this.canvasBcf.nativeElement, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'BCF', data: points as never, borderColor: sombre ? '#4a8fd8' : '#0055a5', borderWidth: 2, tension: 0.2,
              pointRadius: 4, pointBackgroundColor: points.map(q => (q.anormal ? '#e11d48' : sombre ? '#4a8fd8' : '#0055a5')),
            },
            { label: 'Alerte 120', ...ligne(this.p.bcf.min) },
            { label: 'Alerte 160', ...ligne(this.p.bcf.max) },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          scales: {
            x: axeX(xMin, xMax),
            y: { min: this.p.bcf.echelle[0], max: this.p.bcf.echelle[1], ticks: { color: texte, stepSize: 10 }, grid: { color: grille }, title: { display: true, text: 'bpm', color: texte } },
          },
          plugins: { legend: { display: false }, tooltip: { ...infobulle, filter: i => i.datasetIndex === 0, callbacks: { ...infobulle.callbacks, label: i => ` ${(i.raw as { y: number }).y} bpm` } } },
        },
      }));
    }

    if (this.canvasDil && this.p.debutPhaseActive) {
      const points = this.p.dilatation.points.map(d => ({ x: d.heures, y: d.cm, le: d.le, zone: d.zone }));
      const xMax = Math.max(12, Math.ceil(Math.max(0, ...points.map(q => q.x))) + 1);
      const ligne = (l: { heures: number; cm: number }[], couleur: string) => ({
        data: l.map(q => ({ x: q.heures, y: q.cm })), borderColor: couleur, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHitRadius: 0,
      });
      this.graphes.push(new Chart(this.canvasDil.nativeElement, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Dilatation', data: points as never, borderColor: sombre ? '#e2e8f0' : '#0f172a', borderWidth: 2,
              pointRadius: 6, pointStyle: 'crossRot', pointBorderWidth: 3, pointBorderColor: points.map(q => COULEURS_ZONE[q.zone]),
            },
            { label: 'Ligne d’alerte', ...ligne(this.p.dilatation.lignes.alerte, COULEURS_ZONE.Jaune) },
            { label: 'Ligne d’action', ...ligne(this.p.dilatation.lignes.action, COULEURS_ZONE.Rouge) },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          scales: {
            x: axeX(0, xMax),
            y: { min: 4, max: 10, ticks: { color: texte, stepSize: 1 }, grid: { color: grille }, title: { display: true, text: 'cm', color: texte } },
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...infobulle, filter: i => i.datasetIndex === 0, callbacks: { ...infobulle.callbacks, label: i => ` ${(i.raw as { y: number; zone: Zone }).y} cm · zone ${(i.raw as { zone: Zone }).zone.toLowerCase()}` } },
            // Options du plugin de zones (non typées par Chart.js).
            ...({ zonesPartogramme: { actif: true, sombre } } as object),
          },
        },
        plugins: [zonesPlugin],
      }));
    }
  }
}
