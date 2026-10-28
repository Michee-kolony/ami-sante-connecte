import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';

/** Relance communautaire du RECO (API /relance) : tâches, supervision, comptes RECO, paramétrage. */

export type StatutTache =
  | 'Nouvelle' | 'Attribuée' | 'En cours' | 'Contact établi' | 'Visite planifiée' | 'Orientée'
  | 'Réintégration confirmée' | 'Non retrouvée' | 'Refus / report' | 'Doublon annulé'
  | 'Clôturée sans réintégration' | 'Escaladée';
export type Domaine = 'CPN' | 'Accouchement' | 'Postnatal' | 'Vaccination' | 'Suivi communautaire';
export type Priorite = 'Normale' | 'Prioritaire' | 'Urgente';

export interface Auteur { id: string; nom: string; role: string; matricule?: string }

export interface TacheResume {
  numero: string;
  statut: StatutTache;
  priorite: Priorite;
  domaine: Domaine;
  parcoursCode: string | null;
  source: string;
  motif: string;
  motifsLies: number;
  personne: {
    type: 'Patiente' | 'Enfant' | 'Déclarée';
    patienteId?: string | null;
    numero?: string;
    nom: string;
    enfant?: { id: string; numero: string; prenom: string; dateNaissance: string } | null;
    quartier: string;
    telephone?: string;
    commune?: string;
    avenue?: string;
    repere?: string;
  };
  etablissementId: string | null;
  structure: string;
  aireSante: string;
  zone: string;
  reco: { id: string; matricule: string; nom: string; statut: string; photo: string | null } | null;
  echeance: string;
  enRetard: boolean;
  dateEvenement: string | null;
  tentativesEchouees: number;
  conflitsEnAttente: number;
  orientation: { le: string; structure: string; priorite: Priorite } | null;
  creeLe: string;
  statutLe: string;
}

export interface ActionReco {
  operationId: string;
  type: string;
  canal: string | null;
  resultat: string | null;
  motif: string | null;
  commentaire: string;
  date: string | null;
  structure: string | null;
  priorite: Priorite | null;
  le: string;
  recuLe: string;
  par: Auteur;
  horsLigne: boolean;
  conflit: boolean;
}

export interface EvenementTache {
  action: string;
  ancienStatut: string | null;
  nouveauStatut: string | null;
  motif: string;
  details?: Record<string, unknown>;
  par: Auteur;
  le: string;
}

export interface TacheDetail extends TacheResume {
  parcoursVersion: number | null;
  motifs: { cle: string; regleCode: string | null; regleVersion: number | null; libelle: string; objet: { type: string | null; id: string | null; libelle: string }; dateEvenement: string | null; ajouteLe: string }[];
  parametres: { tentativesMax: number; alerteAvantEcheanceJours: number; priseEnChargeHeures: number; confirmationOrientationJours: number };
  actions: ActionReco[];
  visites: { prevueLe: string; planifieeLe: string; realiseeLe: string | null; resultat: string | null }[];
  contactEtabliLe: string | null;
  orientation: { le: string; etablissementId: string | null; structure: string; priorite: Priorite; dateConseillee: string | null; par: Auteur } | null;
  confirmation: { le: string; source: string; type: string; reference: string; avantContact: boolean; par: Auteur } | null;
  resolution: { statut: string; resultat: string; motif: string; exceptionnelle: boolean; le: string; par: Auteur } | null;
  doublonDe: string | null;
  escalade: { le: string; motif: string; vers: string; par: Auteur } | null;
  controles: { le: string; conforme: boolean; observation: string; par: Auteur }[];
  conflits: { id: string; operationId: string; motif: string; le: string; resolu: boolean; decision: string; resoluPar?: Auteur; resoluLe: string | null }[];
  historique: EvenementTache[];
  reattributions: number;
  attribueeLe: string | null;
}

