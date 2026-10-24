import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, effect, inject, untracked } from '@angular/core';
import { Chart, LineController, LineElement, LinearScale, Plugin, PointElement, Tooltip } from 'chart.js';
import { Partogramme, Zone, classeZone } from '../data/accouchements.service';
import { ThemeService } from '../../shared/theme.service';
import { dateHeureChiffres, heureFr } from '../data/format';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

const HEURE = 3_600_000;
/** Largeur fixe de la colonne des libellés : les graphes empilés partagent les mêmes colonnes d'heures. */
const MARGE_GAUCHE = 96;
/** Hauteur d'une ligne de cases sous un graphe (Engagement, Incident, Heure réelle). */
const LIGNE = 26;
/** Fond des zones, comme sur la feuille papier : vert, jaune, orangé (composantes RVB). */
const FOND_ZONE: Record<Zone, string> = { Verte: '134,239,172', Jaune: '253,224,71', Rouge: '251,146,60' };
const TEXTE_ZONE: Record<Zone, [string, string]> = { Verte: ['#166534', '#86efac'], Jaune: ['#854d0e', '#fde047'], Rouge: ['#9a3412', '#fdba74'] };

/** Couleurs du quadrillage, selon le thème. */
interface Teintes { texte: string; fine: string; forte: string; trait: string }
/** Ligne de cases sous un graphe : une case par colonne de `pas` heures. */
interface LigneCases { titre: string; pas: number; cases: { h: number; texte: string; couleur?: string }[] }

/**
 * Zones verte / jaune / rouge du graphe de dilatation, dessinées sous les courbes à partir du
 * début de la phase active : à gauche de la ligne d'alerte, entre les deux lignes, à droite de la
 * ligne d'action.
 */
const zonesPlugin: Plugin<'line'> = {
  id: 'zonesPartogramme',
  beforeDatasetsDraw(chart, _args, options: { actif?: boolean; sombre?: boolean }) {
    if (!options?.actif) return;
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    const px = (h: number) => x.getPixelForValue(h);
    const py = (cm: number) => y.getPixelForValue(cm);
    const fin = Math.max(x.max, 10) + 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.left, a.top, a.width, a.height);
    ctx.clip();
    const polygone = (points: number[][], zone: Zone) => {
      ctx.beginPath();
      points.forEach(([h, cm], i) => (i ? ctx.lineTo(px(h), py(cm)) : ctx.moveTo(px(h), py(cm))));
      ctx.closePath();
      ctx.fillStyle = `rgba(${FOND_ZONE[zone]},${options.sombre ? 0.2 : 0.45})`;
      ctx.fill();
    };
    // Ligne d'alerte : (0,4) → (6,10) ; ligne d'action : (4,4) → (10,10).
    polygone([[0, 4], [6, 10], [0, 10]], 'Verte');
    polygone([[0, 4], [6, 10], [10, 10], [4, 4]], 'Jaune');
    polygone([[4, 4], [10, 10], [fin, 10], [fin, 4]], 'Rouge');
    // Noms des zones en haut du graphe, comme sur la feuille.
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nom = (zone: Zone, h: number) => {
      ctx.fillStyle = TEXTE_ZONE[zone][options.sombre ? 1 : 0];
      ctx.fillText(`Zone ${zone.toLowerCase()}`, px(h), py(9.5));
    };
    nom('Verte', 2.75);
    nom('Jaune', 7.5);
    nom('Rouge', (9.5 + x.max) / 2);
    ctx.restore();
  },
};

/** Lignes de cases sous un graphe (Engagement, Incident, Heure réelle), alignées sur les colonnes d'heures. */
const casesPlugin: Plugin<'line'> = {
  id: 'casesPartogramme',
  afterDraw(chart, _args, options: { lignes?: LigneCases[]; teintes?: Teintes }) {
    const t = options?.teintes;
    if (!options?.lignes?.length || !t) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const px = (h: number) => x.getPixelForValue(h);
    const haut0 = x.bottom + 4;
    ctx.save();
    ctx.textBaseline = 'middle';
    options.lignes.forEach((l, i) => {
      const haut = haut0 + i * LIGNE;
      const milieu = haut + LIGNE / 2;
      ctx.strokeStyle = t.forte;
      ctx.lineWidth = 1;
      ctx.strokeRect(a.left, haut, a.width, LIGNE);
      ctx.beginPath();
      for (let h = Math.floor(x.min / l.pas) * l.pas + l.pas; h < x.max; h += l.pas) {
        ctx.moveTo(px(h), haut);
        ctx.lineTo(px(h), haut + LIGNE);
      }
      ctx.stroke();
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = t.texte;
      ctx.textAlign = 'right';
      ctx.fillText(l.titre, a.left - 8, milieu);
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const c of l.cases) {
        const debut = Math.floor(c.h / l.pas) * l.pas;
        if (debut < x.min || debut >= x.max) continue;
        ctx.fillStyle = c.couleur ?? t.texte;
        ctx.fillText(c.texte, (px(debut) + px(Math.min(debut + l.pas, x.max))) / 2, milieu);
      }
    });
    ctx.restore();
  },
};

