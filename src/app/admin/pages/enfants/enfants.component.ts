import { Component, computed, signal } from '@angular/core';
import { formatDate } from '../../data/mock-data';
import {
  ageLisible, CALENDRIER, CONTACTS, couverture, dosesDuMois, Enfant, ENFANTS, etatContact, etatDose,
  EtatDose, prochaineDose, StatutVaccinal, statutVaccinal,
} from '../../data/vaccination';

@Component({
  selector: 'app-enfants',
  standalone: true,
  templateUrl: './enfants.component.html',
})
export class EnfantsComponent {
  fmt = formatDate;
  contacts = CONTACTS;
  calendrier = CALENDRIER;
  age = ageLisible;
  statut = statutVaccinal;
  prochaine = prochaineDose;
  etatContact = etatContact;
  etatDose = etatDose;

  statuts: ('Tous' | StatutVaccinal)[] = ['Tous', 'À jour', 'En retard', 'Complet'];
  recherche = signal('');
  filtreStatut = signal<'Tous' | StatutVaccinal>('Tous');
  ouvert = signal<string | null>(null);

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return ENFANTS.filter(e => {
      const ok = this.filtreStatut() === 'Tous' || statutVaccinal(e) === this.filtreStatut();
      const texte = `${e.prenom} ${e.nom} ${e.id} ${e.tuteur} ${e.telephone}`.toLowerCase();
      return ok && (!q || texte.includes(q));
    });
  });

  stats = {
    total: ENFANTS.length,
    complets: ENFANTS.filter(e => statutVaccinal(e) === 'Complet').length,
    retard: ENFANTS.filter(e => statutVaccinal(e) === 'En retard').length,
    dosesMois: dosesDuMois(ENFANTS),
    penta3: couverture(ENFANTS, 'PENTA3'),
  };

  compte(s: 'Tous' | StatutVaccinal): number {
    return s === 'Tous' ? ENFANTS.length : ENFANTS.filter(e => statutVaccinal(e) === s).length;
  }

  basculer(e: Enfant): void {
    this.ouvert.update(id => (id === e.id ? null : e.id));
  }

  dosesDuContact(contact: string) {
    return CALENDRIER.filter(d => d.contact === contact);
  }

  pastille(etat: EtatDose): string {
    return {
      'recue': 'bg-accent-500 text-white ring-accent-500',
      'due': 'bg-amber-50 text-amber-600 ring-amber-400 dark:bg-amber-500/10 dark:text-amber-300',
      'retard': 'bg-rose-500 text-white ring-rose-500',
      'a-venir': 'bg-white text-slate-300 ring-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:ring-slate-700',
    }[etat];
  }

  icone(etat: EtatDose): string {
    return { 'recue': 'fa-check', 'due': 'fa-clock', 'retard': 'fa-exclamation', 'a-venir': 'fa-minus' }[etat];
  }

  badgeStatut(s: StatutVaccinal): string {
    return {
      'Complet': 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/30',
      'À jour': 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
      'En retard': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
    }[s];
  }
}
