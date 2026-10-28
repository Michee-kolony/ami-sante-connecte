import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../session.service';
import { ecrire, effacer, toutLire, vider } from './stockage';

/** Requête rejouée par la synchronisation : l'intercepteur ne la remet pas en file d'attente. */
export const REJEU = new HttpContextToken<boolean>(() => false);

export type EtatOperation = 'en attente' | 'échec';

/** Champ d'un formulaire multipart (photo comprise), gardé tel quel dans IndexedDB. */
interface ChampFormulaire { nom: string; valeur: string | Blob; fichier?: string }

/** Saisie faite hors connexion, en attente d'envoi au serveur. */
export interface Operation {
  operationId: string;
  methode: string;
  url: string;
  corps: unknown;
  formulaire: ChampFormulaire[] | null;
  /** Description lisible (« Consultation prénatale », « Surveillance du travail »…). */
  libelle: string;
  /** Personne concernée par une création (« Ruth KABEYA », « Josué, enfant de … »). */
  detail?: string;
  /** Dossiers possiblement identiques signalés par le serveur à l'envoi (409). */
  doublons?: DoublonEnvoi[];
  /** Même adresse e-mail qu'un dossier existant : c'est forcément la même patiente (pas de création possible). */
  emailExistant?: boolean;
  creeLe: string;
  /** Soignant qui a fait la saisie : elle n'est envoyée qu'avec sa propre session. */
  soignantId: string;
  soignantNom: string;
  etat: EtatOperation;
  erreur: string | null;
  tentatives: number;
}

/** Dossier existant qui ressemble à celui créé hors connexion. */
export interface DoublonEnvoi { id: string; numero: string; nom: string; postnom?: string; prenom?: string; age?: number | null; commune?: string }

const CLE_DERNIERE = 'ami-derniere-synchronisation';

/** Erreur renvoyée à l'écran quand la saisie a été gardée sur l'appareil (hors connexion). */
export function estMiseEnFile(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0 && err.error?.horsLigne === true;
}

/** Nom de la personne d'une création (dossier patiente ou enfant), lu dans le formulaire gardé. */
function detailOperation(url: string, formulaire: ChampFormulaire[] | null): string | undefined {
  const brut = formulaire?.find(c => c.nom === 'donnees')?.valeur;
  if (typeof brut !== 'string') return undefined;
  try {
    const d = JSON.parse(brut);
    const nom = (p?: { prenom?: string; nom?: string; postnom?: string }) => [p?.prenom, p?.nom, p?.postnom].filter(Boolean).join(' ');
    if (/\/patientes$/.test(url)) return nom(d.patiente) || undefined;
    if (/\/enfants$/.test(url)) {
      const mere = d.nouvelleMere ? ` · mère : ${nom(d.nouvelleMere)} (nouveau dossier)` : '';
      return `${nom(d.enfant) || 'Enfant'}${mere}`;
    }
  } catch { /* formulaire illisible : pas de détail */ }
  return undefined;
}

/**
 * Serveur injoignable : pas de réseau (0), ou passerelle sans réponse (502, 503, 504 — c'est aussi
 * ce que renvoie le service worker de l'application quand le réseau est coupé).
 */
export const estPanneReseau = (status: number) => status === 0 || status === 502 || status === 503 || status === 504;
/** Nouvelle tentative automatique tant qu'il reste des saisies en attente. */
const INTERVALLE_MS = 60_000;

