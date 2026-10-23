import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import type { ResumeEnfant } from './enfants.service';

// --- Types renvoyés par backend-ami-connecte (suivi prénatal) ---------------------------

/** Professionnel figé au moment de l'acte. */
export interface Auteur {
  id: string;
  nom: string;
  role: string;
  matricule: string;
}

export type StatutPatiente = 'Suivi prénatal' | 'Grossesse terminée' | 'Suivi postnatal' | 'Archivé';
export type MethodeDatation = 'DDR' | 'Échographie' | 'Examen clinique';
export type Fiabilite = 'Fiable' | 'Incertaine' | 'Inconnue';
export type TypeConsultation =
  | 'Première consultation prénatale' | 'Suivi prénatal' | 'Consultation non programmée' | 'Accouchement' | 'Postnatal';
export type StatutConsultation = 'Brouillon' | 'Finalisée' | 'Annulée';
export type StatutRdv = 'Planifié' | 'Confirmé' | 'Reporté' | 'Effectué' | 'Annulé' | 'Absent';
export type CanalRappel = 'SMS' | 'Appel' | 'WhatsApp' | 'Aucun';

export const TYPES_CONSULTATION: TypeConsultation[] = [
  'Première consultation prénatale', 'Suivi prénatal', 'Consultation non programmée', 'Accouchement', 'Postnatal',
];
export const ISSUES = ['Naissance vivante', 'Mort-né', 'Fausse couche', 'Interruption de grossesse', 'Grossesse extra-utérine', 'Autre'];
export const MODES_ACCOUCHEMENT = ['Voie basse', 'Voie basse instrumentale', 'Césarienne', 'Non applicable'];
/** Facteurs proposés à la saisie : relevés par le médecin, jamais déduits automatiquement. */
export const FACTEURS_RISQUE = [
  'Antécédent de césarienne', 'Hypertension artérielle', 'Diabète', 'Grossesse multiple', 'Âge < 18 ans', 'Âge > 35 ans',
  'Antécédent de fausse couche', 'Antécédent de mort-né', 'Anémie', 'Paludisme pendant la grossesse', 'Infection à surveiller',
];

export interface ResumePatiente {
  id: string;
  /** Lien signé temporaire (15 min) vers la photo, null sans photo. */
  photoUrl: string | null;
  numero: string;
  nom: string;
  postnom: string;
  prenom: string;
  age: number | null;
  dateNaissance: string | null;
  telephoneMasque: string;
  province: string;
  commune: string;
  quartier: string;
  statut: StatutPatiente;
  creeLe: string;
  grossesse: { id: string; statut: string; agJours: number | null; dpa: string | null; aRisque: boolean } | null;
  prochainRdv: { id: string; date: string; motif: string } | null;
}

export interface PageRecherche {
  total: number;
  page: number;
  parPage: number;
  resultats: ResumePatiente[];
}

export interface Doublon {
  id: string;
  numero: string;
  nom: string;
  postnom: string;
  prenom: string;
  age: number | null;
  telephoneMasque: string;
  commune: string;
}

export interface Consentements {
  sms: boolean | null;
  appel: boolean | null;
  whatsapp: boolean | null;
  version?: string;
  recueilliLe?: string | null;
  recueilliPar?: Auteur;
}

export interface Antecedents {
  gestite: number | null;
  parite: number | null;
  enfantsVivants: number | null;
  avortements: number | null;
  cesariennes: number | null;
  complicationsObstetricales: string;
  medicaux: string;
  chirurgicaux: string;
  allergies: string;
  medicaments: string;
  atcdMedicaux: string[];
  atcdGynecoChirurgicaux: string[];
  atcdObstetricaux: string[];
  plusGrosPoidsNaissanceG: number | null;
  dernierAccouchement: string | null;
  /** « Test connu » (VIH) : date du test, de moins de 3 mois. */
  testVihConnuLe?: string | null;
}

/** Champs de la fiche CPN propres à la patiente (identité complémentaire, biologie, antécédents cochés). */
export interface ProfilCpn {
  etatCivil: string;
  occupation: string;
  nomPartenaire: string;
  occupationPartenaire: string;
  groupeSanguin: string;
  rhesus: string;
  tailleCm: number | null;
  electrophoreseHb: string;
  atcdMedicaux: string[];
  atcdGynecoChirurgicaux: string[];
  atcdObstetricaux: string[];
  plusGrosPoidsNaissanceG: number | null;
  dernierAccouchement: string;
  testVihConnuLe: string;
}

