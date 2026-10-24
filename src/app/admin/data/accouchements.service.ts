import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import { alarme } from '../../shared/son';
import type { Auteur } from './patientes.service';
import type { Naissance, ResumeEnfant, SexeEnfant } from './enfants.service';
import { PresenceService } from './presence.service';
import { SessionService } from './session.service';

// --- Référentiel (backend-ami-connecte/config/accouchement.js et partogramme.js) ---------

export interface CodeLibelle { code: string; libelle: string }

export interface ReferentielAccouchement {
  PROVENANCES: CodeLibelle[];
  STATUTS_HB: string[];
  RESULTATS_VIH: string[];
  CONJONCTIVES: string[];
  ETATS_GENERAUX: string[];
  SYSTEMES: CodeLibelle[];
  PRESENTATIONS: string[];
  ETATS_POCHE: string[];
  ASPECTS_LA: string[];
  ENGAGEMENTS: string[];
  ENGAGEMENTS_PARTOGRAMME: CodeLibelle[];
  BASSINS: string[];
  EXAMENS_LABO_ENTREE: CodeLibelle[];
  SAIGNEMENTS: string[];
  MEMBRANES: string[];
  MODES_ACCOUCHEMENT: string[];
  MODES_DELIVRANCE: string[];
  HEMORRAGIE_PHYSIOLOGIQUE_MAX_ML: number;
  SEXES: SexeEnfant[];
  ETATS_NAISSANCE: string[];
  APGAR_CRITERES: CodeLibelle[];
  APGAR_MINUTES: number[];
  CRENEAUX_POST_PARTUM: (CodeLibelle & { minutes: number })[];
  POUR_TRAITEMENT: string[];
  STATUTS_TRAITEMENT: string[];
  MESURES_SORTIE_MERE: CodeLibelle[];
  MESURES_SORTIE_NOUVEAU_NE: CodeLibelle[];
  STATUTS_ACCOUCHEMENT: StatutAccouchement[];
  partogramme: {
    BCF: { min: number; max: number; echelle: [number, number] };
    PHASE_ACTIVE_CM: number;
    DILATATION_COMPLETE_CM: number;
    VITESSE_CM_H: number;
    DECALAGE_ACTION_H: number;
    STAGNATION_H: number;
  };
}

// --- Dossier d'accouchement ----------------------------------------------------------------

export type StatutAccouchement = 'En travail' | 'Post-partum' | 'Clôturé';
export type Zone = 'Verte' | 'Jaune' | 'Rouge';
export type CodeAlerte = 'BCF' | 'Zone jaune' | 'Stagnation' | 'Zone rouge';

/** Module 1 — identité et anamnèse. */
export interface Admission {
  nom: string; postnom: string; prenom: string; age: number | null; occupation: string; etatMatrimonial: string;
  provenance: string; provenancePrecision: string; nomPartenaire: string; adresse: string;
  personneAPrevenir: { nom: string; telephone: string };
  motif: string; groupeSanguin: string; rhesus: string; statutHb: string;
  gestite: number | null; parite: number | null; avortements: number | null; enfantsVivants: number | null;
  ddr: string | null; dpa: string | null;
  vih: { conseillee: boolean | null; testee: boolean | null; informee: boolean | null; resultat: string };
  arv: { regime: string; depuisLe: string | null };
  debutTravail: string | null;
  antecedents: {
    medicoChirurgicaux: string;
    gynecoObstetricaux: {
      vivants: number | null; morts: number | null; mortNes: number | null; eutocies: number | null; dystocies: number | null;
      bebesPlus4kg: number | null; cesariennes: { annee: number | null; indication: string }[]; autres: string;
    };
  };
  admiseLe: string;
  admisePar?: Auteur;
}

