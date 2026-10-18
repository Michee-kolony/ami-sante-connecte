import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TraduirePipe } from '../../../shared/i18n/traduire.pipe';
import { GalerieComponent } from '../../components/galerie/galerie.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink, TraduirePipe, GalerieComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  /** Chiffres clés affichés sur le site — à tenir à jour avec les données réelles. */
  statistiques = [
    { valeur: 100_000, prefixe: '+', libelle: 'femmes enceintes inscrites', texte: 'suivies lors de leurs consultations prénatales', icon: 'fa-person-pregnant', accent: false },
    { valeur: 10_000, prefixe: '+', libelle: 'enfants vaccinés', texte: 'grâce au suivi et aux rappels de rendez-vous', icon: 'fa-syringe', accent: true },
  ];
  /** Valeurs affichées pendant l'animation du compteur. */
  compteurs = this.statistiques.map(s => s.valeur);

  // --- Formulaire de contact -------------------------------------------------
  sujets = ['Information générale', 'Suivi de grossesse', 'Partenariat', 'Presse et médias', 'Autre'];
  contact = this.contactVide();
  envoiEnCours = false;
  contactEnvoye = false;

  envoyerContact(form: NgForm): void {
    if (form.invalid || this.envoiEnCours) return;
    this.envoiEnCours = true;
    // TODO : brancher sur le serveur (API ou service d'e-mail). Pour l'instant l'envoi est simulé.
    setTimeout(() => {
      this.envoiEnCours = false;
      this.contactEnvoye = true;
    }, 900);
  }

  /** Le formulaire est recréé à neuf quand il réapparaît. */
  nouveauMessage(): void {
    this.contact = this.contactVide();
    this.contactEnvoye = false;
  }

  private contactVide() {
    return { nom: '', telephone: '', email: '', sujet: 'Information générale', message: '', consentement: false };
  }

  @ViewChild('stats') private statsSection?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;
  private frame = 0;
  private format = new Intl.NumberFormat('fr-FR');

  afficher(n: number): string {
    return this.format.format(n);
  }

  ngAfterViewInit(): void {
    const el = this.statsSection?.nativeElement;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduit || !('IntersectionObserver' in window)) return;

    this.compteurs = this.statistiques.map(() => 0);
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        this.observer?.disconnect();
        this.animer();
      }
    }, { threshold: 0.4 });
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  private animer(): void {
    const duree = 1800;
    const debut = performance.now();
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / duree);
      const ease = 1 - Math.pow(1 - p, 3);
      this.compteurs = this.statistiques.map(s => Math.round(s.valeur * ease));
      if (p < 1) this.frame = requestAnimationFrame(pas);
    };
    this.frame = requestAnimationFrame(pas);
  }

  /** Passe à false si public/images/docteur.png est absent : le logo s'affiche à la place. */
  photoDocteur = true;

  piliers = [
    { titre: 'Mère', texte: 'Un dossier prénatal unique pour suivre chaque grossesse en toute sécurité.', icon: 'fa-person-pregnant', color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' },
    { titre: 'Enfant', texte: 'Des dates clés estimées avec soin pour préparer une naissance sereine.', icon: 'fa-baby', color: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' },
    { titre: 'Communauté', texte: 'Des relais communautaires mobilisés pour ne perdre aucune patiente de vue.', icon: 'fa-people-roof', color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' },
    { titre: 'Avenir', texte: 'Des données fiables pour mieux décider et améliorer la santé maternelle.', icon: 'fa-seedling', color: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' },
  ];

  atouts = [
    { titre: 'Indicateurs en temps réel', texte: 'Inscriptions, RDV honorés ou manqués, dossiers incomplets.', icon: 'fa-chart-line' },
    { titre: 'Pensé pour le terrain', texte: 'Utilisable sur tablette et téléphone, même hors connexion.', icon: 'fa-mobile-screen-button' },
    { titre: 'Sécurisé par rôle', texte: 'Chaque profil ne voit que ce dont il a besoin.', icon: 'fa-user-shield' },
  ];

  etapes = [
    { n: '01', titre: 'Accueil et identification', texte: 'À votre arrivée, l’équipe vérifie si vous avez déjà un dossier pour éviter les doublons.', icon: 'fa-id-card' },
    { n: '02', titre: 'Consultation prénatale', texte: 'Une sage-femme ou un·e infirmier·ère évalue votre grossesse et estime la date prévue d’accouchement.', icon: 'fa-stethoscope' },
    { n: '03', titre: 'Prochain rendez-vous', texte: 'Votre prochain rendez-vous est fixé avec vous. Avec votre accord, un rappel discret peut vous être envoyé.', icon: 'fa-calendar-check' },
    { n: '04', titre: 'Suivi continu', texte: 'En cas d’absence, l’équipe peut vous recontacter pour reprogrammer votre visite.', icon: 'fa-hand-holding-heart' },
  ];

  engagements = [
    { titre: 'Votre consentement d’abord', texte: 'Aucun SMS, appel ou message WhatsApp sans votre accord, que vous pouvez retirer à tout moment.', icon: 'fa-file-signature' },
    { titre: 'Messages discrets', texte: 'Les rappels ne contiennent aucune information médicale.', icon: 'fa-eye-slash' },
    { titre: 'Accès limité', texte: 'Seul le personnel autorisé accède à votre dossier, et chaque accès est enregistré.', icon: 'fa-user-shield' },
    { titre: 'Données protégées', texte: 'Échanges chiffrés et sauvegardes régulières.', icon: 'fa-lock' },
  ];
}
