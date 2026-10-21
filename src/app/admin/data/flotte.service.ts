import { Injectable, computed, signal } from '@angular/core';
import { Empreinte, hacherMotDePasse, verifierMotDePasse } from '../../shared/mot-de-passe';

export type StatutAmbulance = 'Disponible' | 'En mission' | 'Maintenance' | 'Hors service';
export type TypeAmbulance = 'Type A — transport' | 'Type B — soins d’urgence' | 'Type C — réanimation';
export type StatutChauffeur = 'Actif' | 'Suspendu';

export interface Ambulance {
  id: string;
  immatriculation: string;
  modele: string;
  annee: number;
  type: TypeAmbulance;
  statut: StatutAmbulance;
  chauffeurId: string | null;
  /** Infirmier ou secouriste embarqué. */
  infirmier: string;
  kilometrage: number;
  /** Niveau de carburant, en %. */
  carburant: number;
  prochaineRevision: string;
  /** Alerte en cours de prise en charge (page Urgences) ; null hors mission. */
  alerteId: string | null;
}

export interface Chauffeur {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  postnom: string;
  telephone: string;
  /** Photo d'identité (facultative) : sinon les initiales s'affichent. */
  photo?: string;
  permis: string;
  permisExpire: string;
  statut: StatutChauffeur;
  missionsMois: number;
  /** Empreinte du mot de passe de l'application ambulance (jamais le mot de passe lui-même). */
  empreinte?: Empreinte;
  /** Le mot de passe temporaire devra être changé à la première connexion. */
  doitChangerMotDePasse: boolean;
  derniereConnexion: string | null;
}

/** Mot de passe des chauffeurs de démonstration (à supprimer avec les données fictives). */
export const MOT_DE_PASSE_DEMO = 'Ambulance@2026';

export type ResultatConnexion = { chauffeur: Chauffeur } | { erreur: string };

/** Données fictives — photos libres de droits (Pexels), personnes sans lien avec le projet. */
const CHAUFFEURS_INITIAUX: Omit<Chauffeur, 'doitChangerMotDePasse' | 'derniereConnexion'>[] = [
  { id: 'CH-001', matricule: 'CHF-0011', prenom: 'Bienvenu', nom: 'LEMA', postnom: 'NDONGALA', telephone: '+243 81 556 2201', photo: 'images/chauffeurs/chauffeur-1.webp', permis: 'KIN-C-448120', permisExpire: '2028-03-14', statut: 'Actif', missionsMois: 23 },
  { id: 'CH-002', matricule: 'CHF-0014', prenom: 'Dieudonné', nom: 'MPIA', postnom: 'BOKETSHU', telephone: '+243 99 812 4410', photo: 'images/chauffeurs/chauffeur-2.webp', permis: 'KIN-C-390877', permisExpire: '2026-11-30', statut: 'Actif', missionsMois: 19 },
  { id: 'CH-003', matricule: 'CHF-0017', prenom: 'Jonathan', nom: 'TSHALA', postnom: 'MULUMBA', telephone: '+243 82 304 7756', photo: 'images/chauffeurs/chauffeur-3.webp', permis: 'KIN-C-512043', permisExpire: '2029-07-02', statut: 'Actif', missionsMois: 15 },
  { id: 'CH-004', matricule: 'CHF-0021', prenom: 'Fabrice', nom: 'KALOMBO', postnom: 'NGOY', telephone: '+243 97 650 1189', photo: 'images/chauffeurs/chauffeur-4.webp', permis: 'KIN-C-287615', permisExpire: '2027-01-18', statut: 'Actif', missionsMois: 21 },
  { id: 'CH-005', matricule: 'CHF-0025', prenom: 'Serge', nom: 'MATONDO', postnom: 'NKIAMBI', telephone: '+243 85 471 3392', photo: 'images/chauffeurs/chauffeur-5.webp', permis: 'KIN-C-198402', permisExpire: '2026-09-05', statut: 'Suspendu', missionsMois: 0 },
  { id: 'CH-006', matricule: 'CHF-0028', prenom: 'Patience', nom: 'MUANDA', postnom: 'LUZOLO', telephone: '+243 81 228 9064', photo: 'images/chauffeurs/chauffeur-6.webp', permis: 'KIN-C-603318', permisExpire: '2030-02-11', statut: 'Actif', missionsMois: 8 },
];