export function profilCpnVide(): ProfilCpn {
  return {
    etatCivil: '', occupation: '', nomPartenaire: '', occupationPartenaire: '', groupeSanguin: '', rhesus: '', tailleCm: null, electrophoreseHb: '',
    atcdMedicaux: [], atcdGynecoChirurgicaux: [], atcdObstetricaux: [], plusGrosPoidsNaissanceG: null, dernierAccouchement: '', testVihConnuLe: '',
  };
}

export function profilCpnDe(p: Patiente): ProfilCpn {
  const a = p.antecedents;
  return {
    etatCivil: p.etatCivil ?? '', occupation: p.occupation ?? '', nomPartenaire: p.nomPartenaire ?? '', occupationPartenaire: p.occupationPartenaire ?? '',
    groupeSanguin: p.groupeSanguin ?? '', rhesus: p.rhesus ?? '', tailleCm: p.tailleCm ?? null, electrophoreseHb: p.electrophoreseHb ?? '',
    atcdMedicaux: [...(a?.atcdMedicaux ?? [])], atcdGynecoChirurgicaux: [...(a?.atcdGynecoChirurgicaux ?? [])],
    atcdObstetricaux: [...(a?.atcdObstetricaux ?? [])], plusGrosPoidsNaissanceG: a?.plusGrosPoidsNaissanceG ?? null,
    dernierAccouchement: a?.dernierAccouchement ?? '', testVihConnuLe: a?.testVihConnuLe ?? '',
  };
}

/** Répartit la fiche entre les champs de la patiente et ceux de ses antécédents (format de l'API). */
export function profilCpnVersApi(f: ProfilCpn): { patiente: Partial<Patiente>; antecedents: Partial<Antecedents> } {
  return {
    patiente: {
      etatCivil: f.etatCivil, occupation: f.occupation, nomPartenaire: f.nomPartenaire, occupationPartenaire: f.occupationPartenaire, groupeSanguin: f.groupeSanguin,
      rhesus: f.rhesus, tailleCm: f.tailleCm, electrophoreseHb: f.electrophoreseHb,
    },
    antecedents: {
      atcdMedicaux: f.atcdMedicaux, atcdGynecoChirurgicaux: f.atcdGynecoChirurgicaux, atcdObstetricaux: f.atcdObstetricaux,
      plusGrosPoidsNaissanceG: f.plusGrosPoidsNaissanceG, dernierAccouchement: f.dernierAccouchement || null,
      testVihConnuLe: f.testVihConnuLe || null,
    },
  };
}

export interface Adresse {
  province: string;
  commune: string;
  quartier: string;
  avenue: string;
  repere: string;
  aireSante: string;
}

export interface Patiente {
  id: string;
  numero: string;
  /** Lien signé temporaire (15 min) vers la photo d'identification. */
  photoUrl: string | null;
  nom: string;
  postnom: string;
  prenom: string;
  dateNaissance: string | null;
  ageDeclare: number | null;
  age: number | null;
  pieceIdentite: string;
  etatCivil: string;
  occupation: string;
  nomPartenaire: string;
  occupationPartenaire?: string;
  groupeSanguin: string;
  rhesus: string;
  tailleCm: number | null;
  electrophoreseHb: string;
  telephone: string;
  telephonePartage: boolean;
  telephone2: string;
  email?: string;
  contactUrgence: { nom: string; lien: string; telephone: string; adresse?: string };
  consentements: Consentements;
  adresse: Adresse;
  antecedents: Antecedents;
  statut: StatutPatiente;
  espaceEnLigne: string;
  creePar: Auteur;
  modifiePar?: Auteur;
  createdAt: string;
  updatedAt: string;
}

export interface Datation {
  methode: MethodeDatation;
  ddr: string | null;
  ddrFiabilite: Fiabilite | null;
  dateReference: string;
  agReferenceJours: number;
  dpaCalculee: string;
  dpa: string;
  justification: string;
  valideePar: Auteur;
  valideeLe: string;
}

