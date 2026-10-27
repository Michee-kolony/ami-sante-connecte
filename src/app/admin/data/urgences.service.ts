import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import { arreterSirene, carillon, demarrerSirene } from '../../shared/son';
import { AlerteUrgence, EvenementUrgence, MessageUrgence, TypeEvenement } from './urgences';
import { PresenceService } from './presence.service';
import { SessionService } from './session.service';

const CLE_MUET = 'ami-urgences-muet';

function lireMuet(): boolean {
  try {
    return localStorage.getItem(CLE_MUET) === '1';
  } catch {
    return false;
  }
}

/** Minutes entre deux instants ISO. */
function minutesEntre(debut: string, fin: string): number {
  return Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60_000);
}

/**
 * Urgences (alertes de détresse des patientes), en temps réel : chargées depuis l'API à
 * l'ouverture de session puis tenues à jour par socket.io (« urgence:nouvelle », « urgence:maj »).
 * Tant qu'une alerte attend sa prise en charge, la sirène sonne sur toutes les pages de
 * l'espace administrateur — sauf si l'utilisateur a coupé le son (choix mémorisé).
 */
@Injectable({ providedIn: 'root' })
export class UrgencesService {
  private http = inject(HttpClient);
  private session = inject(SessionService);
  private presence = inject(PresenceService);
  private url = `${API_URL}/urgences`;

  readonly alertes = signal<AlerteUrgence[]>([]);
  readonly charge = signal(false);
  /** Sirène coupée par l'utilisateur. */
  readonly muet = signal(lireMuet());
  /** Dernière alerte arrivée (bandeau d'annonce). */
  readonly derniereArrivee = signal<AlerteUrgence | null>(null);

  readonly nouvelles = computed(() => this.alertes().filter(a => a.etat === 'nouvelle').length);

  /** Chat de chaque urgence (chargé à l'ouverture de la conversation, puis en temps réel). */
  readonly messages = signal<Partial<Record<string, MessageUrgence[]>>>({});
  /** Messages non lus de la patiente ou du chauffeur, par urgence. */
  readonly nonLus = signal<Partial<Record<string, number>>>({});
  /** Conversation affichée à l'écran (ses messages sont lus aussitôt). */
  private conversationOuverte: string | null = null;

  constructor() {
    effect(() => {
      const connecte = this.session.connecte();
      untracked(() => {
        if (connecte) this.charger().catch(() => {});
        else {
          this.alertes.set([]);
          this.charge.set(false);
        }
      });
    });
    // Sirène : tant qu'une alerte n'est pas prise en charge, sauf son coupé.
    effect(() => (this.nouvelles() > 0 && !this.muet() && this.session.connecte() ? demarrerSirene() : arreterSirene()));

    this.presence.sur<AlerteUrgence>('urgence:nouvelle', a => {
      this.remplacer(a);
      this.derniereArrivee.set(a);
    });
    this.presence.sur<AlerteUrgence>('urgence:maj', a => this.remplacer(a));
    this.presence.sur<{ urgence: string; lat: number; lng: number; precisionM: number | null }>('urgence:position', p =>
      this.alertes.update(liste => liste.map(a => (a.id === p.urgence ? Object.assign(a, { lat: p.lat, lng: p.lng, precisionM: p.precisionM }) : a))));
    this.presence.sur<MessageUrgence>('urgence:message', m => this.recevoirMessage(m));
    // Mission terminée : la conversation est supprimée définitivement par le serveur.
    this.presence.sur<{ urgence: string }>('urgence:conversation-supprimee', ({ urgence }) => {
      this.messages.update(t => ({ ...t, [urgence]: [] }));
      this.nonLus.update(n => ({ ...n, [urgence]: 0 }));
    });
    // Reconnexion après une coupure : on recharge pour ne rien manquer.
    this.presence.surConnexion(() => this.session.connecte() && this.charger().catch(() => {}));
  }

