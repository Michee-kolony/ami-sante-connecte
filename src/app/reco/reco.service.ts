import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../shared/api';
import { empreinte, ecrire, estChiffre, lire, toutEffacer } from './reco-stockage';

const URL = `${API_URL}/reco`;
const CLE_SESSION = 'ami-reco';
/** Dernier compte connecté sur l'appareil (ses données locales lui appartiennent). */
const CLE_COMPTE = 'ami-reco-compte';
/** Verrouillage automatique après 5 minutes sans activité (section 11). */
const VERROUILLAGE_MS = 5 * 60000;

export interface ProfilReco {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  postnom: string;
  telephone: string;
  photo: string | null;
  aireSante: string;
  zones: string[];
  doitChangerMotDePasse: boolean;
  structure: { id: string; nom: string; telephone: string } | null;
  derniereSynchronisation: string | null;
}

export interface ActionTache {
  operationId: string;
  type: string;
  canal: string | null;
  resultat: string | null;
  motif: string | null;
  commentaire: string;
  date: string | null;
  le: string;
  conflit: boolean;
  /** Pas encore reçue par le serveur. */
  enAttente?: boolean;
}

export interface TacheReco {
  numero: string;
  statut: string;
  priorite: 'Normale' | 'Prioritaire' | 'Urgente';
  echeance: string;
  enRetard: boolean;
  parcoursCode: string | null;
  motif: string;
  attribueeAMoi: boolean;
  personne: {
    nom: string;
    enfant?: { prenom: string; sexe: string } | null;
    commune?: string;
    quartier: string;
    avenue?: string;
    repere: string;
    telephone: string;
    telephonePartage?: boolean;
  };
  canauxAutorises: string[];
  structure: { id: string; nom: string; telephone: string } | null;
  messageNeutre: string;
  tentativesEchouees: number;
  tentativesMax: number;
  contactEtabli: boolean;
  visites: { prevueLe: string; realiseeLe: string | null; resultat: string | null }[];
  orientation: { le: string; structure: string; priorite: string; dateConseillee: string | null } | null;
  actions: ActionTache[];
  misAJourLe: string;
}

export interface ReferentielReco {
  canaux: string[];
  resultatsTentative: string[];
  resultatsVisite: string[];
  motifsRefus: string[];
  priorites: string[];
  domaines: string[];
  commentaireMax: number;
  structures: { id: string; nom: string; zoneSante: string; aireSante: string }[];
}

export interface AlerteReco { id: string; type: string; libelle: string; taches: string[]; occurrences: number; derniereLe: string; ouverte: boolean }

/** Opération faite sur l'appareil, envoyée dès que le réseau le permet. */
export interface Operation {
  operationId: string;
  type: string;
  numero?: string;
  canal?: string | null;
  resultat?: string | null;
  motif?: string | null;
  commentaire?: string;
  date?: string | null;
  structure?: string | null;
  priorite?: string | null;
  le: string;
  horsLigne: boolean;
  appareil: string;
  // Signalement
  nom?: string;
  quartier?: string;
  repere?: string;
  telephone?: string;
  domaine?: string;
  urgence?: boolean;
}

/** Opération refusée par le serveur (règle non respectée) : montrée au RECO. */
export interface OperationRefusee { operation: Operation; message: string }

interface Session { jeton: string; reco: ProfilReco; sel: string; empreinte: string }

interface Cache { taches: TacheReco[]; referentiel: ReferentielReco | null; alertes: AlerteReco[]; serveurLe: string | null }

function lireSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(CLE_SESSION) ?? 'null');
  } catch {
    return null;
  }
}

