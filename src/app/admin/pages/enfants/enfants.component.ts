import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnfantsService, ResumeEnfant } from '../../data/enfants.service';
import { dateHeureChiffres, jourChiffres, aujourdhui } from '../../data/format';
import { messageErreur } from '../../data/session.service';

type Filtre = 'Tous' | 'À jour' | 'En retard' | 'Complets';

/**
 * Enfants suivis (nés dans la plateforme, ou ailleurs puis enregistrés pour leur vaccination) : carnet vaccinal du PEV RDC calculé par le serveur,
 * prochaine séance et retards. Ouvert à tout le personnel soignant.
 */
@Component({
  selector: 'app-enfants',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './enfants.component.html',
})
export class EnfantsComponent implements OnInit {
  private service = inject(EnfantsService);
  jour = jourChiffres;
  dateHeure = dateHeureChiffres;

  filtres: Filtre[] = ['Tous', 'À jour', 'En retard', 'Complets'];
  filtre = signal<Filtre>('Tous');
  recherche = signal('');
  enfants = signal<ResumeEnfant[]>([]);
  chargement = signal(true);
  erreur = signal('');
  private minuterie?: ReturnType<typeof setTimeout>;

  private correspond(e: ResumeEnfant, f: Filtre): boolean {
    const v = e.vaccination;
    if (f === 'Tous') return true;
    if (!v) return false;
    if (f === 'En retard') return v.enRetard > 0;
    if (f === 'Complets') return v.completementVaccine;
    return v.enRetard === 0;
  }

  affiches = computed(() => this.enfants().filter(e => this.correspond(e, this.filtre())));

  stats = computed(() => {
    const l = this.enfants().filter(e => e.vaccination);
    const jour = aujourdhui();
    return {
      total: this.enfants().length,
      complets: l.filter(e => e.vaccination!.completementVaccine).length,
      retard: l.filter(e => e.vaccination!.enRetard > 0).length,
      aujourdhui: l.filter(e => e.vaccination!.prochaineSeance?.date === jour).length,
    };
  });

  compte(f: Filtre): number {
    return this.enfants().filter(e => this.correspond(e, f)).length;
  }

  async ngOnInit(): Promise<void> {
    await this.charger();
  }

  async charger(): Promise<void> {
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.enfants.set(await this.service.rechercher({ q: this.recherche() }));
    } catch (err) {
      this.erreur.set(messageErreur(err));
    } finally {
      this.chargement.set(false);
    }
  }

  /** Recherche côté serveur, déclenchée après une courte pause de frappe. */
  chercher(q: string): void {
    this.recherche.set(q);
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.charger(), 350);
  }

  progression(e: ResumeEnfant): number {
    const v = e.vaccination;
    return v && v.vaccinsTotal ? Math.round((v.vaccinsFaits / v.vaccinsTotal) * 100) : 0;
  }

  libelles(e: ResumeEnfant): string {
    return e.vaccination?.prochaineSeance?.doses.map(x => x.libelle).join(', ') ?? '';
  }

  statut(e: ResumeEnfant): { libelle: string; classe: string } {
    const v = e.vaccination;
    if (e.etatNaissance === 'Mort-né') return { libelle: 'Mort-né', classe: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    if (e.statut !== 'Suivi') return { libelle: e.statut, classe: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    if (v?.completementVaccine) return { libelle: 'Complet', classe: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/30' };
    if (v && v.enRetard > 0) return { libelle: `${v.enRetard} en retard`, classe: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30' };
    return { libelle: 'À jour', classe: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30' };
  }
}