  basculerSon(): void {
    const muet = !this.muet();
    this.muet.set(muet);
    try {
      localStorage.setItem(CLE_MUET, muet ? '1' : '0');
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  }

  alerte(id: string | null | undefined): AlerteUrgence | undefined {
    return id ? this.alertes().find(a => a.id === id) : undefined;
  }

  /** Urgences actives et celles des 90 derniers jours (historique). */
  async charger(): Promise<void> {
    const liste = await firstValueFrom(this.http.get<AlerteUrgence[]>(`${this.url}?etat=toutes&jours=90`));
    this.alertes.set(liste);
    this.charge.set(true);
  }

  async prendreEnCharge(a: AlerteUrgence): Promise<AlerteUrgence> {
    return this.remplacer(await firstValueFrom(this.http.post<AlerteUrgence>(`${this.url}/${a.id}/prise-en-charge`, {})));
  }

  /** Envoie le chauffeur et l'ambulance choisis vers la patiente. */
  async affecter(a: AlerteUrgence, chauffeurId: string, ambulance: string, infirmierId: string | null): Promise<AlerteUrgence> {
    return this.remplacer(await firstValueFrom(this.http.post<AlerteUrgence>(`${this.url}/${a.id}/affectation`, { chauffeurId, ambulance, infirmierId })));
  }

  async cloturer(a: AlerteUrgence, detail = ''): Promise<AlerteUrgence> {
    return this.remplacer(await firstValueFrom(this.http.post<AlerteUrgence>(`${this.url}/${a.id}/cloture`, { detail })));
  }

  async annuler(a: AlerteUrgence, motif: string): Promise<AlerteUrgence> {
    return this.remplacer(await firstValueFrom(this.http.post<AlerteUrgence>(`${this.url}/${a.id}/annulation`, { motif })));
  }

  // --- Chat de l'urgence -----------------------------------------------------------

  /** Ouvre la conversation d'une urgence : messages chargés et marqués comme lus. */
  async ouvrirConversation(numero: string | null): Promise<void> {
    this.conversationOuverte = numero;
    if (!numero) return;
    this.nonLus.update(n => ({ ...n, [numero]: 0 }));
    const liste = await firstValueFrom(this.http.get<MessageUrgence[]>(`${this.url}/${numero}/messages`));
    this.messages.update(m => ({ ...m, [numero]: liste }));
  }

  async envoyerMessage(numero: string, texte: string): Promise<void> {
    this.recevoirMessage(await firstValueFrom(this.http.post<MessageUrgence>(`${this.url}/${numero}/messages`, { texte })));
  }

  private recevoirMessage(m: MessageUrgence): void {
    const fil = this.messages()[m.urgence] ?? [];
    if (fil.some(x => x.id === m.id)) return;
    this.messages.update(t => ({ ...t, [m.urgence]: [...fil, m] }));
    if (m.auteur.type === 'regulation') return;
    // Message de la patiente ou du chauffeur : carillon, et non lu si la conversation n'est pas affichée.
    if (!this.muet()) carillon();
    if (this.conversationOuverte !== m.urgence) this.nonLus.update(n => ({ ...n, [m.urgence]: (n[m.urgence] ?? 0) + 1 }));
  }

  /**
   * Remplace l'alerte (ou l'ajoute en tête). L'objet affiché est mis à jour sur place : la page
   * garde une référence à l'alerte sélectionnée.
   */
  private remplacer(a: AlerteUrgence): AlerteUrgence {
    const liste = this.alertes();
    const existante = liste.find(x => x.id === a.id);
    if (existante) {
      Object.assign(existante, a);
      this.alertes.set([...liste]);
      return existante;
    }
    this.alertes.set([a, ...liste].sort((x, y) => y.creeLe.localeCompare(x.creeLe)));
    return a;
  }

  // --- Indicateurs ---------------------------------------------------------------

  private evenement(a: AlerteUrgence, type: TypeEvenement): EvenementUrgence | undefined {
    return a.evenements.find(e => e.type === type);
  }

  /** Délai entre l'alerte et l'arrivée de l'ambulance sur place (min). */
  delaiArrivee(a: AlerteUrgence): number | null {
    const recu = this.evenement(a, 'Alerte reçue');
    const surPlace = this.evenement(a, 'Arrivée sur place');
    return recu && surPlace ? minutesEntre(recu.le, surPlace.le) : null;
  }

  /** Durée totale, de l'alerte à la clôture (min). */
  dureeTotale(a: AlerteUrgence): number | null {
    const recu = this.evenement(a, 'Alerte reçue');
    const fin = this.evenement(a, 'Clôturée') ?? this.evenement(a, 'Annulée');
    return recu && fin ? minutesEntre(recu.le, fin.le) : null;
  }
}
