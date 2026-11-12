import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_ETABLISSEMENTS } from './espace';
import type { Etablissement } from './etablissements.service';

/**
 * Fiche AMI d'un établissement (étapes 1 à 10 du cahier des charges). Copie des référentiels de
 * backend-ami-connecte/config/ficheEtablissement.js : garder les deux fichiers alignés.
 */

export const NIVEAUX_SANITAIRES = ['Central', 'Provincial', 'Zone', 'Aire', 'Prestation'] as const;
export const CATEGORIES = ['HGR', 'HP', 'HN', 'HM', 'CSR', 'CS', 'PS', 'Polyclinique', 'Clinique', 'CM', 'Autre'] as const;
export const STATUTS_ACTUELS = ['Fonctionnelle', 'Fonctionnelle limitée', 'Temporairement fermée', 'Définitivement fermée', 'En construction', 'En réhabilitation'] as const;
export const STATUTS_JURIDIQUES = ['Public', 'Privé lucratif', 'Privé non lucratif', 'Confessionnel', 'Militaire', 'Associatif', 'Autre'] as const;
export const MODES_GESTION = ['Étatique', 'Confessionnelle', 'Privée', 'Associative', 'Communautaire', 'Autre'] as const;
export const ACCESSIBILITE = ['Oui', 'Non', 'Partielle'] as const;
export const ETATS_EQUIPEMENT = ['Bon', 'Moyen', 'Mauvais'] as const;
export const PROFESSIONS = [
  'Médecin généraliste', 'Médecin spécialiste', 'Infirmier', 'Sage-femme', 'Accoucheuse', 'Technicien laboratoire',
  'Pharmacien', 'Technicien vaccination', 'Nutritionniste', 'Administratif', 'Hygiéniste', 'Autre',
] as const;
export const CONTRATS = ['État', 'Contractuel', 'Bénévole', 'Autre'] as const;
export const STATUTS_AGENT = ['Actif', 'En congé', 'En formation', 'En mission', 'Suspendu', 'Sorti'] as const;
export const REGIMES = ['Temps plein', 'Temps partiel'] as const;
export const SOURCES_POPULATION = ['DPS', 'SNIS', 'Recensement', 'Estimation'] as const;
export const SERVICES_SANITAIRES = [
  'CPN', 'Accouchement', 'Vaccination', 'Consultation générale', 'Consultation postnatale', 'Planification familiale',
  'Laboratoire', 'Hospitalisation', 'Chirurgie', 'Urgences', 'Nutrition', 'Pédiatrie', 'Maternité', 'Imagerie', 'Ambulance',
] as const;
export const MODULES_AMI = ['CPN', 'Accouchement', 'Vaccination'] as const;
export const EQUIPEMENTS_COURANTS = ['Table d’accouchement', 'Tensiomètre', 'Réfrigérateur vaccinal', 'Échographe', 'Autoclave', 'Balance pèse-bébé', 'Doppler fœtal', 'Microscope'];
export const STATUTS_CIRCUIT = ['Brouillon', 'En attente de vérification', 'À corriger', 'En attente de validation', 'Validée', 'Active', 'Suspendue', 'Archivée'] as const;
export type StatutCircuit = (typeof STATUTS_CIRCUIT)[number];

/** Statut juridique → secteur affiché dans les listes (même règle que le serveur). */
export const SECTEUR_DU_STATUT: Record<string, string> = {
  Public: 'Public', 'Privé lucratif': 'Privé', 'Privé non lucratif': 'Privé', Confessionnel: 'Confessionnel',
  Militaire: 'Militaire', Associatif: 'ONG', Autre: 'Privé',
};
/** Type de structure → catégorie proposée. */
export const CATEGORIE_DU_TYPE: Record<string, string> = {
  'Hôpital général de référence': 'HGR', 'Hôpital provincial': 'HP', 'Hôpital national': 'HN', 'Hôpital militaire': 'HM',
  'Centre de santé de référence': 'CSR', 'Centre de santé': 'CS', 'Poste de santé': 'PS', Polyclinique: 'Polyclinique',
  Clinique: 'Clinique', 'Centre médical': 'CM', Autre: 'Autre',
};
/** Étape 6 → liste courte des services de la plateforme. */
export const VERS_SERVICES_PLATEFORME: Record<string, string> = {
  CPN: 'CPN', Accouchement: 'Maternité', Maternité: 'Maternité', Vaccination: 'Vaccination', Urgences: 'Urgences',
  Ambulance: 'Ambulance', Pédiatrie: 'Pédiatrie', Laboratoire: 'Laboratoire', Imagerie: 'Imagerie', Chirurgie: 'Chirurgie',
};
/** Coefficients nationaux par défaut (aperçu de l'étape 8 avant le calcul du serveur). */
export const COEFFICIENTS_DEFAUT = [
  { cible: 'FE', indicateur: 'Femmes enceintes attendues', pct: 4 },
  { cible: 'NA', indicateur: 'Naissances attendues', pct: 4 },
  { cible: 'NS', indicateur: 'Nourrissons survivants attendus', pct: 3.49 },
];