/** Module 2 — examen clinique d'entrée. */
export interface ExamenClinique {
  physique: {
    poidsKg: number | null; tailleCm: number | null; temperature: number | null; pouls: number | null;
    taSystolique: number | null; taDiastolique: number | null; oedemes: boolean | null; conjonctives: string; etatGeneral: string;
    systemes: Record<string, string>;
  };
  obstetrical: {
    hauteurUterineCm: number | null; presentation: string; position: string; bcf: number | null; contractions10min: number | null;
    contractions: string; mouvementsFoetauxActifs: boolean | null; speculum: string; colAspect: string;
    toucherVaginal: { effacementPct: number | null; dilatationCm: number | null; oedemeCol: boolean | null };
    pocheEaux: { etat: string; rompueLe: string | null; aspectLiquide: string };
    engagement: string; bassin: string;
  };
  laboratoire: Record<string, string>;
  conclusion: string; pronostic: string; conduiteATenir: string;
  examinateur?: Auteur;
  examineLe: string | null;
}

/** Module 3 — une ligne de surveillance du travail. */
export interface SaisieSurveillance {
  le?: string;
  saignement: string;
  contractions10min: number | null;
  dureeContractionsSec: number | null;
  bcf: number | null;
  temperature: number | null;
  pouls: number | null;
  taSystolique: number | null;
  taDiastolique: number | null;
  diurese: string;
  dilatationCm: number | null;
  /** Effacement du col (%). */
  effacementPct: number | null;
  affection: string;
  traitements: string;
  membranes: string;
  liquideAmniotique: string;
  ocytocine: { uParMl: number | null; gouttesMin: number | null };
  medicamentsIV: string;
  engagement: string;
  incident: string;
}

export interface Surveillance extends SaisieSurveillance {
  id: string;
  le: string;
  phase: 'Latence' | 'Active';
  auteur: Auteur;
  tempsDepuis?: { arriveeH: number | null; ruptureH: number | null; debutTravailH: number | null };
}

export interface Alerte {
  id: string;
  code: CodeAlerte;
  niveau: 'Avertissement' | 'Critique';
  sonore: boolean;
  message: string;
  surveillanceId: string | null;
  le: string;
  medecinsNotifies: string[];
  acquitteePar?: Auteur;
  acquitteeLe: string | null;
}

export interface AlerteSalle extends Alerte {
  accouchementId: string;
  numero: string;
  patiente: { id: string; numero: string; nom: string; prenom: string } | null;
}

/** Identité minimale d'une femme admise directement en salle de travail, sans dossier CPN. */
export interface NouvellePatienteAdmission {
  nom: string; postnom: string; prenom: string;
  dateNaissance: string; ageDeclare: number | null; telephone: string;
  adresse: { commune: string; quartier: string; avenue: string };
  contactUrgence: { nom: string; lien: string; telephone: string };
}

export interface Partogramme {
  debutPhaseActive: string | null;
  bcf: { min: number; max: number; echelle: [number, number]; points: { id: string; le: string; phase: string; bcf: number; anormal: boolean; heures: number | null }[] };
  dilatation: {
    echelle: [number, number];
    lignes: { alerte: { heures: number; cm: number }[]; action: { heures: number; cm: number }[] };
    points: { id: string; le: string; heures: number; cm: number; zone: Zone }[];
    zoneActuelle: Zone | null;
  };
  effacement: { echelle: [number, number]; points: { id: string; le: string; phase: string; pct: number; heures: number | null }[] };
  /** Engagement de la présentation (M, A, F, E, D) et incidents, sous le graphe des BCF. */
  reperes: { id: string; le: string; heures: number | null; engagement: string | null; incident: string | null }[];
}

/** Module 4 — accouchement et délivrance. */
export interface DonneesAccouchement {
  mode: string;
  heure: string | null;
  multiple: boolean | null;
  nombreEnfants: number | null;
  dechirure: { presente: boolean | null; degre: number | null };
  episiotomie: boolean | null;
  indicationCesarienne: string;
  accoucheur: string;
  assiste: string;
  delivrance: {
    ocytocine10UI: { administree: boolean | null; heure: string | null };
    tractionControlee: boolean | null;
    massageUterin: boolean | null;
    mode: string;
    heure: string | null;
    placenta: { complet: boolean | null; aspect: string };
    membranesCompletes: boolean | null;
    pertesSangMl: number | null;
    hemorragie: string;
  };
  enregistrePar?: Auteur;
  enregistreLe?: string;
}

