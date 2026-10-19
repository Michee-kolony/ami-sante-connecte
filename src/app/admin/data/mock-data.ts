// Données fictives pour la maquette statique — aucune donnée réelle.

export type DossierStatut = 'Brouillon' | 'Actif' | 'Transféré' | 'Clôturé';
export type SyncState = 'synchronisé' | 'en attente' | 'conflit';

export interface Patiente {
  id: string;
  nom: string;
  postnom: string;
  prenom: string;
  /** Photo de profil (facultative) : sinon les initiales s'affichent. */
  photo?: string;
  age: number;
  telephone: string;
  quartier: string;
  commune: string;
  ddr: string | null;
  ddrFiabilite: 'Fiable' | 'Incertaine' | 'Inconnue';
  ageGestationnel: string;
  dpa: string;
  dpaMethode: 'DDR' | 'Échographie' | 'Examen clinique';
  risque: boolean;
  prochainRdv: string | null;
  statut: DossierStatut;
  sync: SyncState;
  cpnCount: number;
  creeLe: string;
}

export const STRUCTURE = {
  nom: 'Hôpital Militaire de la Garde Républicaine',
  site: 'Camp Colonel Tshatshi',
  zone: 'Zone de Santé Militaire Kokolo',
};

export const UTILISATEUR = {
  nom: 'Inf. Grâce Mbuyi',
  initiales: 'GM',
  role: 'Sage-femme CPN',
};

export const PATIENTES: Patiente[] = [
  {
    id: 'AMI-2026-000142', nom: 'KABEYA', postnom: 'MUJINGA', prenom: 'Esther', photo: 'images/patientes/patiente-3.webp', age: 27,
    telephone: '+243 81 234 5678', quartier: 'Kingabwa', commune: 'Limete',
    ddr: '2026-05-04', ddrFiabilite: 'Fiable', ageGestationnel: '23 SA + 6 j', dpa: '2027-02-08',
    dpaMethode: 'DDR', risque: false, prochainRdv: '2026-10-22', statut: 'Actif', sync: 'synchronisé',
    cpnCount: 3, creeLe: '2026-07-02',
  },
  {
    id: 'AMI-2026-000141', nom: 'MBALA', postnom: 'NSIMBA', prenom: 'Ruth', photo: 'images/patientes/patiente-1.webp', age: 19,
    telephone: '+243 99 876 1122', quartier: 'Camp Tshatshi', commune: 'Ngaliema',
    ddr: null, ddrFiabilite: 'Inconnue', ageGestationnel: '16 SA (clinique)', dpa: '2027-03-29',
    dpaMethode: 'Examen clinique', risque: true, prochainRdv: '2026-10-20', statut: 'Actif', sync: 'synchronisé',
    cpnCount: 1, creeLe: '2026-09-29',
  },
  {
    id: 'AMI-2026-000140', nom: 'TSHIBANDA', postnom: 'KAPINGA', prenom: 'Marie', photo: 'images/patientes/patiente-6.webp', age: 34,
    telephone: '+243 82 555 0193', quartier: 'Binza Pigeon', commune: 'Ngaliema',
    ddr: '2026-03-15', ddrFiabilite: 'Incertaine', ageGestationnel: '31 SA + 0 j', dpa: '2026-12-20',
    dpaMethode: 'Échographie', risque: true, prochainRdv: '2026-10-15', statut: 'Actif', sync: 'conflit',
    cpnCount: 4, creeLe: '2026-05-11',
  },
  {
    id: 'AMI-LOC-7F3A2C', nom: 'NGOMA', postnom: 'LUSAMBA', prenom: 'Divine', photo: 'images/patientes/patiente-2.webp', age: 22,
    telephone: '+243 97 410 2290', quartier: 'Kokolo', commune: 'Lingwala',
    ddr: '2026-08-10', ddrFiabilite: 'Fiable', ageGestationnel: '10 SA + 0 j', dpa: '2027-05-17',
    dpaMethode: 'DDR', risque: false, prochainRdv: '2026-11-16', statut: 'Brouillon', sync: 'en attente',
    cpnCount: 1, creeLe: '2026-10-18',
  },
  {
    id: 'AMI-2026-000138', nom: 'ILUNGA', postnom: 'MWAMBA', prenom: 'Sarah', photo: 'images/patientes/patiente-4.webp', age: 29,
    telephone: '+243 81 900 4471', quartier: 'Kauka', commune: 'Kalamu',
    ddr: '2026-02-01', ddrFiabilite: 'Fiable', ageGestationnel: '37 SA + 1 j', dpa: '2026-11-08',
    dpaMethode: 'DDR', risque: false, prochainRdv: '2026-10-25', statut: 'Actif', sync: 'synchronisé',
    cpnCount: 4, creeLe: '2026-04-03',
  },
  {
    id: 'AMI-2026-000131', nom: 'MUKENDI', postnom: 'BIAYA', prenom: 'Josée', photo: 'images/patientes/patiente-5.webp', age: 31,
    telephone: '+243 85 120 7788', quartier: 'Matonge', commune: 'Kalamu',
    ddr: '2026-01-20', ddrFiabilite: 'Fiable', ageGestationnel: '—', dpa: '2026-10-27',
    dpaMethode: 'DDR', risque: false, prochainRdv: null, statut: 'Transféré', sync: 'synchronisé',
    cpnCount: 3, creeLe: '2026-03-14',
  },
];