export interface Reco {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  postnom: string;
  sexe: 'F' | 'M';
  telephone: string;
  /** Photo de profil (URL publique), null pour un compte créé sans photo. */
  photo: string | null;
  etablissementId: string;
  aireSante: string;
  zones: string[];
  superviseurId: string | null;
  statut: 'Actif' | 'Suspendu';
  doitChangerMotDePasse: boolean;
  derniereConnexion: string | null;
  derniereSynchronisation: string | null;
  ouvertes: number;
  enRetard: number;
}

export interface AlerteRelance {
  id: string;
  type: string;
  libelle: string;
  destinataire: 'supervision' | 'structure' | 'reco';
  etablissementId: string | null;
  taches: string[];
  occurrences: number;
  premiereLe: string;
  derniereLe: string;
  ouverte: boolean;
  accuseLe: string | null;
  accusePar?: Auteur;
}

export interface Indicateur {
  code: string;
  libelle: string;
  unite: string;
  numerateur: number;
  denominateur: number | null;
  valeur: number | null;
  formule: string;
}

export interface Performance {
  effectifs: { taches: number; personnes: number; ouvertes: number; enRetard: number; reintegrees: number; reintegreesAvantContact: number; orientees: number };
  indicateurs: Indicateur[];
}

export interface GroupeDesagrege { groupe: string; personnes: number | null; reintegrees: number | null; taux: number | null; masque: boolean }

export interface TableauDeBordRelance {
  periode: { du: string; au: string };
  genereLe: string;
  charge: {
    parStatut: Record<StatutTache, number>;
    ouvertes: number;
    enRetard: number;
    nonAttribuees: number;
    parReco: { id: string; matricule: string; nom: string; statut: string; ouvertes: number; enRetard: number }[];
    parAire: { aire: string; ouvertes: number; enRetard: number }[];
  };
  performance: Performance;
  parParcours: (Performance & { code: string | null; libelle: string; statut?: string; version?: number })[];
  continuum: { domaine: Domaine; taches: number; personnes: number; ouvertes: number; reintegrees: number; taux: number | null }[];
  qualite: {
    doublonsAnnules: number;
    sansMotifCloture: number;
    sansRecoDepuisPlusDe2Jours: number;
    sansAireSante: number;
    incoherents: { libelle: string; nombre: number }[];
    conflitsEnAttente: number;
  };
  equite: { seuil: number; parAge: GroupeDesagrege[]; parAire: GroupeDesagrege[] };
  tracabilite: {
    reattributions: number;
    cloturesExceptionnelles: number;
    actionsHorsLigne: number;
    actionsEnConflit: number;
    synchronisations: { matricule: string; nom: string; statut: string; derniereSynchronisation: string | null }[];
  };
}

export interface ReferentielRelance {
  statuts: StatutTache[];
  statutsFinaux: StatutTache[];
  statutsSupervision: StatutTache[];
  domaines: Domaine[];
  priorites: Priorite[];
  resultatsCloture: string[];
  codesParcours: string[];
  alertes: Record<string, string>;
  droits: { supervision: boolean; parametrage: boolean; responsable: boolean };
}

export interface ParametresRegle {
  toleranceJours: number;
  fenetreJours: number;
  delaiTraitementJours: number;
  priorite: Priorite;
  tentativesMax: number;
  alerteAvantEcheanceJours: number;
  priseEnChargeHeures: number;
  confirmationOrientationJours: number;
}

export interface ParcoursRelance {
  id: string;
  code: string;
  libelle: string;
  definition: string;
  criteresEntree: string;
  actionsAutorisees: string[];
  delaiJours: number | null;
  criteresSortie: string;
  formuleIndicateur: string;
  version: number;
  dateEffet: string | null;
  responsableValidation: string;
  referenceValidation: string;
  statut: 'À valider' | 'Validé' | 'Suspendu';
  modifiePar: Auteur;
  modifieLe: string;
  historique: (Omit<ParcoursRelance, 'id' | 'code' | 'historique'>)[];
}