/**
 * Partogramme de la phase active, dessiné comme la feuille papier : graphe des BCF (100–180 bpm,
 * lignes épaisses à 120 et 160) suivi des lignes Engagement et Incident, puis graphe de la
 * dilatation (4–10 cm) sur les zones verte, jaune et rouge, suivi de l'heure réelle. Les graphes
 * partagent les mêmes colonnes d'une demi-heure. Abscisse : heures depuis le début de la phase
 * active (ou depuis l'admission tant que la phase active n'a pas commencé).
 */
@Component({
  selector: 'app-partogramme',
  standalone: true,
  template: `
<div class="grid gap-6">
  <div class="card">
    <div class="card-header flex-wrap gap-2">
      <h3 class="card-title"><i class="fa-solid fa-wave-square text-brand-600 dark:text-brand-400"></i> Surveillance de la phase active (≥ 4 cm)</h3>
      <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>BCF normal {{ p.bcf.min }}–{{ p.bcf.max }} bpm</span>
        @if (p.dilatation.zoneActuelle; as z) { <span class="badge {{ zone(z) }}">Zone {{ z.toLowerCase() }}</span> }
      </div>
    </div>
    <div class="overflow-x-auto">
      <div class="min-w-[720px] px-4 pb-4 pt-4">
        <div class="relative h-[330px]">
          <canvas #bcf role="img" [attr.aria-label]="'Courbe des BCF : ' + p.bcf.points.length + ' mesures, avec engagement et incidents'"></canvas>
          @if (!p.bcf.points.length) { <p class="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500 shadow-sm dark:bg-slate-900/90 dark:text-slate-400">Aucun BCF saisi.</p> }
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400" [style.padding-left.px]="margeGauche">
          <strong class="text-slate-700 dark:text-slate-300">M</strong> = Mobile ou haute ·
          <strong class="text-slate-700 dark:text-slate-300">A</strong> = Amorcée ·
          <strong class="text-slate-700 dark:text-slate-300">F</strong> = Fixée ·
          <strong class="text-slate-700 dark:text-slate-300">E</strong> = Engagée ·
          <strong class="text-slate-700 dark:text-slate-300">D</strong> = Dégagée
        </p>
        @if (incidents.length) {
          <ol class="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-300" [style.padding-left.px]="margeGauche">
            @for (i of incidents; track i.id; let n = $index) {
              <li><strong class="text-rose-600 dark:text-rose-400">{{ n + 1 }}</strong> · {{ heure(i.le) }} — {{ i.incident }}</li>
            }
          </ol>
        }

        <div class="relative mt-6 h-[360px]">
          <canvas #dilatation role="img" aria-label="Courbe de dilatation du col sur les zones verte, jaune et rouge, avec l’heure réelle"></canvas>
          @if (!p.debutPhaseActive) { <p class="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-center text-xs text-slate-500 shadow-sm dark:bg-slate-900/90 dark:text-slate-400">Le graphe démarre à la première dilatation ≥ 4 cm.</p> }
        </div>
      </div>
    </div>
    <div class="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span class="flex items-center gap-1.5"><i class="fa-solid fa-xmark font-bold text-slate-900 dark:text-slate-100"></i>Dilatation mesurée</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-green-300"></span>Verte : progression normale</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-yellow-300"></span>Jaune : au-delà de la ligne d’alerte</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-orange-400"></span>Rouge : au-delà de la ligne d’action</span>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3 class="card-title"><i class="fa-solid fa-circle-half-stroke text-accent-600 dark:text-accent-400"></i> Effacement du col</h3>
      @if (p.effacement.points.at(-1); as e) {
        <span class="text-xs text-slate-500 dark:text-slate-400">Dernier : {{ e.pct }} %</span>
      } @else {
        <span class="text-xs text-slate-500 dark:text-slate-400">0 % (col long) → 100 % (col effacé)</span>
      }
    </div>
    <div class="overflow-x-auto">
      <div class="relative h-56 min-w-[720px] p-4">
        @if (!p.effacement.points.length) { <p class="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">Aucun effacement saisi.</p> }
        <canvas #effacement [class.hidden]="!p.effacement.points.length" role="img" [attr.aria-label]="'Courbe de l’effacement du col : ' + p.effacement.points.length + ' mesures'"></canvas>
      </div>
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
  @ViewChild('effacement') canvasEff?: ElementRef<HTMLCanvasElement>;

  private theme = inject(ThemeService);
  private graphes: Chart<'line'>[] = [];
  private vue = false;
  zone = classeZone;
  heure = heureFr;
  margeGauche = MARGE_GAUCHE;

  constructor() {
    // Changement de thème : le quadrillage est redessiné dans les bonnes couleurs.
    effect(() => {
      this.theme.sombre();
      untracked(() => this.vue && this.dessiner());
    });
  }

  get incidents() {
    return this.p.reperes.filter(r => r.incident);
  }

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
    const t: Teintes = sombre
      ? { texte: '#cbd5e1', fine: 'rgba(148,163,184,0.16)', forte: 'rgba(203,213,225,0.45)', trait: '#f1f5f9' }
      : { texte: '#334155', fine: 'rgba(100,116,139,0.2)', forte: 'rgba(51,65,85,0.55)', trait: '#0f172a' };
    const origine = this.origine();
    const heures = (le: string) => Math.round(((new Date(le).getTime() - origine) / HEURE) * 100) / 100;

    // Mêmes colonnes d'heures pour tous les graphes.
    const toutes = [
      ...this.p.bcf.points.map(b => heures(b.le)),
      ...this.p.effacement.points.map(e => heures(e.le)),
      ...this.p.reperes.map(r => heures(r.le)),
      ...this.p.dilatation.points.map(d => d.heures),
    ];
    const xMin = Math.min(0, Math.floor(Math.min(0, ...toutes)));
    const xMax = Math.max(12, Math.ceil(Math.max(0, ...toutes)) + 1);

    const axeX = (etiquettes: boolean) => ({
      type: 'linear' as const, min: xMin, max: xMax,
      ticks: { display: etiquettes, stepSize: 0.5, autoSkip: false, maxRotation: 0, color: t.texte, callback: (v: string | number) => (Number.isInteger(Number(v)) ? `${v} h` : '') },
      grid: { color: (c: { tick?: { value: number } }) => (Number.isInteger(c.tick?.value) ? t.forte : t.fine), drawTicks: false },
      border: { color: t.forte },
    });
    const axeY = (min: number, max: number, pas: number, etiquette: (v: number) => string, titre: string) => ({
      min, max,
      afterFit: (s: { width: number }) => { s.width = MARGE_GAUCHE; },
      ticks: { stepSize: pas, autoSkip: false, color: t.texte, callback: (v: string | number) => etiquette(Number(v)) },
      grid: { color: (c: { tick?: { value: number } }) => (etiquette(c.tick?.value ?? NaN) ? t.forte : t.fine), drawTicks: false },
      border: { color: t.forte },
      title: { display: true, text: titre, color: t.texte, font: { weight: 'bold' as const, size: 13 } },
    });
    const infobulle = {
      backgroundColor: '#0f172a', padding: 10, cornerRadius: 8,
      callbacks: { title: (items: { raw: unknown }[]) => dateHeureChiffres((items[0]?.raw as { le?: string })?.le ?? null) },
    };
    const horizontale = (y: number) => ({ data: [{ x: xMin, y }, { x: xMax, y }], borderColor: t.trait, borderWidth: 3, pointRadius: 0, pointHitRadius: 0 });

    if (this.canvasBcf) {
      const points = this.p.bcf.points.map(b => ({ x: heures(b.le), y: b.bcf, le: b.le }));
      const couleur = sombre ? '#4a8fd8' : '#0055a5';
      const engagement: LigneCases = {
        titre: 'Engagement', pas: 0.5,
        cases: this.p.reperes.filter(r => r.engagement).map(r => ({ h: heures(r.le), texte: r.engagement! })),
      };
      const incident: LigneCases = {
        titre: 'Incident', pas: 0.5,
        cases: this.incidents.map((r, i) => ({ h: heures(r.le), texte: String(i + 1), couleur: sombre ? '#fb7185' : '#e11d48' })),
      };
      this.graphes.push(new Chart(this.canvasBcf.nativeElement, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'BCF', data: points as never, borderColor: couleur, borderWidth: 2, tension: 0.2,
              pointRadius: 4, pointBackgroundColor: this.p.bcf.points.map(b => (b.anormal ? '#e11d48' : couleur)), pointBorderColor: this.p.bcf.points.map(b => (b.anormal ? '#e11d48' : couleur)),
            },
            { label: `Limite ${this.p.bcf.min}`, ...horizontale(this.p.bcf.min) },
            { label: `Limite ${this.p.bcf.max}`, ...horizontale(this.p.bcf.max) },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          layout: { padding: { bottom: 2 * LIGNE + 6 } },
          scales: {
            x: axeX(false),
            y: axeY(this.p.bcf.echelle[0], this.p.bcf.echelle[1], 5, v => (v % 10 === 0 ? String(v) : ''), 'BCF'),
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...infobulle, filter: i => i.datasetIndex === 0, callbacks: { ...infobulle.callbacks, label: i => ` ${(i.raw as { y: number }).y} bpm` } },
            // Options des plugins du partogramme (non typées par Chart.js).
            ...({ casesPartogramme: { lignes: [engagement, incident], teintes: t } } as object),
          },
        },
        plugins: [casesPlugin],
      }));
    }

    if (this.canvasDil) {
      const points = this.p.dilatation.points.map(d => ({ x: d.heures, y: d.cm, le: d.le, zone: d.zone }));
      const ligne = (l: { heures: number; cm: number }[]) => ({
        data: l.map(q => ({ x: q.heures, y: q.cm })), borderColor: t.trait, borderWidth: 3, pointRadius: 0, pointHitRadius: 0,
      });
      const heureReelle: LigneCases = {
        titre: 'Heure réelle', pas: 1,
        cases: Array.from({ length: xMax - xMin }, (_, i) => ({ h: xMin + i, texte: heureFr(new Date(origine + (xMin + i) * HEURE)) })),
      };
      const actif = !!this.p.debutPhaseActive;
      this.graphes.push(new Chart(this.canvasDil.nativeElement, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Dilatation', data: points as never, borderColor: t.trait, borderWidth: 2,
              pointRadius: 7, pointHoverRadius: 8, pointStyle: 'crossRot', pointBorderWidth: 3, pointBorderColor: t.trait,
            },
            ...(actif ? [
              { label: 'Ligne d’alerte', ...ligne(this.p.dilatation.lignes.alerte) },
              { label: 'Ligne d’action', ...ligne(this.p.dilatation.lignes.action) },
            ] : []),
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          layout: { padding: { bottom: LIGNE + 6 } },
          scales: {
            x: axeX(true),
            y: axeY(4, 10, 0.5, v => (Number.isInteger(v) ? `${v} cm` : ''), 'DILATATION'),
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...infobulle, filter: i => i.datasetIndex === 0, callbacks: { ...infobulle.callbacks, label: i => ` ${(i.raw as { y: number; zone: Zone }).y} cm · zone ${(i.raw as { zone: Zone }).zone.toLowerCase()}` } },
            ...({ zonesPartogramme: { actif, sombre }, casesPartogramme: { lignes: [heureReelle], teintes: t } } as object),
          },
        },
        plugins: [zonesPlugin, casesPlugin],
      }));
    }

    if (this.canvasEff && this.p.effacement.points.length) {
      const points = this.p.effacement.points.map(e => ({ x: heures(e.le), y: e.pct, le: e.le }));
      const couleur = sombre ? '#4ade80' : '#24894a';
      this.graphes.push(new Chart(this.canvasEff.nativeElement, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Effacement', data: points as never, borderColor: couleur, backgroundColor: couleur, borderWidth: 2, tension: 0.2,
            pointRadius: 4, pointBackgroundColor: couleur,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          scales: {
            x: axeX(true),
            y: axeY(this.p.effacement.echelle[0], this.p.effacement.echelle[1], 10, v => (v % 20 === 0 ? `${v} %` : ''), 'EFFACEMENT'),
          },
          plugins: { legend: { display: false }, tooltip: { ...infobulle, callbacks: { ...infobulle.callbacks, label: i => ` Effacé à ${(i.raw as { y: number }).y} %` } } },
        },
      }));
    }
  }
}
