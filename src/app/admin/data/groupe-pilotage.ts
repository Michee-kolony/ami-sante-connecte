import { HttpClient } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Membre du groupe de pilotage : médecin chef (soignant) ou membre du comité. */
export interface MembreGroupe {
  id: string;
  type: 'soignant' | 'comite';
  prenom: string;
  nom: string;
  photo: string | null;
  /** « Président du comité », « Médecin chef · Centre … »… */
  detail: string;
}

export interface MessageGroupe {
  id: string;
  auteurId: string;
  auteurType: 'soignant' | 'comite';
  texte: string;
  envoyeLe: string;
  lusPar: { id: string; le: string }[];
  /** Côté client : envoi en cours ou échoué. */
  etat?: 'envoi' | 'echec';
}

/** Canal temps réel (socket de l'espace professionnel ou de l'espace du comité). */
export interface CanalTempsReel {
  sur<T>(evenement: string, f: (donnees: T) => void): () => void;
  emettre(evenement: string, donnees: unknown): void;
}

/**
 * Groupe de pilotage : conversation commune aux médecins chefs et au comité de pilotage.
 * Même logique dans les deux espaces ; seules l'adresse de l'API et la connexion temps réel changent.
 */
export class GroupePilotage {
  readonly membres = signal<MembreGroupe[]>([]);
  readonly messages = signal<MessageGroupe[]>([]);
  readonly nonLus = signal(0);
  readonly dernier = signal<MessageGroupe | null>(null);
  readonly plusAnciens = signal(false);
  readonly charge = signal(false);
  /** Le fil est affiché à l'écran : les messages entrants sont lus aussitôt. */
  readonly ouvert = signal(false);
  /** Membre en train d'écrire (affiché quelques secondes). */
  readonly ecrit = signal<string | null>(null);
  private minuteur?: ReturnType<typeof setTimeout>;

  readonly auteurs = computed(() => Object.fromEntries(this.membres().map(m => [m.id, m])));

  constructor(
    private http: HttpClient,
    private base: string,
    private moi: () => string | undefined,
    canal: CanalTempsReel,
  ) {
    canal.sur<MessageGroupe>('groupe:message', m => this.recevoir(m));
    canal.sur<{ id: string; le: string }>('groupe:lu', e => this.accuse(e));
    canal.sur<{ auteurId: string }>('groupe:ecrit', e => this.signalerEcriture(e.auteurId));
    this.emettreEcrit = () => canal.emettre('groupe:ecrit', {});
  }

  /** Signale « en train d'écrire » au groupe (limité côté serveur). */
  emettreEcrit: () => void;

  /** Résumé : membres, dernier message, non lus. */
  async chargerResume(): Promise<void> {
    const r = await firstValueFrom(this.http.get<{ membres: MembreGroupe[]; dernierMessage: MessageGroupe | null; nonLus: number }>(this.base));
    this.membres.set(r.membres);
    this.dernier.set(r.dernierMessage);
    this.nonLus.set(r.nonLus);
  }

  async chargerMessages(plusAnciens = false): Promise<void> {
    const actuels = this.messages();
    const avant = plusAnciens && actuels.length ? actuels[0].envoyeLe : undefined;
    const r = await firstValueFrom(this.http.get<{ messages: MessageGroupe[]; plusAnciens: boolean }>(`${this.base}/messages`, { params: avant ? { avant } : {} }));
    this.messages.set(avant ? [...r.messages, ...actuels] : r.messages);
    this.plusAnciens.set(r.plusAnciens);
    this.charge.set(true);
  }

  async envoyer(texte: string): Promise<void> {
    const provisoire: MessageGroupe = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, auteurId: this.moi() ?? '', auteurType: 'soignant',
      texte, envoyeLe: new Date().toISOString(), lusPar: [], etat: 'envoi',
    };
    this.messages.update(l => [...l, provisoire]);
    try {
      const m = await firstValueFrom(this.http.post<MessageGroupe>(`${this.base}/messages`, { texte }));
      // Le message a pu arriver d'abord par le temps réel : pas de doublon.
      this.messages.update(l => (l.some(x => x.id === m.id) ? l.filter(x => x.id !== provisoire.id) : l.map(x => (x.id === provisoire.id ? m : x))));
      this.dernier.set(m);
    } catch (err) {
      this.messages.update(l => l.map(x => (x.id === provisoire.id ? { ...x, etat: 'echec' as const } : x)));
      throw err;
    }
  }

  retirer(id: string): void {
    this.messages.update(l => l.filter(x => x.id !== id));
  }

  async marquerLu(): Promise<void> {
    if (!this.nonLus()) return;
    this.nonLus.set(0);
    await firstValueFrom(this.http.post(`${this.base}/lu`, {})).catch(() => {});
  }

  private recevoir(m: MessageGroupe): void {
    const deMoi = m.auteurId === this.moi();
    if (this.charge() && !this.messages().some(x => x.id === m.id)) {
      // Mon propre message : remplacé par la réponse de l'API (voir envoyer).
      if (!deMoi || !this.messages().some(x => x.etat === 'envoi' && x.texte === m.texte)) this.messages.update(l => [...l, m]);
    }
    this.dernier.set(m);
    if (this.ecrit() === m.auteurId) this.ecrit.set(null);
    if (deMoi) return;
    if (this.ouvert() && document.visibilityState === 'visible') {
      firstValueFrom(this.http.post(`${this.base}/lu`, {})).catch(() => {});
    } else {
      this.nonLus.update(n => n + 1);
    }
  }

  private accuse(e: { id: string; le: string }): void {
    if (e.id === this.moi()) {
      this.nonLus.set(0);
      return;
    }
    this.messages.update(l => l.map(x => (x.lusPar.some(p => p.id === e.id) ? x : { ...x, lusPar: [...x.lusPar, { id: e.id, le: e.le }] })));
  }

  private signalerEcriture(auteurId: string): void {
    if (auteurId === this.moi()) return;
    this.ecrit.set(auteurId);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.ecrit.set(null), 3500);
  }
}
