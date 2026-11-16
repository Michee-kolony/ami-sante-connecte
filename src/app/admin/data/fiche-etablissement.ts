import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_ETABLISSEMENTS } from './espace';
import type { Etablissement } from './etablissements.service';

/**
 * Fiche AMI d'un établissement, alignée sur la fiche « Identification générale de la structure ».
 * Les petites listes ci-dessous sont des copies de backend-ami-connecte/config/ficheEtablissement.js
 * et config/catalogueStructure.js (garder les fichiers alignés) ; les longs catalogues (services,
 * personnel, équipements, groupes de population) sont servis par /referentiels/fiche-etablissement.
 *
 * Règle de saisie : chaque information n'est demandée qu'une fois ; ce qui se déduit d'une autre
 * réponse (catégorie d'un centre de santé, adresse, bâtiments hors service, totaux des lits…) est
 * calculé et affiché, jamais ressaisi.
 */

/** Types de structure (§1). */
export const TYPES_STRUCTURE = [
  'Hôpital', 'Centre de santé', 'Centre de santé de référence', 'Clinique', 'Poste de santé', 'Laboratoire', 'Maternité', 'Autre',
] as const;
/** Anciens types → type et catégorie actuels (fiches enregistrées avant la fiche « Identification générale »). */
export const TYPES_ANCIENS: Record<string, { type: string; categorie: string }> = {
  'Hôpital général de référence': { type: 'Hôpital', categorie: 'HGR' }, 'Hôpital provincial': { type: 'Hôpital', categorie: 'HP' },
  'Hôpital national': { type: 'Hôpital', categorie: 'HN' }, 'Hôpital militaire': { type: 'Hôpital', categorie: 'HM' },
  Polyclinique: { type: 'Clinique', categorie: 'Polyclinique' }, 'Centre médical': { type: 'Centre de santé', categorie: 'CM' },
};
/** Catégories possibles par type (§4) : une seule → déduite, jamais demandée. */
export const CATEGORIES_DU_TYPE: Record<string, string[]> = {
  Hôpital: ['HGR', 'HP', 'HS', 'HN', 'HM'], 'Centre de santé': ['CS'], 'Centre de santé de référence': ['CSR'], Clinique: ['Clinique'],
  'Poste de santé': ['PS'], Laboratoire: ['Laboratoire'], Maternité: ['Maternité'], Autre: ['Autre'],
};
export const LIBELLES_CATEGORIE: Record<string, string> = {
  HGR: 'Hôpital général de référence (HGR)', HP: 'Hôpital provincial', HS: 'Hôpital spécialisé', HN: 'Hôpital national',
  HM: 'Hôpital militaire', CS: 'Centre de santé', CSR: 'Centre de santé de référence (CSR)', PS: 'Poste de santé', Clinique: 'Clinique',
  Polyclinique: 'Polyclinique', CM: 'Centre médical', Laboratoire: 'Laboratoire', Maternité: 'Maternité', Autre: 'Autre',
};
/** Statut de fonctionnement (§1) et reprise des anciens libellés. */
export const STATUTS_FONCTIONNEMENT = ['Opérationnel', 'Partiel', 'Temporairement fermé', 'Fermé', 'En construction'] as const;
const STATUTS_ANCIENS: Record<string, string> = {
  Fonctionnelle: 'Opérationnel', 'Fonctionnelle limitée': 'Partiel', 'En réhabilitation': 'Partiel',
  'Temporairement fermée': 'Temporairement fermé', 'Définitivement fermée': 'Fermé',
};
export const STATUTS_JURIDIQUES = ['Public', 'Privé lucratif', 'Privé non lucratif', 'Confessionnel', 'Militaire', 'Associatif', 'Autre'] as const;
/** Régime de gestion / tutelle (§1) : valeur enregistrée et libellé du document. */
export const REGIMES_GESTION = [
  { valeur: 'Étatique', libelle: 'État' }, { valeur: 'Établissement public', libelle: 'Établissement public' }, { valeur: 'Privée', libelle: 'Privé' },
  { valeur: 'Confessionnelle', libelle: 'Confessionnel' }, { valeur: 'Militaire', libelle: 'Militaire' }, { valeur: 'ONG', libelle: 'ONG' },
  { valeur: 'Autre', libelle: 'Autre' },
] as const;
export const SOURCES_CODE = ['SNIS', 'DHIS2', 'DPS', 'Ministère de la Santé', 'Autre'] as const;
export const METHODES_GPS = ['Récepteur GPS', 'Smartphone', 'Carte / imagerie satellite', 'Autre'] as const;
export const SOURCES_POPULATION = ['DPS', 'SNIS', 'Recensement', 'Estimation'] as const;
export const CANAUX_CONTACT = ['Appel', 'SMS', 'E-mail', 'WhatsApp institutionnel', 'Autre'] as const;
export const TITRES_RESPONSABLE = ['Médecin directeur', 'Médecin chef', 'Infirmier titulaire', 'Administrateur gestionnaire', 'Autre'] as const;
export const ETATS_BATIMENT = ['Bon', 'Moyen', 'Mauvais', 'Dangereux'] as const;
export const STABILITES = ['Stable', 'Instable', 'Absente'] as const;
export const CONTINUITES = ['Continue', 'Intermittente', 'Absente'] as const;
export const ROUTES = ['Route asphaltée', 'Route en terre', 'Piste', 'Voie fluviale / lacustre', 'Sentier', 'Autre'] as const;
export const SOURCES_ELECTRICITE = ['Réseau', 'Solaire', 'Groupe électrogène', 'Autre'] as const;
export const MOYENS_REFERENCE = ['Ambulance', 'Véhicule', 'Moto', 'Convention de transport', 'Aucun'] as const;
export const SYSTEMES_RAPPORTAGE = ['DHIS2', 'Registre papier', 'Autre système', 'Aucun'] as const;
export const ETATS_INTRANTS = ['Disponibles', 'Ruptures partielles', 'Rupture totale'] as const;
export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
export const MODULES_AMI = ['CPN', 'Accouchement', 'Vaccination'] as const;
export const STATUTS_CIRCUIT = ['Brouillon', 'En attente de vérification', 'À corriger', 'En attente de validation', 'Validée', 'Active', 'Suspendue', 'Archivée'] as const;
export type StatutCircuit = (typeof STATUTS_CIRCUIT)[number];

