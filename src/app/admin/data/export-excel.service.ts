import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Feuille, ValeurCellule, classeurXlsx, nomFichierExcel, telecharger, telephoneExcel } from './excel';
import { SessionService } from './session.service';

/** Source complète d'un tableau paginé : toutes les lignes, pas seulement la page affichée. */
export type SourceExport = () => Promise<Feuille>;

/** Les tableaux ou zones marqués ainsi ne reçoivent pas de bouton d'export. */
export const SANS_EXPORT = 'data-sans-export';
const BARRE = 'data-export-excel';

/**
 * Export Excel « dynamique » de l'espace administrateur : chaque tableau affiché dans une page
 * reçoit automatiquement un bouton « Excel » (médecins seulement), et la page entière peut être
 * exportée depuis l'en-tête (un onglet par tableau). Les lignes exportées sont celles affichées
 * (filtres et tri compris) ; un tableau paginé peut fournir ses lignes complètes via
 * la directive `appExportComplet`.
 */
@Injectable({ providedIn: 'root' })
export class ExportExcelService {
  private session = inject(SessionService);
  private zone = inject(NgZone);
  private sources = new WeakMap<HTMLTableElement, SourceExport>();
  private barres = new Map<HTMLTableElement, HTMLElement>();
  private observateur: MutationObserver | null = null;
  private racine: HTMLElement | null = null;
  private planifie = false;

  /** Nombre de tableaux exportables dans la page courante (bouton de l'en-tête). */
  readonly nbTableaux = signal(0);
  readonly enCours = signal(false);

  /** Export réservé aux médecins (données de santé). */
  autorise(): boolean {
    return this.session.estMedecin();
  }

  // --- Sources complètes (tableaux paginés) ------------------------------------------------------

  enregistrerSource(table: HTMLTableElement, source: SourceExport): void {
    this.sources.set(table, source);
  }

  retirerSource(table: HTMLTableElement): void {
    this.sources.delete(table);
  }

  // --- Boutons automatiques -----------------------------------------------------------------------

  /** Surveille la zone de contenu : un bouton « Excel » est ajouté à chaque tableau qui apparaît. */
  surveiller(racine: HTMLElement): void {
    this.arreter();
    this.racine = racine;
    this.zone.runOutsideAngular(() => {
      this.observateur = new MutationObserver(() => this.planifier());
      this.observateur.observe(racine, { childList: true, subtree: true });
    });
    this.planifier();
  }

  arreter(): void {
    this.observateur?.disconnect();
    this.observateur = null;
    for (const barre of this.barres.values()) barre.remove();
    this.barres.clear();
  }

  private planifier(): void {
    if (this.planifie) return;
    this.planifie = true;
    requestAnimationFrame(() => {
      this.planifie = false;
      this.actualiser();
    });
  }

  private actualiser(): void {
    if (!this.racine) return;
    const autorise = this.autorise();
    const tables = autorise ? this.tableauxExportables() : [];
    // Barres orphelines (tableau retiré par Angular) ou export plus autorisé.
    for (const [table, barre] of this.barres) {
      if (!tables.includes(table)) {
        barre.remove();
        this.barres.delete(table);
      }
    }
    for (const table of tables) {
      const existante = this.barres.get(table);
      const ancre = this.ancre(table);
      if (existante?.isConnected && existante.nextElementSibling === ancre) continue;
      existante?.remove();
      const barre = this.creerBarre(table);
      ancre.parentElement?.insertBefore(barre, ancre);
      this.barres.set(table, barre);
    }
    if (this.nbTableaux() !== tables.length) this.zone.run(() => this.nbTableaux.set(tables.length));
  }

  private tableauxExportables(): HTMLTableElement[] {
    if (!this.racine) return [];
    return Array.from(this.racine.querySelectorAll('table')).filter((t) =>
      !t.closest(`[${SANS_EXPORT}]`) && (t.tHead || t.querySelector('th')) && this.lignesDonnees(t).length > 0);
  }

  /** Élément devant lequel placer le bouton : le conteneur défilant du tableau s'il existe. */
  private ancre(table: HTMLTableElement): HTMLElement {
    const parent = table.parentElement;
    if (parent && parent.children.length === 1 && /overflow-(x-)?auto/.test(parent.className)) return parent;
    return table;
  }

  private creerBarre(table: HTMLTableElement): HTMLElement {
    const barre = document.createElement('div');
    barre.setAttribute(BARRE, '');
    barre.className = 'flex justify-end px-3 pt-2';
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:text-emerald-300 dark:ring-emerald-500/30 dark:hover:bg-emerald-500/10';
    bouton.title = 'Exporter ce tableau au format Excel (.xlsx)';
    bouton.innerHTML = '<i class="fa-solid fa-file-excel"></i><span>Excel</span>';
    bouton.addEventListener('click', () => this.zone.run(() => this.exporterTableau(table)));
    barre.appendChild(bouton);
    return barre;
  }

