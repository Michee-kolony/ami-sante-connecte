import { Component, HostListener } from '@angular/core';
import { TraduirePipe } from '../../../shared/i18n/traduire.pipe';

interface Theme {
  id: string;
  nom: string;
  icon: string;
  degrade: string;
}

interface Photo {
  src: string;
  theme: string;
  legende: string;
  /** Crédit exigé par la licence de la photo. */
  auteur: string;
  licence: string;
  /** Page d'origine (Wikimedia Commons) avec la licence complète. */
  source: string;
  /** Cadrage de la vignette (ex. 'object-top' pour un portrait). */
  cadrage?: string;
}

/** Nombre de photos affichées avant « Voir plus ». */
const APERCU = 6;

/**
 * Galerie photo par thème.
 * Photos libres de droits issues de Wikimedia Commons (licences indiquées pour chacune).
 * Pour ajouter une photo : la déposer dans public/images/galerie/ et l'ajouter à la liste `photos`.
 */
@Component({
  selector: 'app-galerie',
  standalone: true,
  imports: [TraduirePipe],
  templateUrl: './galerie.component.html',
})
export class GalerieComponent {
  themes: Theme[] = [
    { id: 'prenatal', nom: 'Suivi prénatal', icon: 'fa-person-pregnant', degrade: 'from-brand-600 to-brand-800' },
    { id: 'vaccination', nom: 'Vaccination', icon: 'fa-syringe', degrade: 'from-accent-500 to-accent-700' },
    { id: 'equipe', nom: 'Équipe et formation', icon: 'fa-user-doctor', degrade: 'from-brand-700 to-accent-600' },
  ];

  photos: Photo[] = [
    {
      src: 'images/galerie/vaccination-rougeole-rdc.webp', theme: 'vaccination',
      legende: 'Vaccination contre la rougeole en RDC', auteur: 'CDC Global', licence: 'CC BY 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Measles_vaccination_in_the_Democratic_Republic_of_Congo.jpg',
    },
    {
      src: 'images/galerie/sage-femme-nouveau-ne.webp', theme: 'prenatal', cadrage: 'object-top',
      legende: 'Une sage-femme et un nouveau-né', auteur: 'Vhikman Gee', licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:African_Midwife.jpg',
    },
    {
      src: 'images/galerie/formation-soignants-rdc.webp', theme: 'equipe',
      legende: 'Formation des soignants en santé maternelle et néonatale (RDC)', auteur: 'CDC Global', licence: 'CC BY 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Democratic_Republic_of_Congo_Training_Healthcare_Workers_(36813869690).jpg',
    },
    {
      src: 'images/galerie/vaccination-enfant.webp', theme: 'vaccination',
      legende: 'Un enfant reçoit son vaccin contre la rougeole', auteur: 'Julien Harneis', licence: 'CC BY-SA 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Child_vaccine.jpg',
    },
    {
      src: 'images/galerie/consultation-prenatale.webp', theme: 'prenatal',
      legende: 'Consultation prénatale de routine', auteur: 'Susan Elden / DFID', licence: 'CC BY-SA 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Mother_and_child,_ante-natal_care_clinic,_Jigawa,_Nigeria,_December_2011_(8379199175).jpg',
    },
    {
      src: 'images/galerie/carte-vaccination.webp', theme: 'vaccination',
      legende: 'Une mère présente la carte de vaccination de son enfant', auteur: 'IBRAHOUA', licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:M%C3%A8re_pr%C3%A9sentant_la_carte_de_vaccination_de_son_enfant_vaccin%C3%A9_contre_la_rougeole.jpg',
    },
    {
      src: 'images/galerie/centre-mere-enfant.webp', theme: 'prenatal',
      legende: 'Un centre de santé mère et enfant', auteur: 'AMISOM Public Information', licence: 'CC0',
      source: 'https://commons.wikimedia.org/wiki/File:UNICEF_Mother_and_Child_Centre_(6243393912).jpg',
    },
    {
      src: 'images/galerie/campagne-vaccination-rdc.webp', theme: 'vaccination',
      legende: 'Campagne de vaccination en RDC', auteur: 'CDC Global', licence: 'CC BY 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Vaccination_in_Democratic_Republic_of_Congo_(34733084465).jpg',
    },
    {
      src: 'images/galerie/vaccin-polio.webp', theme: 'vaccination',
      legende: 'Vaccin oral contre la poliomyélite', auteur: 'CDC Global', licence: 'CC BY 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Immunization_in_Cameroon_(34692993536).jpg',
    },
  ];

  filtre = 'tous';
  toutVoir = false;
  /** Fichiers introuvables : affichés en vignette « Photo à venir ». */
  manquantes = new Set<string>();
  /** Index (dans `disponibles`) de la photo ouverte en grand, ou null. */
  ouverte: number | null = null;

  /** Photos du thème choisi. */
  get filtrees(): Photo[] {
    return this.filtre === 'tous' ? this.photos : this.photos.filter(p => p.theme === this.filtre);
  }

  /** Photos affichées dans la grille (6 au départ, toutes après « Voir plus »). */
  get affichees(): Photo[] {
    return this.toutVoir ? this.filtrees : this.filtrees.slice(0, APERCU);
  }

  get restantes(): number {
    return Math.max(0, this.filtrees.length - APERCU);
  }

  /** Photos affichées et disponibles (pour la visionneuse). */
  get disponibles(): Photo[] {
    return this.affichees.filter(p => !this.manquantes.has(p.src));
  }

  theme(id: string): Theme {
    return this.themes.find(t => t.id === id)!;
  }

  compte(id: string): number {
    return id === 'tous' ? this.photos.length : this.photos.filter(p => p.theme === id).length;
  }

  choisir(id: string): void {
    this.filtre = id;
    this.toutVoir = false;
    this.ouverte = null;
  }

  absente(p: Photo): void {
    this.manquantes.add(p.src);
  }

  ouvrir(p: Photo): void {
    if (this.manquantes.has(p.src)) return;
    this.ouverte = this.disponibles.indexOf(p);
    document.body.style.overflow = 'hidden';
  }

  fermer(): void {
    this.ouverte = null;
    document.body.style.overflow = '';
  }

  suivante(pas: number): void {
    if (this.ouverte === null) return;
    const n = this.disponibles.length;
    this.ouverte = (this.ouverte + pas + n) % n;
  }

  @HostListener('document:keydown', ['$event'])
  clavier(e: KeyboardEvent): void {
    if (this.ouverte === null) return;
    if (e.key === 'Escape') this.fermer();
    if (e.key === 'ArrowRight') this.suivante(1);
    if (e.key === 'ArrowLeft') this.suivante(-1);
  }
}
