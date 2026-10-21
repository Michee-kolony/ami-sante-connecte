// Alertes de détresse fictives pour la maquette — positions approximatives à Kinshasa.

export type Gravite = 'critique' | 'élevée' | 'modérée';
export type EtatAlerte = 'nouvelle' | 'prise en charge' | 'résolue' | 'annulée';

export type TypeEvenement =
  | 'Alerte reçue'
  | 'Prise en charge'
  | 'Ambulance envoyée'
  | 'Arrivée sur place'
  | 'Patiente à bord'
  | 'Arrivée à l’hôpital'
  | 'Clôturée'
  | 'Annulée';

/** Étape horodatée de l'historique d'une urgence. */
export interface EvenementUrgence {
  /** AAAA-MM-JJ HH:mm */
  date: string;
  type: TypeEvenement;
  auteur: string;
  detail?: string;
}

export interface AlerteUrgence {
  id: string;
  patienteId: string;
  patiente: string;
  photo?: string;
  telephone: string;
  motif: string;
  gravite: Gravite;
  etat: EtatAlerte;
  /** Jour de déclenchement (AAAA-MM-JJ). */
  date: string;
  /** Heure de déclenchement (HH:mm). */
  heure: string;
  lat: number;
  lng: number;
  quartier: string;
  commune: string;
  /** Ambulance et chauffeur engagés, conservés après la mission pour l'historique. */
  ambulanceId?: string;
  chauffeur?: string;
  evenements: EvenementUrgence[];
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

/** Date locale AAAA-MM-JJ, décalée de n jours par rapport à aujourd'hui. */
export function jour(decalage = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Données fictives ----------------------------------------------------------------

const PATIENTES = {
  marie: { patienteId: 'AMI-2026-000140', patiente: 'Marie TSHIBANDA', photo: 'images/patientes/patiente-6.webp', telephone: '+243 82 555 0193', lat: -4.3446, lng: 15.2612, quartier: 'Binza Pigeon', commune: 'Ngaliema' },
  ruth: { patienteId: 'AMI-2026-000141', patiente: 'Ruth MBALA', photo: 'images/patientes/patiente-1.webp', telephone: '+243 99 876 1122', lat: -4.3132, lng: 15.2631, quartier: 'Camp Tshatshi', commune: 'Ngaliema' },
  sarah: { patienteId: 'AMI-2026-000138', patiente: 'Sarah ILUNGA', photo: 'images/patientes/patiente-4.webp', telephone: '+243 81 900 4471', lat: -4.3401, lng: 15.3069, quartier: 'Kauka', commune: 'Kalamu' },
  divine: { patienteId: 'AMI-LOC-7F3A2C', patiente: 'Divine NGOMA', photo: 'images/patientes/patiente-2.webp', telephone: '+243 97 410 2290', lat: -4.3163, lng: 15.2953, quartier: 'Kokolo', commune: 'Lingwala' },
  esther: { patienteId: 'AMI-2026-000142', patiente: 'Esther KABEYA', photo: 'images/patientes/patiente-3.webp', telephone: '+243 81 234 5678', lat: -4.3527, lng: 15.3497, quartier: 'Kingabwa', commune: 'Limete' },
  josee: { patienteId: 'AMI-2026-000131', patiente: 'Josée MUKENDI', photo: 'images/patientes/patiente-5.webp', telephone: '+243 85 120 7788', lat: -4.3370, lng: 15.3150, quartier: 'Matonge', commune: 'Kalamu' },
};

const REGULATRICE = 'Inf. Grâce Mbuyi';

/** Raccourci : [heure, type, auteur, détail?] → événements datés du jour j. */
function chrono(j: string, etapes: [string, TypeEvenement, string, string?][]): EvenementUrgence[] {
  return etapes.map(([h, type, auteur, detail]) => ({ date: `${j} ${h}`, type, auteur, detail }));
}

/** Mission complète (alerte → hôpital), pour l'historique des jours passés. */
function missionTerminee(
  j: string, h: [string, string, string, string, string, string], ambulance: string, chauffeur: string,
): EvenementUrgence[] {
  return chrono(j, [
    [h[0], 'Alerte reçue', 'Application patiente'],
    [h[1], 'Prise en charge', REGULATRICE],
    [h[1], 'Ambulance envoyée', REGULATRICE, `${ambulance} — ${chauffeur}`],
    [h[2], 'Arrivée sur place', chauffeur],
    [h[3], 'Patiente à bord', chauffeur],
    [h[4], 'Arrivée à l’hôpital', chauffeur],
    [h[5], 'Clôturée', REGULATRICE, 'Patiente admise aux urgences maternité'],
  ]);
}

function alertesInitiales(): AlerteUrgence[] {
  const j0 = jour(0);
  const passees: [number, string, keyof typeof PATIENTES, string, Gravite, [string, string, string, string, string, string], string, string][] = [
    [-1, 'URG-0188', 'sarah', 'Perte des eaux — 36 SA', 'élevée', ['22:14', '22:15', '22:29', '22:36', '22:51', '23:05'], 'AMB-05', 'J. TSHALA'],
    [-1, 'URG-0187', 'marie', 'Douleurs abdominales', 'modérée', ['15:40', '15:42', '15:55', '16:03', '16:15', '16:40'], 'AMB-02', 'B. LEMA'],
    [-3, 'URG-0185', 'ruth', 'Malaise, tension élevée', 'critique', ['03:12', '03:12', '03:20', '03:27', '03:34', '03:50'], 'AMB-07', 'F. KALOMBO'],
    [-4, 'URG-0184', 'josee', 'Travail avancé — 39 SA', 'élevée', ['11:05', '11:06', '11:24', '11:30', '11:52', '12:10'], 'AMB-04', 'D. MPIA'],
    [-7, 'URG-0181', 'divine', 'Saignements légers', 'modérée', ['09:30', '09:33', '09:46', '09:55', '10:06', '10:30'], 'AMB-05', 'J. TSHALA'],
    [-9, 'URG-0179', 'esther', 'Convulsions', 'critique', ['19:48', '19:48', '20:01', '20:09', '20:28', '20:45'], 'AMB-02', 'B. LEMA'],
    [-12, 'URG-0176', 'sarah', 'Chute à domicile — 32 SA', 'modérée', ['07:15', '07:20', '07:41', '07:50', '08:12', '08:35'], 'AMB-07', 'F. KALOMBO'],
    [-16, 'URG-0172', 'marie', 'Fièvre et frissons', 'modérée', ['13:02', '13:05', '13:22', '13:30', '13:47', '14:10'], 'AMB-04', 'D. MPIA'],
  ];

  const historique: AlerteUrgence[] = passees.map(([d, id, p, motif, gravite, h, ambulanceId, chauffeur]) => ({
    id, ...PATIENTES[p], motif, gravite, etat: 'résolue' as EtatAlerte, date: jour(d), heure: h[0],
    ambulanceId, chauffeur, evenements: missionTerminee(jour(d), h, ambulanceId, chauffeur),
  }));

  // Fausse alerte : bouton déclenché par erreur, annulée après appel de vérification.
  const jAnnulee = jour(-5);
  historique.splice(4, 0, {
    id: 'URG-0183', ...PATIENTES.esther, motif: 'Alerte déclenchée par erreur', gravite: 'modérée', etat: 'annulée',
    date: jAnnulee, heure: '18:22',
    evenements: chrono(jAnnulee, [
      ['18:22', 'Alerte reçue', 'Application patiente'],
      ['18:24', 'Annulée', REGULATRICE, 'Appel de vérification : la patiente va bien'],
    ]),
  });

  const aujourdhui: AlerteUrgence[] = [
    {
      id: 'URG-0193', ...PATIENTES.marie, motif: 'Saignements abondants — 31 SA', gravite: 'critique', etat: 'nouvelle',
      date: j0, heure: '08:47', evenements: chrono(j0, [['08:47', 'Alerte reçue', 'Application patiente']]),
    },
    {
      id: 'URG-0192', ...PATIENTES.ruth, motif: 'Céphalées intenses, vision floue', gravite: 'élevée', etat: 'prise en charge',
      date: j0, heure: '08:12', ambulanceId: 'AMB-02', chauffeur: 'B. LEMA',
      evenements: chrono(j0, [
        ['08:12', 'Alerte reçue', 'Application patiente'],
        ['08:14', 'Prise en charge', REGULATRICE],
        ['08:15', 'Ambulance envoyée', REGULATRICE, 'AMB-02 — B. LEMA'],
      ]),
    },
    {
      id: 'URG-0191', ...PATIENTES.sarah, motif: 'Contractions régulières — 37 SA', gravite: 'élevée', etat: 'nouvelle',
      date: j0, heure: '07:58', evenements: chrono(j0, [['07:58', 'Alerte reçue', 'Application patiente']]),
    },
    {
      id: 'URG-0190', ...PATIENTES.divine, motif: 'Vomissements persistants', gravite: 'modérée', etat: 'prise en charge',
      date: j0, heure: '07:21', ambulanceId: 'AMB-04', chauffeur: 'D. MPIA',
      evenements: chrono(j0, [
        ['07:21', 'Alerte reçue', 'Application patiente'],
        ['07:25', 'Prise en charge', REGULATRICE],
        ['07:26', 'Ambulance envoyée', REGULATRICE, 'AMB-04 — D. MPIA'],
      ]),
    },
    {
      id: 'URG-0189', ...PATIENTES.esther, motif: 'Fièvre élevée', gravite: 'modérée', etat: 'résolue',
      date: j0, heure: '06:05', ambulanceId: 'AMB-07', chauffeur: 'F. KALOMBO',
      evenements: missionTerminee(j0, ['06:05', '06:07', '06:31', '06:38', '07:02', '07:15'], 'AMB-07', 'F. KALOMBO'),
    },
  ];

  return [...aujourdhui, ...historique];
}

export const ALERTES: AlerteUrgence[] = alertesInitiales();
