import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { CarteRdcComponent } from '../../components/carte-rdc.component';
import { formatDate, PATIENTES, RENDEZ_VOUS, UTILISATEUR } from '../../data/mock-data';
import { ageLisible, couverture, dosesDuMois, ENFANTS, prochaineDose, statutVaccinal } from '../../data/vaccination';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, AvatarComponent, CarteRdcComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  user = UTILISATEUR;
  fmt = formatDate;
  recentes = PATIENTES.slice(0, 5);
  rdvs = RENDEZ_VOUS.filter(r => r.statut !== 'Honoré').slice(0, 4);

  // --- Vaccination des enfants (calculée à partir des carnets) ---------------
  ageEnfant = ageLisible;
  prochaine = prochaineDose;
  vacc = {
    enfants: ENFANTS.length,
    complets: ENFANTS.filter(e => statutVaccinal(e) === 'Complet').length,
    retard: ENFANTS.filter(e => statutVaccinal(e) === 'En retard').length,
    dosesMois: dosesDuMois(ENFANTS),
  };
  couvertures = [
    { code: 'BCG', nom: 'BCG', age: 'Naissance' },
    { code: 'PENTA1', nom: 'Penta 1', age: '6 sem.' },
    { code: 'PENTA3', nom: 'Penta 3', age: '14 sem.' },
    { code: 'VPI', nom: 'VPI', age: '14 sem.' },
    { code: 'VAR', nom: 'Rougeole (VAR)', age: '9 mois' },
    { code: 'VAA', nom: 'Fièvre jaune (VAA)', age: '9 mois' },
  ].map(c => ({ ...c, ...couverture(ENFANTS, c.code) }));
  enfantsEnRetard = ENFANTS.filter(e => statutVaccinal(e) === 'En retard');

  telLien(tel: string): string {
    return 'tel:' + tel.replace(/\s/g, '');
  }

  kpis = [
    { label: 'Nouvelles inscriptions', value: '38', sub: 'ce mois', trend: '+12 %', up: true, icon: 'fa-user-plus', color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' },
    { label: 'Dossiers incomplets', value: '7', sub: 'champs manquants', trend: '−3', up: true, icon: 'fa-file-circle-exclamation', color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: 'Avec prochain RDV', value: '91 %', sub: 'des dossiers actifs', trend: '+4 pts', up: true, icon: 'fa-calendar-check', color: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' },
    { label: 'RDV manqués', value: '5', sub: 'tâches de suivi créées', trend: '+2', up: false, icon: 'fa-calendar-xmark', color: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  ];

  // Inscriptions par semaine (données agrégées fictives)
  weeks = [
    { label: 'S36', value: 6 }, { label: 'S37', value: 9 }, { label: 'S38', value: 7 },
    { label: 'S39', value: 11 }, { label: 'S40', value: 8 }, { label: 'S41', value: 12 },
  ];
  maxWeek = Math.max(...this.weeks.map(w => w.value));

  trimestres = [
    { label: '1er trimestre', value: 24, color: 'bg-brand-300 dark:bg-brand-400' },
    { label: '2e trimestre', value: 46, color: 'bg-brand-700 dark:bg-brand-600' },
    { label: '3e trimestre', value: 30, color: 'bg-accent-600' },
  ];

  statutClass(s: string): string {
    return {
      'Actif': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
      'Brouillon': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      'Transféré': 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
      'Clôturé': 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    }[s] ?? '';
  }

  rdvClass(s: string): string {
    return {
      'Prévu': 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
      'Rappel envoyé': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
      'Manqué': 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
      'Honoré': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    }[s] ?? '';
  }
}
