import { Injectable, NgZone, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { API_URL } from '../shared/api';
import { ComiteSessionService } from './comite-session.service';
import { CanalTempsReel } from '../admin/data/groupe-pilotage';

/** Serveur socket.io : même hôte que l'API, sans le préfixe /api. */
const SERVEUR_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Connexion temps réel du comité de pilotage (jeton du comité) : messages privés des médecins
 * chefs et messages du groupe de pilotage. Ouverte tant que la session du comité est active.
 */
@Injectable({ providedIn: 'root' })
export class ComiteTempsReelService implements CanalTempsReel, OnDestroy {
  private session = inject(ComiteSessionService);
  private zone = inject(NgZone);
  private socket?: Socket;
  private ecouteurs = new Map<string, Set<(donnees: any) => void>>();
  private aLaConnexion = new Set<() => void>();
  readonly connecte = signal(false);

  constructor() {
    effect(() => {
      const actif = this.session.connecte();
      untracked(() => (actif ? this.ouvrir() : this.fermer()));
    });
  }

  ngOnDestroy(): void {
    this.fermer();
  }

  sur<T>(evenement: string, f: (donnees: T) => void): () => void {
    const abonnes = this.ecouteurs.get(evenement) ?? new Set();
    abonnes.add(f);
    this.ecouteurs.set(evenement, abonnes);
    return () => abonnes.delete(f);
  }

  /** Appelé à chaque (re)connexion : rattrapage de ce qui a été manqué. */
  surConnexion(f: () => void): () => void {
    this.aLaConnexion.add(f);
    return () => this.aLaConnexion.delete(f);
  }

  emettre(evenement: string, donnees: unknown): void {
    this.socket?.emit(evenement, donnees);
  }

  private ouvrir(): void {
    if (this.socket) return;
    this.socket = this.zone.runOutsideAngular(() => io(SERVEUR_URL, { auth: (cb) => cb({ jeton: this.session.jeton }) }));
    this.socket.onAny((evenement: string, donnees: unknown) => {
      const abonnes = this.ecouteurs.get(evenement);
      if (abonnes?.size) this.zone.run(() => abonnes.forEach(f => f(donnees)));
    });
    this.socket.on('connect', () => this.zone.run(() => {
      this.connecte.set(true);
      this.aLaConnexion.forEach(f => f());
    }));
    this.socket.on('disconnect', () => this.zone.run(() => this.connecte.set(false)));
  }

  private fermer(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.connecte.set(false);
  }
}