/** Statut juridique → secteur affiché dans les listes (même règle que le serveur). */
export const SECTEUR_DU_STATUT: Record<string, string> = {
  Public: 'Public', 'Privé lucratif': 'Privé', 'Privé non lucratif': 'Privé', Confessionnel: 'Confessionnel',
  Militaire: 'Militaire', Associatif: 'ONG', Autre: 'Privé',
};
/** Services → liste courte des services de la plateforme (même table que le serveur). */
export const VERS_SERVICES_PLATEFORME: Record<string, string> = {
  CPN: 'CPN', Accouchement: 'Maternité', 'Salle d’accouchement': 'Maternité', Maternité: 'Maternité', Vaccination: 'Vaccination',
  'Vaccination et PEV': 'Vaccination', Urgences: 'Urgences', 'Urgences médicales': 'Urgences', 'Urgences de première ligne': 'Urgences',
  Ambulance: 'Ambulance', 'Transport et ambulance': 'Ambulance', Pédiatrie: 'Pédiatrie', 'Hospitalisation pédiatrique': 'Pédiatrie',
  Laboratoire: 'Laboratoire', 'Laboratoire de biologie médicale': 'Laboratoire', 'Laboratoire de première ligne': 'Laboratoire',
  Imagerie: 'Imagerie', 'Imagerie médicale': 'Imagerie', Radiologie: 'Imagerie', Échographie: 'Imagerie',
  Chirurgie: 'Chirurgie', 'Chirurgie générale': 'Chirurgie', 'Chirurgie spécialisée': 'Chirurgie', 'Blocs opératoires': 'Chirurgie',
};
/** Coefficients nationaux par défaut (aperçu des cibles avant le calcul du serveur). */
export const COEFFICIENTS_DEFAUT = [
  { cible: 'FE', indicateur: 'Femmes enceintes attendues', pct: 4 },
  { cible: 'AA', indicateur: 'Accouchements attendus', pct: 4 },
  { cible: 'NA', indicateur: 'Naissances vivantes attendues', pct: 4 },
  { cible: 'NS', indicateur: 'Nourrissons survivants attendus', pct: 3.49 },
];