export interface MereSurveillancePP {
  taSystolique: number | null; taDiastolique: number | null; pouls: number | null; temperature: number | null; respiration: number | null;
  conscience: string; saignement: string; globeSecurite: boolean | null; vessieDiurese: string; allaitement: string; reactionsPsy: string;
}

export interface NouveauNeSurveillancePP {
  enfantId: string; respiration: number | null; coloration: string; temperatureAxillaire: number | null; signesDanger: string;
}

export interface SurveillancePostPartum {
  id: string;
  creneau: string;
  le: string;
  mere: MereSurveillancePP;
  nouveauNes: NouveauNeSurveillancePP[];
  observations: string;
  auteur: Auteur;
}

export interface TraitementPostPartum {
  id: string;
  pour: 'Mère' | 'Nouveau-né';
  enfantId: string | null;
  produit: string; dose: string; voie: string; frequence: string; duree: string;
  statut: 'Prévu' | 'Administré';
  administreLe: string | null;
  auteur: Auteur;
  le: string;
}

export interface MesuresSortie {
  mere: Record<string, boolean | null>;
  nouveauNe: Record<string, boolean | null>;
}

export interface DossierAccouchement {
  id: string;
  numero: string;
  patienteId: string;
  grossesseId: string;
  etablissementId: string | null;
  statut: StatutAccouchement;
  admission: Admission;
  examenClinique?: ExamenClinique;
  phaseActiveLe: string | null;
  surveillances: Surveillance[];
  alertes: Alerte[];
  accouchement?: DonneesAccouchement;
  postPartum: {
    surveillances: SurveillancePostPartum[];
    traitements: TraitementPostPartum[];
    sortie?: { date: string; rdvCpon: string | null; rdvCponId: string | null; observations: string; examinePar: Auteur; le: string };
    conseils: string;
    mesuresPreventives: MesuresSortie;
  };
  cloture?: { par: Auteur; le: string };
  partogramme: Partogramme;
  planningPostPartum: { code: string; libelle: string; prevuLe: string; statut: 'Faite' | 'À venir' | 'À faire' | 'En retard'; surveillanceId: string | null }[] | null;
  patiente: { id: string; numero: string; nom: string; postnom: string; prenom: string; photoUrl: string | null } | null;
  nouveauNes: ResumeEnfant[];
  manquantsCloture: string[];
  /** Synthèse du suivi prénatal (grossesse, dernière CPN, échographie, points d'attention). */
  rappelPrenatal?: RappelPrenatal;
  /** Valeurs du suivi prénatal proposées pour les champs vides (dossier ouvert seulement). */
  preRemplissage?: { admission: Partial<Admission>; examen: Partial<ExamenClinique> | null } | null;
  creePar: Auteur;
  createdAt: string;
}

export interface RappelPrenatal {
  grossesse: {
    numero: number; multiple: boolean | null; facteursRisque: string[];
    datation: { methode: string; ddr: string | null; dpa: string } | null;
    ag: { semaines: number; jours: number } | null;
  } | null;
  nombreCpn: number;
  derniereCpn: {
    date: string; agJours: number | null; poidsKg: number | null; taSystolique: number | null; taDiastolique: number | null;
    hauteurUterineCm: number | null; bcf: number | null; presentation: string; signes: string[];
  } | null;
  laboratoire: { libelle: string; valeur: string; le: string }[];
  preventions: string[];
  echographie: {
    date: string; agSemaines: number | null; agJours: number | null; nombreFoetus: number; presentation: string;
    poidsEstimeG: number | null; placenta: string; liquide: string; conclusion: string;
  } | null;
  allergies: string;
  medicaments: string;
  points: { niveau: 'Critique' | 'Avertissement'; texte: string }[];
}