/** Libellé d'une saisie d'après son adresse (affiché dans la page Synchronisation). */
export function libelleOperation(methode: string, url: string): string {
  const chemin = url.replace(/^.*\/api\//, '').split('?')[0];
  const regles: [RegExp, string][] = [
    [/^accouchements$/, 'Admission en salle de travail'],
    [/^accouchements\/[^/]+\/admission$/, 'Admission (identité, anamnèse)'],
    [/^accouchements\/[^/]+\/examen-clinique$/, 'Examen clinique d’entrée'],
    [/^accouchements\/[^/]+\/surveillances$/, 'Surveillance du travail (partogramme)'],
    [/^accouchements\/[^/]+\/evacuation$/, 'Évacuation pendant le travail'],
    [/^accouchements\/[^/]+\/accouchement$/, 'Accouchement et délivrance'],
    [/^accouchements\/[^/]+\/nouveau-nes$/, 'Nouveau-né'],
    [/^accouchements\/[^/]+\/post-partum\/surveillances$/, 'Surveillance post-partum'],
    [/^accouchements\/[^/]+\/post-partum\/traitements/, 'Traitement post-partum'],
    [/^accouchements\/[^/]+\/sortie$/, 'Examen de sortie'],
    [/^accouchements\/[^/]+\/cloturer$/, 'Clôture du dossier d’accouchement'],
    [/^accouchements\/[^/]+\/alertes/, 'Prise en charge d’une alerte du partogramme'],
    [/^patientes$/, 'Création d’un dossier patiente'],
    [/^patientes\//, 'Dossier patiente'],
    [/^grossesses/, 'Grossesse'],
    [/^consultations/, 'Consultation prénatale (CPN)'],
    [/^rendez-vous/, 'Rendez-vous'],
    [/^enfants$/, 'Enregistrement d’un enfant'],
    [/^enfants\/[^/]+\/vaccin/, 'Vaccination'],
    [/^enfants\//, 'Dossier de l’enfant'],
  ];
  const r = regles.find(([motif]) => motif.test(chemin));
  return r ? r[1] : `${methode} ${chemin}`;
}

/**
 * Travail hors connexion de l'espace administrateur : état du réseau, file des saisies faites
 * sans connexion (IndexedDB) et synchronisation automatique dès le retour du réseau. Chaque saisie
 * garde son identifiant (X-Operation-Id) : le serveur ne l'exécute jamais deux fois.
 */
@Injectable({ providedIn: 'root' })
export class HorsLigneService {
  private http = inject(HttpClient);
  private session = inject(SessionService);

  /** Réseau disponible (navigateur, et dernier appel au serveur réussi). */
  readonly enLigne = signal(navigator.onLine);
  readonly operations = signal<Operation[]>([]);
  readonly synchronisation = signal(false);
  readonly derniereSynchronisation = signal<string | null>(lireDerniere());
  /** Dernière saisie mise en file (annonce à l'écran). */
  readonly derniereMiseEnFile = signal<Operation | null>(null);

  readonly enAttente = computed(() => this.operations().filter(o => o.etat === 'en attente').length);
  readonly enEchec = computed(() => this.operations().filter(o => o.etat === 'échec').length);

  constructor() {
    window.addEventListener('online', () => {
      this.enLigne.set(true);
      this.synchroniser();
    });
    window.addEventListener('offline', () => this.enLigne.set(false));
    this.charger().then(() => this.synchroniser());
    setInterval(() => this.enAttente() && this.synchroniser(), INTERVALLE_MS);
    // Session ouverte (reconnexion après expiration) : les saisies de ce soignant repartent.
    effect(() => {
      const s = this.session.soignant();
      untracked(() => (s ? this.synchroniser() : this.oublierLectures()));
    });
  }

  /** Réponse du serveur reçue : le réseau est revenu (sans attendre l'événement du navigateur). */
  signalerReseau(ok: boolean): void {
    if (ok === this.enLigne()) return;
    this.enLigne.set(ok);
    if (ok) this.synchroniser();
  }

  async charger(): Promise<void> {
    try {
      const liste = await toutLire<Operation>('operations');
      this.operations.set(liste.sort((a, b) => a.creeLe.localeCompare(b.creeLe)));
    } catch {
      /* IndexedDB indisponible (navigation privée) : pas de travail hors connexion */
    }
  }

  /** Met une saisie en file d'attente (appelé par l'intercepteur). */
  async mettreEnFile(op: Omit<Operation, 'libelle' | 'creeLe' | 'soignantId' | 'soignantNom' | 'etat' | 'erreur' | 'tentatives'>): Promise<Operation> {
    const s = this.session.soignant();
    const operation: Operation = {
      ...op,
      libelle: libelleOperation(op.methode, op.url),
      detail: detailOperation(op.url, op.formulaire),
      creeLe: new Date().toISOString(),
      soignantId: s?.id ?? '',
      soignantNom: s ? `${s.prenom} ${s.nom}` : '',
      etat: 'en attente',
      erreur: null,
      tentatives: 0,
    };
    await ecrire('operations', operation);
    this.operations.update(l => [...l.filter(o => o.operationId !== operation.operationId), operation]);
    this.derniereMiseEnFile.set(operation);
    return operation;
  }

  /**
   * Envoie les saisies en attente, dans l'ordre où elles ont été faites. S'arrête au premier
   * envoi sans réseau ; une saisie refusée par le serveur passe « en échec » (à corriger ou supprimer).
   */
  async synchroniser(): Promise<void> {
    const moi = this.session.soignant();
    if (this.synchronisation() || !moi) return;
    const aEnvoyer = this.operations().filter(o => o.etat === 'en attente' && o.soignantId === moi.id);
    if (!aEnvoyer.length) return;
    this.synchronisation.set(true);
    try {
      for (const op of aEnvoyer) {
        const resultat = await this.envoyer(op);
        if (resultat === 'reseau') return;
      }
      const maintenant = new Date().toISOString();
      this.derniereSynchronisation.set(maintenant);
      try {
        localStorage.setItem(CLE_DERNIERE, maintenant);
      } catch { /* stockage indisponible */ }
    } finally {
      this.synchronisation.set(false);
    }
  }

  /** Remet une saisie en échec dans la file (après correction côté serveur, ou nouvel essai). */
  async reessayer(op: Operation): Promise<void> {
    await this.majOperation({ ...op, etat: 'en attente', erreur: null });
    await this.synchroniser();
  }

  /**
   * Doublon signalé à l'envoi, et le soignant confirme que ce n'est pas la même personne : la
   * création repart avec la confirmation (même identifiant d'opération, jamais en double).
   */
  async confirmerMalgreDoublons(op: Operation): Promise<void> {
    const formulaire = op.formulaire?.map(c => {
      if (c.nom !== 'donnees' || typeof c.valeur !== 'string') return c;
      return { ...c, valeur: JSON.stringify({ ...JSON.parse(c.valeur), confirmerMalgreDoublons: true }) };
    }) ?? null;
    await this.majOperation({ ...op, formulaire, etat: 'en attente', erreur: null, doublons: undefined, emailExistant: undefined });
    await this.synchroniser();
  }

  async supprimer(op: Operation): Promise<void> {
    await effacer('operations', op.operationId);
    this.operations.update(l => l.filter(o => o.operationId !== op.operationId));
  }

  /** Déconnexion : les dossiers gardés sur l'appareil sont effacés (les saisies en attente restent). */
  async oublierLectures(): Promise<void> {
    await vider('lectures').catch(() => {});
  }

  private async envoyer(op: Operation): Promise<'ok' | 'echec' | 'reseau'> {
    const corps = op.formulaire ? versFormData(op.formulaire) : op.corps;
    try {
      await firstValueFrom(this.http.request(op.methode, op.url, {
        body: corps,
        headers: new HttpHeaders({ 'X-Operation-Id': op.operationId }),
        context: new HttpContext().set(REJEU, true),
      }));
      await this.supprimer(op);
      this.signalerReseau(true);
      return 'ok';
    } catch (err) {
      const e = err as HttpErrorResponse;
      if (estPanneReseau(e.status)) {
        this.signalerReseau(false);
        return 'reseau';
      }
      if (e.status === 401) return 'reseau'; // session expirée : reprise après reconnexion
      const message = typeof e.error?.message === 'string' ? e.error.message : `Refusée par le serveur (erreur ${e.status}).`;
      // 409 « déjà en cours d'envoi » : l'opération est en train d'être traitée, on réessaiera.
      if (e.status === 409 && /déjà en cours d’envoi/.test(message)) return 'reseau';
      // Dossiers ressemblants : mère (doublons) ou enfant déjà enregistré pour cette mère (enfantExistant).
      const doublons = Array.isArray(e.error?.doublons) ? e.error.doublons as DoublonEnvoi[]
        : e.error?.enfantExistant ? [{ nom: '', ...e.error.enfantExistant } as DoublonEnvoi] : undefined;
      await this.majOperation({ ...op, etat: 'échec', erreur: message, doublons, emailExistant: e.error?.emailExistant === true, tentatives: op.tentatives + 1 });
      return 'echec';
    }
  }

  private async majOperation(op: Operation): Promise<void> {
    await ecrire('operations', op);
    this.operations.update(l => l.map(o => (o.operationId === op.operationId ? op : o)));
  }
}

function lireDerniere(): string | null {
  try {
    return localStorage.getItem(CLE_DERNIERE);
  } catch {
    return null;
  }
}

/** FormData → champs (Blob compris) que IndexedDB sait garder. */
export function depuisFormData(f: FormData): ChampFormulaire[] {
  const champs: ChampFormulaire[] = [];
  f.forEach((valeur, nom) => champs.push(valeur instanceof File
    ? { nom, valeur: valeur.slice(0, valeur.size, valeur.type), fichier: valeur.name }
    : { nom, valeur }));
  return champs;
}

function versFormData(champs: ChampFormulaire[]): FormData {
  const f = new FormData();
  for (const c of champs) c.fichier ? f.append(c.nom, c.valeur as Blob, c.fichier) : f.append(c.nom, c.valeur);
  return f;
}
