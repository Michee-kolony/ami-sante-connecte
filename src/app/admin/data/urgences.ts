// Alertes de détresse fictives pour la maquette — positions approximatives à Kinshasa.

export type Gravite = 'critique' | 'élevée' | 'modérée';
export type EtatAlerte = 'nouvelle' | 'prise en charge' | 'résolue';

export interface AlerteUrgence {
  id: string;
  patienteId: string;
  patiente: string;
  photo?: string;
  telephone: string;
  motif: string;
  gravite: Gravite;
  etat: EtatAlerte;
  /** Heure de déclenchement (HH:mm, aujourd'hui). */
  heure: string;
  lat: number;
  lng: number;
  quartier: string;
  commune: string;
}

/**
 * Point de départ des secours : la structure de rattachement (Camp Tshatshi, Ngaliema).
 * Attention : Brazzaville est juste en face, sur l'autre rive du fleuve Congo ;
 * vérifier toute coordonnée par géocodage inverse (pays attendu : CD).
 */
export const BASE_SECOURS = {
  nom: 'Hôpital Militaire de la Garde Républicaine',
  lat: -4.3210,
  lng: 15.2745,
};

/** Ambulance suivie sur la carte (les véhicules eux-mêmes viennent de FlotteService). */
export interface AmbulanceEnRoute {
  id: string;
  immatriculation: string;
  equipage: string;
  alerteId: string;
  /** Part du trajet déjà parcourue (0 → 1). */
  progression: number;
}

/** Avancement des missions déjà en cours à l'ouverture de la page (démonstration). */
export const PROGRESSION_INITIALE: Record<string, number> = { 'AMB-02': 0.4, 'AMB-04': 0.15 };

export const ALERTES: AlerteUrgence[] = [
  {
    id: 'URG-0193', patienteId: 'AMI-2026-000140', patiente: 'Marie TSHIBANDA', photo: 'images/patientes/patiente-6.webp',
    telephone: '+243 82 555 0193', motif: 'Saignements abondants — 31 SA', gravite: 'critique', etat: 'nouvelle',
    heure: '08:47', lat: -4.3446, lng: 15.2612, quartier: 'Binza Pigeon', commune: 'Ngaliema',
  },
  {
    id: 'URG-0192', patienteId: 'AMI-2026-000141', patiente: 'Ruth MBALA', photo: 'images/patientes/patiente-1.webp',
    telephone: '+243 99 876 1122', motif: 'Céphalées intenses, vision floue', gravite: 'élevée', etat: 'prise en charge',
    heure: '08:12', lat: -4.3132, lng: 15.2631, quartier: 'Camp Tshatshi', commune: 'Ngaliema',
  },
  {
    id: 'URG-0191', patienteId: 'AMI-2026-000138', patiente: 'Sarah ILUNGA', photo: 'images/patientes/patiente-4.webp',
    telephone: '+243 81 900 4471', motif: 'Contractions régulières — 37 SA', gravite: 'élevée', etat: 'nouvelle',
    heure: '07:58', lat: -4.3401, lng: 15.3069, quartier: 'Kauka', commune: 'Kalamu',
  },
  {
    id: 'URG-0190', patienteId: 'AMI-LOC-7F3A2C', patiente: 'Divine NGOMA', photo: 'images/patientes/patiente-2.webp',
    telephone: '+243 97 410 2290', motif: 'Vomissements persistants', gravite: 'modérée', etat: 'prise en charge',
    heure: '07:21', lat: -4.3163, lng: 15.2953, quartier: 'Kokolo', commune: 'Lingwala',
  },
  {
    id: 'URG-0189', patienteId: 'AMI-2026-000142', patiente: 'Esther KABEYA', photo: 'images/patientes/patiente-3.webp',
    telephone: '+243 81 234 5678', motif: 'Fièvre élevée', gravite: 'modérée', etat: 'résolue',
    heure: '06:05', lat: -4.3527, lng: 15.3497, quartier: 'Kingabwa', commune: 'Limete',
  },
];
