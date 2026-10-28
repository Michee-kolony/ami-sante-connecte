import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../../shared/api';
import { SessionService } from '../session.service';
import { ecrire, effacer, toutLire, vider } from './stockage';

/** Requête rejouée par la synchronisation : l'intercepteur ne la remet pas en file d'attente. */
export const REJEU = new HttpContextToken<boolean>(() => false);

/**
 * Statut de synchronisation (spécification hors connexion, section 7) :
 *   LOCAL_ONLY : saisie qui attend qu'un dossier parent créé hors ligne reçoive son identifiant serveur ;
 *   PENDING    : prête à être envoyée ;
 *   SYNCING    : envoi en cours ;
 *   SYNCED     : accusé de réception du serveur (la trace est gardée dans le journal de l'appareil) ;
 *   ERROR      : refusée par le serveur ou en conflit : décision humaine nécessaire.
 */
export type StatutSync = 'LOCAL_ONLY' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
export const LIBELLES_STATUT: Record<StatutSync, string> = {
  LOCAL_ONLY: 'En attente du dossier parent',
  PENDING: 'En attente de synchronisation',
  SYNCING: 'Envoi en cours',
  SYNCED: 'Synchronisée',
  ERROR: 'Refusée ou en conflit',
};

/** Champ d'un formulaire multipart (photo comprise), gardé dans IndexedDB. */
export interface ChampFormulaire { nom: string; valeur: string | Blob; fichier?: string }

/** Dossier existant qui ressemble à celui créé hors connexion. */
export interface DoublonEnvoi { id: string; numero: string; nom: string; postnom?: string; prenom?: string; age?: number | null; commune?: string }

/** Saisie faite hors connexion (file de synchronisation, « outbox »). */
export interface Operation {
  /** operation_id : identifiant unique de l'envoi (le serveur ne l'exécute jamais deux fois). */
  operationId: string;
  methode: string;
  url: string;
  corps: unknown;
  formulaire: ChampFormulaire[] | null;
  /** Description lisible (« Consultation prénatale »…) et personne concernée. */
  libelle: string;
  detail?: string;
  /** record_type : CPN, Consultation, Enfant, Vaccination, Accouchement, Surveillance… */
  recordType: string;
  /** local_id des dossiers créés par cette saisie, par champ de la réponse du serveur (id, grossesseId…). */
  localIds?: Record<string, string>;
  /** local_id d'autres dossiers créés hors ligne dont cette saisie dépend (mère avant enfant…). */
  dependances: string[];
  /** created_at_device / updated_at_device (indications : l'ordre réel est celui de la file). */
  creeLe: string;
  majLe: string;
  /** created_by_user_id / facility_id : auteur et structure de la session au moment de la saisie. */
  soignantId: string;
  soignantNom: string;
  etablissementId: string | null;
  statut: StatutSync;
  /** local_revision : incrémentée à chaque changement de la saisie (confirmation, nouvel essai…). */
  revision: number;
  /** Modification d'un dossier existant : version vue sur l'appareil (détection des conflits). */
  versionBase?: string;
  erreur: string | null;
  /** sync_error_code : reseau, refus-400, droits-403, conflit, doublon, email-existant… */
  codeErreur: string | null;
  tentatives: number;
  derniereTentativeLe?: string;
  doublons?: DoublonEnvoi[];
  emailExistant?: boolean;
  conflit?: boolean;
}

/** Dossier créé sur l'appareil (patiente, grossesse, enfant, accouchement) : local_id ↔ server_id. */
export interface DossierLocal {
  localId: string;
  type: 'Patiente' | 'Grossesse' | 'Enfant' | 'Accouchement' | 'Consultation' | 'Rendez-vous';
  /** Saisie qui crée ce dossier. */
  operationId: string;
  serverId: string | null;
  serverNumero: string | null;
  /** Dossier parent : mère d'un enfant, patiente d'une grossesse ou d'un accouchement (local_id ou identifiant serveur). */
  parent: string | null;
  /** Mère (pour un nouveau-né créé depuis un accouchement local). */
  mere?: string | null;
  statut: StatutSync;
  creeLe: string;
  majLe: string;
  soignantId: string;
  etablissementId: string | null;
  derniereSyncLe: string | null;
  /** Données d'affichage, lues dans la saisie (sans les photos). */
  resume: Record<string, unknown>;
}

