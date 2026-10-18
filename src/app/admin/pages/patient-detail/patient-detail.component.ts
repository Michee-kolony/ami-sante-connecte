import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { AUDIT, formatDate, PATIENTES, Patiente, RENDEZ_VOUS } from '../../data/mock-data';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  templateUrl: './patient-detail.component.html',
})
export class PatientDetailComponent {
  fmt = formatDate;
  tab: 'resume' | 'cpn' | 'historique' = 'resume';
  /** Simule la vue d'un agent d'accueil (accès clinique restreint). */
  vueNonClinique = false;

  p: Patiente = PATIENTES[0];

  @Input() set id(value: string) {
    this.p = PATIENTES.find(x => x.id === value) ?? PATIENTES[0];
  }

  get rdvs() {
    return RENDEZ_VOUS.filter(r => r.patienteId === this.p.id);
  }

  get historique() {
    const own = AUDIT.filter(a => a.cible.includes(this.p.id.slice(-6)));
    return own.length ? own : AUDIT.slice(2, 5);
  }

  cpns = [
    { n: 1, date: '2026-07-02', ag: '8 SA + 3 j', poids: '61 kg', ta: '110/70', soignant: 'Inf. G. Mbuyi' },
    { n: 2, date: '2026-08-13', ag: '14 SA + 3 j', poids: '63 kg', ta: '115/72', soignant: 'Inf. G. Mbuyi' },
    { n: 3, date: '2026-09-24', ag: '20 SA + 3 j', poids: '65 kg', ta: '112/70', soignant: 'SF R. Kasongo' },
  ];

  // Progression de la grossesse en % (sur 40 SA)
  get progression(): number {
    const sa = parseInt(this.p.ageGestationnel, 10);
    return isNaN(sa) ? 0 : Math.min(100, Math.round((sa / 40) * 100));
  }
}