const AMBULANCES_INITIALES: Ambulance[] = [
  { id: 'AMB-02', immatriculation: 'GR-4521-KN', modele: 'Toyota Land Cruiser 78', annee: 2022, type: 'Type B — soins d’urgence', statut: 'En mission', chauffeurId: 'CH-001', infirmier: 'Inf. P. Nkulu', kilometrage: 48210, carburant: 72, prochaineRevision: '2026-12-15', alerteId: 'URG-0192' },
  { id: 'AMB-04', immatriculation: 'GR-3307-KN', modele: 'Toyota HiAce', annee: 2021, type: 'Type A — transport', statut: 'En mission', chauffeurId: 'CH-002', infirmier: 'Inf. A. Kasongo', kilometrage: 76540, carburant: 45, prochaineRevision: '2026-11-02', alerteId: 'URG-0190' },
  { id: 'AMB-05', immatriculation: 'GR-6610-KN', modele: 'Toyota Land Cruiser 78', annee: 2024, type: 'Type C — réanimation', statut: 'Disponible', chauffeurId: 'CH-003', infirmier: 'Inf. C. Mbombo', kilometrage: 12980, carburant: 90, prochaineRevision: '2027-03-01', alerteId: null },
  { id: 'AMB-07', immatriculation: 'GR-1184-KN', modele: 'Nissan Patrol', annee: 2020, type: 'Type B — soins d’urgence', statut: 'Disponible', chauffeurId: 'CH-004', infirmier: 'Inf. L. Ngandu', kilometrage: 102330, carburant: 64, prochaineRevision: '2026-10-28', alerteId: null },
  { id: 'AMB-09', immatriculation: 'GR-2275-KN', modele: 'Toyota HiAce', annee: 2019, type: 'Type A — transport', statut: 'Maintenance', chauffeurId: null, infirmier: '', kilometrage: 154870, carburant: 20, prochaineRevision: '2026-10-10', alerteId: null },
];

/**
 * Flotte d'ambulances et chauffeurs, gardée en mémoire pendant la session (maquette sans serveur).
 * Partagée par les pages Ambulances, Chauffeurs et Urgences.
 */
@Injectable({ providedIn: 'root' })
export class FlotteService {
  readonly ambulances = signal<Ambulance[]>(AMBULANCES_INITIALES);
  readonly chauffeurs = signal<Chauffeur[]>(
    CHAUFFEURS_INITIAUX.map(c => ({ ...c, doitChangerMotDePasse: false, derniereConnexion: null })),
  );

  /** Empreintes des comptes de démonstration, calculées une fois au démarrage. */
  private pret = Promise.all(this.chauffeurs().map(async c => ({ id: c.id, empreinte: await hacherMotDePasse(MOT_DE_PASSE_DEMO) })))
    .then(liste => this.chauffeurs.update(cs => cs.map(c => ({ ...c, empreinte: liste.find(l => l.id === c.id)?.empreinte ?? c.empreinte }))));

  /** Chauffeur → ambulance affectée. */
  readonly affectations = computed(() => new Map(
    this.ambulances().filter(a => a.chauffeurId).map(a => [a.chauffeurId!, a] as const),
  ));

  chauffeur(id: string | null): Chauffeur | undefined {
    return id ? this.chauffeurs().find(c => c.id === id) : undefined;
  }

  /** « Inf. P. Nkulu · B. LEMA » : équipage affiché sur la carte des urgences. */
  equipage(a: Ambulance): string {
    const c = this.chauffeur(a.chauffeurId);
    return [a.infirmier, c ? `${c.prenom.charAt(0)}. ${c.nom}` : ''].filter(Boolean).join(' · ');
  }

  // --- Ambulances -----------------------------------------------------------------

  ajouterAmbulance(a: Omit<Ambulance, 'id' | 'statut' | 'alerteId'>): Ambulance {
    const max = this.ambulances().reduce((m, x) => Math.max(m, parseInt(x.id.split('-')[1], 10) || 0), 0);
    const nouvelle: Ambulance = { ...a, id: `AMB-${String(max + 1).padStart(2, '0')}`, statut: 'Disponible', alerteId: null };
    this.ambulances.update(liste => [...liste, nouvelle]);
    return nouvelle;
  }

  changerStatut(id: string, statut: Exclude<StatutAmbulance, 'En mission'>): void {
    this.majAmbulance(id, a => a.statut === 'En mission' ? a : { ...a, statut });
  }

