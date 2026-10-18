import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { STRUCTURE, SYNC_QUEUE, UTILISATEUR } from '../data/mock-data';
import { MessagesService } from '../data/messages.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { LangueToggleComponent } from '../../shared/i18n/langue-toggle.component';
import { TraduirePipe } from '../../shared/i18n/traduire.pipe';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, LangueToggleComponent, TraduirePipe],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  messages = inject(MessagesService);

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

  navAdmin: NavItem[] = [
    { label: 'Synchronisation', icon: 'fa-arrows-rotate', path: '/admin/synchronisation', badge: this.pending },
    { label: 'Journal d’audit', icon: 'fa-shield-halved', path: '/admin/audit' },
  ];
}
