import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { Ambulance, FlotteService, StatutAmbulance, TypeAmbulance, joursAvant } from '../../data/flotte.service';

function formulaireVide() {
  return {
    immatriculation: '', modele: '', annee: new Date().getFullYear(),
    type: 'Type B — soins d’urgence' as TypeAmbulance,
    chauffeurId: null as string | null, infirmier: '',
    kilometrage: 0, prochaineRevision: '',
  };
}

@Component({
  selector: 'app-ambulances',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './ambulances.component.html',
})
export class AmbulancesComponent implements OnDestroy {
  flotte = inject(FlotteService);
  ambulances = this.flotte.ambulances;

  types: TypeAmbulance[] = ['Type A — transport', 'Type B — soins d’urgence', 'Type C — réanimation'];
  statuts: StatutAmbulance[] = ['Disponible', 'En mission', 'Maintenance', 'Hors service'];

  // --- Liste -----------------------------------------------------------------
  recherche = signal('');
  filtreStatut = signal<'Tous' | StatutAmbulance>('Tous');

  filtrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.ambulances().filter(a => {
      const c = this.flotte.chauffeur(a.chauffeurId);
      const texte = `${a.id} ${a.immatriculation} ${a.modele} ${c?.prenom ?? ''} ${c?.nom ?? ''}`.toLowerCase();
      return (this.filtreStatut() === 'Tous' || a.statut === this.filtreStatut()) && (!q || texte.includes(q));
    });
  });

  stats = computed(() => {
    const liste = this.ambulances();
    const n = (s: StatutAmbulance) => liste.filter(a => a.statut === s).length;
    return { total: liste.length, disponibles: n('Disponible'), mission: n('En mission'), atelier: n('Maintenance') + n('Hors service') };
  });

  /** Chauffeurs actifs, pour la liste d'affectation. */
  chauffeursActifs = computed(() => this.flotte.chauffeurs().filter(c => c.statut === 'Actif'));

  joursRevision(a: Ambulance): number {
    return joursAvant(a.prochaineRevision);
  }

  classeStatut(s: StatutAmbulance): string {
    switch (s) {
      case 'Disponible': return 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/30';
      case 'En mission': return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30';
      case 'Maintenance': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30';
      default: return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30';
    }
  }

  affecter(a: Ambulance, chauffeurId: string): void {
    this.flotte.affecterChauffeur(a.id, chauffeurId || null);
    const c = this.flotte.chauffeur(chauffeurId);
    this.notifier(c ? `${c.prenom} ${c.nom} conduit désormais ${a.id}.` : `${a.id} n’a plus de chauffeur attitré.`);
  }

  changerStatut(a: Ambulance, statut: Exclude<StatutAmbulance, 'En mission'>): void {
    this.flotte.changerStatut(a.id, statut);
    this.notifier(`${a.id} · ${a.immatriculation} : ${statut.toLowerCase()}.`);
  }

  // --- Formulaire d'ajout ------------------------------------------------------
  panneauOuvert = false;
  form = formulaireVide();
  notification: string | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  get immatriculationExiste(): boolean {
    const i = this.form.immatriculation.trim().toUpperCase();
    return !!i && this.ambulances().some(a => a.immatriculation === i);
  }

  ouvrir(): void {
    this.form = formulaireVide();
    this.panneauOuvert = true;
    document.body.style.overflow = 'hidden';
  }

  fermer(): void {
    this.panneauOuvert = false;
    document.body.style.overflow = '';
  }

  enregistrer(f: NgForm): void {
    if (f.invalid || this.immatriculationExiste) return;
    const a = this.flotte.ajouterAmbulance({
      immatriculation: this.form.immatriculation.trim().toUpperCase(),
      modele: this.form.modele.trim(),
      annee: this.form.annee,
      type: this.form.type,
      chauffeurId: null,
      infirmier: this.form.infirmier.trim(),
      kilometrage: this.form.kilometrage,
      carburant: 100,
      prochaineRevision: this.form.prochaineRevision,
    });
    if (this.form.chauffeurId) this.flotte.affecterChauffeur(a.id, this.form.chauffeurId);
    this.fermer();
    this.notifier(`Ambulance ${a.id} · ${a.immatriculation} ajoutée à la flotte.`);
  }

  private notifier(message: string): void {
    this.notification = message;
    clearTimeout(this.timerNotif);
    this.timerNotif = setTimeout(() => (this.notification = null), 5000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timerNotif);
    document.body.style.overflow = '';
  }
}
