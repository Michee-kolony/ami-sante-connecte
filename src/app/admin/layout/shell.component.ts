import { Component, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { STRUCTURE, SYNC_QUEUE, UTILISATEUR } from '../data/mock-data';
import { UrgencesService } from '../data/urgences.service';
import { MessagesService } from '../data/messages.service';
import { SessionService } from '../data/session.service';
import { PresenceService } from '../data/presence.service';
import { DiscussionsService } from '../data/discussions.service';
import { NotificationsMessagesComponent } from '../components/notifications-messages.component';
import { AvatarComponent } from '../components/avatar.component';
import { ConversationsFlottantesComponent } from '../components/conversations-flottantes.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
  /** Accès au dossier médical (réservé aux médecins). */
  clinique?: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, NotificationsMessagesComponent, AvatarComponent, ConversationsFlottantesComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  messages = inject(MessagesService);

  constructor() {
    // Une fois l'écran affiché, on prépare la page Urgences en tâche de fond :
    // code Leaflet téléchargé et connexions aux serveurs de tuiles déjà ouvertes.
    afterNextRender(() => {
      const prechargerCarte = () => {
        import('../pages/urgences/urgences.component');
        // Tuiles OSM chargées en <img> (sans CORS) ; TomTom aussi interrogé via fetch (CORS).
        const hotes: [string, boolean][] = [['https://tile.openstreetmap.org', false], ['https://api.tomtom.com', true]];
        for (const [hote, cors] of hotes) {
          const lien = document.createElement('link');
          lien.rel = 'preconnect';
          lien.href = hote;
          if (cors) lien.crossOrigin = '';
          document.head.appendChild(lien);
        }
      };
      'requestIdleCallback' in window ? requestIdleCallback(prechargerCarte) : setTimeout(prechargerCarte, 1500);
    });
  }

  urgences = inject(UrgencesService);

  /** Badge du menu : messages non lus et nouvelles urgences comptés en direct. */
  badge(item: NavItem): number | undefined {
    if (item.path === '/admin/messages') return this.messages.totalNonLus();
    if (item.path === '/admin/discussions') return this.discussions.totalNonLus() || undefined;
    if (item.path === '/admin/urgences') return this.urgences.nouvelles();
    return item.badge;
  }

  session = inject(SessionService);
  /** Démarre le battement de présence sur toutes les pages de l'espace administrateur. */
  private presence = inject(PresenceService);
  /** Discussions entre soignants : compteur de messages non lus dans le menu, en temps réel. */
  private discussions = inject(DiscussionsService);

  /** Établissement choisi à la connexion, sinon la structure fictive de la maquette. */
  get structure() {
    const e = this.session.etablissement();
    if (e) return { nom: e.nom, site: e.aireSante || e.adresse, zone: e.zoneSante };
    return this.session.connecte() ? { nom: 'Aucun établissement', site: 'Ajoutez-en un', zone: 'Établissements sanitaires' } : STRUCTURE;
  }

  /** Soignant connecté au serveur, sinon l'utilisateur fictif de la maquette. */
  get user() {
    const s = this.session.soignant();
    if (!s) return UTILISATEUR;
    return { ...UTILISATEUR, nom: `${s.prenom} ${s.nom}`, initiales: `${s.prenom[0]}${s.nom[0]}`.toUpperCase(), role: s.role };
  }
  /** « Dr Prénom NOM » pour les médecins, « Prénom NOM » sinon. */
  get nomAffiche(): string {
    return `${this.session.estMedecin() ? 'Dr ' : ''}${this.user.nom}`;
  }
  menuOpen = false;
  pending = SYNC_QUEUE.filter(s => s.etat !== 'synchronisé').length;

  /** Enregistrement (dossier médical) : masqué aux infirmier·ères — le serveur refuse aussi. Patientes et rendez-vous : vue de suivi. */
  get nav(): NavItem[] {
    return this.session.estInfirmier() ? this.navTous.filter(i => !i.clinique) : this.navTous;
  }

  private navTous: NavItem[] = [
    { label: 'Accès rapide', icon: 'fa-bolt', path: '/admin/acces-rapide' },
    { label: 'Tableau de bord', icon: 'fa-gauge-high', path: '/admin/tableau-de-bord' },
    { label: 'Patientes', icon: 'fa-person-pregnant', path: '/admin/patientes' },
    { label: 'Enregistrement CPN', icon: 'fa-file-circle-plus', path: '/admin/patientes/nouvelle', clinique: true },
    { label: 'Rendez-vous', icon: 'fa-calendar-check', path: '/admin/rendez-vous' },
    { label: 'Discussions', icon: 'fa-comment-medical', path: '/admin/discussions' },
    { label: 'Conseils aux mamans', icon: 'fa-newspaper', path: '/admin/conseils', clinique: true },
    { label: 'Messages', icon: 'fa-comments', path: '/admin/messages' },
    { label: 'Doublons', icon: 'fa-clone', path: '/admin/doublons', badge: 2 },
    { label: 'Enfants vaccinés', icon: 'fa-baby', path: '/admin/enfants' },
    { label: 'Agents de vaccination', icon: 'fa-user-nurse', path: '/admin/agents' },
  ];

  navSecours: NavItem[] = [
    { label: 'Urgences', icon: 'fa-tower-broadcast', path: '/admin/urgences' },
    { label: 'Ambulances', icon: 'fa-truck-medical', path: '/admin/ambulances' },
    { label: 'Chauffeurs', icon: 'fa-id-card', path: '/admin/chauffeurs' },
  ];

  navAdmin: NavItem[] = [
    { label: 'Synchronisation', icon: 'fa-arrows-rotate', path: '/admin/synchronisation', badge: this.pending },
    { label: 'Journal d’audit', icon: 'fa-shield-halved', path: '/admin/audit' },
  ];

  navSuperAdmin: NavItem[] = this.user.superAdmin
    ? [
      { label: 'Établissements sanitaires', icon: 'fa-hospital', path: '/admin/etablissements' },
      { label: 'Médecins et infirmiers', icon: 'fa-user-doctor', path: '/admin/soignants' },
    ]
    : [];
}
