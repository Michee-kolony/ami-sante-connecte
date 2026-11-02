import { Component, ElementRef, HostListener, computed, inject, input, signal, viewChild } from '@angular/core';
import { ModuleSynthese, SyntheseEtatService } from '../data/statistiques.service';
import { ONGLETS_MODULES } from './indicateurs-modules.component';
import { valeurIndicateur } from './synthese-ami.component';

type Genre = 'section' | 'indicateur';

/** Élément cherchable du tableau de bord : lu dans la page, ou indicateur d'un onglet non affiché. */
interface Entree {
  id: string;
  genre: Genre;
  titre: string;
  section: string;
  type: string;
  valeur: string;
  mots: string;
  code: string;
  el?: HTMLElement;
  module?: ModuleSynthese;
}

interface Resultat extends Entree {
  score: number;
  segments: { t: string; m: boolean }[];
}

/** Synonymes et sigles du suivi mère-enfant (termes normalisés : minuscules, sans accent). */
const SYNONYMES: Record<string, string[]> = {
  cpn: ['consultation prenatale', 'prenatal', 'prenatale'],
  prenatal: ['cpn'],
  cpon: ['postnatal', 'postnatale', 'consultation postnatale'],
  postnatal: ['cpon'],
  vaccin: ['vaccination', 'pev', 'dose', 'antigene', 'bcg', 'penta', 'polio', 'vpo', 'rr', 'rougeole', 'vat'],
  vaccination: ['vaccin', 'pev', 'antigene'],
  pev: ['vaccination', 'vaccin'],
  vat: ['tetanos', 'antitetanique'],
  tetanos: ['vat'],
  sp: ['tpi', 'sulfadoxine', 'paludisme'],
  tpi: ['sp', 'paludisme'],
  palu: ['paludisme', 'tdr', 'tpi', 'sp', 'moustiquaire', 'milda'],
  paludisme: ['palu', 'tdr'],
  tdr: ['test', 'paludisme', 'palu'],
  moustiquaire: ['milda'],
  milda: ['moustiquaire'],
  ptme: ['vih', 'transmission'],
  vih: ['ptme', 'sida'],
  echo: ['echographie'],
  echographie: ['echo'],
  accouchement: ['naissance', 'salle', 'travail', 'cesarienne', 'parturiente'],
  naissance: ['accouchement', 'ne', 'nouveau'],
  cesarienne: ['accouchement', 'cesar'],
  hpp: ['hemorragie', 'post partum'],
  hemorragie: ['hpp', 'saignement'],
  eclampsie: ['convulsion', 'preeclampsie'],
  deces: ['mortalite', 'mort', 'decede'],
  mortalite: ['deces', 'mort'],
  mort: ['deces', 'mortalite', 'mortinaissance'],
  bebe: ['nouveau', 'enfant', 'nourrisson'],
  nn: ['nouveau ne', 'nouveau'],
  enfant: ['bebe', 'nouveau', 'nourrisson'],
  poids: ['pese', 'pesee', 'faible poids', 'kg', 'grammes'],
  senn: ['soins essentiels', 'nouveau'],
  reco: ['relais communautaire', 'communautaire', 'relance'],
  relais: ['reco'],
  communautaire: ['reco'],
  relance: ['reco', 'tache', 'rac', 'arc', 'rpc', 'irc', 'tcc'],
  rac: ['relance', 'absent', 'cpn'],
  arc: ['relance', 'vaccin', 'abandon'],
  rpc: ['relance', 'postnatal'],
  irc: ['relance', 'reference'],
  tcc: ['relance', 'causerie', 'sensibilisation', 'communication'],
  visite: ['vad', 'domicile'],
  vad: ['visite', 'domicile'],
  reference: ['refere', 'evacuation', 'transfert', 'contre'],
  evacuation: ['reference', 'transfert'],
  rdv: ['rendez vous', 'rendezvous'],
  rendez: ['rdv'],
  retard: ['rattraper', 'manque', 'absent', 'perdu'],
  abandon: ['perdu', 'retard', 'arc'],
  couverture: ['taux', 'pourcentage', 'cible'],
  taux: ['pourcentage', 'couverture', 'proportion'],
  province: ['carte', 'territoire', 'residence'],
  carte: ['province'],
  aire: ['zone', 'aire de sante'],
  qualite: ['donnees', 'doublon', 'incomplet', 'completude'],
  doublon: ['qualite'],
  grossesse: ['enceinte', 'gestation', 'trimestre'],
  enceinte: ['grossesse'],
  personnel: ['soignant', 'medecin', 'infirmier', 'sage femme'],
  soignant: ['personnel'],
  alerte: ['alertes', 'urgence'],
};

