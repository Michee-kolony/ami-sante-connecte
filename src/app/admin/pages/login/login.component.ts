import { Component, inject, signal } from '@angular/core';
import { applicationEnCache } from '../../data/hors-ligne/stockage';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../../shared/theme-toggle.component';
import { EtablissementSession, SessionService, messageErreur } from '../../data/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private session = inject(SessionService);
  private router = inject(Router);

  showPassword = false;
  email = '';
  motDePasse = '';
  erreur = '';
  connexion = false;
  /** Établissements proposés quand le soignant en a plusieurs (2e étape). */
  choix: EtablissementSession[] | null = null;
  etablissementId = '';

  /** État réel de l'appareil pour le travail hors connexion (affiché sous le formulaire). */
  readonly reseau = navigator.onLine;
  readonly appareilPret = signal(false);
  readonly appareil = (() => {
    try { return localStorage.getItem('ami-appareil'); } catch { return null; }
  })();

  constructor() {
    applicationEnCache().then(ok => this.appareilPret.set(ok));
  }

  async login(): Promise<void> {
    if (this.connexion || (this.choix && !this.etablissementId)) return;
    this.erreur = '';
    this.connexion = true;
    try {
      const choix = await this.session.connecter(this.email, this.motDePasse, this.choix ? this.etablissementId : undefined);
      if (choix) {
        this.choix = choix;
        this.etablissementId = choix[0]?.id ?? '';
      } else {
        this.router.navigateByUrl('/admin/acces-rapide');
      }
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.connexion = false;
    }
  }

  changerDeCompte(): void {
    this.choix = null;
    this.etablissementId = '';
    this.motDePasse = '';
    this.erreur = '';
  }
}