/** Champs que le médecin chef peut compléter (true = toute la section). */
export const CHAMPS_CHEF: Record<string, true | string[]> = {
  identification: ['nomUsuel', 'sigle', 'anneeCreation', 'dateOuverture', 'siteWeb'],
  localisation: ['commune', 'quartier', 'reperes', 'distanceBczsKm', 'distanceHgrKm', 'distanceCsrKm', 'tempsDeplacement', 'moyenTransport', 'accessibilitePluies', 'accessibiliteUrgence'],
  organisation: ['proprietaire', 'tutelleAdministrative', 'tutelleTechnique', 'responsableMedical', 'responsableInfirmier', 'responsableAdministratif', 'responsableMaternite', 'joursFonctionnement', 'horaires', 'garde'],
  infrastructures: true, equipements: true, agents: true, effectifsAttendus: true, populations: true, capacites: true,
};

export const ETAPES = [
  { n: 1, titre: 'Identification générale', icone: 'fa-id-card' },
  { n: 2, titre: 'Localisation', icone: 'fa-map-location-dot' },
  { n: 3, titre: 'Statut et organisation', icone: 'fa-scale-balanced' },
  { n: 4, titre: 'Infrastructures et équipements', icone: 'fa-building', facultatif: true },
  { n: 5, titre: 'Ressources humaines', icone: 'fa-users', facultatif: true },
  { n: 6, titre: 'Services et activités', icone: 'fa-stethoscope' },
  { n: 7, titre: 'Population desservie', icone: 'fa-people-roof', facultatif: true },
  { n: 8, titre: 'Populations cibles', icone: 'fa-calculator' },
  { n: 9, titre: 'Capacités opérationnelles', icone: 'fa-gauge-high', facultatif: true },
  { n: 10, titre: 'Validation et activation', icone: 'fa-stamp' },
] as const;

export type OuiNon = 'Oui' | 'Non' | null;
export interface Personne { nom: string; postnom: string; prenom: string; fonction: string; telephone: string }
export interface Fichier { nom: string; url: string | null }
export interface Equipement {
  nom: string; categorie: string; total: number | null; fonctionnels: number | null; enPanne: number | null; horsService: number | null;
  dateAcquisition: string | null; etat: string | null; financement: string; derniereMaintenance: string | null; remplacement: OuiNon;
}
export interface Agent {
  code: string; nom: string; postnom: string; prenom: string; sexe: 'M' | 'F' | null; profession: string; specialite: string;
  qualification: string; numeroOrdre: string; fonction: string; service: string; contrat: string | null; statut: string;
  datePriseFonction: string | null; disponibilite: string; regime: string | null;
}
export interface LigneService {
  service: string; autorise: OuiNon; disponible: OuiNon; fonctionnel: 'Oui' | 'Non' | 'Partiel' | null; personnelQualifie: OuiNon;
  equipement: 'Disponible' | 'Indisponible' | null; joursActivite: number | null; dateVerification: string | null;
}
export interface Population {
  annee: number; village: string; totale: number | null; administrative: number | null; frequentant: number | null; menages: number | null;
  urbaine: number | null; rurale: number | null; hommes: number | null; femmes: number | null;
  tranches: { moins1: number | null; moins5: number | null; de5a14: number | null; de15a49: number | null; plus50: number | null };
  source: string | null; dateCollecte: string | null; dateValidation: string | null; autorite: string; methode: string;
  saisiPar?: { nom: string } | null; saisiLe?: string | null;
}