const CLE_RECENTS = 'ami.recherche-tableau.recents';

/** Minuscules sans accents ni ponctuation, en gardant la correspondance des positions avec le texte d'origine. */
function normaliser(s: string): { n: string; pos: number[] } {
  let n = '';
  const pos: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    c = c === 'œ' ? 'o' : c === '’' || c === "'" ? ' ' : c;
    if (!c) continue;
    const ch = /[a-z0-9%‰]/.test(c) ? c : ' ';
    n += ch;
    pos.push(i);
  }
  return { n, pos };
}
/** Texte comparable ; lettres et chiffres collés séparés (« CPN4 » = « CPN 4 »). */
const norm = (s: string) => normaliser(s).n.replace(/([a-z])(\d)|(\d)([a-z])/g, '$1$3 $2$4').replace(/\s+/g, ' ').trim();

/** Distance d'édition (insertion, suppression, substitution, transposition) bornée. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let min = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      min = Math.min(min, d[i][j]);
    }
    if (min > max) return max + 1;
  }
  return d[a.length][b.length];
}

/**
 * Score d'un terme dans un texte normalisé : mot exact (10), début de mot (8), sous-chaîne (5),
 * faute de frappe tolérée sur un mot ou un début de mot (4). 0 : absent.
 */
function scoreTerme(terme: string, texte: string, mots: string[]): number {
  if (!texte) return 0;
  if (terme.includes(' ')) return texte.includes(terme) ? 9 : 0;
  if (mots.includes(terme)) return 10;
  if (terme.length < 2 || /^\d+$/.test(terme)) return 0;
  if (mots.some(m => m.startsWith(terme))) return 8;
  if (terme.length >= 3 && texte.includes(terme)) return 5;
  if (terme.length >= 4) {
    const max = terme.length >= 7 ? 2 : 1;
    if (mots.some(m => m.length >= terme.length - 1 && (distance(terme, m, max) <= max || distance(terme, m.slice(0, terme.length), max) <= max))) return 4;
  }
  return 0;
}

/** Requête analysée : termes (avec synonymes), expressions exactes, exclusions et filtres. */
interface Requete {
  termes: string[];
  phrases: string[];
  exclus: string[];
  genre: Genre | null;
  dans: string[];
  brute: string;
}

