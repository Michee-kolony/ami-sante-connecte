// Données fictives de vaccination + calcul du statut vaccinal.
// ⚠️ Calendrier à faire valider par le responsable PEV avant usage réel.

export const AUJOURDHUI = '2026-10-18';

const JOUR = 86_400_000;
const ms = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Une dose du calendrier vaccinal de routine (PEV). */
export interface Dose {
  code: string;
  nom: string;
  maladie: string;
  /** Âge recommandé, en jours. */
  ageJours: number;
  contact: string;
}

export const CALENDRIER: Dose[] = [
  { code: 'BCG', nom: 'BCG', maladie: 'Tuberculose', ageJours: 0, contact: 'Naissance' },
  { code: 'VPO0', nom: 'VPO 0', maladie: 'Poliomyélite', ageJours: 0, contact: 'Naissance' },
  { code: 'PENTA1', nom: 'Penta 1', maladie: 'Diphtérie, tétanos, coqueluche, hépatite B, Hib', ageJours: 42, contact: '6 semaines' },
  { code: 'VPO1', nom: 'VPO 1', maladie: 'Poliomyélite', ageJours: 42, contact: '6 semaines' },
  { code: 'PCV1', nom: 'PCV 1', maladie: 'Pneumocoque', ageJours: 42, contact: '6 semaines' },
  { code: 'ROTA1', nom: 'Rota 1', maladie: 'Rotavirus', ageJours: 42, contact: '6 semaines' },
  { code: 'PENTA2', nom: 'Penta 2', maladie: 'Diphtérie, tétanos, coqueluche, hépatite B, Hib', ageJours: 70, contact: '10 semaines' },
  { code: 'VPO2', nom: 'VPO 2', maladie: 'Poliomyélite', ageJours: 70, contact: '10 semaines' },
  { code: 'PCV2', nom: 'PCV 2', maladie: 'Pneumocoque', ageJours: 70, contact: '10 semaines' },
  { code: 'ROTA2', nom: 'Rota 2', maladie: 'Rotavirus', ageJours: 70, contact: '10 semaines' },
  { code: 'PENTA3', nom: 'Penta 3', maladie: 'Diphtérie, tétanos, coqueluche, hépatite B, Hib', ageJours: 98, contact: '14 semaines' },
  { code: 'VPO3', nom: 'VPO 3', maladie: 'Poliomyélite', ageJours: 98, contact: '14 semaines' },
  { code: 'PCV3', nom: 'PCV 3', maladie: 'Pneumocoque', ageJours: 98, contact: '14 semaines' },
  { code: 'VPI', nom: 'VPI', maladie: 'Poliomyélite (injectable)', ageJours: 98, contact: '14 semaines' },
  { code: 'VAR', nom: 'VAR', maladie: 'Rougeole', ageJours: 270, contact: '9 mois' },
  { code: 'VAA', nom: 'VAA', maladie: 'Fièvre jaune', ageJours: 270, contact: '9 mois' },
];

export const CONTACTS = ['Naissance', '6 semaines', '10 semaines', '14 semaines', '9 mois'];

/** Délai de tolérance avant qu'une dose due soit considérée « en retard ». */
const TOLERANCE_JOURS = 28;

export interface DoseRecue {
  date: string;
  agent: string;
}

export interface Enfant {
  id: string;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M';
  dateNaissance: string;
  tuteur: string;
  telephone: string;
  aire: string;
  recues: Record<string, DoseRecue>;
}

export type EtatDose = 'recue' | 'due' | 'retard' | 'a-venir';
export type StatutVaccinal = 'Complet' | 'À jour' | 'En retard';

const AGENTS = ['Patrick LUKUSA', 'Junior KASONGO', 'Grâce TSHIMANGA'];

/** Construit les doses reçues pour les contacts indiqués (dates proches de l'âge recommandé). */
function doses(naissance: string, contacts: string[], decalage = 1): Record<string, DoseRecue> {
  const r: Record<string, DoseRecue> = {};
  CALENDRIER.filter(d => contacts.includes(d.contact)).forEach((d, i) => {
    r[d.code] = { date: iso(ms(naissance) + (d.ageJours + decalage) * JOUR), agent: AGENTS[(i + decalage) % AGENTS.length] };
  });
  return r;
}

const [N, S6, S10, S14, M9] = CONTACTS;

