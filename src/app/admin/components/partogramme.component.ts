import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, effect, inject, untracked } from '@angular/core';
import { Chart, LineController, LineElement, LinearScale, Plugin, PointElement, Tooltip } from 'chart.js';
import { ColonnePartogramme, Partogramme, Zone, classeZone } from '../data/accouchements.service';
import { ThemeService } from '../../shared/theme.service';
import { dateHeureChiffres, heureFr } from '../data/format';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

const HEURE = 3_600_000;
/** Largeur fixe de la colonne des libellés : les graphes empilés partagent les mêmes colonnes d'heures. */
const MARGE_GAUCHE = 96;
/** Marge droite commune (place de la dernière étiquette « 12 h ») : les colonnes restent alignées. */
const MARGE_DROITE = 16;
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
 * Zones verte / jaune / rouge du graphe de dilatation, dessinées sous les courbes même sans
 * saisie, comme sur la feuille papier : à gauche de la ligne d'alerte, entre les deux lignes, à droite de la
 * ligne d'action.
 */
const zonesPlugin: Plugin<'line'> = {
  id: 'zonesPartogramme',
  beforeDatasetsDraw(chart, _args, options: { sombre?: boolean }) {
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

/**
 * Partogramme complété des valeurs par défaut : un dossier incomplet (cache hors ligne, dossier
 * ancien) affiche quand même le quadrillage vide au lieu d'interrompre le dessin.
 */
function completer(p: Partial<Partogramme> | null | undefined): Partogramme {
  return {
    ...p,
    debutPhaseActive: p?.debutPhaseActive ?? null,
    bcf: { min: 120, max: 160, echelle: [100, 180], ...p?.bcf, points: p?.bcf?.points ?? [] },
    effacement: { echelle: [0, 100], ...p?.effacement, points: p?.effacement?.points ?? [] },
    dilatation: {
      echelle: [4, 10], zoneActuelle: null, ...p?.dilatation,
      lignes: { alerte: p?.dilatation?.lignes?.alerte ?? [], action: p?.dilatation?.lignes?.action ?? [] },
      points: p?.dilatation?.points ?? [],
    },
    reperes: p?.reperes ?? [],
    // Avant la phase active (ou dossier ancien) : grille vide de 14 heures, comme sur la feuille.
    tableau: {
      colonnes: p?.tableau?.colonnes?.length ? p.tableau.colonnes : Array.from({ length: COLONNES_TABLEAU }, (_, i) => ({
        heure: i + 1, debut: null, contractions10min: null, dureeContractionsSec: null, membranes: null, liquideAmniotique: null,
        pertesSang: null, temperature: null, pouls: null, taSystolique: null, taDiastolique: null, diurese: null,
        ocytocineUParMl: null, ocytocineGouttesMin: null, medicamentsIV: [],
      })),
    },
  } as Partogramme;
}

const COLONNES_TABLEAU = 14;

/** Lignes du tableau horaire sous la dilatation, dans l'ordre de la feuille papier. */
const LIGNES_TABLEAU: { titre: string; valeur: (c: ColonnePartogramme) => string | number | null; rouge?: boolean }[] = [
  { titre: 'Contractions utérines en 10 minutes', valeur: c => c.contractions10min },
  { titre: 'Durée des contractions (en sec)', valeur: c => c.dureeContractionsSec },
  { titre: 'Membranes présentes ou rompues', valeur: c => c.membranes },
  { titre: 'LA (aspect)', valeur: c => c.liquideAmniotique },
  { titre: 'Pertes de sang', valeur: c => c.pertesSang },
  { titre: 'Température axillaire', valeur: c => (c.temperature != null ? `${c.temperature} °C` : null) },
  { titre: 'Pouls', valeur: c => c.pouls },
  { titre: 'Tension artérielle', valeur: c => (c.taSystolique != null || c.taDiastolique != null ? `${c.taSystolique ?? '?'}/${c.taDiastolique ?? '?'}` : null) },
  { titre: 'Diurèse', valeur: c => c.diurese },
  { titre: 'Ocytocine U/ml', valeur: c => c.ocytocineUParMl },
  { titre: 'Ocytocine gttes/min', valeur: c => c.ocytocineGouttesMin },
  { titre: 'Médicaments et injections IV', valeur: c => c.medicamentsIV.join(' ; ') || null, rouge: true },
];

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
 * Mesures bien visibles sur le quadrillage : pastille claire sous chaque point de la courbe
 * mesurée (premier jeu de données), puis valeur écrite à côté (« 140 », « 5 cm »).
 */
const valeursPlugin: Plugin<'line'> = {
  id: 'valeursPartogramme',
  beforeDatasetDraw(chart, args, options: { sombre?: boolean; halo?: number }) {
    if (args.index !== 0 || !options?.halo) return;
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = options.sombre ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)';
    for (const p of chart.getDatasetMeta(0).data) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, options.halo, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart, _args, options: { sombre?: boolean; texte?: (y: number) => string; couleur?: (i: number) => string }) {
    if (!options?.texte || !options.couleur) return;
    const { ctx, chartArea: a } = chart;
    const donnees = chart.data.datasets[0].data as { y: number }[];
    ctx.save();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((p, i) => {
      const texte = options.texte!(donnees[i].y);
      const couleur = options.couleur!(i);
      const l = ctx.measureText(texte).width + 10;
      const h = 18;
      // Au-dessus du point, ou en dessous s'il touche le haut du graphe.
      const cy = p.y - 20 < a.top + h / 2 ? p.y + 20 : p.y - 20;
      ctx.beginPath();
      ctx.roundRect(p.x - l / 2, cy - h / 2, l, h, 5);
      ctx.fillStyle = options.sombre ? '#0f172a' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = couleur;
      ctx.stroke();
      ctx.fillStyle = couleur;
      ctx.fillText(texte, p.x, cy + 0.5);
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
        </div>

        <!-- Tableau horaire de la feuille papier : une colonne par heure écoulée depuis le début de la phase active. -->
        <table class="mt-6 w-full table-fixed border-collapse text-[11px] text-slate-700 dark:text-slate-300">
          <caption class="sr-only">Surveillance horaire de la phase active : contractions, membranes, liquide amniotique, constantes, ocytocine et médicaments IV</caption>
          <colgroup><col class="w-40"></colgroup>
          <thead>
            <tr>
              <th scope="row" class="border border-slate-400 px-1.5 py-1 text-left font-medium leading-tight dark:border-slate-600">Temps écoulé depuis phase active</th>
              @for (c of p.tableau.colonnes; track c.heure) {
                <th scope="col" class="border border-slate-400 px-0.5 py-1 text-center font-bold dark:border-slate-600" [attr.title]="c.debut ? 'À partir de ' + heure(c.debut) : null">
                  {{ c.heure }}
                  @if (c.debut) { <span class="block text-[10px] font-normal text-slate-500 dark:text-slate-400">{{ heure(c.debut) }}</span> }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (l of lignesTableau; track l.titre) {
              <tr>
                <th scope="row" class="border border-slate-400 px-1.5 py-1 text-left font-medium leading-tight dark:border-slate-600"
                    [class]="l.rouge ? 'h-12 text-rose-600 dark:text-rose-400' : ''">{{ l.titre }}</th>
                @for (c of p.tableau.colonnes; track c.heure) {
                  <td class="break-words border border-slate-400 px-0.5 py-1 text-center align-middle font-semibold dark:border-slate-600">{{ l.valeur(c) ?? '' }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    <div class="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-[#0055a5] dark:bg-blue-400"></span>BCF mesuré</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-rose-600 dark:bg-rose-400"></span>BCF hors 120–160</span>
      <span class="flex items-center gap-1.5"><i class="fa-solid fa-xmark font-bold text-indigo-800 dark:text-indigo-300"></i>Dilatation mesurée</span>
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
  lignesTableau = LIGNES_TABLEAU;

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
    this.p = completer(this.p);
    if (this.vue) this.dessiner();
  }

  ngOnDestroy(): void {
    this.graphes.forEach(g => g.destroy());
  }

  private origine(): number {
    // Sans début de phase active ni heure d'admission valide, le graphe part de l'heure pleine actuelle.
    const t = new Date(this.p.debutPhaseActive ?? this.admiseLe).getTime();
    return Number.isNaN(t) ? Math.floor(Date.now() / HEURE) * HEURE : t;
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
    ].filter(Number.isFinite);
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
      const couleur = sombre ? '#60a5fa' : '#0055a5';
      const rouge = sombre ? '#fb7185' : '#e11d48';
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
              // Segments droits (pas de lissage : aucune valeur inventée entre deux mesures) ; points au bord non coupés.
              label: 'BCF', data: points as never, borderColor: couleur, borderWidth: 3, tension: 0, clip: false,
              pointRadius: this.p.bcf.points.map(b => (b.anormal ? 7 : 6)), pointHoverRadius: 8,
              pointBackgroundColor: this.p.bcf.points.map(b => (b.anormal ? rouge : couleur)),
              pointBorderColor: sombre ? '#0f172a' : '#ffffff', pointBorderWidth: 2,
            },
            { label: `Limite ${this.p.bcf.min}`, ...horizontale(this.p.bcf.min) },
            { label: `Limite ${this.p.bcf.max}`, ...horizontale(this.p.bcf.max) },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          layout: { padding: { bottom: 2 * LIGNE + 6, right: MARGE_DROITE } },
          scales: {
            x: axeX(false),
            y: axeY(this.p.bcf.echelle[0], this.p.bcf.echelle[1], 5, v => (v % 10 === 0 ? String(v) : ''), 'BCF'),
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...infobulle, filter: i => i.datasetIndex === 0, callbacks: { ...infobulle.callbacks, label: i => ` ${(i.raw as { y: number }).y} bpm` } },
            // Options des plugins du partogramme (non typées par Chart.js).
            ...({
              casesPartogramme: { lignes: [engagement, incident], teintes: t },
              valeursPartogramme: { sombre, texte: (y: number) => String(y), couleur: (i: number) => (this.p.bcf.points[i]?.anormal ? rouge : couleur) },
            } as object),
          },
        },
        plugins: [casesPlugin, valeursPlugin],
      }));
    }

    if (this.canvasDil) {
      const points = this.p.dilatation.points.map(d => ({ x: d.heures, y: d.cm, le: d.le, zone: d.zone }));
      const couleurDil = sombre ? '#a5b4fc' : '#3730a3';
      const ligne = (l: { heures: number; cm: number }[]) => ({
        data: l.map(q => ({ x: q.heures, y: q.cm })), borderColor: t.trait, borderWidth: 3, pointRadius: 0, pointHitRadius: 0,
      });
      const heureReelle: LigneCases = {
        titre: 'Heure réelle', pas: 1,
        cases: Array.from({ length: xMax - xMin }, (_, i) => ({ h: xMin + i, texte: heureFr(new Date(origine + (xMin + i) * HEURE)) })),
      };
      // Zones et lignes toujours visibles, même sans saisie, comme sur la feuille papier.
      const { alerte, action } = this.p.dilatation.lignes;
      this.graphes.push(new Chart(this.canvasDil.nativeElement, {
        type: 'line',
        data: {
          datasets: [
            {
              // Couleur propre, distincte des lignes d'alerte et d'action (noires) et des zones.
              label: 'Dilatation', data: points as never, borderColor: couleurDil, borderWidth: 3, clip: false,
              pointRadius: 9, pointHoverRadius: 10, pointStyle: 'crossRot', pointBorderWidth: 4, pointBorderColor: couleurDil,
            },
            { label: 'Ligne d’alerte', ...ligne(alerte.length ? alerte : [{ heures: 0, cm: 4 }, { heures: 6, cm: 10 }]) },
            { label: 'Ligne d’action', ...ligne(action.length ? action : [{ heures: 4, cm: 4 }, { heures: 10, cm: 10 }]) },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          layout: { padding: { bottom: LIGNE + 6, right: MARGE_DROITE } },
          scales: {
            x: axeX(true),
            y: axeY(4, 10, 0.5, v => (Number.isInteger(v) ? `${v} cm` : ''), 'DILATATION'),
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...infobulle, filter: i => i.datasetIndex === 0, callbacks: { ...infobulle.callbacks, label: i => ` ${(i.raw as { y: number; zone: Zone }).y} cm · zone ${(i.raw as { zone: Zone }).zone.toLowerCase()}` } },
            ...({
              zonesPartogramme: { sombre }, casesPartogramme: { lignes: [heureReelle], teintes: t },
              valeursPartogramme: { sombre, halo: 11, texte: (y: number) => `${y} cm`, couleur: () => couleurDil },
            } as object),
          },
        },
        plugins: [zonesPlugin, casesPlugin, valeursPlugin],
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