export interface RendezVous {
  patienteId: string;
  patiente: string;
  date: string;
  heure: string;
  type: string;
  canal: 'SMS' | 'Appel' | 'WhatsApp' | 'Aucun';
  consentement: boolean;
  statut: 'Prévu' | 'Rappel envoyé' | 'Manqué' | 'Honoré';
}

export const RENDEZ_VOUS: RendezVous[] = [
  { patienteId: 'AMI-2026-000140', patiente: 'Marie TSHIBANDA', date: '2026-10-15', heure: '09:00', type: 'CPN 5', canal: 'SMS', consentement: true, statut: 'Manqué' },
  { patienteId: 'AMI-2026-000141', patiente: 'Ruth MBALA', date: '2026-10-20', heure: '08:30', type: 'CPN 2', canal: 'Appel', consentement: true, statut: 'Rappel envoyé' },
  { patienteId: 'AMI-2026-000142', patiente: 'Esther KABEYA', date: '2026-10-22', heure: '10:00', type: 'CPN 4', canal: 'WhatsApp', consentement: true, statut: 'Prévu' },
  { patienteId: 'AMI-2026-000138', patiente: 'Sarah ILUNGA', date: '2026-10-25', heure: '09:30', type: 'CPN 5', canal: 'Aucun', consentement: false, statut: 'Prévu' },
  { patienteId: 'AMI-LOC-7F3A2C', patiente: 'Divine NGOMA', date: '2026-11-16', heure: '11:00', type: 'CPN 2', canal: 'SMS', consentement: true, statut: 'Prévu' },
  { patienteId: 'AMI-2026-000142', patiente: 'Esther KABEYA', date: '2026-09-24', heure: '10:00', type: 'CPN 3', canal: 'WhatsApp', consentement: true, statut: 'Honoré' },
];

export interface AuditEntry {
  date: string;
  auteur: string;
  role: string;
  action: string;
  cible: string;
  detail: string;
  type: 'création' | 'modification' | 'correction' | 'consultation' | 'connexion' | 'refus' | 'fusion' | 'export';
}