function analyser(q: string): Requete {
  const r: Requete = { termes: [], phrases: [], exclus: [], genre: null, dans: [], brute: norm(q.replace(/"[^"]*"|\S+:\S+|(^|\s)-\S+/g, ' ')) };
  q = q.replace(/"([^"]+)"?/g, (_, p) => { const n = norm(p); if (n) r.phrases.push(n); return ' '; });
  for (const brut of q.split(/\s+/).filter(Boolean)) {
    const filtre = /^(type|dans|in|section|module):(.+)$/i.exec(brut);
    if (filtre) {
      const v = norm(filtre[2]);
      if (/^type$/i.test(filtre[1])) r.genre = v.startsWith('s') ? 'section' : v.startsWith('i') ? 'indicateur' : null;
      else if (v) r.dans.push(v);
      continue;
    }
    if (brut.startsWith('-') && brut.length > 1) { const n = norm(brut.slice(1)); if (n) r.exclus.push(n); continue; }
    r.termes.push(...norm(brut).split(' ').filter(Boolean));
  }
  return r;
}

/**
 * Recherche avancée du tableau de bord : trouve une analyse, un indicateur ou une section parmi
 * toutes celles de la page (y compris les indicateurs des onglets non affichés), tolère les fautes
 * de frappe, les accents oubliés, les sigles (CPN, HPP, PTME, RAC…) et les synonymes, puis fait
 * défiler jusqu'à l'élément et le met en évidence.
 *
 * Syntaxe : « "expression exacte" », « -exclure », « type:indicateur|section », « dans:vaccination ».
 * Raccourcis : Ctrl+K ou « / » pour chercher, ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.
 */
@Component({
  selector: 'app-recherche-tableau-bord',
  standalone: true,
  template: `
    <div class="relative" (focusout)="perteFocus($event)">
      <div class="card flex items-center gap-2 px-3 py-2 shadow-md ring-1 ring-transparent transition focus-within:ring-brand-300 dark:focus-within:ring-brand-500/50">
        <i class="fa-solid fa-magnifying-glass text-slate-400"></i>
        <input #champ type="search" role="combobox" autocomplete="off" spellcheck="false"
               class="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-white"
               placeholder="Rechercher une analyse : CPN 4, Penta 3, hémorragie, RECO, couverture BCG…"
               aria-label="Rechercher une analyse dans le tableau de bord" aria-controls="resultats-recherche-tableau"
               [attr.aria-expanded]="ouvert()" [attr.aria-activedescendant]="actif() >= 0 ? 'rtb-' + actif() : null"
               [value]="requete()" (input)="saisir($any($event.target).value)" (focus)="ouvrir()" (keydown)="clavier($event)" />
        @if (requete()) {
          <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="effacer()" title="Effacer" aria-label="Effacer la recherche"><i class="fa-solid fa-xmark"></i></button>
        }
        <button type="button" class="btn-ghost px-2 py-1 text-xs" [class.text-brand-600]="aide()" (click)="aide.set(!aide()); champ.focus()" title="Astuces de recherche" aria-label="Astuces de recherche">
          <i class="fa-regular fa-circle-question"></i>
        </button>
        <kbd class="hidden rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline dark:border-slate-700 dark:text-slate-400">Ctrl K</kbd>
      </div>

      @if (ouvert()) {
        <div id="resultats-recherche-tableau" role="listbox" aria-label="Résultats de la recherche"
             class="absolute inset-x-0 top-full z-40 mt-2 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          @if (aide()) {
            <div class="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <p class="mb-1.5 font-semibold text-slate-800 dark:text-slate-100">Astuces</p>
              <ul class="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <li><code class="text-brand-700 dark:text-brand-300">penta 3</code> : plusieurs mots, tous doivent correspondre</li>
                <li><code class="text-brand-700 dark:text-brand-300">"taux de cesarienne"</code> : expression exacte</li>
                <li><code class="text-brand-700 dark:text-brand-300">deces -maternel</code> : exclure un mot</li>
                <li><code class="text-brand-700 dark:text-brand-300">dans:vaccination</code> : limiter à une section</li>
                <li><code class="text-brand-700 dark:text-brand-300">type:section</code> ou <code class="text-brand-700 dark:text-brand-300">type:indicateur</code></li>
                <li>Fautes, accents et sigles tolérés : <code class="text-brand-700 dark:text-brand-300">hemoragie</code>, <code class="text-brand-700 dark:text-brand-300">HPP</code>, <code class="text-brand-700 dark:text-brand-300">palu</code></li>
              </ul>
            </div>
          }

          @if (requete().trim()) {
            <div class="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
              @for (f of filtresGenre; track f.code) {
                <button type="button" class="badge border transition" (mousedown)="$event.preventDefault()" (click)="genre.set(f.code); rechercher()"
                        [class]="genre() === f.code ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'">
                  {{ f.libelle }} · {{ compte()[f.code] }}
                </button>
              }
              <span class="ml-auto text-[11px] text-slate-400">{{ affiches().length < filtres().length ? affiches().length + ' premiers sur ' : '' }}{{ filtres().length }} résultat(s)</span>
            </div>
          }

          <div class="overflow-y-auto py-1">
            @if (!requete().trim()) {
              @if (recents().length) {
                <p class="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recherches récentes</p>
                <div class="flex flex-wrap gap-1.5 px-4 pb-2">
                  @for (r of recents(); track r) {
                    <button type="button" class="badge border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
                            (mousedown)="$event.preventDefault()" (click)="saisir(r)"><i class="fa-solid fa-clock-rotate-left text-[10px]"></i>{{ r }}</button>
                  }
                  <button type="button" class="text-[11px] text-slate-400 underline" (mousedown)="$event.preventDefault()" (click)="oublierRecents()">Effacer</button>
                </div>
              }
              <p class="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sommaire du tableau de bord</p>
            }
            @for (g of groupes(); track g.nom) {
              @if (requete().trim()) {
                <p class="sticky top-0 z-10 bg-white/95 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur dark:bg-slate-900/95">{{ g.nom }}</p>
              }
              @for (r of g.items; track r.id) {
                <button type="button" role="option" [id]="'rtb-' + r.rang" [attr.aria-selected]="actif() === r.rang"
                        class="flex w-full items-center gap-3 px-4 py-2 text-left transition"
                        [class]="actif() === r.rang ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'"
                        (mousedown)="$event.preventDefault()" (mouseenter)="actif.set(r.rang)" (click)="aller(r)">
                  <span class="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs"
                        [class]="r.genre === 'section' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'">
                    <i class="fa-solid" [class]="r.genre === 'section' ? 'fa-layer-group' : r.module ? 'fa-table-cells' : 'fa-chart-simple'"></i>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm text-slate-800 dark:text-slate-100">@for (s of r.segments; track $index) {@if (s.m) {<mark class="rounded bg-amber-100 px-0.5 font-semibold text-slate-900 dark:bg-amber-400/25 dark:text-amber-100">{{ s.t }}</mark>} @else {<span>{{ s.t }}</span>}}</span>
                    <span class="block truncate text-[11px] text-slate-500 dark:text-slate-400">{{ r.type }}@if (r.section && r.section !== r.titre) {<span> · {{ r.section }}</span>}@if (r.module) {<span> · onglet {{ libelleModule(r.module) }}</span>}</span>
                  </span>
                  @if (r.valeur) {
                    <span class="flex-none text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ r.valeur }}</span>
                  }
                  @if (actif() === r.rang) { <i class="fa-solid fa-arrow-turn-down rotate-90 text-[10px] text-brand-500"></i> }
                </button>
              }
            } @empty {
              <div class="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <i class="fa-solid fa-magnifying-glass-minus mb-2 block text-xl text-slate-300 dark:text-slate-600"></i>
                Aucune analyse ne correspond à « {{ requete() }} ».
                @if (suggestion(); as s) {
                  <button type="button" class="mt-1 block w-full text-brand-600 underline dark:text-brand-400" (mousedown)="$event.preventDefault()" (click)="saisir(s)">Essayer « {{ s }} »</button>
                }
              </div>
            }
          </div>

          <div class="hidden items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:flex dark:border-slate-800">
            <span><kbd class="font-mono">↑</kbd> <kbd class="font-mono">↓</kbd> choisir</span>
            <span><kbd class="font-mono">Entrée</kbd> ouvrir</span>
            <span><kbd class="font-mono">Échap</kbd> fermer</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class RechercheTableauBordComponent {
  private etat = inject(SyntheseEtatService);
  private hote = inject(ElementRef<HTMLElement>);
  private champ = viewChild.required<ElementRef<HTMLInputElement>>('champ');

  /** Conteneur du tableau de bord dans lequel chercher. */
  racine = input.required<HTMLElement>();

  readonly filtresGenre: { code: Genre | 'tout'; libelle: string }[] = [
    { code: 'tout', libelle: 'Tout' }, { code: 'indicateur', libelle: 'Indicateurs' }, { code: 'section', libelle: 'Sections' },
  ];

  requete = signal('');
  ouvert = signal(false);
  aide = signal(false);
  genre = signal<Genre | 'tout'>('tout');
  actif = signal(0);
  recents = signal<string[]>(this.lireRecents());
  private resultats = signal<Resultat[]>([]);
  private index: Entree[] = [];
  suggestion = signal<string | null>(null);

  /** Résultats selon le filtre Tout / Indicateurs / Sections. */
  filtres = computed(() => this.genre() === 'tout' || !this.requete().trim() ? this.resultats() : this.resultats().filter(r => r.genre === this.genre()));
  affiches = computed(() => this.filtres().slice(0, 60));
  compte = computed(() => {
    const r = this.resultats();
    return { tout: r.length, indicateur: r.filter(x => x.genre === 'indicateur').length, section: r.filter(x => x.genre === 'section').length };
  });

  /** Groupés par section, dans l'ordre du meilleur résultat de chaque section ; rang = ordre clavier. */
  groupes = computed(() => {
    const groupes: { nom: string; items: (Resultat & { rang: number })[] }[] = [];
    for (const r of this.affiches()) {
      const nom = this.requete().trim() ? (r.genre === 'section' ? 'Sections' : r.section || 'Autres') : '';
      let g = groupes.find(x => x.nom === nom);
      if (!g) groupes.push(g = { nom, items: [] });
      g.items.push({ ...r, rang: 0 });
    }
    let rang = 0;
    for (const g of groupes) for (const i of g.items) i.rang = rang++;
    return groupes;
  });
  private ordre = computed(() => this.groupes().flatMap(g => g.items));

  libelleModule = (m: ModuleSynthese) => ONGLETS_MODULES.find(o => o.code === m)?.libelle ?? m;

  // --- Index ---

  /** Relu à chaque recherche : les valeurs affichées et les sections présentes changent avec les filtres. */
  private indexer(): void {
    const racine = this.racine();
    const entrees: Entree[] = [];
    const vus = new Set<HTMLElement>();
    let n = 0;
    const texte = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const visible = (el: HTMLElement) => !!(el.offsetParent || el.getClientRects().length);
    const titreSection = (el: HTMLElement) =>
      el.closest<HTMLElement>('[data-recherche-section]')?.dataset['rechercheSection']
      ?? texte(el.closest('.card')?.querySelector('.card-title'));

    // Indicateurs et tuiles marqués dans les gabarits.
    racine.querySelectorAll<HTMLElement>('[data-recherche]').forEach(el => {
      if (this.hote.nativeElement.contains(el) || !visible(el)) return;
      const d = el.dataset;
      entrees.push({
        id: `d${n++}`, genre: (d['rechercheGenre'] as Genre) ?? 'indicateur', titre: d['recherche'] ?? '',
        section: d['rechercheSection'] ?? titreSection(el.parentElement ?? el), type: d['rechercheType'] ?? 'Indicateur',
        valeur: d['rechercheValeur'] ?? '', mots: d['rechercheMots'] ?? '', code: d['rechercheCode'] ?? '', el,
      });
      vus.add(el);
    });

    // Sections : titres de cartes et grands titres de la page.
    racine.querySelectorAll<HTMLElement>('.card-title, h2').forEach(h => {
      if (this.hote.nativeElement.contains(h) || !visible(h)) return;
      const cible = h.closest<HTMLElement>('.card, section') ?? h;
      if (vus.has(cible) || vus.has(h)) return;
      vus.add(cible);
      const titre = texte(h);
      if (!titre) return;
      const mots = cible.closest<HTMLElement>('[data-recherche-mots]')?.dataset['rechercheMots'] ?? texte(h.parentElement?.querySelector('p'));
      entrees.push({ id: `s${n++}`, genre: 'section', titre, section: titre, type: 'Section', valeur: '', mots, code: '', el: cible.classList.contains('card') ? cible : h });
    });

    // Indicateurs par module, y compris les onglets non affichés.
    const modules = this.etat.donnees()?.modules;
    if (modules) {
      for (const o of ONGLETS_MODULES) {
        for (const i of modules[o.code] ?? []) {
          entrees.push({
            id: `m${o.code}-${i.code}`, genre: 'indicateur', titre: i.libelle, section: 'Indicateurs par module', type: `Indicateur ${i.code}`,
            valeur: valeurIndicateur(i), mots: `${o.libelle} ${i.formule ?? ''} ${i.detail ?? ''} ${i.source ?? ''}`, code: i.code, module: o.code,
          });
        }
      }
    }
    this.index = entrees;
  }

  // --- Recherche ---

  saisir(q: string): void {
    this.requete.set(q);
    this.ouvert.set(true);
    this.rechercher();
  }

  rechercher(): void {
    this.indexer();
    const q = this.requete();
    this.actif.set(0);
    this.suggestion.set(null);
    if (!q.trim()) {
      this.resultats.set(this.index.filter(e => e.genre === 'section').map(e => ({ ...e, score: 0, segments: [{ t: e.titre, m: false }] })));
      return;
    }
    const r = analyser(q);
    const res: Resultat[] = [];
    for (const e of this.index) {
      const s = this.noter(e, r);
      if (s > 0) res.push({ ...e, score: s, segments: this.surligner(e.titre, r) });
    }
    res.sort((a, b) => b.score - a.score || (a.genre === b.genre ? 0 : a.genre === 'indicateur' ? -1 : 1));
    this.resultats.set(res);
    if (!res.length) this.suggestion.set(this.suggerer(r));
  }

  private noter(e: Entree, r: Requete): number {
    const champs = [
      { t: norm(e.titre), poids: 3 }, { t: norm(e.code), poids: 2.5 }, { t: norm(e.section), poids: 1.4 },
      { t: norm(`${e.type} ${e.mots}`), poids: 0.8 },
    ].map(c => ({ ...c, mots: c.t.split(' ') }));
    const tout = champs.map(c => c.t).join(' ');
    if (r.genre && e.genre !== r.genre) return 0;
    if (r.dans.some(d => !norm(`${e.section} ${e.type} ${e.mots}`).includes(d) && !(e.module && norm(this.libelleModule(e.module)).includes(d)))) return 0;
    if (r.exclus.some(x => tout.split(' ').some(m => m.startsWith(x)))) return 0;
    if (r.phrases.some(p => !tout.includes(p))) return 0;

    let total = r.phrases.length * 12;
    for (const terme of r.termes) {
      let meilleur = 0;
      for (const variante of [terme, ...(SYNONYMES[terme] ?? [])]) {
        const facteur = variante === terme ? 1 : 0.7;
        for (const c of champs) meilleur = Math.max(meilleur, scoreTerme(variante, c.t, c.mots) * c.poids * facteur);
      }
      if (!meilleur) return 0;
      total += meilleur;
    }
    if (!r.termes.length && !r.phrases.length) total = 1;
    // Expression entière dans le titre : bonus, d'autant plus s'il commence par elle.
    const titre = champs[0].t;
    if (r.brute && titre.startsWith(r.brute)) total += 20;
    else if (r.brute && titre.includes(r.brute)) total += 10;
    if (r.brute && titre === r.brute) total += 15;
    return total;
  }

  /** Découpe le titre en segments surlignés là où un terme (ou un synonyme) apparaît. */
  private surligner(titre: string, r: Requete): { t: string; m: boolean }[] {
    const { n, pos } = normaliser(titre);
    const marque = new Array(titre.length).fill(false);
    const termes = [...r.phrases, ...r.termes.flatMap(t => [t, ...(SYNONYMES[t] ?? [])])].filter(t => t.length >= 2 || /^\d$/.test(t));
    for (const t of termes) {
      const re = new RegExp(`(^|[^a-z0-9])(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, ' +')})`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(n))) {
        const debut = m.index + m[1].length;
        for (let i = debut; i < debut + m[2].length; i++) marque[pos[i]] = true;
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    }
    const segments: { t: string; m: boolean }[] = [];
    for (let i = 0; i < titre.length; i++) {
      const dernier = segments.at(-1);
      if (dernier && dernier.m === marque[i]) dernier.t += titre[i];
      else segments.push({ t: titre[i], m: marque[i] });
    }
    return segments;
  }

  /** « Vouliez-vous dire » : mot de l'index le plus proche de chaque terme inconnu. */
  private suggerer(r: Requete): string | null {
    if (!r.termes.length) return null;
    const vocabulaire = new Set(this.index.flatMap(e => norm(`${e.titre} ${e.section}`).split(' ')).filter(m => m.length >= 3));
    let change = false;
    const termes = r.termes.map(t => {
      if ([...vocabulaire].some(m => m.startsWith(t))) return t;
      let meilleur = t, d = 3;
      for (const m of vocabulaire) {
        const x = distance(t, m, 2);
        if (x < d) { d = x; meilleur = m; }
      }
      if (meilleur !== t) change = true;
      return meilleur;
    });
    return change ? termes.join(' ') : null;
  }

  // --- Navigation ---

  aller(r: Resultat): void {
    this.memoriser(this.requete());
    this.ouvert.set(false);
    this.champ().nativeElement.blur();
    if (r.module) {
      // Indicateur d'un onglet : l'onglet est affiché, puis la carte mise en évidence une fois rendue.
      this.etat.ongletDemande.set(r.module);
      let essais = 0;
      const chercher = () => {
        const el = this.racine().querySelector<HTMLElement>(`[data-recherche-code="${CSS.escape(r.code)}"]`);
        if (el) this.mettreEnEvidence(el);
        else if (essais++ < 20) setTimeout(chercher, 50);
      };
      setTimeout(chercher, 30);
    } else if (r.el) {
      this.mettreEnEvidence(r.el);
    }
  }

  private mettreEnEvidence(el: HTMLElement): void {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
        { boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.85)', offset: 0.15 },
        { boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.85)', offset: 0.75 },
        { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
      ],
      { duration: 2600, delay: 350, easing: 'ease-out' },
    );
  }

  ouvrir(): void {
    this.ouvert.set(true);
    this.rechercher();
  }

  effacer(): void {
    this.saisir('');
    this.champ().nativeElement.focus();
  }

  perteFocus(e: FocusEvent): void {
    if (!this.hote.nativeElement.contains(e.relatedTarget as Node)) this.ouvert.set(false);
  }

  clavier(e: KeyboardEvent): void {
    const n = this.ordre().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.ouvert()) return this.ouvrir();
      if (!n) return;
      this.actif.set((this.actif() + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
      document.getElementById(`rtb-${this.actif()}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.ordre()[this.actif()];
      if (r) this.aller(r);
    } else if (e.key === 'Escape') {
      if (this.requete() && this.ouvert()) this.saisir('');
      else { this.ouvert.set(false); this.champ().nativeElement.blur(); }
    }
  }

  /** Ctrl+K (ou Cmd+K) et « / » placent le curseur dans la recherche, où que l'on soit sur la page. */
  @HostListener('document:keydown', ['$event'])
  raccourci(e: KeyboardEvent): void {
    const cible = e.target as HTMLElement | null;
    const saisie = !!cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable);
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !saisie)) {
      e.preventDefault();
      this.champ().nativeElement.focus();
      this.champ().nativeElement.select();
    }
  }

  // --- Recherches récentes ---

  private lireRecents(): string[] {
    try { return JSON.parse(localStorage.getItem(CLE_RECENTS) ?? '[]').slice(0, 6); } catch { return []; }
  }

  private memoriser(q: string): void {
    q = q.trim();
    if (!q) return;
    const liste = [q, ...this.recents().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    this.recents.set(liste);
    try { localStorage.setItem(CLE_RECENTS, JSON.stringify(liste)); } catch { /* stockage indisponible */ }
  }

  oublierRecents(): void {
    this.recents.set([]);
    try { localStorage.removeItem(CLE_RECENTS); } catch { /* stockage indisponible */ }
  }
}