export interface IssueGrossesse {
  date: string;
  lieu: string;
  issue: string;
  mode: string;
  complications: string;
  resume: string;
  orientation: string;
  enregistreePar: Auteur;
  enregistreeLe: string;
}

export interface Grossesse {
  id: string;
  patienteId: string;
  numero: number;
  statut: 'En cours' | 'Terminée';
  grossesseMultiple: boolean | null;
  facteursRisque: string[];
  datation?: Datation;
  historiqueDatation: Datation[];
  issue?: IssueGrossesse;
  creePar: Auteur;
  createdAt: string;
  agJours: number | null;
  /** Mesures préventives réalisées (consultations finalisées) : dernière réponse « oui » par code. */
  mesuresPreventives: Record<string, { date: string; valeur: string; consultationId: string }>;
}

export interface Constantes {
  poidsKg: number | null;
  taSystolique: number | null;
  taDiastolique: number | null;
  temperature: number | null;
  pouls: number | null;
  hauteurUterineCm: number | null;
  bcf: number | null;
  saO2: number | null;
  frequenceRespiratoire: number | null;
}

/** Signes oui/non (null = non évalué) et éléments du fœtus relevés à la visite CPN. */
export interface ExamenCpn {
  signes: Record<string, boolean | null>;
  etatGeneral: string;
  perimetreBrachialCm: number | null;
  mouvementsFoetaux: string;
  presentation: string;
}

export interface ReponseMesure {
  reponse: boolean | null;
  valeur: string;
}

export interface ReferenceFemme {
  motifs: string[];
  precision: string;
  /** Horodatage serveur de la référence (null sans motif). */
  le: string | null;
}

export interface Traitement {
  produit: string;
  dose: string;
  voie: string;
  frequence: string;
  duree: string;
  indication: string;
}

export interface Addendum {
  id: string;
  texte: string;
  motif: string;
  auteur: Auteur;
  le: string;
}

export interface ConsultationResume {
  id: string;
  grossesseId: string;
  type: TypeConsultation;
  date: string;
  auteur: Auteur;
  statut: StatutConsultation;
  agJours: number | null;
  motif: string;
  finaliseeLe: string | null;
  addenda: number;
  constantes: Constantes;
  createdAt: string;
  reference: { le: string; motifs: string[] } | null;
}

export interface Consultation extends Omit<ConsultationResume, 'addenda' | 'reference'> {
  examenCpn: ExamenCpn;
  mesuresPreventives: Record<string, ReponseMesure>;
  laboratoire: Record<string, string>;
  echographie: string;
  reference: ReferenceFemme;
  patienteId: string;
  etablissementId: string | null;
  symptomes: string;
  examenClinique: string;
  evaluation: string;
  facteursRisque: string[];
  decisions: string;
  examensDemandes: string[];
  resultatsRevus: string;
  traitements: Traitement[];
  conseils: string;
  orientation: string;
  prochainRdv: { date: string | null; motif: string; consignes: string };
  prochainRdvId: string | null;
  rendezVousId: string | null;
  annulation?: { motif: string; par: Auteur; le: string };
  addenda: Addendum[];
  updatedAt: string;
}

export interface EvenementRdv {
  action: string;
  ancienneDate: string | null;
  nouvelleDate: string | null;
  ancienStatut: string | null;
  nouveauStatut: string | null;
  motif: string;
  par: Auteur;
  le: string;
}

export interface RendezVous {
  id: string;
  patienteId: string;
  grossesseId: string | null;
  /** Rendez-vous d'un enfant de la patiente (vaccination, suivi). */
  enfantId?: string | null;
  consultationId: string | null;
  date: string;
  motif: string;
  lieu: string;
  consignes: string;
  canalRappel: CanalRappel;
  statut: StatutRdv;
  creePar: Auteur;
  modifiePar?: Auteur;
  historique: EvenementRdv[];
}

export interface RendezVousAgenda extends RendezVous {
  patiente: { id: string; numero: string; nom: string; postnom: string; prenom: string } | null;
  enfant?: { id: string; numero: string; nom: string; prenom: string } | null;
}

