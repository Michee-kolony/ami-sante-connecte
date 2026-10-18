import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatDate, STRUCTURE, UTILISATEUR } from '../../data/mock-data';

interface Step {
  title: string;
  subtitle: string;
  icon: string;
  clinical?: boolean;
}

const DAY = 86_400_000;
const TODAY = '2026-10-18';

function parse(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-patient-new',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './patient-new.component.html',
})
export class PatientNewComponent {
  fmt = formatDate;
  structure = STRUCTURE;
  user = UTILISATEUR;
  today = TODAY;
  step = 0;
  saved: 'brouillon' | 'valide' | null = null;

  steps: Step[] = [
    { title: 'Identité', subtitle: 'Nom, âge, pièce', icon: 'fa-id-card' },
    { title: 'Contact', subtitle: 'Téléphone & consentement', icon: 'fa-phone' },
    { title: 'Résidence', subtitle: 'Adresse & structure', icon: 'fa-location-dot' },
    { title: 'Obstétrique', subtitle: 'CPN & datation', icon: 'fa-person-pregnant', clinical: true },
    { title: 'Suivi', subtitle: 'RDV & validation', icon: 'fa-calendar-check' },
  ];

  form = {
    nom: '', postnom: '', prenom: '',
    ageMode: 'date' as 'date' | 'age',
    dateNaissance: '', ageDeclare: null as number | null,
    piece: '',
    tel1: '', tel1Partage: false, tel2: '',
    consent: { sms: null as boolean | null, appel: null as boolean | null, whatsapp: null as boolean | null },
    province: 'Kinshasa', commune: 'Ngaliema', quartier: '', avenue: '', repere: '',
    aire: 'AS Camp Tshatshi',
    dateConsultation: TODAY,
    typeConsultation: 'Première CPN',
    ddrConnue: true,
    ddr: '',
    ddrFiabilite: 'Fiable',
    agMethode: 'Échographie',
    agSemaines: null as number | null,
    agJours: null as number | null,
    dpaSaisie: '',
    dpaJustification: '',
    risque: 'Aucun facteur identifié',
    prochainRdv: '',
    canalRappel: 'SMS',
  };

  canaux: { key: 'sms' | 'appel' | 'whatsapp'; label: string; icon: string; color: string }[] = [
    { key: 'sms', label: 'SMS', icon: 'fa-solid fa-comment-sms', color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10' },
    { key: 'appel', label: 'Appel téléphonique', icon: 'fa-solid fa-phone', color: 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', color: 'text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10' },
  ];

  communes: Record<string, string[]> = {
    Kinshasa: ['Ngaliema', 'Lingwala', 'Kalamu', 'Limete', 'Gombe', 'Bandalungwa', 'Kintambo'],
    'Kongo-Central': ['Matadi', 'Boma', 'Mbanza-Ngungu'],
  };

  get progress(): number {
    return Math.round(((this.step + 1) / this.steps.length) * 100);
  }

  // --- Identité ----------------------------------------------------------
  get ageCalcule(): number | null {
    if (this.form.ageMode === 'age') return this.form.ageDeclare;
    if (!this.form.dateNaissance) return null;
    return Math.floor((parse(TODAY) - parse(this.form.dateNaissance)) / (365.25 * DAY));
  }

  get ageImprobable(): boolean {
    const a = this.ageCalcule;
    return a !== null && (a < 12 || a > 55);
  }

  // --- Contact -----------------------------------------------------------
  get telInvalide(): boolean {
    const digits = this.form.tel1.replace(/\D/g, '');
    return this.form.tel1.length > 0 && (digits.length < 9 || digits.length > 12);
  }

  // --- Datation (§6.1) ---------------------------------------------------
  get consultationFuture(): boolean {
    return !!this.form.dateConsultation && this.form.dateConsultation > TODAY;
  }

  get ddrApresConsultation(): boolean {
    return !!this.form.ddr && !!this.form.dateConsultation && this.form.ddr > this.form.dateConsultation;
  }

  get agJoursTotal(): number | null {
    if (!this.form.ddrConnue || !this.form.ddr || !this.form.dateConsultation) return null;
    return Math.round((parse(this.form.dateConsultation) - parse(this.form.ddr)) / DAY);
  }

  get agCalcule(): { sa: number; j: number } | null {
    const t = this.agJoursTotal;
    if (t === null || t < 0) return null;
    return { sa: Math.floor(t / 7), j: t % 7 };
  }

  get agHorsPlage(): boolean {
    const t = this.agJoursTotal;
    return t !== null && (t < 0 || t > 44 * 7);
  }

  get dpaCalculee(): string | null {
    if (!this.form.ddrConnue || !this.form.ddr || this.ddrApresConsultation) return null;
    return toIso(parse(this.form.ddr) + 280 * DAY);
  }

  /** DPA estimée à partir d'un âge gestationnel clinique / échographique. */
  get dpaDepuisAg(): string | null {
    if (this.form.ddrConnue || this.form.agSemaines === null) return null;
    const jours = this.form.agSemaines * 7 + (this.form.agJours ?? 0);
    return toIso(parse(this.form.dateConsultation) + (280 - jours) * DAY);
  }

  get ecartDpa(): number | null {
    const ref = this.dpaCalculee ?? this.dpaDepuisAg;
    if (!ref || !this.form.dpaSaisie) return null;
    return Math.round((parse(this.form.dpaSaisie) - parse(ref)) / DAY);
  }

  get ecartSensible(): boolean {
    const e = this.ecartDpa;
    return e !== null && Math.abs(e) > 7;
  }

  get ddrIncertaine(): boolean {
    return this.form.ddrConnue && this.form.ddrFiabilite !== 'Fiable';
  }

  // --- Synthèse ----------------------------------------------------------
  get manquants(): string[] {
    const m: string[] = [];
    if (!this.form.nom.trim()) m.push('Nom');
    if (this.ageCalcule === null) m.push('Date de naissance ou âge');
    if (!this.form.dateConsultation) m.push('Date de consultation');
    if (!this.form.prochainRdv) m.push('Prochain rendez-vous');
    if (this.ecartSensible && !this.form.dpaJustification.trim()) m.push('Justification de la DPA');
    return m;
  }

  get alertes(): string[] {
    const a: string[] = [];
    if (this.ageImprobable) a.push('Âge improbable — à vérifier');
    if (this.telInvalide) a.push('Format du téléphone principal à vérifier');
    if (this.consultationFuture) a.push('Date de consultation dans le futur');
    if (this.ddrApresConsultation) a.push('DDR postérieure à la date de consultation');
    if (this.agHorsPlage) a.push('Âge gestationnel hors plage (0–44 SA)');
    if (this.ecartSensible) a.push(`DPA saisie différente de ${this.ecartDpa} j de la DPA calculée`);
    return a;
  }

  next(): void { if (this.step < this.steps.length - 1) { this.step++; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  prev(): void { if (this.step > 0) { this.step--; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  goTo(i: number): void { this.step = i; }

  save(mode: 'brouillon' | 'valide'): void {
    this.saved = mode;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setConsent(canal: 'sms' | 'appel' | 'whatsapp', v: boolean): void {
    this.form.consent[canal] = v;
  }
}