  // --- Export ---------------------------------------------------------------------------------------

  /** Exporte un tableau (ses lignes complètes s'il a une source, sinon les lignes affichées). */
  async exporterTableau(table: HTMLTableElement): Promise<void> {
    await this.executer(async () => {
      const feuille = await this.feuilleDe(table, 0);
      telecharger(classeurXlsx([feuille, this.feuilleInformations([feuille])]), nomFichierExcel(`${this.titrePage()} ${feuille.nom}`));
    });
  }

  /** Exporte tous les tableaux de la page courante, un onglet par tableau. */
  async exporterPage(): Promise<void> {
    await this.executer(async () => {
      const tables = this.tableauxExportables();
      if (!tables.length) throw new Error('Aucun tableau à exporter sur cette page.');
      const feuilles: Feuille[] = [];
      for (const [i, t] of tables.entries()) feuilles.push(await this.feuilleDe(t, i));
      telecharger(classeurXlsx([...feuilles, this.feuilleInformations(feuilles)]), nomFichierExcel(this.titrePage()));
    });
  }

  /** Exporte des données déjà préparées par une page (exports métier sur mesure). */
  async exporterFeuilles(titre: string, feuilles: Feuille[]): Promise<void> {
    await this.executer(async () => telecharger(classeurXlsx([...feuilles, this.feuilleInformations(feuilles)]), nomFichierExcel(titre)));
  }

  private async executer(action: () => Promise<void>): Promise<void> {
    if (!this.autorise()) {
      alert('L’export Excel est réservé aux médecins.');
      return;
    }
    if (this.enCours()) return;
    this.enCours.set(true);
    try {
      await action();
    } catch (err) {
      alert(`Export impossible : ${err instanceof Error ? err.message : err}`);
    } finally {
      this.enCours.set(false);
    }
  }

  private async feuilleDe(table: HTMLTableElement, index: number): Promise<Feuille> {
    const source = this.sources.get(table);
    if (source) return source();
    return this.lireTableau(table, index);
  }

  /** Traçabilité : date, auteur, établissement et page de l'export. */
  private feuilleInformations(feuilles: Feuille[]): Feuille {
    const s = this.session.soignant();
    const e = this.session.etablissement();
    return {
      nom: 'Informations',
      colonnes: ['Rubrique', 'Valeur'],
      lignes: [
        ['Application', 'AMI Santé Connect'],
        ['Page', this.titrePage()],
        ['Exporté le', new Date()],
        ['Exporté par', s ? `${s.prenom} ${s.nom} (${s.role})` : ''],
        ['Établissement', e?.nom ?? ''],
        ...feuilles.map((f): ValeurCellule[] => [`Onglet « ${f.nom} »`, `${f.lignes.length} ligne(s)`]),
        ['Confidentialité', 'Données de santé : à conserver et transmettre selon les règles de confidentialité en vigueur.'],
      ],
    };
  }

  private titrePage(): string {
    return document.title.split('·')[0].trim() || 'Export';
  }

  // --- Lecture d'un tableau HTML -------------------------------------------------------------------

  /** Lignes de données : hors squelettes de chargement et messages « aucun résultat ». */
  private lignesDonnees(table: HTMLTableElement): HTMLTableRowElement[] {
    const corps = table.tBodies.length ? Array.from(table.tBodies).flatMap((b) => Array.from(b.rows)) : Array.from(table.rows).slice(1);
    const nbCol = this.entetes(table).length;
    return corps.filter((r) => {
      if (r.getAttribute('aria-hidden') === 'true' || r.closest(`[${SANS_EXPORT}]`)) return false;
      if (r.querySelector('.skeleton')) return false;
      const cellules = Array.from(r.cells);
      if (cellules.length === 1 && nbCol > 1 && cellules[0].colSpan >= nbCol - 1) return false; // message pleine largeur
      return cellules.some((c) => this.texte(c) !== '');
    });
  }

  private entetes(table: HTMLTableElement): string[] {
    const ligne = table.tHead?.rows[table.tHead.rows.length - 1] ?? Array.from(table.rows).find((r) => r.querySelector('th'));
    if (!ligne) return [];
    const noms: string[] = [];
    for (const c of Array.from(ligne.cells)) {
      noms.push(this.texte(c));
      for (let k = 1; k < c.colSpan; k++) noms.push('');
    }
    return noms;
  }

