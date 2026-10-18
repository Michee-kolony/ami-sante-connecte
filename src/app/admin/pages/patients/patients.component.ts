import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { formatDate, PATIENTES, Patiente } from '../../data/mock-data';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './patients.component.html',
})
export class PatientsComponent {
  fmt = formatDate;
  query = '';
  statut = 'Tous';
  searched = false;
  statuts = ['Tous', 'Actif', 'Brouillon', 'Transféré', 'Clôturé'];

  get results(): Patiente[] {
    const q = this.query.trim().toLowerCase().replace(/\s+/g, '');
    return PATIENTES.filter(p => {
      const okStatut = this.statut === 'Tous' || p.statut === this.statut;
      if (!q) return okStatut;
      const hay = `${p.id}${p.nom}${p.postnom}${p.prenom}${p.telephone}`.toLowerCase().replace(/\s+/g, '');
      return okStatut && hay.includes(q);
    });
  }

  search(): void {
    this.searched = true;
  }

  statutClass(s: string): string {
    return {
      'Actif': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300 ring-1 ring-accent-200 dark:ring-accent-500/30',
      'Brouillon': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700',
      'Transféré': 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30',
      'Clôturé': 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700',
    }[s] ?? '';
  }
}