export interface FicheAmi {
  identification: {
    codeSnis: string; nomUsuel: string; sigle: string; niveauSanitaire: string | null; categorie: string | null;
    anneeCreation: number | null; dateOuverture: string | null; statutActuel: string | null; siteWeb: string;
  };
  localisation: {
    pays: string; territoire: string; commune: string; quartier: string; reperes: string; distanceBczsKm: number | null;
    distanceHgrKm: number | null; distanceCsrKm: number | null; tempsDeplacement: string; moyenTransport: string;
    accessibilitePluies: string | null; accessibiliteUrgence: OuiNon;
  };
  organisation: {
    statutJuridique: string | null; proprietaire: string; modeGestion: string | null; tutelleAdministrative: string; tutelleTechnique: string;
    autorisation: { reference: string; date: string | null; piece?: Fichier | null }; agrement: { numero: string; dateEcheance: string | null };
    responsable: Personne; responsableMedical: Personne; responsableInfirmier: Personne; responsableAdministratif: Personne; responsableMaternite: Personne;
    joursFonctionnement: number | null; horaires: string; garde: { disponible: OuiNon; horaires: string };
  };
  infrastructures: {
    batiments: number | null; salles: { consultation: number | null; cpn: number | null; accouchement: number | null; vaccination: number | null; observation: number | null };
    litsTotal: number | null; litsFonctionnels: number | null; litsMaternite: number | null; blocOperatoire: OuiNon; laboratoire: OuiNon;
    pharmacie: OuiNon; morgue: OuiNon; salleAttente: OuiNon; toilettesTotal: number | null; toilettesFonctionnelles: number | null;
    pointEau: OuiNon; electricite: OuiNon; groupeElectrogene: OuiNon; chaineFroid: OuiNon;
  };
  equipements: Equipement[];
  agents: Agent[];
  effectifsAttendus: { profession: string; nombre: number | null }[];
  services: LigneService[];
  populations: Population[];
  capacites: {
    accueil: number | null; litsFonctionnels: number | null; accouchementsMois: number | null; cpnMois: number | null;
    seancesVaccinationMois: number | null; examensLaboPeriode: number | null; urgencesPeriode: number | null;
    vaccins: OuiNon; medicaments: OuiNon; personnelQualifie: OuiNon; electricite: OuiNon; eau: OuiNon; transportReference: OuiNon; communication: OuiNon;
  };
  historiqueResponsables?: { role: string; ancien: Personne; nouveau: Personne; le: string; par: { nom: string } }[];
  circuit?: Circuit;
  modifications?: { par: { nom: string; type: string }; le: string; sections: string[] }[];
}

export interface Circuit {
  statut: StatutCircuit; anterieur: boolean; auteurs: string[];
  controle: { le: string; erreurs: string[]; avertissements: string[] } | null;
  verification: { par: { nom: string }; nom: string; fonction: string; date: string; resultat: string; observations: string } | null;
  pieces: (Fichier | null)[]; motifsCorrection: string[];
  validation: { par: { nom: string }; nom: string; fonction: string; date: string; statutFinal: string } | null;
  completude: number; qrCode: string | null; activeLe: string | null;
  historique: { de: string | null; vers: string; action: string; motif: string; par: { nom: string }; le: string }[];
}

export interface LigneCible {
  cible: string; indicateur: string; populationBase: number | null; coefficientPct: number; formule: string;
  cibleAnnuelle: number | null; cibleMensuelle: number | null;
  coefficient: { code: string; version: number | null; dateDebut: string | null; validePar: string | null; valideLe: string | null; source: string };
}
export interface LigneCapacite {
  activite: string; service: string; theorique: number | null; operationnelle: number | null; realisees: number | null; besoin: number | null;
  deficit: number | null; prerequisManquants: string[]; alerte: { niveau: 'rouge' | 'orange' | 'vert'; message: string } | null;
}
export interface CalculsFiche {
  completude: number;
  controle: { erreurs: string[]; avertissements: string[] };
  equipements: { lignes: { nom: string; total: number; fonctionnels: number; taux: number | null }[]; total: number; fonctionnels: number; taux: number | null; aRemplacer: number };
  rh: { total: number; sortis: number; parProfession: Record<string, number>; parService: Record<string, number>; disponibles: number; indisponibles: number; ecarts: { profession: string; attendu: number; present: number; ecart: number }[] };
  cibles: { annee: number | null; populationBase: number | null; periode: string; dateCalcul: string; lignes: LigneCible[]; alerte: string };
  capacites: { lignes: LigneCapacite[]; disponibilites: { libelle: string; valeur: OuiNon }[] };
  modulesPrevus: string[];
  modulesActifs: string[] | null;
}
export interface FicheComplete {
  etablissement: Etablissement;
  fiche: FicheAmi | null;
  role: 'comite' | 'chef';
  rattachement: { dps: string; bczs: string };
  calculs: CalculsFiche;
}