/** Champs que le médecin chef peut compléter (true = toute la section). Copie du serveur. */
export const CHAMPS_CHEF: Record<string, true | string[]> = {
  identification: ['nomUsuel', 'sigle', 'anneeCreation', 'dateOuverture', 'siteWeb'],
  localisation: [
    'commune', 'quartier', 'groupement', 'avenue', 'numero', 'gps', 'reperes', 'distanceBczsKm', 'distanceHgrKm', 'distanceCsrKm',
    'tempsDeplacement', 'moyenTransport', 'accessibilitePluies', 'accessibiliteUrgence',
  ],
  organisation: [
    'proprietaire', 'tutelleAdministrative', 'tutelleTechnique', 'responsableMedical', 'responsableInfirmier', 'responsableAdministratif',
    'responsableMaternite', 'joursFonctionnement', 'horaires', 'garde',
  ],
  contacts: true, responsablesFonctionnels: true, infrastructures: true, equipements: true, agents: true, effectifsAttendus: true,
  effectifs: true, recos: true, personnel: true, populations: true, capacites: true, operationnel: true,
};

/** Étapes du formulaire : les rubriques de la fiche « Identification générale », dans l'ordre. */
export const ETAPES = [
  { n: 1, titre: 'Identification générale', icone: 'fa-id-card' },
  { n: 2, titre: 'Localisation géographique', icone: 'fa-map-location-dot' },
  { n: 3, titre: 'Population cible', icone: 'fa-people-roof', facultatif: true },
  { n: 4, titre: 'Coordonnées et contacts', icone: 'fa-address-book' },
  { n: 5, titre: 'Responsables et organisation', icone: 'fa-user-tie' },
  { n: 6, titre: 'Services et activités', icone: 'fa-stethoscope' },
  { n: 7, titre: 'Infrastructures', icone: 'fa-building', facultatif: true },
  { n: 8, titre: 'Ressources humaines', icone: 'fa-users', facultatif: true },
  { n: 9, titre: 'Équipements et logistique', icone: 'fa-toolbox', facultatif: true },
  { n: 10, titre: 'Informations opérationnelles', icone: 'fa-business-time', facultatif: true },
  { n: 11, titre: 'Validation et activation', icone: 'fa-stamp' },
] as const;
/** Étapes dont une partie des champs est portée par l'établissement (formulaire de la liste). */
export const ETAPES_ETABLISSEMENT = [1, 2, 4];

// --- Catalogue servi par le serveur -------------------------------------------------------------

export interface GroupeCatalogue { titre: string; elements: string[] }
export type Profil = 'hopital' | 'centreSante';
export interface Catalogue {
  groupesPopulation: { cle: string; libelle: string }[];
  periodesCibles: { cle: string; libelle: string; diviseur: number }[];
  services: Record<Profil, GroupeCatalogue[]>;
  libellesService: Record<Profil, Record<string, string>>;
  servicesModule: Record<string, string[]>;
  servicesRenommes: Record<Profil, Record<string, string>>;
  personnel: Record<Profil, GroupeCatalogue[]>;
  equipements: Record<Profil, GroupeCatalogue[]>;
  domainesFonctionnels: string[];
  salles: { cle: string; libelle: string }[];
  unitesLits: string[];
  sourcesEau: string[];
}

/** Profil du catalogue : hôpital (hôpitaux et cliniques) ou centre de santé (les autres types). */
export function profilCatalogue(type: string | null | undefined): Profil {
  const t = TYPES_ANCIENS[type ?? '']?.type ?? type;
  return t === 'Hôpital' || t === 'Clinique' ? 'hopital' : 'centreSante';
}

// --- Modèle ---------------------------------------------------------------------------------------

