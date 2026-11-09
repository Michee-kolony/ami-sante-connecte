import { Component, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Capture {
  /** Fichier dans public/images/guide-patiente/. */
  fichier: string;
  legende: string;
}

interface Etape {
  id: string;
  titre: string;
  icone: string;
  intro: string;
  /** Marche à suivre, dans l'ordre. */
  points: string[];
  captures: Capture[];
  /** Encadré d'avertissement (facultatif). */
  attention?: string;
}

/**
 * Guide illustré de l'application mobile AMI Santé Connect, espace patiente.
 * Les captures proviennent de l'application réelle (compte de démonstration),
 * régénérées par un script puppeteer : voir public/images/guide-patiente/.
 */
@Component({
  selector: 'app-guide-patiente',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guide-patiente.component.html',
})
export class GuidePatienteComponent {
  /** Capture affichée en grand (null : visionneuse fermée). */
  zoom = signal<{ etape: Etape; index: number } | null>(null);

  /** Les icônes de la barre de navigation en bas de l'application, de gauche à droite. */
  barre = [
    { icone: 'fa-house', libelle: 'Accueil', texte: 'Votre résumé : prochain rendez-vous, grossesse, enfants, centre de santé.' },
    { icone: 'fa-calendar', libelle: 'Rendez-vous', texte: 'Vos consultations et celles de vos enfants.' },
    { icone: 'fa-comments', libelle: 'Messages', texte: 'Écrire en privé à vos soignants.' },
    { icone: 'fa-briefcase-medical', libelle: 'Urgence', texte: 'Appeler une ambulance (bouton rouge).', urgence: true },
    { icone: 'fa-children', libelle: 'Mes enfants', texte: 'Carnet de vaccination, croissance, naissance.' },
    { icone: 'fa-lightbulb', libelle: 'Conseils', texte: 'Recommandations et articles de vos médecins.' },
    { icone: 'fa-user', libelle: 'Profil', texte: 'Vos informations, dossier CPN, carte, mot de passe.' },
  ];

  etapes: Etape[] = [
    {
      id: 'premier-lancement',
      titre: 'Premier lancement',
      icone: 'fa-mobile-screen-button',
      intro: 'À la première ouverture, l’application présente en trois écrans ce qu’elle vous permet de faire.',
      points: [
        'Faites défiler les écrans avec le doigt ou touchez la flèche bleue en bas à droite.',
        'Touchez « Passer » pour aller directement à la connexion.',
        'Sur le dernier écran, touchez « Commencer ». Cette présentation ne s’affiche plus ensuite.',
      ],
      captures: [
        { fichier: '01-presentation-1', legende: 'Écran 1 : suivez votre grossesse' },
        { fichier: '01-presentation-2', legende: 'Écran 2 : vos soignants à portée de main' },
        { fichier: '01-presentation-3', legende: 'Écran 3 : touchez « Commencer »' },
      ],
    },
    {
      id: 'connexion',
      titre: 'Se connecter',
      icone: 'fa-right-to-bracket',
      intro: 'Votre espace est créé par votre centre de santé lors de votre enregistrement. Il vous remet vos identifiants : il n’y a pas d’inscription à faire dans l’application.',
      points: [
        'Dans le premier champ, saisissez au choix votre adresse e-mail, votre matricule (par exemple AC-PAT-000001) ou votre numéro de téléphone.',
        'Saisissez votre mot de passe. L’icône en forme d’œil permet de l’afficher pour vérifier ce que vous avez tapé.',
        'Laissez « Se souvenir de moi » coché sur votre téléphone personnel pour rester connectée. Décochez-le sur un téléphone partagé.',
        'Touchez « Se connecter ». Mot de passe oublié ? Touchez le lien prévu ou adressez-vous à votre centre de santé.',
      ],
      captures: [
        { fichier: '02-connexion-vide', legende: 'L’écran de connexion' },
        { fichier: '02-connexion-remplie', legende: 'Identifiant et mot de passe saisis' },
      ],
      attention: 'Ne communiquez jamais votre mot de passe, même à un proche : il protège vos informations médicales.',
    },
    {
      id: 'accueil',
      titre: 'L’écran d’accueil',
      icone: 'fa-house',
      intro: 'Après la connexion, l’accueil résume tout votre suivi en un coup d’œil.',
      points: [
        'En haut : votre photo (accès au profil), le bouton clair/sombre et la cloche des rendez-vous.',
        'La carte « Prochain rendez-vous » indique la date, l’heure et le lieu. Un encadré rouge vous prévient si vous avez manqué un rendez-vous.',
        'Le bandeau rouge « Une urgence ? » ouvre l’appel d’ambulance.',
        'Les boutons d’accès rapide (Ma grossesse, Rendez-vous, Mes enfants, Conseils, Accouchements, Mon profil) défilent horizontalement.',
        'Plus bas : votre grossesse en cours, vos enfants et votre centre de santé (avec un bouton pour l’appeler).',
        'Tirez l’écran vers le bas pour actualiser les informations.',
      ],
      captures: [
        { fichier: '03-accueil-1', legende: 'Haut de l’accueil' },
        { fichier: '03-accueil-2', legende: 'Accès rapides et grossesse en cours' },
        { fichier: '03-accueil-3', legende: 'Vos enfants et votre centre de santé' },
        { fichier: '12-accueil-sombre', legende: 'Le même écran en mode sombre' },
      ],
    },
    {
      id: 'grossesse',
      titre: 'Ma grossesse',
      icone: 'fa-person-pregnant',
      intro: 'Cette page suit votre grossesse en cours, d’après les informations saisies par votre soignant.',
      points: [
        'La carte du haut indique le numéro de la grossesse, l’âge de la grossesse en semaines (SA), la date des dernières règles (DDR) et la date prévue de l’accouchement (DPA).',
        'L’onglet « Fiches CPN » contient le compte rendu de chaque consultation prénatale. Touchez une fiche pour l’ouvrir.',
        'L’onglet « Rendez-vous » liste les rendez-vous de suivi de cette grossesse.',
      ],
      captures: [
        { fichier: '04-grossesse', legende: 'Grossesse en cours et fiches CPN' },
        { fichier: '04-grossesse-rdv', legende: 'Onglet « Rendez-vous »' },
      ],
    },
    {
      id: 'rendez-vous',
      titre: 'Mes rendez-vous',
      icone: 'fa-calendar-check',
      intro: 'Tous vos rendez-vous et ceux de vos enfants sont réunis ici.',
      points: [
        '« À venir » : les prochains rendez-vous. « Historique » : les rendez-vous passés.',
        'Une étiquette indique l’état : prévu, honoré ou « Raté ». En cas de rendez-vous manqué, contactez votre centre pour en fixer un autre.',
        'Touchez un rendez-vous pour afficher les consignes (par exemple : apporter le carnet de vaccination).',
      ],
      captures: [
        { fichier: '05-rendez-vous', legende: 'Liste des rendez-vous' },
        { fichier: '05-rendez-vous-detail', legende: 'Consignes affichées en touchant un rendez-vous' },
        { fichier: '05-rendez-vous-historique', legende: 'Onglet « Historique »' },
      ],
    },
    {
      id: 'enfants',
      titre: 'Mes enfants',
      icone: 'fa-baby',
      intro: 'Chaque enfant né et enregistré au centre de santé a sa fiche : un véritable carnet de santé dans votre téléphone.',
      points: [
        'La liste affiche pour chaque enfant le nombre de vaccins faits, les vaccins en retard et la prochaine séance.',
        'Touchez un enfant pour ouvrir sa fiche : poids, taille et vaccins en haut, puis quatre onglets.',
        '« Vaccins » : le calendrier vaccinal par âge (fait, à venir, en retard, hors délai).',
        '« Croissance » : les mesures de chaque visite (poids, taille, périmètres) et les conseils du soignant.',
        '« Naissance » : les informations de l’accouchement et le score d’APGAR. « Rendez-vous » : les rendez-vous de l’enfant.',
      ],
      captures: [
        { fichier: '06-enfants', legende: 'Liste de vos enfants' },
        { fichier: '06-enfant-vaccins-1', legende: 'Fiche de l’enfant, onglet « Vaccins »' },
        { fichier: '06-enfant-vaccins-2', legende: 'Calendrier vaccinal par âge' },
        { fichier: '06-enfant-croissance', legende: 'Onglet « Croissance »' },
        { fichier: '06-enfant-naissance', legende: 'Onglet « Naissance »' },
        { fichier: '06-enfant-rendezvous', legende: 'Onglet « Rendez-vous »' },
      ],
    },
    {
      id: 'accouchements',
      titre: 'Mes accouchements',
      icone: 'fa-heart-pulse',
      intro: 'Retrouvez le déroulement de chaque accouchement à la maternité et le suivi après la naissance.',
      points: [
        'Chaque carte indique la date, l’heure, le mode d’accouchement et le soignant qui vous a accouchée.',
        'Touchez le nom du bébé pour ouvrir sa fiche.',
        'Touchez « Examen à l’arrivée » ou « Suivi du travail » pour afficher le détail des examens.',
      ],
      captures: [
        { fichier: '07-accouchements', legende: 'Résumé de l’accouchement' },
        { fichier: '07-accouchements-examen', legende: 'Détail de l’examen à l’arrivée' },
      ],
    },
    {
      id: 'conseils',
      titre: 'Conseils',
      icone: 'fa-lightbulb',
      intro: 'Vos médecins publient ici des recommandations pour vous et des articles de prévention.',
      points: [
        '« Pour moi » : les conseils personnels que votre médecin vous a adressés.',
        '« Articles » : les articles de santé, filtrables par thème (grossesse, après l’accouchement…).',
        'Touchez « Lire la suite » pour lire l’article en entier, touchez une photo pour l’agrandir.',
        'Vous pouvez aimer un article et laisser un commentaire.',
      ],
      captures: [
        { fichier: '08-conseils', legende: 'Les articles de vos médecins' },
        { fichier: '08-conseils-article', legende: 'Article ouvert avec « Lire la suite »' },
        { fichier: '08-conseils-pour-moi', legende: 'Onglet « Pour moi »' },
      ],
    },
    {
      id: 'messages',
      titre: 'Messages',
      icone: 'fa-comments',
      intro: 'Échangez en privé avec vos soignants. Les conversations sont chiffrées.',
      points: [
        'La liste montre vos conversations avec le dernier message. Un point vert signale un soignant en ligne.',
        'Pour écrire à un nouveau soignant, touchez le bouton crayon en haut à droite, puis choisissez-le dans la liste.',
        'Touchez une conversation pour l’ouvrir, écrivez dans le champ en bas puis touchez la flèche pour envoyer.',
        'Les deux coches indiquent que votre message a été lu.',
      ],
      captures: [
        { fichier: '09-messages', legende: 'Vos conversations' },
        { fichier: '09-messages-nouveau', legende: 'Choisir un soignant pour un nouveau message' },
        { fichier: '09-messages-conversation', legende: 'Une conversation avec votre médecin' },
      ],
      attention: 'La messagerie n’est pas faite pour les urgences : votre soignant peut ne pas répondre tout de suite. En cas d’urgence, utilisez le bouton Urgence.',
    },
    {
      id: 'urgence',
      titre: 'Urgence : appeler une ambulance',
      icone: 'fa-truck-medical',
      intro: 'En cas d’urgence, l’application envoie votre alerte et votre position à la régulation, qui vous envoie l’ambulance disponible la plus proche.',
      points: [
        'Ouvrez l’urgence depuis le bandeau rouge de l’accueil ou le bouton rouge de la barre du bas.',
        'Autorisez la localisation si le téléphone le demande : la carte vous situe et affiche les ambulances proches.',
        'Touchez « Appeler une ambulance », puis choisissez ce qui se passe (douleurs, saignements, perte des eaux…). L’alerte part immédiatement.',
        'Vous suivez ensuite l’ambulance sur la carte, avec le temps d’arrivée estimé, et vous pouvez écrire ou téléphoner au chauffeur.',
        '« Annuler » ferme le choix sans rien envoyer. « Appeler mon centre de santé » lance un appel téléphonique.',
      ],
      captures: [
        { fichier: '10-urgence-carte', legende: 'Carte et bouton « Appeler une ambulance »' },
        { fichier: '10-urgence-carte-motif', legende: 'Choisir ce qui se passe' },
      ],
      attention: 'N’utilisez ce bouton qu’en cas de véritable urgence : une ambulance est réellement envoyée.',
    },
    {
      id: 'profil',
      titre: 'Mon profil',
      icone: 'fa-id-card',
      intro: 'Votre profil regroupe vos informations, votre dossier médical, votre carte patiente et vos réglages.',
      points: [
        '« Mes informations » : âge, e-mail et téléphone enregistrés par votre centre.',
        '« Mon enregistrement CPN » : votre dossier (antécédents, groupe sanguin, identité…). Il est confidentiel : saisissez à nouveau votre mot de passe et touchez « Afficher ».',
        '« Voir ma carte » affiche votre carte patiente (recto-verso, avec QR code). « Télécharger / imprimer ma carte » en fait un PDF à imprimer ou partager.',
        '« Apparence » : mode clair, sombre ou automatique.',
        '« Changer mon mot de passe » : saisissez l’actuel puis deux fois le nouveau.',
        '« Se déconnecter » ferme votre session, à faire sur un téléphone partagé.',
      ],
      captures: [
        { fichier: '11-profil-1', legende: 'Haut du profil' },
        { fichier: '11-profil-dossier-verrouille', legende: 'Dossier CPN : mot de passe demandé' },
        { fichier: '11-profil-dossier-1', legende: 'Dossier CPN : antécédents' },
        { fichier: '11-profil-dossier-2', legende: 'Dossier CPN : profil biologique et identité' },
        { fichier: '11-profil-carte', legende: 'Votre carte patiente' },
        { fichier: '11-profil-2', legende: 'Centre de santé, apparence et sécurité' },
        { fichier: '11-profil-mot-de-passe', legende: 'Changer son mot de passe' },
      ],
    },
  ];

  ouvrir(etape: Etape, index: number): void {
    this.zoom.set({ etape, index });
  }

  fermer(): void {
    this.zoom.set(null);
  }

  /** Capture précédente (-1) ou suivante (+1) dans la même étape. */
  changer(pas: number): void {
    const z = this.zoom();
    if (!z) return;
    const n = z.etape.captures.length;
    this.zoom.set({ etape: z.etape, index: (z.index + pas + n) % n });
  }

  @HostListener('document:keydown', ['$event'])
  clavier(e: KeyboardEvent): void {
    if (!this.zoom()) return;
    if (e.key === 'Escape') this.fermer();
    else if (e.key === 'ArrowRight') this.changer(1);
    else if (e.key === 'ArrowLeft') this.changer(-1);
  }
}
