import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, NgZone, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { API_URL } from '../shared/api';
import { RecoService } from './reco.service';

const URL = `${API_URL}/reco`;
const SERVEUR_URL = API_URL.replace(/\/api\/?$/, '');

/** Soignant ou chauffeur de l'établissement du RECO. */
export interface ContactReco {
  id: string;
  prenom: string;
  nom: string;
  role: string;
  photo: string | null;
  statut: string;
}

export interface MessageReco {
  id: string;
  discussionId: string;
  auteurId: string;
  texte: string;
  envoyeLe: string;
  lusPar: { soignantId: string; le: string }[];
  /** Côté client : envoi en cours ou échoué. */
  etat?: 'envoi' | 'echec';
}

export interface DiscussionReco {
  id: string;
  interlocuteur: ContactReco | null;
  dernierMessage: MessageReco | null;
  nonLus: number;
  dernierMessageLe: string | null;
}

/**
 * Messagerie du RECO avec les soignants et les chauffeurs de son établissement : mêmes discussions
 * chiffrées que l'espace administrateur ; historique par l'API, nouveaux messages, accusés de
 * lecture et « en train d'écrire » en temps réel (socket.io). Nécessite du réseau.
 */
@Injectable({ providedIn: 'root' })
export class RecoMessagesService {
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private reco = inject(RecoService);
  private socket?: Socket;