/** Identifiant de l'appareil (journal des synchronisations), sans donnée personnelle. */
function appareil(): string {
  try {
    let id = localStorage.getItem('ami-reco-appareil');
    if (!id) {
      id = `app-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem('ami-reco-appareil', id);
    }
    return id;
  } catch {
    return 'app-inconnu';
  }
}

/** Statut affiché tout de suite après une action faite hors connexion (le serveur tranche ensuite). */
const STATUT_LOCAL: Record<string, string> = {
  accepter: 'En cours', visite_planifiee: 'Visite planifiée', orientation: 'Orientée', refus_report: 'Refus / report',
  demande_appui: 'Escaladée', urgence: 'Escaladée',
};
const CONTACTS = ['Personne jointe', 'Responsable légal autorisé joint', 'Personne rencontrée', 'Responsable légal autorisé rencontré'];

/**
 * Application RECO : connexion par matricule, tâches gardées sur l'appareil (chiffrées),
 * actions enregistrées même sans réseau puis synchronisées sans doublon (chaque action porte
 * un identifiant unique), verrouillage automatique après inactivité.
 */
@Injectable({ providedIn: 'root' })
export class RecoService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private zone = inject(NgZone);
  private session = signal<Session | null>(lireSession());

  readonly reco = computed(() => this.session()?.reco ?? null);
  readonly connecte = computed(() => !!this.session());
  readonly taches = signal<TacheReco[]>([]);
  readonly referentiel = signal<ReferentielReco | null>(null);
  readonly alertes = signal<AlerteReco[]>([]);
  readonly operations = signal<Operation[]>([]);
  readonly refusees = signal<OperationRefusee[]>([]);
  readonly derniereSynchro = signal<string | null>(null);
  readonly enLigne = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly synchronisation = signal(false);
  readonly verrouille = signal(false);
  readonly chiffre = estChiffre();
  readonly ouvertes = computed(() => this.taches().filter(t => !['Réintégration confirmée', 'Doublon annulé', 'Clôturée sans réintégration'].includes(t.statut)));

  private minuterie: ReturnType<typeof setTimeout> | null = null;
  private demarre = false;

  /** Démarre l'espace : données de l'appareil, puis serveur ; écoute du réseau et de l'activité. */
  async demarrer(): Promise<void> {
    if (this.demarre || !this.connecte()) return;
    this.demarre = true;
    const [cache, ops, refusees] = await Promise.all([lire<Cache>('cache'), lire<Operation[]>('operations'), lire<OperationRefusee[]>('refusees')]);
    if (cache) {
      this.taches.set(cache.taches);
      this.referentiel.set(cache.referentiel);
      this.alertes.set(cache.alertes);
      this.derniereSynchro.set(cache.serveurLe);
    }
    this.operations.set(ops ?? []);
    this.refusees.set(refusees ?? []);
    window.addEventListener('online', () => this.zone.run(() => { this.enLigne.set(true); this.synchroniser(); }));
    window.addEventListener('offline', () => this.zone.run(() => this.enLigne.set(false)));
    for (const e of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(e, () => this.activite(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.zone.run(() => this.synchroniser());
    });
    this.activite();
    await this.synchroniser();
  }

  private activite(): void {
    if (this.verrouille()) return;
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.zone.run(() => this.verrouille.set(true)), VERROUILLAGE_MS);
  }

  private entetes(): { headers: HttpHeaders } {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${this.session()?.jeton ?? ''}` }) };
  }

  async connecter(matricule: string, motDePasse: string): Promise<void> {
    const r = await firstValueFrom(this.http.post<{ jeton: string; reco: ProfilReco }>(`${URL}/connexion`, { matricule, motDePasse }));
    // Un autre RECO sur ce téléphone : les données de l'ancien compte (y compris ses actions en
    // attente, gardées après une session expirée) sont effacées.
    const precedent = (() => { try { return localStorage.getItem(CLE_COMPTE); } catch { return null; } })();
    if (precedent && precedent !== r.reco.id) await toutEffacer();
    try { localStorage.setItem(CLE_COMPTE, r.reco.id); } catch { /* stockage indisponible */ }
    const sel = crypto.getRandomValues(new Uint8Array(16));
    const session: Session = { jeton: r.jeton, reco: r.reco, sel: btoa(String.fromCharCode(...sel)), empreinte: await empreinte(motDePasse, sel) };
    this.enregistrer(session);
    this.verrouille.set(false);
    this.demarre = false;
    await this.demarrer();
  }

  /** Déverrouillage : vérifié sur l'appareil (sans réseau) avec l'empreinte du mot de passe. */
  async deverrouiller(motDePasse: string): Promise<boolean> {
    const s = this.session();
    if (!s) return false;
    const sel = Uint8Array.from(atob(s.sel), c => c.charCodeAt(0));
    const ok = s.empreinte ? (await empreinte(motDePasse, sel)) === s.empreinte : false;
    if (ok) {
      this.verrouille.set(false);
      this.activite();
      this.synchroniser();
    }
    return ok;
  }

  /** Déconnexion : suppression sécurisée des données de l'appareil. */
  async deconnecter(): Promise<void> {
    await toutEffacer();
    this.enregistrer(null);
    try { localStorage.removeItem(CLE_COMPTE); } catch { /* stockage indisponible */ }
    this.taches.set([]);
    this.operations.set([]);
    this.refusees.set([]);
    this.verrouille.set(false);
    this.demarre = false;
    this.router.navigateByUrl('/reco/connexion');
  }

  private enregistrer(s: Session | null): void {
    this.session.set(s);
    try {
      s ? localStorage.setItem(CLE_SESSION, JSON.stringify(s)) : localStorage.removeItem(CLE_SESSION);
    } catch { /* stockage indisponible : session en mémoire */ }
  }

  private majProfil(reco: ProfilReco): void {
    const s = this.session();
    if (s) this.enregistrer({ ...s, reco });
  }

  async changerMotDePasse(actuel: string, nouveau: string): Promise<void> {
    const reco = await firstValueFrom(this.http.put<ProfilReco>(`${URL}/moi/mot-de-passe`, { actuel, nouveau }, this.entetes()));
    const sel = crypto.getRandomValues(new Uint8Array(16));
    const s = this.session();
    if (s) this.enregistrer({ ...s, reco, sel: btoa(String.fromCharCode(...sel)), empreinte: await empreinte(nouveau, sel) });
  }

  private async sauverCache(): Promise<void> {
    await ecrire('cache', { taches: this.taches(), referentiel: this.referentiel(), alertes: this.alertes(), serveurLe: this.derniereSynchro() } satisfies Cache).catch(() => {});
  }

  private async sauverFile(): Promise<void> {
    await Promise.all([ecrire('operations', this.operations()), ecrire('refusees', this.refusees())]).catch(() => {});
  }

  /** Session expirée ou révoquée : nouvelle connexion (les actions en attente sont gardées). */
  private gererErreur(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.enregistrer(null);
      this.router.navigateByUrl('/reco/connexion');
    }
    if (err instanceof HttpErrorResponse && err.status === 0) this.enLigne.set(false);
  }

  /**
   * Envoie les actions en attente (dans l'ordre où elles ont été faites), puis recharge les
   * tâches. Une action refusée par le serveur est retirée de la file et signalée au RECO.
   */
  async synchroniser(): Promise<void> {
    if (!this.connecte() || this.synchronisation()) return;
    this.synchronisation.set(true);
    try {
      const file = this.operations();
      if (file.length) {
        const r = await firstValueFrom(this.http.post<{ serveurLe: string; resultats: { operationId: string; ok: boolean; message?: string; conflit?: boolean }[] }>(
          `${URL}/synchroniser`, { operations: file }, this.entetes()));
        const traitees = new Set(r.resultats.map(x => x.operationId));
        const refus = r.resultats.filter(x => !x.ok);
        this.refusees.update(l => [...l, ...refus.map(x => ({ operation: file.find(o => o.operationId === x.operationId)!, message: x.message ?? 'Action refusée.' })).filter(x => x.operation)]);
        this.operations.update(l => l.filter(o => !traitees.has(o.operationId)));
        await this.sauverFile();
      }
      const [taches, referentiel, alertes] = await Promise.all([
        firstValueFrom(this.http.get<{ serveurLe: string; taches: TacheReco[] }>(`${URL}/taches`, this.entetes())),
        firstValueFrom(this.http.get<ReferentielReco>(`${URL}/referentiel`, this.entetes())),
        firstValueFrom(this.http.get<AlerteReco[]>(`${URL}/alertes`, this.entetes())),
      ]);
      // Actions encore en attente (faites pendant l'envoi) : réappliquées à l'affichage.
      this.taches.set(taches.taches.map(t => this.operations().filter(o => o.numero === t.numero).reduce((x, o) => this.appliquerLocal(x, o), t)));
      this.referentiel.set(referentiel);
      this.alertes.set(alertes);
      this.derniereSynchro.set(taches.serveurLe);
      this.enLigne.set(true);
      await this.sauverCache();
    } catch (err) {
      this.gererErreur(err);
    } finally {
      this.synchronisation.set(false);
    }
  }

  /** Effet affiché d'une action pas encore confirmée par le serveur. */
  private appliquerLocal(t: TacheReco, o: Operation): TacheReco {
    const action: ActionTache = {
      operationId: o.operationId, type: o.type, canal: o.canal ?? null, resultat: o.resultat ?? null, motif: o.motif ?? null,
      commentaire: o.commentaire ?? '', date: o.date ?? null, le: o.le, conflit: false, enAttente: true,
    };
    let statut = STATUT_LOCAL[o.type] ?? t.statut;
    let { tentativesEchouees, contactEtabli } = t;
    if (o.type === 'tentative' || o.type === 'visite_realisee') {
      if (CONTACTS.includes(o.resultat ?? '')) {
        contactEtabli = true;
        statut = 'Contact établi';
      } else if (o.resultat !== 'Message neutre envoyé') {
        tentativesEchouees += 1;
        statut = tentativesEchouees >= t.tentativesMax ? 'Non retrouvée' : t.statut === 'Attribuée' ? 'En cours' : t.statut;
      } else if (t.statut === 'Attribuée') statut = 'En cours';
    }
    return { ...t, statut, tentativesEchouees, contactEtabli, actions: [...t.actions, action] };
  }

  /** Action sur une tâche : gardée sur l'appareil, puis envoyée (tout de suite si le réseau le permet). */
  async agir(numero: string, d: Partial<Operation> & { type: string }): Promise<void> {
    const op: Operation = { ...d, numero, operationId: `op-${crypto.randomUUID()}`, le: new Date().toISOString(), horsLigne: !navigator.onLine, appareil: appareil() };
    this.operations.update(l => [...l, op]);
    this.taches.update(l => l.map(t => (t.numero === numero ? this.appliquerLocal(t, op) : t)));
    await Promise.all([this.sauverFile(), this.sauverCache()]);
    if (navigator.onLine) await this.synchroniser();
  }

  /** Situation à vérifier signalée par le RECO (nouvelle personne, danger). */
  async signaler(d: Pick<Operation, 'nom' | 'quartier' | 'repere' | 'telephone' | 'domaine' | 'urgence' | 'commentaire'>): Promise<void> {
    const op: Operation = { ...d, type: 'signalement', operationId: `op-${crypto.randomUUID()}`, le: new Date().toISOString(), horsLigne: !navigator.onLine, appareil: appareil() };
    this.operations.update(l => [...l, op]);
    await this.sauverFile();
    if (navigator.onLine) await this.synchroniser();
  }

  async accuserAlerte(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${URL}/alertes/${id}/accuser`, {}, this.entetes())).catch(err => this.gererErreur(err));
    this.alertes.update(l => l.map(a => (a.id === id ? { ...a, ouverte: false } : a)));
    await this.sauverCache();
  }

  oublierRefus(): void {
    this.refusees.set([]);
    this.sauverFile();
  }

  /** Recharge le profil (changement de mot de passe exigé, structure). */
  async actualiserProfil(): Promise<void> {
    try {
      this.majProfil(await firstValueFrom(this.http.get<ProfilReco>(`${URL}/moi`, this.entetes())));
    } catch (err) {
      this.gererErreur(err);
    }
  }
}

/** Garde : session RECO ouverte sur cet appareil. */
export const recoConnecte: CanActivateFn = () => inject(RecoService).connecte() || inject(Router).parseUrl('/reco/connexion');