export interface ResumeAccouchement {
  id: string;
  numero: string;
  statut: StatutAccouchement;
  etablissementId: string | null;
  /** photoUrl : lien signé temporaire (15 min) vers la photo d'identification. */
  patiente: { id: string; numero: string; nom: string; postnom: string; prenom: string; photoUrl: string | null } | null;
  admiseLe: string;
  phase: 'Latence' | 'Active';
  derniereSurveillance: { le: string; dilatationCm: number | null; effacementPct: number | null; bcf: number | null } | null;
  zoneActuelle: Zone | null;
  alertesActives: number;
  alertesCritiques: number;
  accoucheeLe: string | null;
  sortieLe: string | null;
}

export interface SaisieNouveauNe {
  prenom: string;
  nom?: string;
  postnom?: string;
  sexe: SexeEnfant | '';
  neLe: string | null;
  rang?: number | null;
  etatNaissance: 'Vivant' | 'Mort-né';
  naissance: Naissance;
}

/** Couleurs des zones du partogramme (badges). */
export function classeZone(z: Zone | null): string {
  if (z === 'Rouge') return 'bg-rose-600 text-white';
  if (z === 'Jaune') return 'bg-amber-400 text-amber-950';
  if (z === 'Verte') return 'bg-accent-500 text-white';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

/**
 * Dossier d'accouchement (backend-ami-connecte) : médecins et sages-femmes seulement
 * (le serveur refuse et journalise tout autre rôle).
 */
@Injectable({ providedIn: 'root' })
export class AccouchementsService {
  private http = inject(HttpClient);
  private url = `${API_URL}/accouchements`;

  readonly referentiel = signal<ReferentielAccouchement | null>(null);
  private refEnCours: Promise<ReferentielAccouchement> | null = null;

  chargerReferentiel(): Promise<ReferentielAccouchement> {
    const deja = this.referentiel();
    if (deja) return Promise.resolve(deja);
    this.refEnCours ??= firstValueFrom(this.http.get<ReferentielAccouchement>(`${API_URL}/referentiels/accouchement`))
      .then(r => {
        this.referentiel.set(r);
        return r;
      })
      .finally(() => (this.refEnCours = null));
    return this.refEnCours;
  }

  lister(criteres: { statut?: string; patienteId?: string } = {}): Promise<ResumeAccouchement[]> {
    const params: Record<string, string> = {};
    if (criteres.statut) params['statut'] = criteres.statut;
    if (criteres.patienteId) params['patienteId'] = criteres.patienteId;
    return firstValueFrom(this.http.get<ResumeAccouchement[]>(this.url, { params }));
  }

  alertes(): Promise<AlerteSalle[]> {
    return firstValueFrom(this.http.get<AlerteSalle[]>(`${this.url}/alertes`));
  }

  admettre(patienteId: string, admission: Partial<Admission>): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.post<DossierAccouchement>(this.url, { patienteId, admission }));
  }

  /**
   * Admission directe d'une femme venue accoucher sans dossier (pas de CPN) : son dossier patiente
   * minimal est créé avec le dossier d'accouchement. 409 avec `doublons` si elle semble déjà enregistrée.
   */
  admettreSansDossier(nouvellePatiente: NouvellePatienteAdmission, admission: Partial<Admission>, confirmerMalgreDoublons = false): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.post<DossierAccouchement>(this.url, { nouvellePatiente, admission, confirmerMalgreDoublons }));
  }

  obtenir(id: string): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.get<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}`));
  }

  modifierAdmission(id: string, admission: Partial<Admission>): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.patch<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/admission`, admission));
  }

  examiner(id: string, examen: ExamenClinique): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.put<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/examen-clinique`, examen));
  }

  surveiller(id: string, saisie: SaisieSurveillance): Promise<{ surveillance: Surveillance; alertes: Alerte[]; partogramme: Partogramme }> {
    return firstValueFrom(this.http.post<{ surveillance: Surveillance; alertes: Alerte[]; partogramme: Partogramme }>(`${this.url}/${encodeURIComponent(id)}/surveillances`, saisie));
  }

  acquitter(id: string, alerteId: string): Promise<Alerte> {
    return firstValueFrom(this.http.post<Alerte>(`${this.url}/${encodeURIComponent(id)}/alertes/${alerteId}/acquitter`, {}));
  }

  accoucher(id: string, donnees: Partial<DonneesAccouchement>): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.put<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/accouchement`, donnees));
  }

  /** Formulaire multipart : données en JSON (« donnees ») et photo du bébé (obligatoire s'il est né vivant). */
  ajouterNouveauNe(id: string, saisie: SaisieNouveauNe, photo: File | null): Promise<unknown> {
    const corps = new FormData();
    corps.append('donnees', JSON.stringify(saisie));
    if (photo) corps.append('photo', photo);
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/nouveau-nes`, corps));
  }

  surveillerPostPartum(id: string, corps: { creneau: string; le?: string; mere: Partial<MereSurveillancePP>; nouveauNes: NouveauNeSurveillancePP[]; observations: string }): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.post<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/post-partum/surveillances`, corps));
  }

  ajouterTraitement(id: string, corps: Partial<TraitementPostPartum>): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.post<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/post-partum/traitements`, corps));
  }

  administrer(id: string, traitementId: string): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.post<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/post-partum/traitements/${traitementId}/administrer`, {}));
  }

  sortir(id: string, corps: { date?: string; rdvCpon?: string | null; observations?: string; conseils?: string; mesuresPreventives?: MesuresSortie }): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.put<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/sortie`, corps));
  }

  /** Médecins : suppression définitive (dossier, nouveau-nés, leurs RDV, RDV CPoN) ; le numéro doit être retapé. */
  supprimer(id: string, confirmation: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`, { body: { confirmation } }));
  }

  cloturer(id: string): Promise<DossierAccouchement> {
    return firstValueFrom(this.http.post<DossierAccouchement>(`${this.url}/${encodeURIComponent(id)}/cloturer`, {}));
  }
}

