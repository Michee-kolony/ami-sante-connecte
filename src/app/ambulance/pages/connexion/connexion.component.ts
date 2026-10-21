import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chauffeur, FlotteService } from '../../../admin/data/flotte.service';
import { reglesMotDePasse } from '../../../shared/mot-de-passe';
import { ThemeToggleComponent } from '../../../shared/theme-toggle.component';
import { SessionChauffeurService } from '../../session.service';

const ESSAIS_MAX = 5;
const BLOCAGE_S = 60;

@Component({
  selector: 'app-connexion-chauffeur',
  standalone: true,
  imports: [FormsModule, ThemeToggleComponent],
  templateUrl: './connexion.component.html',
})
export class ConnexionChauffeurComponent implements OnDestroy {
  private flotte = inject(FlotteService);
  private session = inject(SessionChauffeurService);
  private router = inject(Router);

  etape: 'identifiants' | 'nouveau-mdp' = 'identifiants';
  matricule = '';
  motDePasse = '';
  afficherMdp = false;
  erreur = '';
  verification = false;

  // Trop d'échecs : blocage temporaire contre les essais en série.
  private echecs = 0;
  bloqueJusqua = 0;
  secondesRestantes = 0;
  private chrono?: ReturnType<typeof setInterval>;

  // Changement obligatoire du mot de passe temporaire.
  private chauffeur: Chauffeur | null = null;
  nouveau = '';
  confirmation = '';

  get regles() {
    return reglesMotDePasse(this.nouveau);
  }

  get nouveauValide(): boolean {
    return this.regles.every(r => r.ok) && this.nouveau !== this.motDePasse;
  }

  get prenom(): string {
    return this.chauffeur?.prenom ?? '';
  }

  async connecter(): Promise<void> {
    if (this.verification || this.secondesRestantes > 0 || !this.matricule || !this.motDePasse) return;
    this.verification = true;
    this.erreur = '';
    // TODO serveur : POST /api/ambulance/connexion en HTTPS, le serveur vérifie et ouvre la session.
    const r = await this.flotte.connecter(this.matricule, this.motDePasse);
    this.verification = false;

    if ('erreur' in r) {
      this.erreur = r.erreur;
      if (++this.echecs >= ESSAIS_MAX) this.bloquer();
      return;
    }
    this.echecs = 0;
    this.chauffeur = r.chauffeur;
    if (r.chauffeur.doitChangerMotDePasse) {
      this.etape = 'nouveau-mdp';
    } else {
      this.entrer();
    }
  }

  async changerMotDePasse(): Promise<void> {
    if (!this.chauffeur || !this.nouveauValide || this.confirmation !== this.nouveau) return;
    await this.flotte.definirMotDePasse(this.chauffeur.id, this.nouveau, false);
    this.entrer();
  }

  private entrer(): void {
    this.session.ouvrir(this.chauffeur!.id);
    this.motDePasse = this.nouveau = this.confirmation = '';
    this.router.navigateByUrl('/ambulance');
  }

  private bloquer(): void {
    this.bloqueJusqua = Date.now() + BLOCAGE_S * 1000;
    const maj = () => {
      this.secondesRestantes = Math.max(0, Math.ceil((this.bloqueJusqua - Date.now()) / 1000));
      if (this.secondesRestantes === 0) {
        clearInterval(this.chrono);
        this.echecs = 0;
        this.erreur = '';
      }
    };
    maj();
    this.chrono = setInterval(maj, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.chrono);
  }
}
