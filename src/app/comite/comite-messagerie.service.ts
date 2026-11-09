import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_COMITE, ComiteSessionService } from './comite-session.service';
import { ComiteTempsReelService } from './comite-temps-reel.service';
import { GroupePilotage } from '../admin/data/groupe-pilotage';
import type { Discussion, Interlocuteur, MessageDiscussion } from '../admin/data/discussions.service';

/** Médecin chef proposé dans l'annuaire du comité (avec son établissement principal). */
export interface ChefAnnuaire extends Interlocuteur {
  etablissement: string;
}

/**
 * Messagerie du comité de pilotage : discussions privées avec les médecins chefs et groupe de
 * pilotage. Historique par l'API, nouveaux messages et accusés de lecture en temps réel.
 */
@Injectable({ providedIn: 'root' })
export class ComiteMessagerieService {
  private http = inject(HttpClient);
  private session = inject(ComiteSessionService);
  private tempsReel = inject(ComiteTempsReelService);
  private url = `${API_COMITE}/discussions`;

  readonly discussions = signal<Discussion[]>([]);
  readonly charge = signal(false);
  readonly messages = signal<Record<string, MessageDiscussion[]>>({});
  readonly plusAnciens = signal<Record<string, boolean>>({});
  /** Discussion affichée (ses messages entrants sont lus aussitôt). */
  readonly ouverte = signal<string | null>(null);
  readonly enTrainDecrire = signal<Set<string>>(new Set());
  private minuteurs = new Map<string, ReturnType<typeof setTimeout>>();

  readonly groupe = new GroupePilotage(this.http, `${API_COMITE}/groupe-pilotage`, () => this.moi, this.tempsReel);
  readonly totalNonLus = computed(() => this.discussions().reduce((t, d) => t + d.nonLus, 0) + this.groupe.nonLus());

  get moi(): string | undefined {
    return this.session.membre()?.id;
  }

  constructor() {
    this.tempsReel.surConnexion(() => {
      this.charger().catch(() => {});
      this.groupe.chargerResume().catch(() => {});
    });
    effect(() => {
      if (!this.session.connecte()) untracked(() => this.vider());
    });
    this.tempsReel.sur<MessageDiscussion>('discussion:message', m => this.recevoir(m));
    this.tempsReel.sur<{ discussionId: string; soignantId: string; le: string }>('discussion:lu', e => this.accuse(e));
    this.tempsReel.sur<{ discussionId: string }>('discussion:ecrit', e => this.signalerEcriture(e.discussionId));
  }

  async charger(): Promise<void> {
    this.discussions.set(await firstValueFrom(this.http.get<Discussion[]>(this.url)));
    this.charge.set(true);
  }

  annuaire(): Promise<ChefAnnuaire[]> {
    return firstValueFrom(this.http.get<ChefAnnuaire[]>(`${this.url}/annuaire`));
  }

  async ouvrirAvec(soignantId: string): Promise<Discussion> {
    const d = await firstValueFrom(this.http.post<Discussion>(this.url, { soignantId }));
    const existante = this.discussions().find(x => x.id === d.id);
    if (!existante) this.discussions.update(l => [d, ...l]);
    return existante ?? d;
  }

  async chargerMessages(id: string, plusAnciens = false): Promise<void> {
    const actuels = this.messages()[id] ?? [];
    const avant = plusAnciens && actuels.length ? actuels[0].envoyeLe : undefined;
    const r = await firstValueFrom(this.http.get<{ messages: MessageDiscussion[]; plusAnciens: boolean }>(`${this.url}/${id}/messages`, { params: avant ? { avant } : {} }));
    this.messages.update(m => ({ ...m, [id]: avant ? [...r.messages, ...actuels] : r.messages }));
    this.plusAnciens.update(p => ({ ...p, [id]: r.plusAnciens }));
  }

