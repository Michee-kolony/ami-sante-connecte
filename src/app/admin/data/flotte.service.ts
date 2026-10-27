import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import { dateHeureChiffres } from './format';
import { PresenceService } from './presence.service';
import { SessionService } from './session.service';

export type StatutAmbulance = 'Disponible' | 'En mission' | 'Maintenance' | 'Hors service';
export type TypeAmbulance = 'Type A — transport' | 'Type B — soins d’urgence' | 'Type C — réanimation';
export type StatutChauffeur = 'Actif' | 'Suspendu';
export type DisponibiliteChauffeur = 'Disponible' | 'Occupé' | 'Suspendu';

/** Libellé affiché : une ambulance en mission est « Occupée ». */
export const LIBELLE_STATUT: Record<StatutAmbulance, string> = {
  'Disponible': 'Disponible', 'En mission': 'Occupée', 'Maintenance': 'Maintenance', 'Hors service': 'Hors service',
};

/** Dernière position GPS envoyée par l'application chauffeur. */
export interface PositionAmbulance {
  lat: number;
  lng: number;
  cap: number | null;
  vitesse: number | null;
  le: string;
}

export interface Ambulance {
  /** Code public (AMB-01). */
  id: string;
  immatriculation: string;
  modele: string;
  annee: number | null;
  type: TypeAmbulance;
  statut: StatutAmbulance;
  chauffeurId: string | null;
  /** Infirmier ou secouriste embarqué. */
  infirmier: string;
  kilometrage: number;
  /** Niveau de carburant, en %. */
  carburant: number;
  prochaineRevision: string;
  /** Urgence en cours (URG-…) ; null hors mission. */
  alerteId: string | null;
  position: PositionAmbulance | null;
}

export interface Chauffeur {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  postnom: string;
  telephone: string;
  photo?: string;
  permis: string;
  permisExpire: string;
  statut: StatutChauffeur;
  missionsMois: number;
  doitChangerMotDePasse: boolean;
  /** Dernière connexion à l'application chauffeur (JJ/MM/AAAA HH:mm). */
  derniereConnexion: string | null;
  /** Urgence en cours (le chauffeur est « Occupé »). */
  mission: string | null;
}

export interface NouveauChauffeur {
  prenom: string;
  nom: string;
  postnom: string;
  telephone: string;
  permis: string;
  permisExpire: string;
  matricule: string;
  motDePasse: string;
  doitChangerMotDePasse: boolean;
  ambulance: string | null;
}

export interface CarteService {
  chauffeur: Chauffeur & { ambulance: { code: string; immatriculation: string; statut: StatutAmbulance } | null };
  emiseLe: string;
  controle: string;
  /** QR code (image PNG en data URL). */
  qr: string;
}

type AmbulanceApi = Omit<Ambulance, 'id' | 'alerteId' | 'chauffeurId' | 'prochaineRevision'> & {
  code: string; urgence: string | null; chauffeurId: string | null; prochaineRevision: string | null;
};
type ChauffeurApi = Omit<Chauffeur, 'derniereConnexion' | 'permis' | 'permisExpire'> & {
  derniereConnexion: string | null; permis?: string; permisExpire: string | null;
};

const versAmbulance = (a: AmbulanceApi): Ambulance => ({
  id: a.code, immatriculation: a.immatriculation, modele: a.modele, annee: a.annee, type: a.type, statut: a.statut,
  chauffeurId: a.chauffeurId ? String(a.chauffeurId) : null, infirmier: a.infirmier, kilometrage: a.kilometrage,
  carburant: a.carburant, prochaineRevision: a.prochaineRevision ?? '', alerteId: a.urgence, position: a.position ?? null,
});

const versChauffeur = (c: ChauffeurApi): Chauffeur => ({
  id: c.id, matricule: c.matricule, prenom: c.prenom, nom: c.nom, postnom: c.postnom, telephone: c.telephone,
  photo: c.photo ?? undefined, permis: c.permis ?? '', permisExpire: c.permisExpire ?? '', statut: c.statut,
  missionsMois: c.missionsMois, doitChangerMotDePasse: c.doitChangerMotDePasse,
  derniereConnexion: c.derniereConnexion ? dateHeureChiffres(c.derniereConnexion) : null, mission: c.mission,
});

