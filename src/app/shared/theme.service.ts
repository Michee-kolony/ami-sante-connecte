import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ami-theme';

/**
 * Gère le mode clair / sombre. Le choix est mémorisé dans le navigateur ;
 * en mode « système », l'application suit le réglage de l'appareil.
 * Le thème initial est appliqué par un script dans index.html (pas de flash).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.read());
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.media.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply();
    });
    this.apply();
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // stockage indisponible (navigation privée) : le choix vaut pour la session
    }
    this.apply();
  }

  private apply(): void {
    const dark = this.mode() === 'dark' || (this.mode() === 'system' && this.media.matches);
    document.documentElement.classList.toggle('dark', dark);
  }

  private read(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      // ignore
    }
    return 'system';
  }
}