/** Alerte reçue en temps réel (zone rouge notifiée aux médecins). */
export interface AlerteTempsReel {
  accouchementId: string;
  numero: string;
  alerte: Alerte;
  patiente: { numero: string; nom: string; prenom: string } | null;
}

/**
 * Alertes de la salle de travail, sur toutes les pages : compteur du menu (alertes non prises en
 * charge, relu toutes les minutes) et notification sonore immédiate quand le serveur signale
 * une zone rouge à ce médecin.
 */
@Injectable({ providedIn: 'root' })
export class AlertesMaterniteService {
  private service = inject(AccouchementsService);
  private session = inject(SessionService);
  private presence = inject(PresenceService);
  private minuterie?: ReturnType<typeof setInterval>;

  readonly actives = signal<AlerteSalle[]>([]);
  /** Dernière notification reçue en direct (bandeau affiché jusqu'à fermeture). */
  readonly derniere = signal<AlerteTempsReel | null>(null);

  constructor() {
    this.presence.sur<AlerteTempsReel>('accouchement:alerte', (a) => {
      this.derniere.set(a);
      alarme();
      this.actualiser();
    });
    effect(() => {
      const actif = this.session.connecte() && this.session.estMaternite();
      untracked(() => {
        clearInterval(this.minuterie);
        if (!actif) return this.actives.set([]);
        this.actualiser();
        this.minuterie = setInterval(() => this.actualiser(), 60_000);
      });
    });
  }

  async actualiser(): Promise<void> {
    try {
      this.actives.set(await this.service.alertes());
    } catch { /* hors ligne : on garde la dernière liste */ }
  }

  /** Alertes du même dossier retirées localement après prise en charge. */
  retirer(alerteId: string): void {
    this.actives.update(l => l.filter(a => a.id !== alerteId));
  }
}
