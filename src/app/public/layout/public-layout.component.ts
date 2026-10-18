import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { LangueToggleComponent } from '../../shared/i18n/langue-toggle.component';
import { TraduirePipe } from '../../shared/i18n/traduire.pipe';
import { RetourHautComponent } from '../../shared/retour-haut.component';
import { ChatbotComponent } from '../components/chatbot/chatbot.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ThemeToggleComponent, LangueToggleComponent, TraduirePipe, RetourHautComponent, ChatbotComponent],
  templateUrl: './public-layout.component.html',
})
export class PublicLayoutComponent {
  menuOpen = false;
  year = new Date().getFullYear();

  // TODO : remplacer « # » par les vraies adresses des pages AMI Santé Connect.
  reseaux = [
    { nom: 'Facebook', icon: 'fa-facebook-f', url: '#', hover: 'hover:bg-[#1877f2] hover:ring-[#1877f2]' },
    { nom: 'X (Twitter)', icon: 'fa-x-twitter', url: '#', hover: 'hover:bg-black hover:ring-white/30' },
    { nom: 'Instagram', icon: 'fa-instagram', url: '#', hover: 'hover:bg-gradient-to-br hover:from-[#f58529] hover:via-[#dd2a7b] hover:to-[#8134af] hover:ring-[#dd2a7b]' },
    { nom: 'LinkedIn', icon: 'fa-linkedin-in', url: '#', hover: 'hover:bg-[#0a66c2] hover:ring-[#0a66c2]' },
    { nom: 'YouTube', icon: 'fa-youtube', url: '#', hover: 'hover:bg-[#ff0000] hover:ring-[#ff0000]' },
    { nom: 'WhatsApp', icon: 'fa-whatsapp', url: '#', hover: 'hover:bg-[#25d366] hover:ring-[#25d366]' },
  ];

  nav = [
    { label: 'Accueil', fragment: 'accueil' },
    { label: 'Le projet', fragment: 'projet' },
    { label: 'Suivi prénatal', fragment: 'cpn' },
    { label: 'Galerie', fragment: 'galerie' },
    { label: 'Confidentialité', fragment: 'confidentialite' },
    { label: 'Contact', fragment: 'contact' },
  ];
}