// --- Échographie obstétricale ------------------------------------------------------------
export const SEXES_FOETUS = ['Féminin', 'Masculin', 'Indéterminé'] as const;
export const PRESENTATIONS_FOETUS = ['Céphalique', 'Siège', 'Transverse', 'Oblique'] as const;
export const QUANTITES_LIQUIDE = ['Normale', 'Oligoamnios', 'Hydramnios'] as const;
export const MATURITES_PLACENTA = ['Grade 0', 'Grade I', 'Grade II', 'Grade III'] as const;
export const FOETUS_MAX = 4;

/** Un fœtus : activité cardiaque, BCF, sexe, présentation, position et biométrie (mm, poids en g). */
export interface FoetusEcho {
  activiteCardiaque: boolean | null;
  /** Bruits du cœur fœtal, en battements par minute. */
  bcf: number | null;
  sexe: string;
  presentation: string;
  position: string;
  bipMm: number | null;
  perimetreCranienMm: number | null;
  perimetreAbdominalMm: number | null;
  longueurFemoraleMm: number | null;
  poidsEstimeG: number | null;
}

export function foetusVide(): FoetusEcho {
  return {
    activiteCardiaque: null, bcf: null, sexe: '', presentation: '', position: '',
    bipMm: null, perimetreCranienMm: null, perimetreAbdominalMm: null, longueurFemoraleMm: null, poidsEstimeG: null,
  };
}

/** Saisie d'une échographie (rubriques de la fiche du médecin). */
export interface SaisieEchographie {
  date: string;
  motif: string;
  agSemaines: number | null;
  agJours: number | null;
  nombreFoetus: number;
  foetus: FoetusEcho[];
  placenta: { localisation: string; aspect: string; maturite: string };
  liquideAmniotique: { quantite: string; indiceCm: number | null };
  col: { longueurMm: number | null; aspect: string };
  anomalies: string;
  conclusion: string;
  praticien: string;
}

/** Échographie enregistrée : compte rendu et images servis par liens signés (15 min). */
export interface Echographie extends SaisieEchographie {
  id: string;
  grossesseId: string;
  auteur: Auteur;
  fichiers: { type: string; nom: string; url: string | null }[];
  createdAt: string;
}

export interface Dossier {
  patiente: Patiente;
  grossesses: Grossesse[];
  consultations: ConsultationResume[];
  rendezVous: RendezVous[];
  echographies: Echographie[];
  premiereConsultation: { consultationId: string; medecin: Auteur; date: string; etablissementId: string | null } | null;
  /** Établissement de prise en charge (null s'il a été suspendu ou supprimé). */
  etablissement: { id: string; code: string; nom: string; province: string } | null;
  /** Dossiers d'accouchement (salle de travail → sortie). */
  accouchements: { id: string; numero: string; grossesseId: string; statut: string; admiseLe: string; accoucheeLe: string | null; mode: string | null }[];
  /** Enfants rattachés au compte de la patiente, avec leur prochaine vaccination. */
  enfants: ResumeEnfant[];
}

export interface EntreeJournal {
  id: string;
  acteur?: Auteur;
  action: string;
  libelle: string;
  resultat: 'autorisé' | 'refusé';
  patienteId: string | null;
  patienteNumero?: string | null;
  ressource?: { type: string | null; id: string | null };
  details?: Record<string, unknown>;
  le: string;
}

/**
 * Fiche de la patiente pour les infirmier·ères et sages-femmes : informations administratives,
 * grossesse en cours, rendez-vous et dates des visites. Aucune donnée médicale sensible.
 */
export interface SuiviPatiente {
  patiente: {
    id: string; numero: string; nom: string; postnom: string; prenom: string; age: number | null;
    dateNaissance: string | null; photoUrl: string | null; statut: StatutPatiente;
    etatCivil: string; occupation: string; nomPartenaire: string; telephone: string; telephone2: string;
    province: string; commune: string; quartier: string; avenue: string; repere: string; aireSante: string;
    contactUrgence: { nom: string; lien: string; telephone: string };
  };
  etablissement: { id: string; nom: string; province: string } | null;
  grossesse: { id: string; numero: number; statut: string; agJours: number | null; dpa: string | null; datee: boolean } | null;
  enfants: ResumeEnfant[];
  rendezVous: {
    id: string; date: string; motif: string; lieu: string; consignes: string; statut: StatutRdv; enfantId?: string | null;
    historique: { action: string; ancienneDate: string | null; nouvelleDate: string | null; motif: string; le: string }[];
  }[];
  /** Visites passées : date, type et soignant seulement (le contenu reste réservé aux médecins). */
  visites: { id: string; date: string; type: TypeConsultation; statut: string; soignant: { nom: string; role: string } }[];
}