export const ENFANTS: Enfant[] = [
  { id: 'ENF-0231', prenom: 'Josué', nom: 'KALALA', sexe: 'M', dateNaissance: '2026-10-02', tuteur: 'Mireille KALALA', telephone: '+243 81 556 2201', aire: 'AS Camp Tshatshi', recues: doses('2026-10-02', [N]) },
  { id: 'ENF-0228', prenom: 'Gloire', nom: 'MUKENDI', sexe: 'F', dateNaissance: '2026-08-25', tuteur: 'Josée MUKENDI', telephone: '+243 85 120 7788', aire: 'AS Kokolo', recues: doses('2026-08-25', [N, S6], 2) },
  { id: 'ENF-0219', prenom: 'Christ', nom: 'NSIMBA', sexe: 'M', dateNaissance: '2026-07-01', tuteur: 'Nadine NSIMBA', telephone: '+243 97 330 1456', aire: 'AS Camp Tshatshi', recues: doses('2026-07-01', [N, S6, S10]) },
  { id: 'ENF-0211', prenom: 'Prince', nom: 'ILUNGA', sexe: 'M', dateNaissance: '2026-06-10', tuteur: 'Sarah ILUNGA', telephone: '+243 81 900 4471', aire: 'AS Kokolo', recues: doses('2026-06-10', [N, S6, S10, S14], 3) },
  { id: 'ENF-0204', prenom: 'Merveille', nom: 'NGOY', sexe: 'F', dateNaissance: '2026-05-01', tuteur: 'Clarisse NGOY', telephone: '+243 99 214 7730', aire: 'AS Kokolo', recues: doses('2026-05-01', [N, S6, S10]) },
  { id: 'ENF-0197', prenom: 'Rachidi', nom: 'KASONGO', sexe: 'M', dateNaissance: '2026-03-15', tuteur: 'Aïcha KASONGO', telephone: '+243 82 641 0092', aire: 'AS Camp Tshatshi', recues: doses('2026-03-15', [N, S6], 2) },
  { id: 'ENF-0188', prenom: 'Plamedie', nom: 'MAKIESE', sexe: 'F', dateNaissance: '2026-02-10', tuteur: 'Chantal MAKIESE', telephone: '+243 97 115 2083', aire: 'AS Camp Tshatshi', recues: doses('2026-02-10', [N, S6, S10, S14]) },
  { id: 'ENF-0172', prenom: 'Divine-Grâce', nom: 'LUBAKI', sexe: 'F', dateNaissance: '2025-12-20', tuteur: 'Ruth LUBAKI', telephone: '+243 81 773 9015', aire: 'AS Kokolo', recues: doses('2025-12-20', [N, S6, S10, S14], 2) },
  { id: 'ENF-0159', prenom: 'Exaucé', nom: 'MBUYI', sexe: 'M', dateNaissance: '2025-11-02', tuteur: 'Esther MBUYI', telephone: '+243 99 802 6614', aire: 'AS Camp Tshatshi', recues: doses('2025-11-02', [N, S6, S10, S14, M9]) },
  { id: 'ENF-0141', prenom: 'Bénédicte', nom: 'TSHIBANGU', sexe: 'F', dateNaissance: '2025-09-15', tuteur: 'Marie TSHIBANGU', telephone: '+243 82 555 0193', aire: 'AS Kokolo', recues: doses('2025-09-15', [N, S6, S10, S14, M9], 3) },
];

// --- Calculs -------------------------------------------------------------------

export function ageJours(e: Enfant, ref = AUJOURDHUI): number {
  return Math.floor((ms(ref) - ms(e.dateNaissance)) / JOUR);
}

export function ageLisible(e: Enfant): string {
  const j = ageJours(e);
  if (j < 60) return `${Math.floor(j / 7)} sem.`;
  const mois = Math.floor(j / 30.44);
  return mois < 24 ? `${mois} mois` : `${Math.floor(mois / 12)} ans`;
}

export function etatDose(e: Enfant, d: Dose): EtatDose {
  if (e.recues[d.code]) return 'recue';
  const age = ageJours(e);
  if (age < d.ageJours) return 'a-venir';
  return age > d.ageJours + TOLERANCE_JOURS ? 'retard' : 'due';
}

export function statutVaccinal(e: Enfant): StatutVaccinal {
  const etats = CALENDRIER.map(d => etatDose(e, d));
  if (etats.every(s => s === 'recue')) return 'Complet';
  return etats.includes('retard') ? 'En retard' : 'À jour';
}

/** Prochaine dose à administrer et sa date (aujourd'hui si elle est déjà due). */
export function prochaineDose(e: Enfant): { contact: string; date: string; enRetard: boolean; aFaire: boolean } | null {
  const d = CALENDRIER.find(x => !e.recues[x.code]);
  if (!d) return null;
  const prevue = iso(ms(e.dateNaissance) + d.ageJours * JOUR);
  const etat = etatDose(e, d);
  return { contact: d.contact, date: prevue, enRetard: etat === 'retard', aFaire: etat === 'due' };
}

/** État d'un contact (groupe de doses) pour la frise de progression. */
export function etatContact(e: Enfant, contact: string): EtatDose {
  const etats = CALENDRIER.filter(d => d.contact === contact).map(d => etatDose(e, d));
  if (etats.every(s => s === 'recue')) return 'recue';
  if (etats.includes('retard')) return 'retard';
  if (etats.includes('due')) return 'due';
  return 'a-venir';
}

/** Couverture par antigène, parmi les enfants en âge de l'avoir reçu. */
export function couverture(enfants: Enfant[], code: string): { pct: number; recus: number; eligibles: number } {
  const d = CALENDRIER.find(x => x.code === code)!;
  const eligibles = enfants.filter(e => ageJours(e) >= d.ageJours + TOLERANCE_JOURS);
  const recus = eligibles.filter(e => e.recues[code]).length;
  return { pct: eligibles.length ? Math.round((recus / eligibles.length) * 100) : 0, recus, eligibles: eligibles.length };
}

export function dosesDuMois(enfants: Enfant[], mois = AUJOURDHUI.slice(0, 7)): number {
  return enfants.reduce((n, e) => n + Object.values(e.recues).filter(r => r.date.startsWith(mois)).length, 0);
}
