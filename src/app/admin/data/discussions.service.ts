import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import { PresenceService } from './presence.service';
import { SessionService } from './session.service';

export interface Interlocuteur {
  id: string;
  prenom: string;
  nom: string;
  role: string;
  photo: string | null;
  matricule: string;
  statut: string;
}

export interface MessageDiscussion {
  id: string;
  discussionId: string;
  auteurId: string;
  texte: string;
  envoyeLe: string;
  lusPar: { soignantId: string; le: string }[];
  /** Côté client : envoi en cours ou échoué (message affiché avant la réponse du serveur). */
  etat?: 'envoi' | 'echec';
}

export interface Discussion {
  id: string;
  interlocuteur: Interlocuteur | null;
  dernierMessage: MessageDiscussion | null;
  nonLus: number;
  dernierMessageLe: string | null;
}

/**
 * Discussions privées entre soignants. L'historique vient de l'API ; les nouveaux messages,
 * accusés de lecture et « en train d'écrire » arrivent en temps réel par socket.io.
 */
@Injectable({ providedIn: 'root' })
export class DiscussionsService {
  private http = inject(HttpClient);
  private presence = inject(PresenceService);
  private session = inject(SessionService);
  private url = `${API_URL}/discussions`;

  readonly discussions = signal<Discussion[]>([]);
  readonly charge = signal(false);
  /** Messages chargés, par discussion. */
  readonly messages = signal<Record<string, MessageDiscussion[]>>({});
  readonly plusAnciens = signal<Record<string, boolean>>({});
  /** Discussion affichée à l'écran (ses messages entrants sont marqués lus aussitôt). */
  readonly ouverte = signal<string | null>(null);
  /** Discussions où l'interlocuteur est en train d'écrire. */
  readonly enTrainDecrire = signal<Set<string>>(new Set());
  private minuteursEcriture = new Map<string, ReturnType<typeof setTimeout>>();

  readonly totalNonLus = computed(() => this.discussions().reduce((t, d) => t + d.nonLus, 0));

  /** Message reçu d'un collègue alors que sa discussion n'est pas affichée (popup, son…). */
  readonly arrivees = new Subject<{ message: MessageDiscussion; discussion: Discussion }>();
  /** Discussion à ouvrir dès que la page Discussions est affichée (clic sur un popup). */
  readonly aOuvrir = signal<string | null>(null);

  constructor() {
    // (Re)chargement à chaque connexion temps réel, pour rattraper ce qui a été manqué.
    effect(() => {
      const pret = this.session.connecte() && this.presence.charge();
      untracked(() => {
        if (pret) this.charger().catch(() => {});
        else if (!this.session.connecte()) this.vider();
      });
    });
    this.presence.sur<MessageDiscussion>('discussion:message', m => this.recevoir(m));
    this.presence.sur<{ discussionId: string; soignantId: string; le: string }>('discussion:lu', e => this.accuse(e));
    this.presence.sur<{ discussionId: string; soignantId: string }>('discussion:ecrit', e => this.signalerEcriture(e.discussionId));
  }

  get moi(): string | undefined {
    return this.session.soignant()?.id;
  }

  async charger(): Promise<void> {
    this.discussions.set(await firstValueFrom(this.http.get<Discussion[]>(this.url)));
    this.charge.set(true);
  }

  annuaire(): Promise<Interlocuteur[]> {
    return firstValueFrom(this.http.get<Interlocuteur[]>(`${this.url}/annuaire`));
  }

  /** Ouvre (ou crée) la discussion avec un soignant et la place en tête de liste. */
  async ouvrirAvec(soignantId: string): Promise<Discussion> {
    const d = await firstValueFrom(this.http.post<Discussion>(this.url, { soignantId }));
    const existante = this.discussions().find(x => x.id === d.id);
    if (!existante) this.discussions.update(l => [d, ...l]);
    return existante ?? d;
  }

  async chargerMessages(discussionId: string, plusAnciens = false): Promise<void> {
    const actuels = this.messages()[discussionId] ?? [];
    const avant = plusAnciens && actuels.length ? actuels[0].envoyeLe : undefined;
    const r = await firstValueFrom(this.http.get<{ messages: MessageDiscussion[]; plusAnciens: boolean }>(
      `${this.url}/${discussionId}/messages`, { params: avant ? { avant } : {} }));
    this.messages.update(m => ({ ...m, [discussionId]: avant ? [...r.messages, ...actuels] : this.fusionner(r.messages, actuels) }));
    this.plusAnciens.update(p => ({ ...p, [discussionId]: r.plusAnciens }));
  }