  private lireTableau(table: HTMLTableElement, index: number): Feuille {
    const entetes = this.entetes(table);
    const lignes = this.lignesDonnees(table).map((r) => {
      const valeurs: string[] = [];
      for (const c of Array.from(r.cells)) {
        valeurs.push(this.texte(c));
        for (let k = 1; k < c.colSpan; k++) valeurs.push('');
      }
      return valeurs;
    });
    // Colonnes sans intérêt : en-tête vide ou « Actions » et contenu vide (boutons retirés).
    const garder = entetes.map((h, i) => {
      if (/^actions?$/i.test(h)) return false;
      return h !== '' || lignes.some((l) => (l[i] ?? '') !== '');
    });
    const nbCol = Math.max(entetes.length, ...lignes.map((l) => l.length));
    const indices = Array.from({ length: nbCol }, (_, i) => i).filter((i) => garder[i] ?? true);
    // Colonnes de téléphone : toujours du texte (« 0812… » ou « +243… » ne doivent pas devenir des nombres).
    const telephone = (i: number) => /t[ée]l[ée]phone|\bt[ée]l\b|portable|mobile|whatsapp/i.test(entetes[i] ?? '');
    return {
      nom: this.titreTableau(table) || `Tableau ${index + 1}`,
      colonnes: indices.map((i) => entetes[i] || `Colonne ${i + 1}`),
      lignes: lignes.map((l) => indices.map((i) => (telephone(i) ? telephoneExcel(l[i]) || null : convertir(l[i] ?? '')))),
    };
  }

  /** Titre du tableau : légende, sinon titre le plus proche dans sa carte ou sa section. */
  private titreTableau(table: HTMLTableElement): string {
    const legende = table.caption?.textContent?.trim();
    if (legende) return legende;
    let n: HTMLElement | null = table;
    for (let niveau = 0; n && n !== this.racine && niveau < 6; niveau++, n = n.parentElement) {
      const titre = n.querySelector?.(':scope > h1, :scope > h2, :scope > h3, :scope > header h2, :scope > header h3, :scope > div > h2, :scope > div > h3');
      if (titre && !titre.contains(table)) return titre.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }
    return '';
  }

  /** Texte lisible d'une cellule : sans boutons ni icônes, blocs séparés par « · ». */
  private texte(cellule: HTMLElement): string {
    const copie = cellule.cloneNode(true) as HTMLElement;
    // En-tête : le libellé peut être dans un bouton de tri, on le garde.
    const aRetirer = cellule.tagName === 'TH' ? 'svg, img, i, script, style' : 'button, svg, img, i, script, style, .sr-only';
    copie.querySelectorAll(`${aRetirer}, [${SANS_EXPORT}], [${BARRE}]`).forEach((x) => x.remove());
    // Champs de saisie : leur valeur.
    const originaux = cellule.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    copie.querySelectorAll('input, select, textarea').forEach((x, i) => {
      const o = originaux[i];
      let v = '';
      if (o instanceof HTMLInputElement && (o.type === 'checkbox' || o.type === 'radio')) v = o.checked ? 'Oui' : 'Non';
      else if (o instanceof HTMLSelectElement) v = o.selectedOptions[0]?.textContent?.trim() ?? '';
      else if (o) v = o.value;
      x.replaceWith(document.createTextNode(v));
    });
    copie.querySelectorAll('p, div, li, br, tr').forEach((b) => b.before(document.createTextNode(' · ')));
    return (copie.textContent ?? '')
      .replace(/\s+/g, ' ')
      .replace(/(\s*·\s*)+/g, ' · ')
      .replace(/^\s*·\s*|\s*·\s*$/g, '')
      .replace(/^[—–-]$/, '')
      .trim();
  }
}

/**
 * Texte affiché → valeur Excel : nombres (« 1 234 », « 12,5 ») et dates (« 13/11/2026 »,
 * « 2026-11-13 ») convertis ; identifiants à zéro initial et téléphones gardés en texte.
 */
function convertir(t: string): ValeurCellule {
  if (t === '') return null;
  const compact = t.replace(/[   ]/g, '');
  // Long nombre sans séparateur (≥ 9 chiffres) : numéro de téléphone ou identifiant, gardé en texte.
  if (/^-?\d+([.,]\d+)?$/.test(compact) && compact.replace(/\D/g, '').length < 9 && !/^-?0\d/.test(compact)) {
    return Number(compact.replace(',', '.'));
  }
  let m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(?:à\s+)?(\d{1,2})[:h](\d{2}))?$/.exec(t);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
    if (d.getDate() === +m[1]) return d;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getDate() === +m[3]) return d;
  }
  return t;
}