export interface RegleRelance {
  id: string;
  code: string;
  domaine: Domaine;
  libelle: string;
  description: string;
  parcoursCode: string | null;
  parametres: ParametresRegle;
  version: number;
  dateEffet: string | null;
  statut: 'Inactive' | 'Active' | 'Suspendue';
  responsableValidation: string;
  referenceProtocole: string;
  modifiePar: Auteur;
  modifieLe: string;
  historique: (Omit<RegleRelance, 'id' | 'code' | 'domaine' | 'historique'>)[];
}

export interface Parametrage {
  parcours: ParcoursRelance[];
  regles: RegleRelance[];
  referentiel: { domaines: Domaine[]; priorites: Priorite[]; bornes: Record<string, [number, number]>; actionsReco: string[]; statutsParcours: string[] };
  modifiable: boolean;
}

export interface FiltresTaches {
  statut?: string;
  domaine?: string;
  priorite?: string;
  parcours?: string;
  reco?: string;
  retard?: boolean;
  conflits?: boolean;
  recherche?: string;
}

/** Libellés des paramètres d'une règle (écran de paramétrage). */
export const LIBELLES_PARAMETRES: Record<keyof Omit<ParametresRegle, 'priorite'>, string> = {
  toleranceJours: 'Délai de tolérance (jours)',
  fenetreJours: 'Ancienneté maximale de l’événement (jours)',
  delaiTraitementJours: 'Échéance de la tâche (jours)',
  tentativesMax: 'Tentatives avant « non retrouvée »',
  alerteAvantEcheanceJours: 'Rappel au RECO avant l’échéance (jours)',
  priseEnChargeHeures: 'Prise en charge d’une tâche urgente (heures)',
  confirmationOrientationJours: 'Confirmation d’une orientation (jours)',
};

/** Couleur du badge de statut. */
export function couleurStatut(s: StatutTache): string {
  switch (s) {
    case 'Réintégration confirmée': return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
    case 'Orientée': case 'Contact établi': return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
    case 'Non retrouvée': case 'Escaladée': return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    case 'Refus / report': return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    case 'Doublon annulé': case 'Clôturée sans réintégration': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    default: return 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300';
  }
}

