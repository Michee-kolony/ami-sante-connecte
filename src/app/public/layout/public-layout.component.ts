import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { LangueToggleComponent } from '../../shared/i18n/langue-toggle.component';
import { TraduirePipe } from '../../shared/i18n/traduire.pipe';
import { RetourHautComponent } from '../../shared/retour-haut.component';
import { ChatbotComponent } from '../components/chatbot/chatbot.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, LangueToggleComponent, TraduirePipe, RetourHautComponent, ChatbotComponent],
  templateUrl: './public-layout.component.html',
})
export class PublicLayoutComponent {
  menuOpen = false;
  /** Menu déroulant « Documentation » (choix du guide). */
  docsOpen = false;
  private hote = inject<ElementRef<HTMLElement>>(ElementRef);
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

  /** Guides illustrés (français / lingala) : libellé court pour l'en-tête, long pour le menu mobile et le pied de page. */
  guides = [
    {
      court: 'Guide patiente',
      long: 'Comment utiliser l’application mobile AMI Santé Connect (partie patiente)',
      url: '/guide-application-patiente',
      icone: 'fa-mobile-screen-button',
      description: 'Application mobile des mamans : grossesse, rendez-vous, enfants, urgence.',
    },
    {
      court: 'Guide médecin',
      long: 'Guide de l’espace professionnel (partie médecin)',
      url: '/guide-espace-medecin',
      icone: 'fa-user-doctor',
      description: 'Espace professionnel : CPN, consultations, salle de travail, vaccination, urgences.',
    },
  ];

  basculerDocs(): void {
    this.docsOpen = !this.docsOpen;
    if (this.docsOpen) this.menuOpen = false;
  }

  basculerMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) this.docsOpen = false;
  }

  /** Ferme le menu « Documentation » au clic en dehors de son bouton et de son panneau. */
  @HostListener('document:click', ['$event'])
  clicDocument(e: MouseEvent): void {
    if (!this.docsOpen) return;
    const zones = Array.from(this.hote.nativeElement.querySelectorAll('[data-docs]'));
    if (!zones.some((z) => z.contains(e.target as Node))) this.docsOpen = false;
  }

  @HostListener('document:keydown.escape')
  echap(): void {
    this.docsOpen = false;
  }
}