const personne = (): Personne => ({ nom: '', postnom: '', prenom: '', fonction: '', telephone: '' });

export function serviceVide(service: string): LigneService {
  return { service, autorise: null, disponible: null, fonctionnel: null, personnelQualifie: null, equipement: null, joursActivite: null, dateVerification: null };
}
export function equipementVide(nom = ''): Equipement {
  return { nom, categorie: '', total: null, fonctionnels: null, enPanne: null, horsService: null, dateAcquisition: null, etat: null, financement: '', derniereMaintenance: null, remplacement: null };
}
export function agentVide(): Agent {
  return {
    code: '', nom: '', postnom: '', prenom: '', sexe: null, profession: '', specialite: '', qualification: '', numeroOrdre: '', fonction: '',
    service: '', contrat: null, statut: 'Actif', datePriseFonction: null, disponibilite: 'Disponible', regime: null,
  };
}
export function populationVide(annee = new Date().getFullYear()): Population {
  return {
    annee, village: '', totale: null, administrative: null, frequentant: null, menages: null, urbaine: null, rurale: null, hommes: null, femmes: null,
    tranches: { moins1: null, moins5: null, de5a14: null, de15a49: null, plus50: null },
    source: null, dateCollecte: null, dateValidation: null, autorite: '', methode: '',
  };
}

/** Fiche vide d'un nouvel établissement (les 15 services de l'étape 6 sont listés). */
export function ficheVide(): FicheAmi {
  return {
    identification: { codeSnis: '', nomUsuel: '', sigle: '', niveauSanitaire: null, categorie: null, anneeCreation: null, dateOuverture: null, statutActuel: 'Fonctionnelle', siteWeb: '' },
    localisation: {
      pays: 'RDC', territoire: '', commune: '', quartier: '', reperes: '', distanceBczsKm: null, distanceHgrKm: null, distanceCsrKm: null,
      tempsDeplacement: '', moyenTransport: '', accessibilitePluies: null, accessibiliteUrgence: null,
    },
    organisation: {
      statutJuridique: null, proprietaire: '', modeGestion: null, tutelleAdministrative: '', tutelleTechnique: '',
      autorisation: { reference: '', date: null }, agrement: { numero: '', dateEcheance: null },
      responsable: personne(), responsableMedical: personne(), responsableInfirmier: personne(), responsableAdministratif: personne(), responsableMaternite: personne(),
      joursFonctionnement: null, horaires: '', garde: { disponible: null, horaires: '' },
    },
    infrastructures: {
      batiments: null, salles: { consultation: null, cpn: null, accouchement: null, vaccination: null, observation: null },
      litsTotal: null, litsFonctionnels: null, litsMaternite: null, blocOperatoire: null, laboratoire: null, pharmacie: null, morgue: null,
      salleAttente: null, toilettesTotal: null, toilettesFonctionnelles: null, pointEau: null, electricite: null, groupeElectrogene: null, chaineFroid: null,
    },
    equipements: [],
    agents: [],
    effectifsAttendus: [],
    services: SERVICES_SANITAIRES.map(serviceVide),
    populations: [],
    capacites: {
      accueil: null, litsFonctionnels: null, accouchementsMois: null, cpnMois: null, seancesVaccinationMois: null, examensLaboPeriode: null,
      urgencesPeriode: null, vaccins: null, medicaments: null, personnelQualifie: null, electricite: null, eau: null, transportReference: null, communication: null,
    },
  };
}

/** Fiche reçue du serveur, complétée par les valeurs vides (sections ou services manquants). */
export function ficheDepuis(f: FicheAmi | null): FicheAmi {
  const vide = ficheVide();
  if (!f) return vide;
  const fusion = <T extends object>(a: T, b: Partial<T> | undefined): T => {
    const r = { ...a } as Record<string, unknown>;
    for (const [k, v] of Object.entries(b ?? {})) {
      const base = r[k];
      r[k] = base && typeof base === 'object' && !Array.isArray(base) && v && typeof v === 'object' && !Array.isArray(v) ? fusion(base as object, v as object) : v ?? base;
    }
    return r as T;
  };
  const services = vide.services.map(s => ({ ...s, ...(f.services ?? []).find(x => x.service === s.service) }));
  return {
    ...f,
    identification: fusion(vide.identification, f.identification),
    localisation: fusion(vide.localisation, f.localisation),
    organisation: fusion(vide.organisation, f.organisation),
    infrastructures: fusion(vide.infrastructures, f.infrastructures),
    capacites: fusion(vide.capacites, f.capacites),
    equipements: (f.equipements ?? []).map(q => fusion(equipementVide(), q)),
    agents: (f.agents ?? []).map(a => fusion(agentVide(), a)),
    effectifsAttendus: f.effectifsAttendus ?? [],
    populations: (f.populations ?? []).map(p => fusion(populationVide(p.annee), p)),
    services,
  };
}