/** Accusé de réception d'une saisie envoyée, ou trace d'une saisie abandonnée (journal de l'appareil). */
export interface Recu {
  operationId: string;
  libelle: string;
  detail?: string;
  recordType: string;
  statut: 'SYNCED' | 'ABANDONNÉE';
  creeLe: string;
  envoyeLe: string;
  soignantNom: string;
  serverId: string | null;
  serverNumero: string | null;
  codeHttp: number | null;
  /** Abandon : qui l'a décidé et pourquoi (une saisie en attente n'est jamais effacée sans trace). */
  motif?: string;
  /** Corps de la saisie gardé pour l'affichage des dossiers locaux synchronisés (sans photo). */
  corps?: unknown;
  url: string;
  methode: string;
}

const CLE_DERNIERE = 'ami-derniere-synchronisation';
const CLE_APPAREIL = 'ami-appareil';
/** Identifiants locaux : « local- » + UUID (jamais réutilisés). */
const LOCAL = /local-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
/** Lot limité par tour de synchronisation (reprise au dernier élément confirmé). */
const LOT = 25;
/** Délai progressif après une panne réseau : 15 s, 30 s, 1 min… jusqu'à 10 min. */
const DELAI_MIN_MS = 15_000;
const DELAI_MAX_MS = 10 * 60_000;
/** Contrôle réel du serveur (et non du seul indicateur Wi-Fi / données mobiles). */
const DELAI_VERIFICATION_MS = 6_000;
/** Accusés de réception gardés sur l'appareil. */
const JOURNAL_MAX = 300;

/** Erreur renvoyée à l'écran quand la saisie a été gardée sur l'appareil (hors connexion). */
export function estMiseEnFile(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0 && err.error?.horsLigne === true;
}

/** local_id du dossier créé par une saisie mise en file (pour ouvrir le dossier local). */
export function localIdDe(err: unknown): string | null {
  return err instanceof HttpErrorResponse ? err.error?.localId ?? null : null;
}

/**
 * Serveur injoignable : pas de réseau (0), ou passerelle sans réponse (502, 503, 504 — c'est aussi
 * ce que renvoie le service worker de l'application quand le réseau est coupé).
 */
export const estPanneReseau = (status: number) => status === 0 || status === 502 || status === 503 || status === 504;

