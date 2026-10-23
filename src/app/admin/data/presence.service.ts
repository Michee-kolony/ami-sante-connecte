import { Injectable, NgZone, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { API_URL } from '../../shared/api';
import { SessionService } from './session.service';
import type { RoleSoignant } from './soignants.service';

/** Serveur socket.io : même hôte que l'API, sans le préfixe /api. */
const SERVEUR_URL = API_URL.replace(/\/api\/?$/, '');

/** Soignant ayant au moins une page de l'espace administrateur ouverte. */
export interface SoignantEnLigne {
  id: string;
  prenom: string;
  nom: string;
  postnom: string;
  role: RoleSoignant;
  matricule: string;
  photo: string | null;
  sexe: 'F' | 'M';
  /** Établissement choisi à la connexion. */
  etablissement: string | null;
  connecteDepuis: string;
}

/**
 * Personnel en ligne, en temps réel : tant qu'une session est ouverte, une connexion socket.io
 * reste établie avec le serveur. Il détecte seul chaque arrivée et chaque départ (déconnexion,
 * onglet fermé, réseau perdu) et renvoie aussitôt la liste à jour à tout le personnel.
 */
@Injectable({ providedIn: 'root' })
export class PresenceService implements OnDestroy {
  private session = inject(SessionService);
  private zone = inject(NgZone);
  private socket?: Socket;

  /** Abonnements aux autres événements temps réel (discussions…), conservés entre deux connexions. */
  private ecouteurs = new Map<string, Set<(donnees: any) => void>>();

  readonly enLigne = signal<SoignantEnLigne[]>([]);
  /** Patientes connectées à l'application mobile (identifiants seulement). */
  readonly patientesEnLigne = signal<Set<string>>(new Set());
  /** Liste reçue du serveur (avant, ou pendant une reconnexion : squelette). */
  readonly charge = signal(false);

  constructor() {
    // Connexion à l'ouverture de session, fermeture à la déconnexion (le serveur prévient les autres).
    effect(() => {
      const connecte = this.session.connecte();
      untracked(() => (connecte ? this.ouvrir() : this.fermer()));
    });
  }

  ngOnDestroy(): void {
    this.fermer();
  }

  /** Soignant ou patiente (application mobile) actuellement en ligne. */
  estEnLigne(id: string): boolean {
    return this.enLigne().some(s => s.id === id) || this.patientesEnLigne().has(id);
  }

  /** S'abonne à un événement temps réel ; renvoie la fonction de désabonnement. */
  sur<T>(evenement: string, f: (donnees: T) => void): () => void {
    const abonnes = this.ecouteurs.get(evenement) ?? new Set();
    abonnes.add(f);
    this.ecouteurs.set(evenement, abonnes);
    return () => abonnes.delete(f);
  }

  /** Envoie un événement au serveur (ignoré hors connexion). */
  emettre(evenement: string, donnees: unknown): void {
    this.socket?.emit(evenement, donnees);
  }

  private ouvrir(): void {
    if (this.socket) return;
    // Hors zone Angular : les pings du socket ne relancent pas la détection de changements.
    // Transports par défaut : requêtes HTTPS (polling) d'abord, puis passage automatique au
    // WebSocket (WSS) si le serveur et le proxy (Nginx) le permettent. Le temps réel fonctionne
    // ainsi même derrière un proxy qui bloque le WebSocket.
    this.socket = this.zone.runOutsideAngular(() => io(SERVEUR_URL, {
      auth: (cb) => cb({ jeton: this.session.jeton }),
    }));
    // Autres événements : remis aux abonnés dans la zone Angular (mise à jour de l'affichage).
    this.socket.onAny((evenement: string, donnees: unknown) => {
      const abonnes = this.ecouteurs.get(evenement);
      if (abonnes?.size) this.zone.run(() => abonnes.forEach(f => f(donnees)));
    });
    this.socket.on('presence', (liste: SoignantEnLigne[]) => {
      this.enLigne.set(liste);
      this.charge.set(true);
    });
    this.socket.on('presence:patientes', (ids: string[]) => this.patientesEnLigne.set(new Set(ids)));
    // Serveur redémarré ou réseau coupé : socket.io se reconnecte seul et le serveur renvoie la liste.
    this.socket.on('disconnect', () => this.charge.set(false));
  }

  private fermer(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.enLigne.set([]);
    this.patientesEnLigne.set(new Set());
    this.charge.set(false);
  }
}