  readonly discussions = signal<DiscussionReco[]>([]);
  readonly charge = signal(false);
  readonly messages = signal<Record<string, MessageReco[]>>({});
  readonly plusAnciens = signal<Record<string, boolean>>({});
  /** Discussion affichée (ses messages entrants sont marqués lus aussitôt). */
  readonly ouverte = signal<string | null>(null);
  readonly enTrainDecrire = signal<Set<string>>(new Set());
  /** Soignants et chauffeurs en ligne. */
  readonly enLigne = signal<Set<string>>(new Set());
  readonly totalNonLus = computed(() => this.discussions().reduce((t, d) => t + d.nonLus, 0));
  private minuteursEcriture = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    // Déconnexion du RECO : temps réel coupé et messages effacés de la mémoire.
    effect(() => {
      if (!this.reco.connecte()) untracked(() => this.arreter());
    });
  }

  get moi(): string | undefined {
    return this.reco.reco()?.id;
  }

  private entetes(): { headers: HttpHeaders } {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${this.reco.jeton() ?? ''}` }) };
  }

  /** Ouvre la connexion temps réel (une seule) et charge les discussions. */
  demarrer(): void {
    if (this.socket || !this.reco.connecte()) return;
    this.socket = this.zone.runOutsideAngular(() => io(SERVEUR_URL, { auth: (cb) => cb({ jeton: this.reco.jeton() }) }));
    const sur = <T>(evenement: string, f: (d: T) => void) => this.socket!.on(evenement, (d: T) => this.zone.run(() => f(d)));
    sur<MessageReco>('discussion:message', m => this.recevoir(m));
    sur<{ discussionId: string; soignantId: string; le: string }>('discussion:lu', e => this.accuse(e));
    sur<{ discussionId: string }>('discussion:ecrit', e => this.signalerEcriture(e.discussionId));
    sur<string[]>('presence:ids', ids => this.enLigne.set(new Set(ids)));
    // À chaque (re)connexion : rattrape ce qui a été manqué.
    sur('connect', () => this.charger().catch(() => {}));
  }

  arreter(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.discussions.set([]);
    this.messages.set({});
    this.charge.set(false);
    this.ouverte.set(null);
    this.enLigne.set(new Set());
  }

  async charger(): Promise<void> {
    this.discussions.set(await firstValueFrom(this.http.get<DiscussionReco[]>(`${URL}/discussions`, this.entetes())));
    this.charge.set(true);
  }

  contacts(): Promise<ContactReco[]> {
    return firstValueFrom(this.http.get<ContactReco[]>(`${URL}/contacts`, this.entetes()));
  }

  /** Ouvre (ou crée) la discussion avec un soignant ou un chauffeur et la place en tête de liste. */
  async ouvrirAvec(c: ContactReco): Promise<DiscussionReco> {
    const corps = c.role === 'Chauffeur' ? { chauffeurId: c.id } : { soignantId: c.id };
    const d = await firstValueFrom(this.http.post<DiscussionReco>(`${URL}/discussions`, corps, this.entetes()));
    const existante = this.discussions().find(x => x.id === d.id);
    if (!existante) this.discussions.update(l => [d, ...l]);
    return existante ?? d;
  }

  async chargerMessages(discussionId: string, plusAnciens = false): Promise<void> {
    const actuels = this.messages()[discussionId] ?? [];
    const avant = plusAnciens && actuels.length ? actuels[0].envoyeLe : undefined;
    const r = await firstValueFrom(this.http.get<{ messages: MessageReco[]; plusAnciens: boolean }>(
      `${URL}/discussions/${discussionId}/messages`, { ...this.entetes(), params: avant ? { avant } : {} }));
    const ids = new Set(r.messages.map(m => m.id));
    this.messages.update(m => ({
      ...m,
      [discussionId]: avant ? [...r.messages, ...actuels] : [...r.messages, ...actuels.filter(x => !ids.has(x.id) && x.envoyeLe > (r.messages.at(-1)?.envoyeLe ?? ''))],
    }));
    this.plusAnciens.update(p => ({ ...p, [discussionId]: r.plusAnciens }));
  }

  /** Envoi optimiste : affiché tout de suite, confirmé (ou marqué en échec) par le serveur. */
  async envoyer(discussionId: string, texte: string): Promise<void> {
    const provisoire: MessageReco = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, discussionId, auteurId: this.moi ?? '',
      texte, envoyeLe: new Date().toISOString(), lusPar: [], etat: 'envoi',
    };
    this.ajouter(provisoire);
    try {
      const m = await firstValueFrom(this.http.post<MessageReco>(`${URL}/discussions/${discussionId}/messages`, { texte }, this.entetes()));
      this.remplacer(discussionId, provisoire.id, m);
      this.majApercu(m);
    } catch (err) {
      this.remplacer(discussionId, provisoire.id, { ...provisoire, etat: 'echec' });
      throw err;
    }
  }

  retirer(discussionId: string, messageId: string): void {
    this.messages.update(m => ({ ...m, [discussionId]: (m[discussionId] ?? []).filter(x => x.id !== messageId) }));
  }

  async marquerLu(discussionId: string): Promise<void> {
    const d = this.discussions().find(x => x.id === discussionId);
    if (!d?.nonLus) return;
    this.discussions.update(l => l.map(x => (x.id === discussionId ? { ...x, nonLus: 0 } : x)));
    await firstValueFrom(this.http.post(`${URL}/discussions/${discussionId}/lu`, {}, this.entetes())).catch(() => {});
  }

  signalerSaisie(discussionId: string): void {
    this.socket?.emit('discussion:ecrit', { discussionId });
  }

  // --- Temps réel ---------------------------------------------------------------------------
  private recevoir(m: MessageReco): void {
    const deMoi = m.auteurId === this.moi;
    const visible = this.ouverte() === m.discussionId && document.visibilityState === 'visible';
    this.ajouter(m);
    this.arreterEcriture(m.discussionId);
    if (!this.discussions().some(d => d.id === m.discussionId)) {
      this.charger().catch(() => {}); // discussion ouverte par l'interlocuteur
      return;
    }
    this.majApercu(m, deMoi || visible ? 0 : 1);
    if (!deMoi && visible) firstValueFrom(this.http.post(`${URL}/discussions/${m.discussionId}/lu`, {}, this.entetes())).catch(() => {});
    if (!deMoi && !visible) navigator.vibrate?.(120);
  }

  /** Dernier message et position en tête de liste. */
  private majApercu(m: MessageReco, nonLusEnPlus = 0): void {
    this.discussions.update(l => {
      const d = l.find(x => x.id === m.discussionId);
      if (!d) return l;
      if (d.dernierMessage?.id === m.id) return l;
      return [{ ...d, dernierMessage: m, dernierMessageLe: m.envoyeLe, nonLus: d.nonLus + nonLusEnPlus }, ...l.filter(x => x.id !== m.discussionId)];
    });
  }

  private accuse(e: { discussionId: string; soignantId: string; le: string }): void {
    if (e.soignantId === this.moi) {
      this.discussions.update(l => l.map(x => (x.id === e.discussionId ? { ...x, nonLus: 0 } : x)));
      return;
    }
    this.messages.update(m => ({
      ...m,
      [e.discussionId]: (m[e.discussionId] ?? []).map(x =>
        x.auteurId === this.moi && !x.lusPar.some(l => l.soignantId === e.soignantId) ? { ...x, lusPar: [...x.lusPar, { soignantId: e.soignantId, le: e.le }] } : x),
    }));
  }

  private signalerEcriture(discussionId: string): void {
    this.enTrainDecrire.update(s => new Set(s).add(discussionId));
    clearTimeout(this.minuteursEcriture.get(discussionId));
    this.minuteursEcriture.set(discussionId, setTimeout(() => this.arreterEcriture(discussionId), 3500));
  }

  private arreterEcriture(discussionId: string): void {
    clearTimeout(this.minuteursEcriture.get(discussionId));
    this.enTrainDecrire.update(s => {
      const n = new Set(s);
      n.delete(discussionId);
      return n;
    });
  }

  private ajouter(m: MessageReco): void {
    const liste = this.messages()[m.discussionId];
    if (!liste || liste.some(x => x.id === m.id)) return;
    this.messages.update(t => ({ ...t, [m.discussionId]: [...liste, m] }));
  }

  private remplacer(discussionId: string, ancienId: string, m: MessageReco): void {
    this.messages.update(t => {
      const liste = (t[discussionId] ?? []).filter(x => x.id !== m.id || x.id === ancienId);
      return { ...t, [discussionId]: liste.map(x => (x.id === ancienId ? m : x)) };
    });
  }
}