/**
 * Flotte d'ambulances et chauffeurs (API /flotte), tenue à jour en temps réel : changements de
 * statut (« flotte:ambulance ») et positions GPS envoyées chaque seconde par l'application
 * chauffeur (« ambulance:position »). Partagée par les pages Ambulances, Chauffeurs et Urgences.
 */
@Injectable({ providedIn: 'root' })
export class FlotteService {
  private http = inject(HttpClient);
  private session = inject(SessionService);
  private presence = inject(PresenceService);
  private url = `${API_URL}/flotte`;

  readonly ambulances = signal<Ambulance[]>([]);
  readonly chauffeurs = signal<Chauffeur[]>([]);
  readonly charge = signal(false);

  /** Chauffeur → ambulance affectée. */
  readonly affectations = computed(() => new Map(
    this.ambulances().filter(a => a.chauffeurId).map(a => [a.chauffeurId!, a] as const),
  ));

  /** Ambulances prêtes à partir. */
  readonly ambulancesDisponibles = computed(() => this.ambulances().filter(a => a.statut === 'Disponible'));

  constructor() {
    effect(() => {
      const connecte = this.session.connecte();
      untracked(() => (connecte ? this.charger().catch(() => {}) : (this.ambulances.set([]), this.chauffeurs.set([]))));
    });
    this.presence.sur<AmbulanceApi>('flotte:ambulance', a => this.remplacerAmbulance(versAmbulance(a)));
    this.presence.sur<PositionAmbulance & { ambulance: string; urgence: string | null }>('ambulance:position', p =>
      this.ambulances.update(liste => liste.map(a => (a.id === p.ambulance
        ? { ...a, position: { lat: p.lat, lng: p.lng, cap: p.cap, vitesse: p.vitesse, le: p.le } }
        : a))));
    this.presence.surConnexion(() => this.session.connecte() && this.charger().catch(() => {}));
  }

  async charger(): Promise<void> {
    const [ambulances, chauffeurs] = await Promise.all([
      firstValueFrom(this.http.get<AmbulanceApi[]>(`${this.url}/ambulances`)),
      firstValueFrom(this.http.get<ChauffeurApi[]>(`${this.url}/chauffeurs`)),
    ]);
    this.ambulances.set(ambulances.map(versAmbulance));
    this.chauffeurs.set(chauffeurs.map(versChauffeur));
    this.charge.set(true);
  }

  chauffeur(id: string | null | undefined): Chauffeur | undefined {
    return id ? this.chauffeurs().find(c => c.id === id) : undefined;
  }

  ambulance(code: string | null | undefined): Ambulance | undefined {
    return code ? this.ambulances().find(a => a.id === code) : undefined;
  }

  /** « Occupé » pendant une mission (ambulance en mission), sinon disponible ou suspendu. */
  disponibilite(c: Chauffeur): DisponibiliteChauffeur {
    if (c.statut === 'Suspendu') return 'Suspendu';
    return c.mission || this.affectations().get(c.id)?.statut === 'En mission' ? 'Occupé' : 'Disponible';
  }

  /** Chauffeur connecté à son application en ce moment. */
  enLigne(c: Chauffeur | undefined): boolean {
    return !!c && this.presence.chauffeursEnLigne().has(c.id);
  }

  /** « Inf. P. Nkulu · B. LEMA » : équipage affiché sur la carte des urgences. */
  equipage(a: Ambulance): string {
    const c = this.chauffeur(a.chauffeurId);
    return [a.infirmier, c ? `${c.prenom.charAt(0)}. ${c.nom}` : ''].filter(Boolean).join(' · ');
  }

  // --- Ambulances -----------------------------------------------------------------

  async ajouterAmbulance(a: Pick<Ambulance, 'immatriculation' | 'modele' | 'annee' | 'type' | 'infirmier' | 'kilometrage' | 'prochaineRevision'> & { chauffeurId: string | null }): Promise<Ambulance> {
    const r = versAmbulance(await firstValueFrom(this.http.post<AmbulanceApi>(`${this.url}/ambulances`, {
      ...a, prochaineRevision: a.prochaineRevision || null,
    })));
    this.remplacerAmbulance(r);
    await this.chargerChauffeurs();
    return r;
  }

  private async modifierAmbulance(code: string, champs: Record<string, unknown>): Promise<Ambulance> {
    const r = versAmbulance(await firstValueFrom(this.http.patch<AmbulanceApi>(`${this.url}/ambulances/${code}`, champs)));
    this.remplacerAmbulance(r);
    return r;
  }