export type OuiNon = 'Oui' | 'Non' | null;
export interface Personne { nom: string; postnom: string; prenom: string; fonction: string; telephone: string }
export interface Fichier { nom: string; url: string | null }
export interface Periode { debut: string | null; fin: string | null }
export interface Equipement {
  nom: string; categorie: string; total: number | null; fonctionnels: number | null;
  [legacy: string]: unknown;
}
export interface LigneService {
  service: string; existence: OuiNon; disponible: OuiNon; fonctionnel: 'Oui' | 'Non' | 'Partiel' | null; jours: string[]; horaires: string;
  [legacy: string]: unknown;
}
export interface Population {
  annee: number; totale: number | null; source: string | null; tranches: Record<string, number | null>;
  saisiPar?: { nom: string } | null; saisiLe?: string | null;
  [legacy: string]: unknown;
}
export interface ResponsableFonctionnel { domaine: string; nom: string; prenom: string; telephone: string; email: string; debut: string | null; fin: string | null; [legacy: string]: unknown }
export interface ContactService extends Periode { service: string; nom: string; fonction: string; telephone: string; email: string }
export interface UniteLits { unite: string; installes: number | null; operationnels: number | null }

export interface FicheAmi {
  identification: {
    codeSnis: string; codeSnisSource: string | null; codeSnisVerifieLe: string | null; nomUsuel: string; sigle: string;
    anciensNoms: ({ nom: string } & Periode)[]; categorie: string | null; dateOuverture: string | null;
    acteCreation: { numero: string; date: string | null; autorite: string; piece?: Fichier | null };
    statutActuel: string | null; siteWeb: string;
    [legacy: string]: unknown;
  };
  localisation: {
    territoire: string; commune: string; quartier: string; avenue: string; numero: string; reperes: string;
    gps: { precisionM: number | null; date: string | null; methode: string | null };
    [legacy: string]: unknown;
  };
  organisation: {
    statutJuridique: string | null; modeGestion: string | null; responsable: Personne; titreResponsable: string | null; datePriseFonction: string | null;
    [legacy: string]: unknown;
  };
  contacts: { telephoneSecondaire: string; telephoneUrgence: string; canalPrivilegie: string | null; contactsService: ContactService[] };
  responsablesFonctionnels: ResponsableFonctionnel[];
  infrastructures: {
    batiments: number | null; batimentsFonctionnels: number | null; salles: Record<string, number | null>; litsParUnite: UniteLits[];
    eau: { source: string; continuite: string | null; [legacy: string]: unknown }; toilettesFonctionnelles: number | null;
    electriciteDetail: { sources: string[]; heuresParJour: number | null; [legacy: string]: unknown };
    connectivite: { internet: OuiNon; reseauMobile: OuiNon; stabilite: string | null; operateur: string };
    accessibilite: { route: string | null; saisonnalite: string; pmr: OuiNon };
    etatBatiment: { etat: string | null; date: string | null; evaluateur: string };
    [legacy: string]: unknown;
  };
  personnel: { fonction: string; nombre: number | null }[];
  equipements: Equipement[];
  services: LigneService[];
  populations: Population[];
  operationnel: {
    fonctionnement24h: OuiNon; urgences: { disponible: OuiNon; horaires: string }; intrants: { etat: string | null; date: string | null; commentaire: string };
    moyensReference: string[]; systemeRapportage: string[]; numerique: { logiciel: string; [legacy: string]: unknown }; dateDerniereEvaluation: string | null;
    [legacy: string]: unknown;
  };
  historiqueResponsables?: { role: string; ancien: Personne; nouveau: Personne; le: string; par: { nom: string } }[];
  circuit?: Circuit;
  modifications?: { par: { nom: string; type: string }; le: string; sections: string[] }[];
  [legacy: string]: unknown;
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
  cibleAnnuelle: number | null; cibleSemestrielle?: number | null; cibleTrimestrielle?: number | null; cibleMensuelle: number | null;
  coefficient: { code: string; version: number | null; dateDebut: string | null; validePar: string | null; valideLe: string | null; source: string };
}
export interface LigneCapacite {
  activite: string; service: string; theorique: number | null; operationnelle: number | null; realisees: number | null; besoin: number | null;
  deficit: number | null; prerequisManquants: string[]; alerte: { niveau: 'rouge' | 'orange' | 'vert'; message: string } | null;
}
export interface CalculsFiche {
  completude: number;
  champsManquants?: string[];
  controle: { erreurs: string[]; avertissements: string[] };
  equipements: { lignes: { nom: string; total: number; fonctionnels: number; taux: number | null }[]; total: number; fonctionnels: number; taux: number | null; aRemplacer: number };
  rh: { total: number; sortis: number; parProfession: Record<string, number>; parService: Record<string, number>; disponibles: number; indisponibles: number; ecarts: { profession: string; attendu: number; present: number; ecart: number }[] };
  personnel?: { total: number; fonctions: number; parGroupe: { groupe: string; total: number }[] };
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
  return { service, existence: null, disponible: null, fonctionnel: null, jours: [], horaires: '' };
}
export function populationVide(annee = new Date().getFullYear()): Population {
  return { annee, totale: null, source: null, tranches: {} };
}
export function responsableFonctionnelVide(domaine: string): ResponsableFonctionnel {
  return { domaine, nom: '', prenom: '', telephone: '', email: '', debut: null, fin: null };
}

