import { AfterViewChecked, Component, ElementRef, Input, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { Discussion, DiscussionsService, Interlocuteur, MessageDiscussion } from '../../data/discussions.service';
import { heureFr, jourLocal } from '../../data/format';
import { PresenceService } from '../../data/presence.service';
import { SessionService, messageErreur } from '../../data/session.service';

/** Modèles de messages rapides (texte discret, sans détail médical). */
const MODELES = [
  'Bonjour, comment vous sentez-vous aujourd’hui ?',
  'Petit rappel : n’oubliez pas votre prochain rendez-vous. Pensez à apporter votre carnet.',
  'Merci pour votre message, je vous réponds au plus vite.',
  'En cas de saignement, de fortes douleurs ou de fièvre, rendez-vous immédiatement à l’hôpital.',
];

/**
 * Messages avec les patientes de l'application mobile, en temps réel : présence « en ligne »,
 * « en train d'écrire », accusés de lecture. Mêmes discussions chiffrées que celles entre soignants.
 * Route : /admin/messages, ou /admin/messages?patiente=<numéro AC-PAT-…> pour écrire directement.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './messages.component.html',
})
export class MessagesComponent implements AfterViewChecked, OnDestroy {
  service = inject(DiscussionsService);
  presence = inject(PresenceService);
  session = inject(SessionService);
  heure = heureFr;
  modeles = MODELES;
  readonly TAILLE_MAX = 2000;

  @ViewChild('fil') private filRef?: ElementRef<HTMLElement>;
  @ViewChild('saisie') private saisieRef?: ElementRef<HTMLTextAreaElement>;
  private defilerEnBas = false;
  private derniereSaisie = 0;

  recherche = signal('');
  texte = '';
  erreur = '';
  chargementFil = false;
  afficherModeles = false;

  constructor() {
    // Popup ou panneau flottant : ouvre la conversation demandée.
    effect(() => {
      const id = this.service.aOuvrir();
      const d = id ? this.service.patientes().find(x => x.id === id) : null;
      if (!d) return;
      untracked(() => {
        this.service.aOuvrir.set(null);
        this.ouvrir(d);
      });
    });
  }

  /** Écrire directement à une patiente : ?patiente=<numéro>. */
  @Input() set patiente(id: string | undefined) {
    if (id) this.demarrerAvec(id);
  }

  actif = computed(() => {
    const d = this.service.patientes().find(x => x.id === this.service.ouverte());
    return d ?? null;
  });
  messagesActifs = computed(() => (this.actif() ? this.service.messages()[this.actif()!.id] ?? [] : []));
  nbEnLigne = computed(() => this.service.patientes().filter(d => d.interlocuteur && this.presence.estEnLigne(d.interlocuteur.id)).length);

  liste = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.service.patientes().filter(d => !q || `${d.interlocuteur?.prenom} ${d.interlocuteur?.nom} ${d.interlocuteur?.matricule}`.toLowerCase().includes(q));
  });

  /** Messages regroupés par jour (« Aujourd’hui », « Hier »…). */
  groupes = computed(() => {
    const groupes: { jour: string; libelle: string; messages: MessageDiscussion[] }[] = [];
    for (const m of this.messagesActifs()) {
      const jour = jourLocal(m.envoyeLe);
      let g = groupes.at(-1);
      if (!g || g.jour !== jour) {
        g = { jour, libelle: this.libelleJour(jour), messages: [] };
        groupes.push(g);
      }
      g.messages.push(m);
    }
    return groupes;
  });

  ngAfterViewChecked(): void {
    if (this.defilerEnBas && this.filRef) {
      this.filRef.nativeElement.scrollTop = this.filRef.nativeElement.scrollHeight;
      this.defilerEnBas = false;
    }
  }

  ngOnDestroy(): void {
    this.service.ouverte.set(null);
  }

  get moi(): string | undefined {
    return this.session.soignant()?.id;
  }

  // --- Ouverture -------------------------------------------------------------------------
  async ouvrir(d: Discussion): Promise<void> {
    this.service.ouverte.set(d.id);
    this.erreur = '';
    this.texte = '';
    this.afficherModeles = false;
    this.defilerEnBas = true;
    if (!this.service.messages()[d.id]) {
      this.chargementFil = true;
      try {
        await this.service.chargerMessages(d.id);
      } catch (err) {
        this.erreur = messageErreur(err);
      } finally {
        this.chargementFil = false;
      }
    }
    this.defilerEnBas = true;
    this.service.marquerLu(d.id);
    setTimeout(() => this.saisieRef?.nativeElement.focus());
  }

  fermer(): void {
    this.service.ouverte.set(null);
  }

  async plusAnciens(): Promise<void> {
    const d = this.actif();
    if (!d || !this.filRef) return;
    const el = this.filRef.nativeElement;
    const hauteurAvant = el.scrollHeight;
    await this.service.chargerMessages(d.id, true).catch(err => (this.erreur = messageErreur(err)));
    setTimeout(() => (el.scrollTop = el.scrollHeight - hauteurAvant));
  }

  // --- Nouvelle conversation : recherche des patientes joignables -----------------------------
  rechercheOuverte = false;
  rechercheQ = '';
  resultats: Interlocuteur[] = [];
  chargementRecherche = false;
  private minuteurRecherche?: ReturnType<typeof setTimeout>;

  ouvrirRecherche(): void {
    this.rechercheOuverte = true;
    this.rechercheQ = '';
    this.chercher();
  }

  surRecherche(): void {
    clearTimeout(this.minuteurRecherche);
    this.minuteurRecherche = setTimeout(() => this.chercher(), 300);
  }

  private async chercher(): Promise<void> {
    this.chargementRecherche = true;
    try {
      const liste = await this.service.rechercherPatientes(this.rechercheQ.trim());
      // Patientes en ligne en premier.
      this.resultats = liste.sort((a, b) => Number(this.presence.estEnLigne(b.id)) - Number(this.presence.estEnLigne(a.id)));
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargementRecherche = false;
    }
  }

  async demarrerAvec(patienteId: string): Promise<void> {
    this.rechercheOuverte = false;
    try {
      if (!this.service.charge()) await this.service.charger();
      const d = await this.service.ouvrirAvecPatiente(patienteId);
      await this.ouvrir(d);
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  // --- Envoi -----------------------------------------------------------------------------
  clavier(evt: KeyboardEvent): void {
    // Entrée : envoyer ; Maj + Entrée : nouvelle ligne.
    if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) {
      evt.preventDefault();
      this.envoyer();
    }
  }

  surSaisie(): void {
    const d = this.actif();
    if (!d || Date.now() - this.derniereSaisie < 2000) return;
    this.derniereSaisie = Date.now();
    this.service.signalerSaisie(d.id);
  }

  async envoyer(): Promise<void> {
    const d = this.actif();
    const texte = this.texte.trim();
    if (!d || !texte || texte.length > this.TAILLE_MAX) return;
    this.texte = '';
    this.erreur = '';
    this.afficherModeles = false;
    this.defilerEnBas = true;
    try {
      await this.service.envoyer(d.id, texte);
    } catch (err) {
      this.erreur = messageErreur(err);
    }
    this.defilerEnBas = true;
  }

  async renvoyer(m: MessageDiscussion): Promise<void> {
    this.service.retirer(m.discussionId, m.id);
    this.texte = m.texte;
    await this.envoyer();
  }

  insererModele(m: string): void {
    this.texte = this.texte ? `${this.texte} ${m}` : m;
    this.afficherModeles = false;
    this.saisieRef?.nativeElement.focus();
  }

  // --- Affichage ---------------------------------------------------------------------------
  enLigne(d: Discussion | null): boolean {
    return !!d?.interlocuteur && this.presence.estEnLigne(d.interlocuteur.id);
  }

  /** Lu par la patiente ? (accusé de lecture de mes messages) */
  estLu(m: MessageDiscussion, d: Discussion): boolean {
    return !!d.interlocuteur && m.lusPar.some(l => l.soignantId === d.interlocuteur!.id);
  }

  apercu(d: Discussion): string {
    const m = d.dernierMessage;
    if (!m) return 'Nouvelle conversation';
    return `${m.auteurId === this.moi ? 'Vous : ' : ''}${m.texte}`;
  }

  dateCourte(iso: string | null): string {
    if (!iso) return '';
    const jour = jourLocal(iso);
    return jour === jourLocal(new Date()) ? this.heure(iso) : this.libelleJour(jour, true);
  }

  private libelleJour(jour: string, court = false): string {
    const aujourdhui = jourLocal(new Date());
    const hier = jourLocal(new Date(Date.now() - 86400000));
    if (jour === aujourdhui) return 'Aujourd’hui';
    if (jour === hier) return 'Hier';
    const d = new Date(`${jour}T12:00:00Z`);
    return new Intl.DateTimeFormat('fr-FR', court ? { day: '2-digit', month: '2-digit' } : { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  }
}