  changerStatut(code: string, statut: Exclude<StatutAmbulance, 'En mission'>): Promise<Ambulance> {
    return this.modifierAmbulance(code, { statut });
  }

  /** Un chauffeur ne conduit qu'une ambulance : le serveur le retire de la précédente. */
  async affecterChauffeur(code: string, chauffeurId: string | null): Promise<Ambulance> {
    const r = await this.modifierAmbulance(code, { chauffeurId });
    await this.chargerAmbulances();
    return r;
  }

  private remplacerAmbulance(a: Ambulance): void {
    this.ambulances.update(liste => (liste.some(x => x.id === a.id)
      ? liste.map(x => (x.id === a.id ? { ...a, position: a.position ?? x.position } : x))
      : [...liste, a].sort((x, y) => x.id.localeCompare(y.id))));
  }

  private async chargerAmbulances(): Promise<void> {
    this.ambulances.set((await firstValueFrom(this.http.get<AmbulanceApi[]>(`${this.url}/ambulances`))).map(versAmbulance));
  }

  // --- Chauffeurs -----------------------------------------------------------------

  private async chargerChauffeurs(): Promise<void> {
    this.chauffeurs.set((await firstValueFrom(this.http.get<ChauffeurApi[]>(`${this.url}/chauffeurs`))).map(versChauffeur));
  }

  /** Matricule proposé pour le prochain chauffeur (modifiable) : son identifiant de connexion. */
  async prochainMatricule(): Promise<string> {
    return (await firstValueFrom(this.http.get<{ matricule: string }>(`${this.url}/chauffeurs/prochain-matricule`))).matricule;
  }

  /** Création du compte : le mot de passe part en HTTPS, le serveur le hache. */
  async ajouterChauffeur(c: NouveauChauffeur, photo: File): Promise<Chauffeur> {
    const f = new FormData();
    f.append('donnees', JSON.stringify(c));
    f.append('photo', photo);
    const r = versChauffeur(await firstValueFrom(this.http.post<ChauffeurApi>(`${this.url}/chauffeurs`, f)));
    this.chauffeurs.update(liste => [r, ...liste]);
    if (c.ambulance) await this.chargerAmbulances();
    return r;
  }

  async modifierChauffeur(id: string, champs: Partial<NouveauChauffeur>, photo?: File): Promise<Chauffeur> {
    const f = new FormData();
    f.append('donnees', JSON.stringify(champs));
    if (photo) f.append('photo', photo);
    const r = versChauffeur(await firstValueFrom(this.http.patch<ChauffeurApi>(`${this.url}/chauffeurs/${id}`, f)));
    this.chauffeurs.update(liste => liste.map(x => (x.id === id ? r : x)));
    return r;
  }

  /** Nouveau mot de passe temporaire (généré par le serveur), à remettre au chauffeur en personne. */
  reinitialiserMotDePasse(id: string): Promise<{ matricule: string; motDePasse: string }> {
    return firstValueFrom(this.http.post<{ matricule: string; motDePasse: string }>(`${this.url}/chauffeurs/${id}/mot-de-passe`, {}));
  }

  /** Suspension ou réactivation ; un chauffeur suspendu est retiré de son ambulance. */
  async basculerChauffeur(id: string): Promise<Chauffeur> {
    const c = this.chauffeur(id);
    const statut: StatutChauffeur = c?.statut === 'Actif' ? 'Suspendu' : 'Actif';
    const r = versChauffeur(await firstValueFrom(this.http.patch<ChauffeurApi>(`${this.url}/chauffeurs/${id}/statut`, { statut })));
    this.chauffeurs.update(liste => liste.map(x => (x.id === id ? r : x)));
    if (statut === 'Suspendu') await this.chargerAmbulances();
    return r;
  }

  carteService(id: string): Promise<CarteService> {
    return firstValueFrom(this.http.get<CarteService>(`${this.url}/chauffeurs/${id}/carte-service`));
  }
}

/** Jours restants avant une date AAAA-MM-JJ (négatif si dépassée). */
export function joursAvant(iso: string): number {
  if (!iso) return Infinity;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + 'T00:00:00').getTime() - aujourdhui.getTime()) / 86_400_000);
}