/** Fiche vide d'un nouvel établissement. */
export function ficheVide(): FicheAmi {
  return {
    identification: {
      codeSnis: '', codeSnisSource: null, codeSnisVerifieLe: null, nomUsuel: '', sigle: '', anciensNoms: [], categorie: null,
      dateOuverture: null, acteCreation: { numero: '', date: null, autorite: '' }, statutActuel: 'Opérationnel', siteWeb: '',
    },
    localisation: { territoire: '', commune: '', quartier: '', avenue: '', numero: '', reperes: '', gps: { precisionM: null, date: null, methode: null } },
    organisation: { statutJuridique: null, modeGestion: null, responsable: personne(), titreResponsable: null, datePriseFonction: null },
    contacts: { telephoneSecondaire: '', telephoneUrgence: '', canalPrivilegie: null, contactsService: [] },
    responsablesFonctionnels: [],
    infrastructures: {
      batiments: null, batimentsFonctionnels: null, salles: {}, litsParUnite: [], eau: { source: '', continuite: null }, toilettesFonctionnelles: null,
      electriciteDetail: { sources: [], heuresParJour: null }, connectivite: { internet: null, reseauMobile: null, stabilite: null, operateur: '' },
      accessibilite: { route: null, saisonnalite: '', pmr: null }, etatBatiment: { etat: null, date: null, evaluateur: '' },
    },
    personnel: [],
    equipements: [],
    services: [],
    populations: [],
    operationnel: {
      fonctionnement24h: null, urgences: { disponible: null, horaires: '' }, intrants: { etat: null, date: null, commentaire: '' },
      moyensReference: [], systemeRapportage: [], numerique: { logiciel: '' }, dateDerniereEvaluation: null,
    },
  };
}

/**
 * Fiche reçue du serveur, complétée par les valeurs vides. Les champs hérités des anciennes
 * versions de la fiche sont conservés tels quels (renvoyés sans modification).
 */
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
  const fiche: FicheAmi = {
    ...f,
    identification: fusion(vide.identification, f.identification),
    localisation: fusion(vide.localisation, f.localisation),
    organisation: fusion(vide.organisation, f.organisation),
    contacts: fusion(vide.contacts, f.contacts),
    infrastructures: fusion(vide.infrastructures, f.infrastructures),
    operationnel: fusion(vide.operationnel, f.operationnel),
    responsablesFonctionnels: f.responsablesFonctionnels ?? [],
    personnel: f.personnel ?? [],
    equipements: (f.equipements ?? []).map(q => ({ ...q, categorie: q.categorie ?? '' })),
    services: (f.services ?? []).map(s => fusion(serviceVide(s.service), s)),
    populations: (f.populations ?? []).map(p => fusion(populationVide(p.annee), p)),
  };
  // Anciens libellés du statut : repris sous le libellé de la fiche « Identification générale ».
  const statut = fiche.identification.statutActuel;
  if (statut && STATUTS_ANCIENS[statut]) fiche.identification.statutActuel = STATUTS_ANCIENS[statut];
  // Ancienne saisie libre de la fonction : reprise comme titre quand elle en est un.
  const org = fiche.organisation;
  if (!org.titreResponsable && (TITRES_RESPONSABLE as readonly string[]).includes(org.responsable.fonction)) org.titreResponsable = org.responsable.fonction;
  return fiche;
}