export function couleurPriorite(p: Priorite): string {
  return p === 'Urgente' ? 'bg-rose-600 text-white' : p === 'Prioritaire' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

/** Données JSON dans « donnees », photo de profil dans « photo ». */
function formulaire(donnees: object, photo?: File | null): FormData {
  const f = new FormData();
  f.append('donnees', JSON.stringify(donnees));
  if (photo) f.append('photo', photo);
  return f;
}

@Injectable({ providedIn: 'root' })
export class RelanceService {
  private http = inject(HttpClient);
  private url = `${API_URL}/relance`;

  private get<T>(chemin: string, params?: HttpParams): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.url}${chemin}`, { params }));
  }

  private post<T>(chemin: string, corps: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.url}${chemin}`, corps));
  }

  referentiel(): Promise<ReferentielRelance> {
    return this.get('/referentiel');
  }

  tableauDeBord(filtres: { du?: string; au?: string; parcours?: string; domaine?: string }): Promise<TableauDeBordRelance> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(filtres)) if (v) p = p.set(k, v);
    return this.get('/tableau-de-bord', p);
  }

  lancerDetection(): Promise<{ confirmees: number; creees: number; reliees: number; regles: number }> {
    return this.post('/detection');
  }

  taches(f: FiltresTaches): Promise<{ total: number; taches: TacheResume[]; nominatif: boolean }> {
    let p = new HttpParams().set('limite', '300');
    for (const [k, v] of Object.entries(f)) {
      if (v === true) p = p.set(k, '1');
      else if (v) p = p.set(k, String(v));
    }
    return this.get('/taches', p);
  }

  tache(numero: string): Promise<TacheDetail> {
    return this.get(`/taches/${numero}`);
  }

  attribuer(numero: string, recoId: string, motif: string, echeance?: string): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/attribuer`, { recoId, motif, echeance: echeance || undefined });
  }

  confirmer(numero: string, type: string, reference: string): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/confirmer`, { type, reference });
  }

  cloturer(numero: string, d: { statut: string; resultat?: string; motif: string; doublonDe?: string }): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/cloturer`, d);
  }

  rouvrir(numero: string, motif: string): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/rouvrir`, { motif });
  }

  escalader(numero: string, motif: string, vers: string): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/escalader`, { motif, vers });
  }

  controler(numero: string, conforme: boolean, observation: string): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/controler`, { conforme, observation });
  }

  identifier(numero: string, d: { patienteId?: string; enfantId?: string }): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/identifier`, d);
  }

  resoudreConflit(numero: string, conflitId: string, decision: string): Promise<TacheDetail> {
    return this.post(`/taches/${numero}/conflits/${conflitId}/resoudre`, { decision });
  }

  alertes(ouvertes = false): Promise<AlerteRelance[]> {
    return this.get('/alertes', ouvertes ? new HttpParams().set('ouvertes', '1') : undefined);
  }

  accuserAlerte(id: string): Promise<AlerteRelance> {
    return this.post(`/alertes/${id}/accuser`);
  }

  // --- Comptes RECO ---

  recos(): Promise<Reco[]> {
    return this.get('/recos');
  }

  prochainMatricule(): Promise<string> {
    return this.get<{ matricule: string }>('/recos/prochain-matricule').then(r => r.matricule);
  }

  /** Création du compte : la photo de profil est obligatoire (formulaire multipart). */
  creerReco(d: Partial<Reco> & { motDePasse?: string }, photo: File): Promise<{ reco: Reco; motDePasse: string | null }> {
    return this.post('/recos', formulaire(d, photo));
  }

  /** Modification ; la photo n'est envoyée que si elle est remplacée. */
  modifierReco(id: string, d: Partial<Reco>, photo?: File | null): Promise<Reco> {
    return firstValueFrom(this.http.patch<Reco>(`${this.url}/recos/${id}`, formulaire(d, photo)));
  }

  changerStatutReco(id: string, statut: 'Actif' | 'Suspendu'): Promise<Reco> {
    return firstValueFrom(this.http.patch<Reco>(`${this.url}/recos/${id}/statut`, { statut }));
  }

  reinitialiserMotDePasse(id: string): Promise<{ matricule: string; motDePasse: string }> {
    return this.post(`/recos/${id}/mot-de-passe`);
  }

  revoquerSessions(id: string): Promise<{ revoqueesLe: string }> {
    return this.post(`/recos/${id}/revoquer-sessions`);
  }

  // --- Paramétrage ---

  parametrage(): Promise<Parametrage> {
    return this.get('/parametrage');
  }

  modifierParcours(code: string, d: Partial<ParcoursRelance>): Promise<ParcoursRelance> {
    return firstValueFrom(this.http.put<ParcoursRelance>(`${this.url}/parametrage/parcours/${code}`, d));
  }

  validerParcours(code: string, d: { responsableValidation: string; referenceValidation: string; dateEffet: string }): Promise<ParcoursRelance> {
    return this.post(`/parametrage/parcours/${code}/valider`, d);
  }

  suspendreParcours(code: string): Promise<ParcoursRelance> {
    return this.post(`/parametrage/parcours/${code}/suspendre`);
  }

  modifierRegle(code: string, d: { libelle?: string; description?: string; parcoursCode?: string | null; parametres?: Partial<ParametresRegle> }): Promise<RegleRelance> {
    return firstValueFrom(this.http.put<RegleRelance>(`${this.url}/parametrage/regles/${code}`, d));
  }

  activerRegle(code: string, d: { responsableValidation: string; referenceProtocole: string; dateEffet: string }): Promise<RegleRelance> {
    return this.post(`/parametrage/regles/${code}/activer`, d);
  }

  suspendreRegle(code: string): Promise<RegleRelance> {
    return this.post(`/parametrage/regles/${code}/suspendre`);
  }
}