  /** Un chauffeur ne conduit qu'une ambulance : il est retiré de la précédente. */
  affecterChauffeur(ambulanceId: string, chauffeurId: string | null): void {
    this.ambulances.update(liste => liste.map(a => {
      if (a.id === ambulanceId) return { ...a, chauffeurId };
      if (chauffeurId && a.chauffeurId === chauffeurId) return { ...a, chauffeurId: null };
      return a;
    }));
  }

  /** Envoi d'une ambulance sur une alerte (ou fin de mission avec null). */
  engager(ambulanceId: string, alerteId: string | null): void {
    this.majAmbulance(ambulanceId, a => ({ ...a, alerteId, statut: alerteId ? 'En mission' : 'Disponible' }));
  }

  /** Ambulance prête à partir : disponible, avec un chauffeur actif. */
  premiereDisponible(): Ambulance | undefined {
    return this.ambulances().find(a => a.statut === 'Disponible' && this.chauffeur(a.chauffeurId)?.statut === 'Actif');
  }

  // --- Chauffeurs -----------------------------------------------------------------

  /** Matricule attribué au prochain chauffeur : c'est son identifiant de connexion. */
  prochainMatricule(): string {
    const max = this.chauffeurs().reduce((m, x) => Math.max(m, parseInt(x.matricule.split('-')[1], 10) || 0), 0);
    return `CHF-${String(max + 1).padStart(4, '0')}`;
  }

  async ajouterChauffeur(
    c: Omit<Chauffeur, 'id' | 'matricule' | 'statut' | 'missionsMois' | 'empreinte' | 'derniereConnexion'>,
    motDePasse: string,
  ): Promise<Chauffeur> {
    const nouvel: Chauffeur = {
      ...c,
      id: `CH-${String(this.chauffeurs().length + 1).padStart(3, '0')}`,
      matricule: this.prochainMatricule(),
      statut: 'Actif',
      missionsMois: 0,
      empreinte: await hacherMotDePasse(motDePasse),
      derniereConnexion: null,
    };
    this.chauffeurs.update(liste => [nouvel, ...liste]);
    return nouvel;
  }

  async definirMotDePasse(id: string, motDePasse: string, doitChanger: boolean): Promise<void> {
    const empreinte = await hacherMotDePasse(motDePasse);
    this.chauffeurs.update(liste => liste.map(c => c.id === id ? { ...c, empreinte, doitChangerMotDePasse: doitChanger } : c));
  }

  /** Connexion à l'application ambulance avec le matricule et le mot de passe. */
  async connecter(matricule: string, motDePasse: string): Promise<ResultatConnexion> {
    await this.pret;
    const m = matricule.trim().toUpperCase();
    const c = this.chauffeurs().find(x => x.matricule === m);
    // Message identique que le matricule existe ou non : on ne révèle pas les comptes.
    const refus = { erreur: 'Matricule ou mot de passe incorrect.' };
    if (!c?.empreinte || !(await verifierMotDePasse(motDePasse, c.empreinte))) return refus;
    if (c.statut === 'Suspendu') return { erreur: 'Votre compte est suspendu. Contactez le superviseur des secours.' };

    const maintenant = new Date().toISOString().slice(0, 16).replace('T', ' ');
    this.chauffeurs.update(liste => liste.map(x => x.id === c.id ? { ...x, derniereConnexion: maintenant } : x));
    return { chauffeur: this.chauffeur(c.id)! };
  }

  /** Un chauffeur suspendu est retiré de son ambulance (sauf en mission). */
  basculerChauffeur(id: string): void {
    const c = this.chauffeur(id);
    if (!c) return;
    const statut: StatutChauffeur = c.statut === 'Actif' ? 'Suspendu' : 'Actif';
    this.chauffeurs.update(liste => liste.map(x => x.id === id ? { ...x, statut } : x));
    const amb = this.affectations().get(id);
    if (statut === 'Suspendu' && amb && amb.statut !== 'En mission') this.affecterChauffeur(amb.id, null);
  }

  private majAmbulance(id: string, f: (a: Ambulance) => Ambulance): void {
    this.ambulances.update(liste => liste.map(a => a.id === id ? f(a) : a));
  }
}

/** Jours restants avant une date AAAA-MM-JJ (négatif si dépassée). */
export function joursAvant(iso: string): number {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + 'T00:00:00').getTime() - aujourdhui.getTime()) / 86_400_000);
}