export const AUDIT: AuditEntry[] = [
  { date: '2026-10-18 09:42', auteur: 'Inf. Grâce Mbuyi', role: 'Sage-femme CPN', action: 'Création de dossier (hors connexion)', cible: 'AMI-LOC-7F3A2C', detail: 'Identifiant local attribué, en attente de synchronisation', type: 'création' },
  { date: '2026-10-18 09:15', auteur: 'J. Kalala', role: 'Agent d’accueil', action: 'Accès refusé', cible: 'AMI-2026-000141', detail: 'Tentative d’ouverture du champ « Facteurs de risque »', type: 'refus' },
  { date: '2026-10-17 16:03', auteur: 'Dr P. Lukusa', role: 'Superviseur', action: 'Correction d’identité', cible: 'AMI-2026-000140', detail: 'Postnom « KAPINGHA » → « KAPINGA » · Motif : erreur de saisie confirmée sur pièce', type: 'correction' },
  { date: '2026-10-17 14:20', auteur: 'Dr P. Lukusa', role: 'Superviseur', action: 'Doublon résolu : personnes différentes', cible: 'AMI-2026-000139 / 000135', detail: 'Même téléphone (partagé), dates de naissance distinctes', type: 'fusion' },
  { date: '2026-10-17 11:48', auteur: 'Inf. Grâce Mbuyi', role: 'Sage-femme CPN', action: 'Correction DPA', cible: 'AMI-2026-000140', detail: '2026-12-20 (DDR) → 2026-12-20 (écho) · Justification : échographie T1', type: 'modification' },
  { date: '2026-10-17 08:01', auteur: 'Inf. Grâce Mbuyi', role: 'Sage-femme CPN', action: 'Connexion', cible: 'Session', detail: 'Appareil approuvé TAB-CPN-02', type: 'connexion' },
  { date: '2026-10-16 15:30', auteur: 'A. Mavungu', role: 'Analyste', action: 'Export nominatif bloqué', cible: 'Rapport CPN septembre', detail: 'Autorisation d’export nominatif absente', type: 'export' },
];

export interface SyncItem {
  operationId: string;
  fiche: string;
  action: string;
  date: string;
  etat: SyncState;
}

export const SYNC_QUEUE: SyncItem[] = [
  { operationId: 'op-7f3a2c-01', fiche: 'AMI-LOC-7F3A2C', action: 'Création dossier', date: '2026-10-18 09:42', etat: 'en attente' },
  { operationId: 'op-7f3a2c-02', fiche: 'AMI-LOC-7F3A2C', action: 'Programmation RDV', date: '2026-10-18 09:44', etat: 'en attente' },
  { operationId: 'op-140-07', fiche: 'AMI-2026-000140', action: 'Modification téléphone', date: '2026-10-17 17:10', etat: 'conflit' },
];

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Patientes (femmes enceintes) et enfants suivis, agrégés par province de résidence. */
export interface EffectifProvince {
  province: string; // identifiant de PROVINCES_RDC (carte-rdc.ts)
  femmes: number;
  enfants: number;
}

export const EFFECTIFS_PROVINCES: EffectifProvince[] = [
  { province: 'kinshasa', femmes: 412, enfants: 286 },
  { province: 'nord-kivu', femmes: 167, enfants: 132 },
  { province: 'haut-katanga', femmes: 156, enfants: 104 },
  { province: 'kongo-central', femmes: 138, enfants: 97 },
  { province: 'sud-kivu', femmes: 121, enfants: 88 },
  { province: 'kasai-oriental', femmes: 87, enfants: 64 },
  { province: 'ituri', femmes: 73, enfants: 61 },
  { province: 'kwilu', femmes: 64, enfants: 41 },
  { province: 'kasai-central', femmes: 58, enfants: 42 },
  { province: 'tshopo', femmes: 54, enfants: 38 },
  { province: 'lualaba', femmes: 47, enfants: 35 },
  { province: 'equateur', femmes: 41, enfants: 30 },
  { province: 'tanganyika', femmes: 30, enfants: 22 },
  { province: 'kasai', femmes: 26, enfants: 19 },
  { province: 'kwango', femmes: 22, enfants: 15 },
  { province: 'lomami', femmes: 21, enfants: 14 },
  { province: 'mai-ndombe', femmes: 18, enfants: 9 },
  { province: 'maniema', femmes: 16, enfants: 10 },
  { province: 'haut-lomami', femmes: 13, enfants: 8 },
  { province: 'sud-ubangi', femmes: 12, enfants: 6 },
  { province: 'haut-uele', femmes: 11, enfants: 7 },
  { province: 'mongala', femmes: 9, enfants: 4 },
  { province: 'tshuapa', femmes: 7, enfants: 2 },
  { province: 'sankuru', femmes: 6, enfants: 3 },
  { province: 'nord-ubangi', femmes: 5, enfants: 3 },
  { province: 'bas-uele', femmes: 0, enfants: 0 },
];