/** Saisie de datation envoyée au serveur (qui calcule la DPA et l'âge gestationnel). */
export interface SaisieDatation {
  methode: MethodeDatation;
  ddr?: string | null;
  ddrFiabilite?: Fiabilite;
  dateReference?: string | null;
  agSemaines?: number | null;
  agJours?: number | null;
  dpa?: string | null;
  justification?: string;
}

export type SaisieConsultation = Partial<Omit<Consultation, 'id' | 'auteur' | 'statut' | 'addenda' | 'prochainRdv' | 'reference'>> & {
  prochainRdv?: { date: string | null; motif: string; consignes: string };
  reference?: { motifs: string[]; precision: string };
  finaliser?: boolean;
};

/** Réponse 409 du serveur à la création : dossiers existants possiblement identiques. */
export function doublonsDe(err: unknown): Doublon[] | null {
  return err instanceof HttpErrorResponse && err.status === 409 && Array.isArray(err.error?.doublons) ? err.error.doublons : null;
}

/**
 * Dossier prénatal stocké par backend-ami-connecte. Toutes ces routes sont réservées aux
 * médecins : le serveur refuse (403) et journalise tout autre rôle.
 */
@Injectable({ providedIn: 'root' })
export class PatientesService {
  private http = inject(HttpClient);
  private url = `${API_URL}/patientes`;

  rechercher(q: string, statut: string, page: number, parPage = 20, province = ''): Promise<PageRecherche> {
    const params: Record<string, string> = { page: String(page), parPage: String(parPage) };
    if (q.trim()) params['q'] = q.trim();
    if (province) params['province'] = province;
    if (statut && statut !== 'Tous') params['statut'] = statut;
    return firstValueFrom(this.http.get<PageRecherche>(this.url, { params }));
  }

  doublons(criteres: { nom?: string; prenom?: string; dateNaissance?: string; telephone?: string }): Promise<Doublon[]> {
    const params = Object.fromEntries(Object.entries(criteres).filter(([, v]) => !!v)) as Record<string, string>;
    return firstValueFrom(this.http.get<Doublon[]>(`${this.url}/doublons`, { params }));
  }

  /** Enregistrement multipart : données en JSON (« donnees ») et photo obligatoire. */
  creer(corps: unknown, photo: File): Promise<{ id: string; numero: string }> {
    const f = new FormData();
    f.append('donnees', JSON.stringify(corps));
    f.append('photo', photo);
    return firstValueFrom(this.http.post<{ id: string; numero: string }>(this.url, f));
  }