  async envoyer(id: string, texte: string): Promise<void> {
    const provisoire: MessageDiscussion = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, discussionId: id, auteurId: this.moi ?? '',
      texte, envoyeLe: new Date().toISOString(), lusPar: [], etat: 'envoi',
    };
    this.messages.update(t => ({ ...t, [id]: [...(t[id] ?? []), provisoire] }));
    try {
      const m = await firstValueFrom(this.http.post<MessageDiscussion>(`${this.url}/${id}/messages`, { texte }));
      this.messages.update(t => {
        const liste = t[id] ?? [];
        return { ...t, [id]: liste.some(x => x.id === m.id) ? liste.filter(x => x.id !== provisoire.id) : liste.map(x => (x.id === provisoire.id ? m : x)) };
      });
    } catch (err) {
      this.messages.update(t => ({ ...t, [id]: (t[id] ?? []).map(x => (x.id === provisoire.id ? { ...x, etat: 'echec' as const } : x)) }));
      throw err;
    }
  }

  retirer(id: string, messageId: string): void {
    this.messages.update(t => ({ ...t, [id]: (t[id] ?? []).filter(x => x.id !== messageId) }));
  }

  async marquerLu(id: string): Promise<void> {
    const d = this.discussions().find(x => x.id === id);
    if (!d?.nonLus) return;
    this.discussions.update(l => l.map(x => (x.id === id ? { ...x, nonLus: 0 } : x)));
    await firstValueFrom(this.http.post(`${this.url}/${id}/lu`, {})).catch(() => {});
  }

  signalerSaisie(id: string): void {
    this.tempsReel.emettre('discussion:ecrit', { discussionId: id });
  }

  private recevoir(m: MessageDiscussion): void {
    const deMoi = m.auteurId === this.moi;
    const visible = this.ouverte() === m.discussionId && document.visibilityState === 'visible';
    const liste = this.messages()[m.discussionId];
    if (liste && !liste.some(x => x.id === m.id) && !(deMoi && liste.some(x => x.etat === 'envoi' && x.texte === m.texte))) {
      this.messages.update(t => ({ ...t, [m.discussionId]: [...liste, m] }));
    }
    this.arreterEcriture(m.discussionId);
    if (!this.discussions().some(d => d.id === m.discussionId)) {
      this.charger().catch(() => {});
      return;
    }
    this.discussions.update(l => {
      const d = l.find(x => x.id === m.discussionId)!;
      return [{ ...d, dernierMessage: m, dernierMessageLe: m.envoyeLe, nonLus: d.nonLus + (deMoi || visible ? 0 : 1) }, ...l.filter(x => x.id !== m.discussionId)];
    });
    if (!deMoi && visible) firstValueFrom(this.http.post(`${this.url}/${m.discussionId}/lu`, {})).catch(() => {});
  }

  private accuse(e: { discussionId: string; soignantId: string; le: string }): void {
    if (e.soignantId === this.moi) {
      this.discussions.update(l => l.map(x => (x.id === e.discussionId ? { ...x, nonLus: 0 } : x)));
      return;
    }
    this.messages.update(t => ({
      ...t,
      [e.discussionId]: (t[e.discussionId] ?? []).map(x => (x.auteurId === this.moi && !x.lusPar.some(l => l.soignantId === e.soignantId)
        ? { ...x, lusPar: [...x.lusPar, { soignantId: e.soignantId, le: e.le }] } : x)),
    }));
  }

  private signalerEcriture(id: string): void {
    this.enTrainDecrire.update(s => new Set(s).add(id));
    clearTimeout(this.minuteurs.get(id));
    this.minuteurs.set(id, setTimeout(() => this.arreterEcriture(id), 3500));
  }

  private arreterEcriture(id: string): void {
    clearTimeout(this.minuteurs.get(id));
    this.enTrainDecrire.update(s => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  private vider(): void {
    this.discussions.set([]);
    this.messages.set({});
    this.charge.set(false);
    this.ouverte.set(null);
  }
}
