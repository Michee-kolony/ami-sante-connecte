import { Component, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { STRUCTURE, SYNC_QUEUE, UTILISATEUR } from '../data/mock-data';
import { ALERTES } from '../data/urgences';
import { MessagesService } from '../data/messages.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
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

  /** Badge du menu : les messages non lus sont comptés en direct. */
  badge(item: NavItem): number | undefined {
    return item.path === '/admin/messages' ? this.messages.totalNonLus() : item.badge;
  }

  structure = STRUCTURE;
  user = UTILISATEUR;
  menuOpen = false;
  pending = SYNC_QUEUE.filter(s => s.etat !== 'synchronisé').length;

  nav: NavItem[] = [
    { label: 'Tableau de bord', icon: 'fa-gauge-high', path: '/admin/tableau-de-bord' },
    { label: 'Patientes', icon: 'fa-person-pregnant', path: '/admin/patientes' },
    { label: 'Nouvel enregistrement', icon: 'fa-file-circle-plus', path: '/admin/patientes/nouvelle' },
    { label: 'Rendez-vous', icon: 'fa-calendar-check', path: '/admin/rendez-vous', badge: 1 },
    { label: 'Messages', icon: 'fa-comments', path: '/admin/messages' },
    { label: 'Doublons', icon: 'fa-clone', path: '/admin/doublons', badge: 2 },
    { label: 'Enfants vaccinés', icon: 'fa-baby', path: '/admin/enfants' },
    { label: 'Agents de vaccination', icon: 'fa-user-nurse', path: '/admin/agents' },
  ];

  navSecours: NavItem[] = [
    { label: 'Urgences', icon: 'fa-tower-broadcast', path: '/admin/urgences', badge: ALERTES.filter(a => a.etat === 'nouvelle').length },
    { label: 'Ambulances', icon: 'fa-truck-medical', path: '/admin/ambulances' },
    { label: 'Chauffeurs', icon: 'fa-id-card', path: '/admin/chauffeurs' },
  ];

  navAdmin: NavItem[] = [
    { label: 'Synchronisation', icon: 'fa-arrows-rotate', path: '/admin/synchronisation', badge: this.pending },
    { label: 'Journal d’audit', icon: 'fa-shield-halved', path: '/admin/audit' },
  ];
}
