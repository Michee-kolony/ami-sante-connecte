// Urgences : types partagés par la page Urgences, l'historique et UrgencesService (API /urgences).

export type Gravite = 'critique' | 'élevée' | 'modérée';
export type EtatAlerte = 'nouvelle' | 'prise en charge' | 'résolue' | 'annulée';

/** Statut de la course, indiqué par le chauffeur depuis l'application ami-connecte-chauffeur. */
export type StatutCourse = 'Assignée' | 'En route' | 'Arrivée sur place' | 'Patiente à bord' | 'Arrivée à l’hôpital' | 'Terminée';
export const STATUTS_COURSE: StatutCourse[] = ['Assignée', 'En route', 'Arrivée sur place', 'Patiente à bord', 'Arrivée à l’hôpital', 'Terminée'];

export type TypeEvenement =
  | 'Alerte reçue'
  | 'Prise en charge'
  | 'Ambulance envoyée'
  | 'En route'
  | 'Arrivée sur place'
  | 'Patiente à bord'
  | 'Arrivée à l’hôpital'
  | 'Clôturée'
  | 'Annulée';

/** Étape horodatée de l'historique d'une urgence. */
export interface EvenementUrgence {
  /** AAAA-MM-JJ HH:mm (heure de Kinshasa) */
  date: string;
  le: string;
  type: TypeEvenement;
  auteur: string;
  detail?: string;
}

export interface AlerteUrgence {
  /** Numéro public URG-000001. */
  id: string;
  patienteId: string;
  patienteNumero: string | null;
  patiente: string;
  photo?: string;
  telephone: string;
  motif: string;
  motifCode: string;
  precisions: string;
  gravite: Gravite;
  etat: EtatAlerte;
  statutCourse: StatutCourse | null;
  /** Jour de déclenchement (AAAA-MM-JJ). */
  date: string;
  /** Heure de déclenchement (HH:mm). */
  heure: string;
  creeLe: string;
  lat: number;
  lng: number;
  precisionM: number | null;
  quartier: string;
  commune: string;
  /** Ambulance (code) et chauffeur engagés, conservés après la mission pour l'historique. */
  ambulanceId?: string;
  chauffeurId?: string;
  chauffeur?: string;
  prisEnChargePar: string | null;
  evenements: EvenementUrgence[];
}

/** Message du chat d'une urgence (patiente, chauffeur envoyé et régulation). */
export interface MessageUrgence {
  id: string;
  urgence: string;
  auteur: { type: 'patiente' | 'chauffeur' | 'regulation'; id: string; nom: string };
  texte: string;
  le: string;
}

/**
 * Point de départ des secours par défaut (avant la première position GPS d'une ambulance) :
 * la structure de rattachement (Camp Tshatshi, Ngaliema).
 * Attention : Brazzaville est juste en face, sur l'autre rive du fleuve Congo ;
 * vérifier toute coordonnée par géocodage inverse (pays attendu : CD).
 */
export const BASE_SECOURS = {
  nom: 'Hôpital Militaire de la Garde Républicaine',
  lat: -4.3210,
  lng: 15.2745,
};

/** Date locale AAAA-MM-JJ, décalée de n jours par rapport à aujourd'hui. */
export function jour(decalage = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