const chemin = (url: string) => url.replace(/^.*\/api\//, '').split('?')[0];

/** Libellé et type d'une saisie d'après son adresse (affichés dans la page Synchronisation). */
export function libelleOperation(methode: string, url: string): { libelle: string; recordType: string } {
  const c = chemin(url);
  const regles: [RegExp, string, string][] = [
    [/^accouchements$/, 'Admission en salle de travail', 'Accouchement'],
    [/^accouchements\/[^/]+\/admission$/, 'Admission (identité, anamnèse)', 'Accouchement'],
    [/^accouchements\/[^/]+\/examen-clinique$/, 'Examen clinique d’entrée', 'Accouchement'],
    [/^accouchements\/[^/]+\/surveillances$/, 'Surveillance du travail (partogramme)', 'Surveillance'],
    [/^accouchements\/[^/]+\/evacuation$/, 'Évacuation pendant le travail', 'Accouchement'],
    [/^accouchements\/[^/]+\/accouchement$/, 'Accouchement et délivrance', 'Accouchement'],
    [/^accouchements\/[^/]+\/nouveau-nes$/, 'Nouveau-né', 'Nouveau-né'],
    [/^accouchements\/[^/]+\/post-partum\/surveillances$/, 'Surveillance post-partum', 'Post-partum'],
    [/^accouchements\/[^/]+\/post-partum\/traitements/, 'Traitement post-partum', 'Post-partum'],
    [/^accouchements\/[^/]+\/sortie$/, 'Examen de sortie', 'Accouchement'],
    [/^accouchements\/[^/]+\/cloturer$/, 'Clôture du dossier d’accouchement', 'Accouchement'],
    [/^accouchements\/[^/]+\/alertes/, 'Prise en charge d’une alerte du partogramme', 'Accouchement'],
    [/^patientes$/, 'Création d’un dossier patiente (enregistrement CPN)', 'CPN'],
    [/^patientes\/[^/]+\/rendez-vous$/, 'Rendez-vous', 'Rendez-vous'],
    [/^patientes\//, 'Dossier patiente', 'CPN'],
    [/^grossesses\/[^/]+\/consultations$/, 'Consultation prénatale (CPN)', 'Consultation'],
    [/^grossesses/, 'Grossesse', 'CPN'],
    [/^consultations/, 'Consultation prénatale (CPN)', 'Consultation'],
    [/^rendez-vous\/rappels$/, 'Rappels de rendez-vous (envoi au retour du réseau)', 'Rappels'],
    [/^rendez-vous/, 'Rendez-vous', 'Rendez-vous'],
    [/^enfants$/, 'Enregistrement d’un enfant', 'Enfant'],
    [/^enfants\/[^/]+\/vaccin/, 'Vaccination', 'Vaccination'],
    [/^enfants\//, 'Dossier de l’enfant', 'Enfant'],
  ];
  const r = regles.find(([motif]) => motif.test(c));
  return r ? { libelle: r[1], recordType: r[2] } : { libelle: `${methode} ${c}`, recordType: 'Autre' };
}

/** Données JSON d'une saisie (corps JSON ou champ « donnees » d'un formulaire). */
function donneesDe(op: Pick<Operation, 'corps' | 'formulaire'>): Record<string, any> | null {
  const brut = op.formulaire?.find(c => c.nom === 'donnees')?.valeur;
  if (typeof brut === 'string') {
    try {
      return JSON.parse(brut);
    } catch {
      return null;
    }
  }
  return op.corps && typeof op.corps === 'object' ? op.corps as Record<string, any> : null;
}

const nomDe = (p?: { prenom?: string; nom?: string; postnom?: string }) => [p?.prenom, p?.nom, p?.postnom].filter(Boolean).join(' ');

/**
 * Dossiers créés par une saisie : un local_id pour chaque identifiant que la réponse du serveur
 * donnera (par exemple la patiente et sa grossesse), et le résumé à afficher sans réseau.
 */
function creationsDe(methode: string, url: string, d: any): { localIds: Record<string, string>; dossiers: Omit<DossierLocal, 'operationId' | 'statut' | 'creeLe' | 'majLe' | 'soignantId' | 'etablissementId' | 'derniereSyncLe' | 'serverId' | 'serverNumero'>[] } | null {
  if (methode !== 'POST') return null;
  const c = chemin(url);
  const nouveau = () => `local-${crypto.randomUUID()}`;
  if (c === 'patientes') {
    const p = nouveau();
    const g = nouveau();
    return {
      localIds: { id: p, grossesseId: g },
      dossiers: [
        { localId: p, type: 'Patiente', parent: null, resume: { ...d?.patiente, etablissementId: d?.etablissementId ?? null, rendezVous: d?.rendezVous ?? null, premiereConsultation: d?.premiereConsultation ?? null } },
        { localId: g, type: 'Grossesse', parent: p, resume: { ...d?.grossesse } },
      ],
    };
  }
  if (c === 'enfants') {
    const e = nouveau();
    return { localIds: { id: e }, dossiers: [{ localId: e, type: 'Enfant', parent: d?.mereId ?? null, resume: { ...d?.enfant, nouvelleMere: d?.nouvelleMere ?? null, vaccinationsAnterieures: d?.vaccinationsAnterieures ?? [] } }] };
  }
  if (c === 'accouchements') {
    const a = nouveau();
    return { localIds: { id: a }, dossiers: [{ localId: a, type: 'Accouchement', parent: d?.patienteId ?? null, resume: { admission: d?.admission ?? {}, nouvellePatiente: d?.nouvellePatiente ?? null } }] };
  }
  const nn = /^accouchements\/([^/]+)\/nouveau-nes$/.exec(c);
  if (nn) {
    const e = nouveau();
    return { localIds: { id: e }, dossiers: [{ localId: e, type: 'Enfant', parent: nn[1], resume: { ...d, nouveauNe: true } }] };
  }
  if (/^grossesses\/[^/]+\/consultations$/.test(c)) {
    const k = nouveau();
    return { localIds: { id: k }, dossiers: [{ localId: k, type: 'Consultation', parent: c.split('/')[1], resume: { ...d } }] };
  }
  if (/^patientes\/[^/]+\/rendez-vous$/.test(c)) {
    const r = nouveau();
    return { localIds: { id: r }, dossiers: [{ localId: r, type: 'Rendez-vous', parent: c.split('/')[1], resume: { ...d } }] };
  }
  return null;
}

/** Nom de la personne d'une création (affiché dans la file d'attente). */
function detailDe(url: string, d: Record<string, any> | null): string | undefined {
  if (!d) return undefined;
  const c = chemin(url);
  if (c === 'patientes') return nomDe(d['patiente']) || undefined;
  if (c === 'enfants') return `${nomDe(d['enfant']) || 'Enfant'}${d['nouvelleMere'] ? ` · mère : ${nomDe(d['nouvelleMere'])} (nouveau dossier)` : ''}`;
  if (/nouveau-nes$/.test(c)) return nomDe(d) || 'Nouveau-né';
  return undefined;
}

/** local_id présents dans une saisie (adresse, corps JSON, champs texte d'un formulaire). */
function localIdsReferences(op: Pick<Operation, 'url' | 'corps' | 'formulaire'>): string[] {
  const textes = [op.url, op.corps ? JSON.stringify(op.corps) : '', ...(op.formulaire ?? []).map(c => (typeof c.valeur === 'string' ? c.valeur : ''))];
  return [...new Set(textes.flatMap(t => t.match(LOCAL) ?? []))];
}

/** Remplace les local_id résolus par les identifiants du serveur (adresse, corps, formulaire). */
function resoudre(op: Operation, correspondances: Map<string, string>): Operation {
  const remplacer = (t: string) => t.replace(LOCAL, id => correspondances.get(id) ?? id);
  return {
    ...op,
    url: remplacer(op.url),
    corps: op.corps == null ? op.corps : JSON.parse(remplacer(JSON.stringify(op.corps))),
    formulaire: op.formulaire?.map(c => (typeof c.valeur === 'string' ? { ...c, valeur: remplacer(c.valeur) } : c)) ?? null,
  };
}

/**
 * Travail hors connexion de l'espace administrateur : état réel du réseau, file des saisies faites
 * sans connexion (IndexedDB chiffrée), dossiers créés sur l'appareil et synchronisation automatique.
 * Chaque saisie garde son identifiant (X-Operation-Id) : le serveur ne l'exécute jamais deux fois.
 */
@Injectable({ providedIn: 'root' })
export class HorsLigneService {
  private http = inject(HttpClient);
  private session = inject(SessionService);

  /** Serveur réellement joignable (contrôle de l'API, pas seulement l'indicateur du téléphone). */
  readonly enLigne = signal(navigator.onLine);
  readonly operations = signal<Operation[]>([]);
  readonly locaux = signal<DossierLocal[]>([]);
  readonly journal = signal<Recu[]>([]);
  readonly synchronisation = signal(false);
  readonly derniereSynchronisation = signal<string | null>(lireStockage(CLE_DERNIERE));
  /** Prochaine tentative automatique après une panne (délai progressif). */
  readonly prochainEssaiLe = signal<string | null>(null);
  /** Dernière saisie mise en file (annonce à l'écran). */
  readonly derniereMiseEnFile = signal<Operation | null>(null);
  /** Incrémenté quand la file vient d'être vidée : la copie locale doit être rafraîchie (mises à jour serveur). */
  readonly fileVidee = signal(0);

  readonly enAttente = computed(() => this.operations().filter(o => o.statut === 'PENDING' || o.statut === 'SYNCING' || o.statut === 'LOCAL_ONLY').length);
  readonly enEchec = computed(() => this.operations().filter(o => o.statut === 'ERROR').length);

  /** Identifiant de cet appareil (journal des synchronisations), sans donnée personnelle. */
  readonly appareil = identifiantAppareil();

  private echecsReseau = 0;
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    window.addEventListener('online', () => this.verifierServeur().then(ok => { if (ok) this.synchroniser(true); }));
    window.addEventListener('offline', () => this.enLigne.set(false));
    // Au démarrage de l'application : état réel du serveur, puis envoi de ce qui attend.
    this.charger().then(() => this.verifierServeur()).then(ok => { if (ok) this.synchroniser(); });
    // Hors ligne : nouvelle vérification régulière (la reprise du réseau n'est pas toujours signalée).
    setInterval(() => !this.enLigne() && navigator.onLine && this.verifierServeur().then(ok => { if (ok) this.synchroniser(true); }), 30_000);
    // Session ouverte (reconnexion après expiration) : les saisies de ce soignant repartent.
    effect(() => {
      const s = this.session.soignant();
      untracked(() => (s ? this.synchroniser() : this.oublierLectures()));
    });
  }

  /** Réponse du serveur reçue (ou panne constatée) par un appel de l'application. */
  signalerReseau(ok: boolean): void {
    if (ok) this.session.marquerContactServeur();
    if (ok === this.enLigne()) return;
    this.enLigne.set(ok);
    if (ok) this.synchroniser(true);
  }

  /** Vérification réelle : le serveur de l'API répond-il ? (n'importe quelle réponse HTTP suffit). */
  async verifierServeur(): Promise<boolean> {
    if (!navigator.onLine) {
      this.enLigne.set(false);
      return false;
    }
    const arret = new AbortController();
    const t = setTimeout(() => arret.abort(), DELAI_VERIFICATION_MS);
    try {
      await fetch(`${API_URL}/`, { method: 'GET', cache: 'no-store', signal: arret.signal });
      this.enLigne.set(true);
      this.session.marquerContactServeur();
      return true;
    } catch {
      this.enLigne.set(false);
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  async charger(): Promise<void> {
    try {
      const [ops, locaux, journal] = await Promise.all([toutLire<Operation>('operations'), toutLire<DossierLocal>('locaux'), toutLire<Recu>('journal')]);
      this.operations.set(ops.map(migrer).sort((a, b) => a.creeLe.localeCompare(b.creeLe)));
      this.locaux.set(locaux.sort((a, b) => b.creeLe.localeCompare(a.creeLe)));
      this.journal.set(journal.sort((a, b) => b.envoyeLe.localeCompare(a.envoyeLe)));
    } catch {
      /* IndexedDB indisponible (navigation privée) : pas de travail hors connexion */
    }
  }

  /**
   * Met une saisie en file d'attente (appelé par l'intercepteur) et enregistre les dossiers qu'elle
   * crée (local_id). Elle sera envoyée dès que le serveur répond.
   */
  async mettreEnFile(op: { operationId: string; methode: string; url: string; corps: unknown; formulaire: ChampFormulaire[] | null; versionBase?: string }): Promise<Operation> {
    const s = this.session.soignant();
    const maintenant = new Date().toISOString();
    const d = donneesDe(op);
    const creations = creationsDe(op.methode, op.url, d);
    const dependances = localIdsReferences(op);
    const { libelle, recordType } = libelleOperation(op.methode, op.url);
    const operation: Operation = {
      ...op,
      libelle, recordType, detail: detailDe(op.url, d),
      localIds: creations?.localIds,
      dependances,
      creeLe: maintenant, majLe: maintenant,
      soignantId: s?.id ?? '', soignantNom: s ? `${s.prenom} ${s.nom}` : '',
      etablissementId: this.session.etablissement()?.id ?? null,
      statut: dependances.length ? 'LOCAL_ONLY' : 'PENDING',
      revision: 1, erreur: null, codeErreur: null, tentatives: 0,
    };
    await ecrire('operations', operation);
    for (const dossier of creations?.dossiers ?? []) {
      const local: DossierLocal = {
        ...dossier, operationId: op.operationId, serverId: null, serverNumero: null, statut: operation.statut,
        creeLe: maintenant, majLe: maintenant, soignantId: operation.soignantId, etablissementId: operation.etablissementId, derniereSyncLe: null,
        mere: dossier.type === 'Enfant' && dossier.resume['nouveauNe'] ? this.parentDe(dossier.parent) : null,
      };
      await ecrire('locaux', local);
      this.locaux.update(l => [local, ...l.filter(x => x.localId !== local.localId)]);
    }
    this.operations.update(l => [...l.filter(o => o.operationId !== operation.operationId), operation]);
    this.derniereMiseEnFile.set(operation);
    return operation;
  }

  /** Mère d'un accouchement local (lien mère-enfant d'un nouveau-né créé hors ligne). */
  private parentDe(accouchement: string | null): string | null {
    return this.locaux().find(x => x.localId === accouchement)?.parent ?? null;
  }

  /** local_id de la première création d'une saisie (pour ouvrir le dossier local). */
  localIdPrincipal(op: Operation): string | null {
    return op.localIds?.['id'] ?? null;
  }

  /**
   * Envoie les saisies en attente, dans l'ordre où elles ont été faites, par lots limités. Une
   * saisie qui dépend d'un dossier créé hors ligne attend que ce dossier ait son identifiant serveur
   * (mère avant enfant). Arrêt à la première panne réseau, avec nouvel essai à délai progressif.
   */
  async synchroniser(immediat = false): Promise<void> {
    const moi = this.session.soignant();
    if (this.synchronisation() || !moi) return;
    if (immediat) this.echecsReseau = 0;
    const aEnvoyer = this.operations().filter(o => (o.statut === 'PENDING' || o.statut === 'LOCAL_ONLY') && o.soignantId === moi.id).slice(0, LOT);
    if (!aEnvoyer.length) return;
    this.synchronisation.set(true);
    let reseauCoupe = false;
    try {
      for (const op of aEnvoyer) {
        const prete = this.prete(op);
        if (prete === 'attente') continue;
        if (prete === 'bloquee') {
          await this.majOperation({ ...op, statut: 'LOCAL_ONLY', erreur: 'Le dossier parent n’a pas pu être créé : réglez d’abord la saisie refusée correspondante.', codeErreur: 'parent-refuse' });
          continue;
        }
        const resultat = await this.envoyer(op);
        if (resultat === 'reseau') {
          reseauCoupe = true;
          break;
        }
      }
      if (!reseauCoupe) {
        this.echecsReseau = 0;
        this.prochainEssaiLe.set(null);
        const maintenant = new Date().toISOString();
        this.derniereSynchronisation.set(maintenant);
        ecrireStockage(CLE_DERNIERE, maintenant);
      }
    } finally {
      this.synchronisation.set(false);
    }
    if (reseauCoupe) this.planifier();
    // Reste des saisies (lot suivant, ou dépendances résolues pendant ce tour) : on continue.
    else if (this.operations().some(o => o.statut === 'PENDING' || (o.statut === 'LOCAL_ONLY' && this.prete(o) === 'prete'))) {
      setTimeout(() => this.synchroniser(), 50);
    } else this.fileVidee.update(n => n + 1);
  }

  /** Nouvel essai automatique après une panne, avec un délai qui double à chaque échec. */
  private planifier(): void {
    this.echecsReseau += 1;
    const delai = Math.min(DELAI_MAX_MS, DELAI_MIN_MS * 2 ** (this.echecsReseau - 1));
    this.prochainEssaiLe.set(new Date(Date.now() + delai).toISOString());
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.verifierServeur().then(ok => (ok ? this.synchroniser() : this.planifier())), delai);
  }

  /** La saisie peut-elle partir ? (ses dossiers parents locaux ont-ils un identifiant serveur ?) */
  private prete(op: Operation): 'prete' | 'attente' | 'bloquee' {
    for (const dep of op.dependances) {
      const parent = this.locaux().find(l => l.localId === dep);
      if (parent?.serverId) continue;
      const creation = this.operations().find(o => o.operationId === parent?.operationId);
      if (!parent || creation?.statut === 'ERROR') return 'bloquee';
      return 'attente';
    }
    return 'prete';
  }

  /** Correspondances local_id → identifiant serveur connues sur l'appareil. */
  private correspondances(): Map<string, string> {
    return new Map(this.locaux().filter(l => l.serverId).map(l => [l.localId, l.serverId!]));
  }

  private async envoyer(brute: Operation): Promise<'ok' | 'echec' | 'reseau'> {
    const op = resoudre(brute, this.correspondances());
    await this.majOperation({ ...brute, statut: 'SYNCING', derniereTentativeLe: new Date().toISOString() });
    const corps = op.formulaire ? versFormData(op.formulaire) : op.corps;
    let entetes = new HttpHeaders({ 'X-Operation-Id': op.operationId, 'X-Appareil': this.appareil, 'X-Saisie-Le': op.creeLe });
    if (op.versionBase) entetes = entetes.set('X-Version-Base', op.versionBase);
    try {
      const reponse = await firstValueFrom(this.http.request<Record<string, any>>(op.methode, op.url, {
        body: corps, headers: entetes, observe: 'response', context: new HttpContext().set(REJEU, true),
      }));
      await this.confirmer(brute, reponse.body ?? {}, reponse.status);
      this.signalerReseau(true);
      return 'ok';
    } catch (err) {
      const e = err as HttpErrorResponse;
      if (estPanneReseau(e.status)) {
        await this.majOperation({ ...brute, statut: 'PENDING' });
        this.signalerReseau(false);
        return 'reseau';
      }
      // Session expirée : reprise après la reconnexion du même soignant.
      if (e.status === 401) {
        await this.majOperation({ ...brute, statut: 'PENDING' });
        return 'reseau';
      }
      const message = typeof e.error?.message === 'string' ? e.error.message : `Refusée par le serveur (erreur ${e.status}).`;
      // 409 « déjà en cours d'envoi » : l'opération est en train d'être traitée, on réessaiera.
      if (e.status === 409 && /déjà en cours d’envoi/.test(message)) {
        await this.majOperation({ ...brute, statut: 'PENDING' });
        return 'reseau';
      }
      const doublons = Array.isArray(e.error?.doublons) ? e.error.doublons as DoublonEnvoi[]
        : e.error?.enfantExistant ? [{ nom: '', ...e.error.enfantExistant } as DoublonEnvoi] : undefined;
      const codeErreur = e.error?.conflit ? 'conflit' : e.error?.emailExistant ? 'email-existant' : doublons ? 'doublon' : e.status === 403 ? 'droits-403' : `refus-${e.status}`;
      await this.majOperation({
        ...brute, statut: 'ERROR', erreur: message, codeErreur, doublons, emailExistant: e.error?.emailExistant === true,
        conflit: e.error?.conflit === true, tentatives: brute.tentatives + 1,
      });
      return 'echec';
    }
  }

  /** Accusé de réception : identifiants serveur des dossiers créés, trace dans le journal, saisie retirée de la file. */
  private async confirmer(op: Operation, reponse: Record<string, any>, codeHttp: number): Promise<void> {
    const maintenant = new Date().toISOString();
    for (const [champ, localId] of Object.entries(op.localIds ?? {})) {
      const local = this.locaux().find(l => l.localId === localId);
      const serverId = reponse[champ] ? String(reponse[champ]) : null;
      if (!local || !serverId) continue;
      const maj: DossierLocal = { ...local, serverId, serverNumero: champ === 'id' ? reponse['numero'] ?? null : null, statut: 'SYNCED', majLe: maintenant, derniereSyncLe: maintenant };
      await ecrire('locaux', maj);
      this.locaux.update(l => l.map(x => (x.localId === localId ? maj : x)));
    }
    await this.tracer({
      operationId: op.operationId, libelle: op.libelle, detail: op.detail, recordType: op.recordType, statut: 'SYNCED',
      creeLe: op.creeLe, envoyeLe: maintenant, soignantNom: op.soignantNom, serverId: reponse['id'] ? String(reponse['id']) : null,
      serverNumero: reponse['numero'] ?? null, codeHttp, corps: donneesSansPhoto(op), url: op.url, methode: op.methode,
    });
    await effacer('operations', op.operationId);
    this.operations.update(l => l.filter(o => o.operationId !== op.operationId));
    // Les saisies qui attendaient ce dossier deviennent prêtes.
    for (const o of this.operations().filter(x => x.statut === 'LOCAL_ONLY' && this.prete(x) === 'prete')) {
      await this.majOperation({ ...o, statut: 'PENDING', erreur: null, codeErreur: null });
    }
  }

  private async tracer(recu: Recu): Promise<void> {
    await ecrire('journal', recu);
    const journal = [recu, ...this.journal().filter(r => r.operationId !== recu.operationId)];
    for (const ancien of journal.slice(JOURNAL_MAX)) await effacer('journal', ancien.operationId);
    this.journal.set(journal.slice(0, JOURNAL_MAX));
  }

  /** Remet une saisie refusée dans la file (après correction côté serveur, ou nouvel essai). */
  async reessayer(op: Operation): Promise<void> {
    await this.majOperation({ ...op, statut: 'PENDING', erreur: null, codeErreur: null, revision: op.revision + 1 });
    await this.synchroniser(true);
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
    await this.majOperation({ ...op, formulaire, statut: 'PENDING', erreur: null, codeErreur: null, doublons: undefined, emailExistant: undefined, revision: op.revision + 1 });
    await this.synchroniser(true);
  }

  /** Conflit : le soignant a vérifié le dossier et applique quand même sa modification. */
  async appliquerMalgreConflit(op: Operation): Promise<void> {
    await this.majOperation({ ...op, versionBase: undefined, statut: 'PENDING', erreur: null, codeErreur: null, conflit: false, revision: op.revision + 1 });
    await this.synchroniser(true);
  }

  /**
   * Abandon d'une saisie (décision explicite) : retirée de la file, mais tracée dans le journal de
   * l'appareil avec l'auteur, la date et le motif. Les saisies qui en dépendaient sont signalées.
   */
  async supprimer(op: Operation, motif = 'Abandonnée par le soignant'): Promise<void> {
    const s = this.session.soignant();
    await this.tracer({
      operationId: op.operationId, libelle: op.libelle, detail: op.detail, recordType: op.recordType, statut: 'ABANDONNÉE',
      creeLe: op.creeLe, envoyeLe: new Date().toISOString(), soignantNom: s ? `${s.prenom} ${s.nom}` : op.soignantNom,
      serverId: null, serverNumero: null, codeHttp: null, motif, url: op.url, methode: op.methode,
    });
    await effacer('operations', op.operationId);
    this.operations.update(l => l.filter(o => o.operationId !== op.operationId));
    for (const localId of Object.values(op.localIds ?? {})) {
      await effacer('locaux', localId);
      this.locaux.update(l => l.filter(x => x.localId !== localId));
    }
  }

  /** Déconnexion : les dossiers copiés sur l'appareil sont effacés (les saisies en attente restent). */
  async oublierLectures(): Promise<void> {
    await vider('lectures').catch(() => {});
  }

  private async majOperation(op: Operation): Promise<void> {
    const maj = { ...op, majLe: new Date().toISOString() };
    await ecrire('operations', maj);
    this.operations.update(l => l.map(o => (o.operationId === maj.operationId ? maj : o)));
    // Le statut des dossiers créés suit celui de leur saisie.
    for (const localId of Object.values(maj.localIds ?? {})) {
      const local = this.locaux().find(x => x.localId === localId);
      if (!local || local.statut === maj.statut || local.serverId) continue;
      const l2 = { ...local, statut: maj.statut, majLe: maj.majLe };
      await ecrire('locaux', l2);
      this.locaux.update(l => l.map(x => (x.localId === localId ? l2 : x)));
    }
  }
}

/** Saisies écrites par la version précédente (« en attente » / « échec ») : statuts de la spécification. */
function migrer(o: Operation & { etat?: string }): Operation {
  // Envoi interrompu (application fermée ou mise à jour pendant l'envoi) : la saisie repart.
  // Sans risque de doublon : le serveur reconnaît son X-Operation-Id.
  if (o.statut === 'SYNCING') return { ...o, statut: 'PENDING' };
  if (o.statut) return o;
  const { libelle, recordType } = libelleOperation(o.methode, o.url);
  return {
    ...o, libelle: o.libelle ?? libelle, recordType, statut: o.etat === 'échec' ? 'ERROR' : 'PENDING', revision: 1,
    dependances: localIdsReferences(o), majLe: o.creeLe, etablissementId: null, codeErreur: o.etat === 'échec' ? 'refus' : null,
  };
}

/** Données de la saisie, sans les photos (affichage d'un dossier local après sa synchronisation). */
function donneesSansPhoto(op: Operation): unknown {
  return donneesDe(op);
}

function identifiantAppareil(): string {
  let id = lireStockage(CLE_APPAREIL);
  if (!id) {
    id = `app-${crypto.randomUUID().slice(0, 8)}`;
    ecrireStockage(CLE_APPAREIL, id);
  }
  return id;
}

function lireStockage(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch { /* stockage indisponible */ }
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