  /** Envoi optimiste : affiché tout de suite, confirmé (ou marqué en échec) par le serveur. */
  async envoyer(discussionId: string, texte: string): Promise<void> {
    const provisoire: MessageDiscussion = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, discussionId, auteurId: this.moi ?? '',
      texte, envoyeLe: new Date().toISOString(), lusPar: [], etat: 'envoi',
    };
    this.ajouter(provisoire);
    try {
      const m = await firstValueFrom(this.http.post<MessageDiscussion>(`${this.url}/${discussionId}/messages`, { texte }));
      this.remplacer(discussionId, provisoire.id, m);
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
    await firstValueFrom(this.http.post(`${this.url}/${discussionId}/lu`, {})).catch(() => {});
  }

  /** Signale « en train d'écrire » à l'interlocuteur (limité côté serveur). */
  signalerSaisie(discussionId: string): void {
    this.presence.emettre('discussion:ecrit', { discussionId });
  }

  // --- Événements temps réel -------------------------------------------------------------
  private recevoir(m: MessageDiscussion): void {
    const deMoi = m.auteurId === this.moi;
    const visible = this.ouverte() === m.discussionId && document.visibilityState === 'visible';
    this.ajouter(m);
    this.arreterEcriture(m.discussionId);
    const connue = this.discussions().some(d => d.id === m.discussionId);
    if (!connue) {
      // Nouvelle discussion ouverte par l'interlocuteur : liste rechargée, puis notification.
      this.charger()
        .then(() => {
          const d = this.discussions().find(x => x.id === m.discussionId);
          if (d && !deMoi) this.arrivees.next({ message: m, discussion: d });
        })
        .catch(() => {});
      return;
    }
    this.discussions.update(l => {
      const d = l.find(x => x.id === m.discussionId)!;
      const maj = { ...d, dernierMessage: m, dernierMessageLe: m.envoyeLe, nonLus: d.nonLus + (deMoi || visible ? 0 : 1) };
      return [maj, ...l.filter(x => x.id !== m.discussionId)];
    });
    if (!deMoi && visible) {
      firstValueFrom(this.http.post(`${this.url}/${m.discussionId}/lu`, {})).catch(() => {});
    } else if (!deMoi) {
      this.arrivees.next({ message: m, discussion: this.discussions()[0] });
    }
  }

  private accuse(e: { discussionId: string; soignantId: string; le: string }): void {
    if (e.soignantId === this.moi) {
      this.discussions.update(l => l.map(x => (x.id === e.discussionId ? { ...x, nonLus: 0 } : x)));
      return;
    }
    this.messages.update(m => ({
      ...m,
      [e.discussionId]: (m[e.discussionId] ?? []).map(x =>
        x.auteurId === this.moi && !x.lusPar.some(l => l.soignantId === e.soignantId)
          ? { ...x, lusPar: [...x.lusPar, { soignantId: e.soignantId, le: e.le }] } : x),
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

  // --- Outils ---------------------------------------------------------------------------------
  private ajouter(m: MessageDiscussion): void {
    const liste = this.messages()[m.discussionId];
    if (!liste || liste.some(x => x.id === m.id)) return; // pas encore chargée, ou déjà reçu
    this.messages.update(t => ({ ...t, [m.discussionId]: [...liste, m] }));
  }

  private remplacer(discussionId: string, ancienId: string, m: MessageDiscussion): void {
    this.messages.update(t => {
      const liste = (t[discussionId] ?? []).filter(x => x.id !== m.id || x.id === ancienId);
      return { ...t, [discussionId]: liste.map(x => (x.id === ancienId ? m : x)) };
    });
  }

  /** Page la plus récente + messages arrivés en temps réel pendant le chargement. */
  private fusionner(page: MessageDiscussion[], actuels: MessageDiscussion[]): MessageDiscussion[] {
    const ids = new Set(page.map(m => m.id));
    return [...page, ...actuels.filter(m => !ids.has(m.id) && m.envoyeLe > (page.at(-1)?.envoyeLe ?? ''))];
  }

  private vider(): void {
    this.discussions.set([]);
    this.messages.set({});
    this.charge.set(false);
    this.ouverte.set(null);
  }
}