/**
 * Sections saisies par ce formulaire, prêtes à envoyer (sans lignes vides). Les autres sections
 * de la fiche (anciennes versions, volets spécifiques) ne sont jamais renvoyées : elles restent
 * telles quelles. Les pièces jointes (stockage privé) sont conservées par le serveur.
 */
export function sectionsAEnvoyer(f: FicheAmi): Partial<FicheAmi> {
  const { piece, ...acte } = f.identification.acteCreation;
  const { autorisation, agrement, ...organisation } = f.organisation;
  return {
    identification: { ...f.identification, acteCreation: acte, anciensNoms: f.identification.anciensNoms.filter(n => n.nom.trim()) },
    localisation: f.localisation,
    organisation: organisation as FicheAmi['organisation'],
    contacts: { ...f.contacts, contactsService: f.contacts.contactsService.filter(c => c.service.trim()) },
    responsablesFonctionnels: f.responsablesFonctionnels.filter(r => r.nom.trim() || r.prenom.trim() || r.telephone.trim()),
    infrastructures: { ...f.infrastructures, litsParUnite: f.infrastructures.litsParUnite.filter(u => u.unite.trim()) },
    personnel: f.personnel.filter(p => p.nombre != null),
    equipements: f.equipements.filter(q => q.nom.trim() && (q.total != null || q.fonctionnels != null)).map(({ preuve, ...q }) => q),
    services: f.services.filter(s => s.existence || s.fonctionnel),
    populations: f.populations.filter(p => p.annee && p.totale != null).map(({ saisiPar, saisiLe, ...p }) => p),
    operationnel: f.operationnel,
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

/** Adresse détaillée composée (avenue, numéro, quartier / village, commune) : jamais ressaisie. */
export function adresseComposee(loc: Pick<FicheAmi['localisation'], 'avenue' | 'numero' | 'quartier' | 'commune'>): string {
  const rue = [loc.avenue.trim(), loc.numero.trim()].filter(Boolean).join(' n° ');
  return [rue, loc.quartier.trim(), loc.commune.trim()].filter(Boolean).join(', ');
}

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
 * Catalogue de la fiche, chargé une fois par espace : /comite/etablissements/catalogue (jeton du
 * comité) ou /etablissements/catalogue (médecin chef). /referentiels refuse les jetons du comité.
 */
const catalogues = new Map<string, Promise<Catalogue>>();
function chargerCatalogue(http: HttpClient, base: string): Promise<Catalogue> {
  let p = catalogues.get(base);
  if (!p) {
    p = firstValueFrom(http.get<Catalogue>(`${base}/catalogue`)).catch(err => {
      catalogues.delete(base);
      throw err;
    });
    catalogues.set(base, p);
  }
  return p;
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

  /** Comité : pièce jointe (acte de création, autorisation, agrément) ou pièce justificative de vérification. */
  ajouterPiece(id: string, type: 'acteCreation' | 'autorisation' | 'verification', fichier: File): Promise<FicheComplete> {
    const c = new FormData();
    c.append('type', type);
    c.append('piece', fichier);
    return firstValueFrom(this.http.post<FicheComplete>(`${this.url}/${id}/fiche/pieces`, c));
  }

  /** Comité : aires de santé déjà connues d'une zone (suggestions). */
  aires(province: string, zone: string): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${this.url}/aires`, { params: { province, zone } }));
  }

  catalogue(): Promise<Catalogue> {
    return chargerCatalogue(this.http, this.url);
  }
}
