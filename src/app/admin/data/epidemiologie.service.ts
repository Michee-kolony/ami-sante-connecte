import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';

/**
 * Module ÉPIDÉMIOLOGIE (API /epidemiologie) : dix sous-fenêtres partageant un référentiel
 * géographique, un moteur de calcul et un cycle de validation communs. Les droits sont appliqués
 * par le serveur ; l'interface n'affiche que les actions permises (référentiel.droits).
 */

/**
 * Réponse JSON du serveur (structures riches, déjà contrôlées par l'API). Type souple pour que les
 * gabarits puissent lire les champs directement (option noPropertyAccessFromIndexSignature).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Donnee = any;

export type StatutDonnee = 'Brouillon' | 'Soumis' | 'À corriger' | 'Validé' | 'Rejeté' | 'Archivé';
export type TypeDonnee = 'population' | 'coefficient' | 'calcul' | 'plan' | 'indicateur' | 'evenement' | 'cas' | 'morbidite' | 'deces';

export interface Entite {
  id: string;
  code: string;
  codeOfficiel: string;
  niveau: string;
  nom: string;
  parentCode: string | null;
  profondeur: number;
  etablissementId: string | null;
  actif: boolean;
}

export interface Droits {
  validation: boolean;
  parametrage: boolean;
  consolidation: boolean;
  planification: boolean;
  saisie: boolean;
  separationSaisieValidation: boolean;
}

export interface ReferentielEpi {
  niveaux: string[];
  statuts: StatutDonnee[];
  natures: string[];
  tranchesAge: { code: string; libelle: string; min: number; max: number | null }[];
  sourcesDemographiques: string[];
  methodes: string[];
  cibles: Record<string, string>;
  programmes: string[];
  arrondi: string;
  interventions: { code: string; libelle: string; cible: string; programme: string }[];
  typesEvenement: string[];
  maladies: { code: string; libelle: string; categorie: string }[];
  categoriesMaladie: string[];
  priorites: string[];
  statutsEvenement: string[];
  resultatsLabo: string[];
  classificationsCas: string[];
  issuesCas: string[];
  sexes: string[];
  services: string[];
  classificationsMorbidite: string[];
  issuesMorbidite: string[];
  lieuxDeces: string[];
  ouiNonNd: string[];
  sourcesDeces: string[];
  causesDeces: string[];
  unitesFrequence: number[];
  unitesIndicateur: string[];
  periodicites: string[];
  desagregations: string[];
  domainesAlerte: string[];
  statutsAlerte: string[];
  indicateursAlerte: { code: string; libelle: string; parametre?: string; domaine: string }[];
  operateurs: string[];
  typesRapport: Record<string, string>;
  formats: string[];
  entiteParDefaut: string;
  droits: Droits;
}

/** Couleur du badge d'un statut commun (Partie I §3). */
export function couleurStatutDonnee(s: string): string {
  switch (s) {
    case 'Validé': case 'Active': case 'Résolue': case 'Clôturée': case 'Clôturé':
      return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
    case 'Soumis': case 'Attribuée': case 'En cours': case 'En investigation': case 'En suivi': case 'Vérifié':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
    case 'À corriger': case 'Nouvelle': case 'Nouveau': case 'Suspendue':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    case 'Rejeté': return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function couleurPrioriteEpi(p: string): string {
  switch (p) {
    case 'Critique': return 'bg-rose-600 text-white';
    case 'Élevée': return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    case 'Modérée': return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}

/** Pourcentage lisible (« Non calculable » si la valeur est absente : jamais 0 %). */
export function pct(v: number | null | undefined): string {
  return v == null ? 'Non calculable' : `${String(v).replace('.', ',')} %`;
}

function params(filtres: Record<string, unknown> = {}): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(filtres)) if (v !== '' && v != null && v !== false) p = p.set(k, String(v));
  return p;
}

@Injectable({ providedIn: 'root' })
export class EpidemiologieService {
  private http = inject(HttpClient);
  private url = `${API_URL}/epidemiologie`;

  /** État partagé des sous-fenêtres : référentiel, territoires et filtres communs (entité, année). */
  readonly referentiel = signal<ReferentielEpi | null>(null);
  readonly territoires = signal<Entite[]>([]);
  readonly entite = signal<string>('');
  readonly annee = signal<number>(new Date().getFullYear());
  readonly droits = computed(() => this.referentiel()?.droits ?? null);
  readonly entiteCourante = computed(() => this.territoires().find(e => e.code === this.entite()) ?? null);

  get<T = Donnee>(chemin: string, filtres?: Record<string, unknown>): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.url}${chemin}`, { params: params(filtres) }));
  }
  post<T = Donnee>(chemin: string, corps: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.url}${chemin}`, corps));
  }
  patch<T = Donnee>(chemin: string, corps: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${this.url}${chemin}`, corps));
  }
  put<T = Donnee>(chemin: string, corps: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.url}${chemin}`, corps));
  }

  /** Référentiel et territoires (une fois par session de page). */
  async charger(forcer = false): Promise<void> {
    if (this.referentiel() && !forcer) return;
    const [r, t] = await Promise.all([this.get<ReferentielEpi>('/referentiel'), this.get<Entite[]>('/territoires')]);
    this.referentiel.set(r);
    this.territoires.set(t);
    if (!this.entite()) this.entite.set(r.entiteParDefaut);
  }

  async rechargerTerritoires(): Promise<void> {
    this.territoires.set(await this.get<Entite[]>('/territoires'));
  }

  libelleMaladie(code: string): string {
    return this.referentiel()?.maladies.find(m => m.code === code)?.libelle ?? code;
  }

  nomEntite(code: string | null | undefined): string {
    if (!code) return '—';
    return this.territoires().find(e => e.code === code)?.nom ?? code;
  }

  // --- Cycle commun de validation -----------------------------------------------------------
  soumettre(type: TypeDonnee, id: string) { return this.post(`/donnees/${type}/${id}/soumettre`); }
  decider(type: TypeDonnee, id: string, decision: 'valider' | 'rejeter' | 'corriger', motif = '') { return this.post(`/donnees/${type}/${id}/decision`, { decision, motif }); }
  archiver(type: TypeDonnee, id: string, motif: string) { return this.post(`/donnees/${type}/${id}/archiver`, { motif }); }
  controle(type: TypeDonnee, id: string) { return this.get<{ bloquantes: string[]; avertissements: string[]; conforme: boolean }>(`/donnees/${type}/${id}/controle`); }
  historique(type: TypeDonnee, id: string) { return this.get(`/donnees/${type}/${id}/historique`); }

  /** Export d'un rapport (PDF, Excel, CSV) téléchargé par le navigateur. */
  async exporter(numero: string, format: 'pdf' | 'excel' | 'csv'): Promise<void> {
    const blob = await firstValueFrom(this.http.get(`${this.url}/rapports/${numero}/export`, { params: params({ format }), responseType: 'blob' }));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = `${numero}.${format === 'excel' ? 'xls' : format}`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
  }
}
