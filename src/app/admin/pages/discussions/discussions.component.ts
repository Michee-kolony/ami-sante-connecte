import { AfterViewChecked, Component, ElementRef, Input, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { Discussion, DiscussionsService, Interlocuteur, MessageDiscussion } from '../../data/discussions.service';
import { heureFr, jourLocal } from '../../data/format';
import { PresenceService } from '../../data/presence.service';
import { SessionService, messageErreur } from '../../data/session.service';

/**
 * Discussions privées et chiffrées entre soignants (médecins, infirmier·ères et sages-femmes), en temps réel.
 * Route : /admin/discussions, ou /admin/discussions?avec=<id du soignant> pour ouvrir directement.
 */
@Component({
  selector: 'app-discussions',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './discussions.component.html',
})
export class DiscussionsComponent implements AfterViewChecked, OnDestroy {
  service = inject(DiscussionsService);
  presence = inject(PresenceService);
  session = inject(SessionService);
  heure = heureFr;

  @ViewChild('fil') private filRef?: ElementRef<HTMLElement>;
  @ViewChild('saisie') private saisieRef?: ElementRef<HTMLTextAreaElement>;
  private defilerEnBas = false;

  recherche = signal('');
  texte = '';
  erreur = '';
  chargementFil = false;
  envoiEnCours = false;
  readonly TAILLE_MAX = 2000;
  /** Notifications du système (onglet en arrière-plan) : demandées sur action de l'utilisateur. */
  permissionNotifications: NotificationPermission | 'indisponible' = 'Notification' in window ? Notification.permission : 'indisponible';

  async activerNotifications(): Promise<void> {
    if (!('Notification' in window)) return;
    this.permissionNotifications = await Notification.requestPermission();
  }
  private derniereSaisie = 0;

  constructor() {
    // Clic sur un popup de nouveau message : ouvre la discussion concernée.
    effect(() => {
      const id = this.service.aOuvrir();
      const d = id ? this.service.collegues().find(x => x.id === id) : null;
      if (!d) return;
      untracked(() => {
        this.service.aOuvrir.set(null);
        this.ouvrir(d);
      });
    });
  }

  /** Ouverture directe d'une discussion avec un soignant : ?avec=<id>. */
  @Input() set avec(id: string | undefined) {
    if (id) this.demarrerAvec(id);
  }

  discussionOuverte = computed(() => this.service.discussions().find(d => d.id === this.service.ouverte()) ?? null);
  messagesOuverts = computed(() => (this.service.ouverte() ? this.service.messages()[this.service.ouverte()!] ?? [] : []));

  liste = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.service.collegues().filter(d => !q || `${d.interlocuteur?.prenom} ${d.interlocuteur?.nom} ${d.interlocuteur?.role}`.toLowerCase().includes(q));
  });

  /** Messages regroupés par jour, pour les séparateurs « Aujourd'hui », « Hier »… */
  groupes = computed(() => {
    const groupes: { jour: string; libelle: string; messages: MessageDiscussion[] }[] = [];
    for (const m of this.messagesOuverts()) {
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

  // --- Ouverture -----------------------------------------------------------------------
  async ouvrir(d: Discussion): Promise<void> {
    this.service.ouverte.set(d.id);
    this.erreur = '';
    this.texte = '';
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
    const id = this.service.ouverte();
    if (!id || !this.filRef) return;
    const el = this.filRef.nativeElement;
    const hauteurAvant = el.scrollHeight;
    await this.service.chargerMessages(id, true).catch(err => (this.erreur = messageErreur(err)));
    // Garde la position de lecture après l'ajout des anciens messages en haut.
    setTimeout(() => (el.scrollTop = el.scrollHeight - hauteurAvant));
  }

  // --- Nouvelle discussion ---------------------------------------------------------------
  annuaireOuvert = false;
  annuaire: Interlocuteur[] = [];
  rechercheAnnuaire = '';
  chargementAnnuaire = false;

  async ouvrirAnnuaire(): Promise<void> {
    this.annuaireOuvert = true;
    this.rechercheAnnuaire = '';
    this.chargementAnnuaire = true;
    try {
      this.annuaire = await this.service.annuaire();
    } catch (err) {
      this.erreur = messageErreur(err);
      this.annuaireOuvert = false;
    } finally {
      this.chargementAnnuaire = false;
    }
  }

  get annuaireFiltre(): Interlocuteur[] {
    const q = this.rechercheAnnuaire.trim().toLowerCase();
    // Soignants en ligne en premier.
    return this.annuaire
      .filter(s => !q || `${s.prenom} ${s.nom} ${s.role} ${s.matricule}`.toLowerCase().includes(q))
      .sort((a, b) => Number(this.presence.estEnLigne(b.id)) - Number(this.presence.estEnLigne(a.id)));
  }

  async demarrerAvec(soignantId: string): Promise<void> {
    this.annuaireOuvert = false;
    try {
      await this.attendreListe();
      const d = await this.service.ouvrirAvec(soignantId);
      await this.ouvrir(d);
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  /** La liste se charge à la connexion temps réel : on l'attend brièvement si besoin. */
  private async attendreListe(): Promise<void> {
    if (this.service.charge()) return;
    await this.service.charger();
  }

  // --- Envoi ---------------------------------------------------------------------------------
  surTouche(evt: KeyboardEvent): void {
    // Entrée : envoyer ; Maj + Entrée : nouvelle ligne.
    if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) {
      evt.preventDefault();
      this.envoyer();
    }
  }

  surSaisie(): void {
    const id = this.service.ouverte();
    if (!id || Date.now() - this.derniereSaisie < 2000) return;
    this.derniereSaisie = Date.now();
    this.service.signalerSaisie(id);
  }

  async envoyer(): Promise<void> {
    const id = this.service.ouverte();
    const texte = this.texte.trim();
    if (!id || !texte || texte.length > this.TAILLE_MAX) return;
    this.texte = '';
    this.erreur = '';
    this.defilerEnBas = true;
    try {
      await this.service.envoyer(id, texte);
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

  // --- Affichage ---------------------------------------------------------------------------
  nom(s: Interlocuteur | null | undefined): string {
    if (!s) return 'Soignant';
    return `${s.role.startsWith('Médecin') ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  }

  /** Lu par l'interlocuteur ? (accusé de lecture de mes messages) */
  estLu(m: MessageDiscussion, d: Discussion): boolean {
    return !!d.interlocuteur && m.lusPar.some(l => l.soignantId === d.interlocuteur!.id);
  }

  apercu(d: Discussion): string {
    const m = d.dernierMessage;
    if (!m) return 'Nouvelle discussion';
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