/** Sections saisissables, prêtes à envoyer (sans circuit, historique ni pièces). */
export function sectionsAEnvoyer(f: FicheAmi): Partial<FicheAmi> {
  const { circuit, historiqueResponsables, modifications, ...reste } = f;
  const org = { ...reste.organisation, autorisation: { reference: reste.organisation.autorisation.reference, date: reste.organisation.autorisation.date } };
  return {
    ...reste,
    organisation: org,
    populations: reste.populations.filter(p => p.annee && p.totale != null).map(({ saisiPar, saisiLe, ...p }) => p),
    equipements: reste.equipements.filter(q => q.nom.trim()),
    agents: reste.agents.filter(a => a.nom.trim() && a.profession),
    effectifsAttendus: reste.effectifsAttendus.filter(n => n.profession && n.nombre != null),
  };
}

/** Sections qui ont changé depuis l'instantané (seules celles-ci sont envoyées). */
export function sectionsModifiees(avant: Partial<FicheAmi>, apres: Partial<FicheAmi>): Partial<FicheAmi> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(apres)) {
    if (JSON.stringify(v) !== JSON.stringify((avant as Record<string, unknown>)[k])) r[k] = v;
  }
  return r as Partial<FicheAmi>;
}

/** Sections et champs saisissables par le médecin chef. */
export function filtrerPourChef(s: Partial<FicheAmi>): Partial<FicheAmi> {
  const r: Record<string, unknown> = {};
  for (const [section, valeur] of Object.entries(s)) {
    const droit = CHAMPS_CHEF[section];
    if (!droit) continue;
    r[section] = droit === true ? valeur : Object.fromEntries(Object.entries(valeur as object).filter(([k]) => droit.includes(k)));
  }
  return r as Partial<FicheAmi>;
}

export const nomPersonne = (p?: Partial<Personne> | null) => [p?.prenom, p?.nom, p?.postnom].filter(Boolean).join(' ').trim();

/** Couleur du badge de statut du circuit. */
export function classeStatut(s: string | null | undefined): string {
  switch (s) {
    case 'Active': return 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/30';
    case 'Validée': return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30';
    case 'À corriger': case 'Suspendue': return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30';
    case 'En attente de vérification': case 'En attente de validation': return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30';
    default: return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
  }
}

/**
 * Fiche AMI : comité (/api/comite/etablissements) ou médecin chef (/api/etablissements).
 * Fourni par le composant qui l'utilise, pour lire l'adresse BASE_ETABLISSEMENTS de sa route.
 */
@Injectable()
export class FicheEtablissementService {
  private http = inject(HttpClient);
  private url = inject(BASE_ETABLISSEMENTS);

  obtenir(id: string): Promise<FicheComplete> {
    return firstValueFrom(this.http.get<FicheComplete>(`${this.url}/${id}/fiche`));
  }

  modifier(id: string, fiche: Partial<FicheAmi>): Promise<FicheComplete> {
    return firstValueFrom(this.http.patch<FicheComplete>(`${this.url}/${id}/fiche`, { fiche }));
  }

  /** Comité : soumettre, verifier, valider, activer, suspendre, reactiver, archiver, rouvrir. */
  circuit(id: string, action: string, corps: object = {}): Promise<FicheComplete> {
    return firstValueFrom(this.http.post<FicheComplete>(`${this.url}/${id}/fiche/circuit/${action}`, corps));
  }

  /** Comité : pièce d'autorisation (étape 3) ou pièce justificative de vérification (étape 10). */
  ajouterPiece(id: string, type: 'autorisation' | 'verification', fichier: File): Promise<FicheComplete> {
    const c = new FormData();
    c.append('type', type);
    c.append('piece', fichier);
    return firstValueFrom(this.http.post<FicheComplete>(`${this.url}/${id}/fiche/pieces`, c));
  }

  /** Comité : aires de santé déjà connues d'une zone (suggestions). */
  aires(province: string, zone: string): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${this.url}/aires`, { params: { province, zone } }));
  }
}