  /** Carte patiente (PDF recto-verso, format carte bancaire) générée par le serveur ; le QR suit le domaine du site. */
  carte(id: string): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.url}/${encodeURIComponent(id)}/carte`, {
      responseType: 'blob', params: { site: window.location.origin },
    }));
  }

  /** Médecin chef : suppression définitive, le numéro du dossier doit être retapé. */
  supprimer(id: string, confirmation: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`, { body: { confirmation } }));
  }

  /** Suivi en lecture seule, ouvert aux infirmier·ères. */
  suivi(id: string): Promise<SuiviPatiente> {
    return firstValueFrom(this.http.get<SuiviPatiente>(`${this.url}/${encodeURIComponent(id)}/suivi`));
  }

  dossier(id: string): Promise<Dossier> {
    return firstValueFrom(this.http.get<Dossier>(`${this.url}/${encodeURIComponent(id)}`));
  }

  modifier(id: string, champs: unknown): Promise<Patiente> {
    return firstValueFrom(this.http.patch<Patiente>(`${this.url}/${encodeURIComponent(id)}`, champs));
  }

  journal(id: string): Promise<EntreeJournal[]> {
    return firstValueFrom(this.http.get<EntreeJournal[]>(`${this.url}/${encodeURIComponent(id)}/journal`));
  }

  nouvelleGrossesse(patienteId: string, corps: unknown): Promise<Grossesse> {
    return firstValueFrom(this.http.post<Grossesse>(`${this.url}/${encodeURIComponent(patienteId)}/grossesses`, corps));
  }

  dater(grossesseId: string, saisie: SaisieDatation): Promise<Grossesse> {
    return firstValueFrom(this.http.put<Grossesse>(`${API_URL}/grossesses/${grossesseId}/datation`, saisie));
  }

  modifierGrossesse(grossesseId: string, corps: { facteursRisque?: string[]; grossesseMultiple?: boolean | null }): Promise<Grossesse> {
    return firstValueFrom(this.http.patch<Grossesse>(`${API_URL}/grossesses/${grossesseId}`, corps));
  }

  enregistrerIssue(grossesseId: string, corps: unknown): Promise<Grossesse> {
    return firstValueFrom(this.http.post<Grossesse>(`${API_URL}/grossesses/${grossesseId}/issue`, corps));
  }

  // --- Consultations -------------------------------------------------------------------
  consultation(id: string): Promise<Consultation> {
    return firstValueFrom(this.http.get<Consultation>(`${API_URL}/consultations/${id}`));
  }

  /** Multipart : « donnees » (JSON) et « fichiers » (compte rendu PDF ou images, 6 au plus). */
  creerEchographie(grossesseId: string, saisie: SaisieEchographie, fichiers: File[]): Promise<Echographie> {
    const f = new FormData();
    f.append('donnees', JSON.stringify(saisie));
    for (const x of fichiers) f.append('fichiers', x);
    return firstValueFrom(this.http.post<Echographie>(`${API_URL}/grossesses/${grossesseId}/echographies`, f));
  }

  creerConsultation(grossesseId: string, saisie: SaisieConsultation): Promise<Consultation> {
    return firstValueFrom(this.http.post<Consultation>(`${API_URL}/grossesses/${grossesseId}/consultations`, saisie));
  }

  modifierConsultation(id: string, saisie: SaisieConsultation): Promise<Consultation> {
    return firstValueFrom(this.http.patch<Consultation>(`${API_URL}/consultations/${id}`, saisie));
  }

  ajouterAddendum(id: string, texte: string, motif: string): Promise<Consultation> {
    return firstValueFrom(this.http.post<Consultation>(`${API_URL}/consultations/${id}/addenda`, { texte, motif }));
  }

  annulerConsultation(id: string, motif: string): Promise<Consultation> {
    return firstValueFrom(this.http.post<Consultation>(`${API_URL}/consultations/${id}/annuler`, { motif }));
  }

  // --- Rendez-vous ---------------------------------------------------------------------
  agenda(du: Date, au: Date): Promise<RendezVousAgenda[]> {
    return firstValueFrom(this.http.get<RendezVousAgenda[]>(`${API_URL}/rendez-vous`, { params: { du: du.toISOString(), au: au.toISOString() } }));
  }

  creerRendezVous(patienteId: string, corps: { date: string; motif: string; lieu?: string; consignes?: string; canalRappel?: CanalRappel }): Promise<RendezVous> {
    return firstValueFrom(this.http.post<RendezVous>(`${this.url}/${encodeURIComponent(patienteId)}/rendez-vous`, corps));
  }

  modifierRendezVous(id: string, action: 'confirmer' | 'reporter' | 'effectue' | 'absent' | 'annuler', extra: { date?: string; motif?: string } = {}): Promise<RendezVous> {
    return firstValueFrom(this.http.patch<RendezVous>(`${API_URL}/rendez-vous/${id}`, { action, ...extra }));
  }

  journalGlobal(page: number, resultat?: string): Promise<{ total: number; page: number; parPage: number; entrees: EntreeJournal[] }> {
    const params: Record<string, string> = { page: String(page) };
    if (resultat) params['resultat'] = resultat;
    return firstValueFrom(this.http.get<{ total: number; page: number; parPage: number; entrees: EntreeJournal[] }>(`${API_URL}/journal`, { params }));
  }
}
