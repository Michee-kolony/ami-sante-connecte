import { Component, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Vérification d'une nouvelle version publiée : toutes les 15 minutes et au retour sur l'onglet. */
const VERIFICATION_MS = 15 * 60000;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'ami-sante';
  private sw = inject(SwUpdate);
  private router = inject(Router);

  /** Nouvelle version téléchargée par le service worker, pas encore affichée. */
  readonly nouvelleVersion = signal(false);

  constructor() {
    // Sans cela, le service worker (mode hors connexion) continue de servir l'ancienne version
    // gardée sur l'appareil après une mise en ligne.
    if (!this.sw.isEnabled) return;
    const verifier = () => this.sw.checkForUpdate().catch(() => false);
    verifier();
    setInterval(verifier, VERIFICATION_MS);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verifier());

    this.sw.versionUpdates.pipe(filter(e => e.type === 'VERSION_READY')).subscribe(() => this.nouvelleVersion.set(true));
    // Version en cache inutilisable (fichiers supprimés du serveur) : rechargement immédiat.
    this.sw.unrecoverable.subscribe(() => document.location.reload());
    // Nouvelle version prête : appliquée au prochain changement de page, sans perdre une saisie en cours.
    this.router.events.pipe(filter((e): e is NavigationStart => e instanceof NavigationStart)).subscribe(e => {
      if (this.nouvelleVersion()) this.appliquer(e.url);
    });
  }

  async appliquer(url = this.router.url): Promise<void> {
    await this.sw.activateUpdate().catch(() => false);
    document.location.href = url;
  }
}
