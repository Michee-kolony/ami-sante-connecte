/**
 * Modèle commun des guides illustrés du site (application patiente, espace médecin).
 * Chaque texte existe en français et en lingala : le guide suit la langue choisie
 * avec le sélecteur FR / LN de l'en-tête (LangueService).
 *
 * ⚠️ Les textes lingala sont une première version à faire relire par un locuteur natif,
 * en particulier le vocabulaire médical, avant la mise en ligne.
 */
export interface Texte {
  fr: string;
  ln: string;
}

export interface CaptureGuide {
  /** Fichier .webp dans le dossier d'images du guide. */
  fichier: string;
  legende: Texte;
  /** Format de la capture : écran d'ordinateur (paysage) ou téléphone (portrait). Par défaut : celui du guide. */
  format?: FormatCapture;
}

export type FormatCapture = 'ecran' | 'telephone';

export interface EtapeGuide {
  id: string;
  titre: Texte;
  icone: string;
  intro: Texte;
  /** Marche à suivre, dans l'ordre. */
  points: Texte[];
  captures: CaptureGuide[];
  /** Qui peut utiliser cette fonction (facultatif). */
  acces?: Texte;
  /** Encadré d'avertissement (facultatif). */
  attention?: Texte;
  /** Encadré de conseil pratique (facultatif). */
  astuce?: Texte;
}

/** Regroupement d'étapes dans le sommaire (ex. « Suivi prénatal », « Maternité »). */
export interface PartieGuide {
  titre: Texte;
  icone: string;
  etapes: EtapeGuide[];
}

export interface CarteGuide {
  icone: string;
  couleur: 'brand' | 'accent' | 'amber' | 'rose';
  titre: Texte;
  texte: Texte;
}

export interface RepereGuide {
  icone: string;
  libelle: Texte;
  texte: Texte;
  urgence?: boolean;
}

export interface ConfigGuide {
  /** Adresse de la page du guide (liens du sommaire). */
  url: string;
  /** Dossier des captures, relatif à public/ (ex. images/guide-medecin). */
  dossier: string;
  format: FormatCapture;
  /** Adresse affichée dans la barre du navigateur dessinée autour des captures d'écran. */
  adresseEcran?: string;
  badge: Texte;
  badgeIcone: string;
  titre: Texte;
  titreAccent: Texte;
  sousTitre: Texte;
  /** Titre de l'onglet du navigateur. */
  titreOnglet: Texte;
  captureHero: string;
  boutons: { fragment: string; libelle: Texte; icone: string; secondaire?: boolean }[];
  avant: { titre: Texte; cartes: CarteGuide[] };
  /** Encadré de repères visuels (barre de navigation, menu…). */
  reperes?: { titre: Texte; texte: Texte; items: RepereGuide[] };
  parties: PartieGuide[];
  aide: { titre: Texte; texte: Texte; bouton: Texte };
}
