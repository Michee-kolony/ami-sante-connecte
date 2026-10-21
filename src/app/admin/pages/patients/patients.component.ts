import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { agLisible, dateHeureFr, jourFr } from '../../data/format';
import { PageRecherche, PatientesService, StatutPatiente } from '../../data/patientes.service';
import { ReferentielsService } from '../../data/referentiels.service';
import { SessionService, messageErreur } from '../../data/session.service';

/** Recherche de dossiers (médecins) : résultats paginés et minimisés par le serveur. */
@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './patients.component.html',
})
export class PatientsComponent {
  private service = inject(PatientesService);
  /** ?supprime=AC-PAT-… après une suppression depuis le dossier. */
  @Input() supprime?: string;
  referentiels = inject(ReferentielsService);
  session = inject(SessionService);
  province = '';
  ag = agLisible;
  jour = jourFr;
  dateHeure = dateHeureFr;

  query = '';
  statut = 'Tous';
  statuts: ('Tous' | StatutPatiente)[] = ['Tous', 'Suivi prénatal', 'Suivi postnatal', 'Grossesse terminée', 'Archivé'];
  readonly lignesSquelette = [1, 2, 3, 4, 5];

  page: PageRecherche | null = null;
  chargement = false;
  erreur = '';
  /** Recherche saisie au moment du dernier envoi (pour le message « aucun dossier »). */
  derniereRecherche = '';

  constructor() {
    this.charger(1);
    this.referentiels.chargerProvinces().catch(() => {});
  }

  get pages(): number {
    return this.page ? Math.max(1, Math.ceil(this.page.total / this.page.parPage)) : 1;
  }

  async charger(numero: number): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      this.page = await this.service.rechercher(this.query, this.statut, numero, 20, this.province);
      this.derniereRecherche = this.query.trim();
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  search(): void {
    this.charger(1);
  }

  statutClass(s: string): string {
    return {
      'Suivi prénatal': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300 ring-1 ring-accent-200 dark:ring-accent-500/30',
      'Suivi postnatal': 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30',
      'Grossesse terminée': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700',
      'Archivé': 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700',
    }[s] ?? '';
  }
}
