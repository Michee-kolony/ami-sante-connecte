import { Injectable, signal } from '@angular/core';
import { LINGALA } from './ln';

export type Langue = 'fr' | 'ln';

const STORAGE_KEY = 'ami-langue';

/**
 * Langue de l'interface. Le français est la langue de base : chaque texte français
 * sert de clé, et sa traduction lingala est cherchée dans le dictionnaire `ln.ts`.
 * Une traduction manquante affiche simplement le français.
 */
@Injectable({ providedIn: 'root' })
export class LangueService {
  readonly langue = signal<Langue>(this.lire());

  constructor() {
    document.documentElement.lang = this.langue();
  }

  definir(langue: Langue): void {
    this.langue.set(langue);
    document.documentElement.lang = langue;
    try {
      localStorage.setItem(STORAGE_KEY, langue);
    } catch {
      // stockage indisponible : le choix vaut pour la session
    }
  }

  traduire(texte: string): string {
    if (this.langue() === 'fr' || !texte) return texte;
    return LINGALA[texte] ?? texte;
  }

  private lire(): Langue {
    // Un lien du type ?lang=ln ouvre directement le site en lingala.
    const param = new URLSearchParams(location.search).get('lang');
    if (param === 'fr' || param === 'ln') {
      try {
        localStorage.setItem(STORAGE_KEY, param);
      } catch {
        // ignore
      }
      return param;
    }
    try {
      return localStorage.getItem(STORAGE_KEY) === 'ln' ? 'ln' : 'fr';
    } catch {
      return 'fr';
    }
  }
}
