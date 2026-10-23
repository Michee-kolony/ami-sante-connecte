import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import {
  ALIMENTATIONS, Administration, DoseCarnet, DossierEnfant, EnfantsService, Naissance, STATUTS_ENFANT, StatutEnfant,
  classeStatutDose, iconeStatutDose, parSeance,
} from '../../data/enfants.service';
import { aujourdhui, dateHeureChiffres, jourChiffres, versSaisieLocale } from '../../data/format';
import type { RendezVous, StatutRdv } from '../../data/patientes.service';
import { SessionService, messageErreur } from '../../data/session.service';
import { ThemeService } from '../../../shared/theme.service';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

type Onglet = 'carnet' | 'croissance' | 'naissance' | 'rendez-vous';
type ActionRdv = 'confirmer' | 'reporter' | 'effectue' | 'absent' | 'annuler';

/**
 * Dossier de l'enfant : carnet vaccinal (PEV RDC), croissance, naissance et rendez-vous.
 * Vaccinations, visites et rendez-vous : tout le personnel ; naissance : médecins et sages-femmes.
 */
@Component({
  selector: 'app-enfant-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './enfant-detail.component.html',
})
export class EnfantDetailComponent implements OnChanges, OnDestroy {
  /** AC-ENF-… (route /admin/enfants/:id). */
  @Input() id = '';

  private service = inject(EnfantsService);
  private theme = inject(ThemeService);
  session = inject(SessionService);
  jour = jourChiffres;
  dateHeure = dateHeureChiffres;
  classeDose = classeStatutDose;
  iconeDose = iconeStatutDose;
  alimentations = ALIMENTATIONS;
  statuts = STATUTS_ENFANT;

  onglet: Onglet = 'carnet';
  onglets: { k: Onglet; l: string; i: string }[] = [
    { k: 'carnet', l: 'Carnet de vaccination', i: 'fa-syringe' },
    { k: 'croissance', l: 'Croissance', i: 'fa-weight-scale' },
    { k: 'naissance', l: 'Naissance', i: 'fa-baby' },
    { k: 'rendez-vous', l: 'Rendez-vous', i: 'fa-calendar-check' },
  ];

  e: DossierEnfant | null = null;
  chargement = true;
  erreur = '';
  notification = '';
  envoi = false;

  // Séance de vaccination
  seanceOuverte = false;
  choix: Record<string, boolean> = {};
  seance = { date: aujourdhui(), lot: '', site: '', lieu: '', observations: '' };
  /** Lots par dose (un même vaccin a son propre lot). */
  lots: Record<string, string> = {};

  // Annulation d'une dose
  annulation: { v: Administration; motif: string } | null = null;

  // Visite de suivi
  formSuivi = { date: aujourdhui(), poidsG: null as number | null, tailleCm: null as number | null, perimetreCranienCm: null as number | null, perimetreBrachialCm: null as number | null, temperature: null as number | null, alimentation: '', developpement: '', observations: '' };

  // Naissance
  formNaissance: Naissance | null = null;

  // Rendez-vous
  formRdv = { date: '', motif: '', consignes: '' };
  actionRdv: { r: RendezVous; action: ActionRdv; date: string; motif: string } | null = null;

  @ViewChild('courbe') set courbe(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.canvasCourbe = ref?.nativeElement;
    this.redessiner();
  }
  private canvasCourbe?: HTMLCanvasElement;
  private graphe?: Chart<'line'>;

  private redessiner(): void {
    this.graphe?.destroy();
    this.graphe = undefined;
    if (this.canvasCourbe) this.dessinerCourbe(this.canvasCourbe);
  }

  async ngOnChanges(): Promise<void> {
    this.chargement = true;
    try {
      this.appliquer(await this.service.obtenir(this.id));
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  ngOnDestroy(): void {
    this.graphe?.destroy();
  }

  private appliquer(e: DossierEnfant): void {
    this.e = e;
    this.formNaissance = JSON.parse(JSON.stringify(e.naissance));
    // Nouvelle visite : la courbe de poids suit.
    this.redessiner();
  }

  private async action(f: () => Promise<DossierEnfant>, message: string): Promise<boolean> {
    this.envoi = true;
    this.erreur = '';
    try {
      this.appliquer(await f());
      this.notification = message;
      setTimeout(() => (this.notification = ''), 4000);
      return true;
    } catch (err) {
      this.erreur = messageErreur(err);
      return false;
    } finally {
      this.envoi = false;
    }
  }

  get suivi(): boolean {
    return !!this.e && this.e.etatNaissance === 'Vivant' && this.e.statut === 'Suivi';
  }

  get seances() {
    return parSeance(this.e?.carnet?.doses ?? []);
  }

  etatSeance(doses: DoseCarnet[]): string {
    if (doses.every(d => d.statut === 'Faite')) return 'Faite';
    if (doses.some(d => d.statut === 'En retard')) return 'En retard';
    if (doses.some(d => d.statut === 'À faire')) return 'À faire';
    if (doses.every(d => d.statut === 'Hors délai' || d.statut === 'Faite')) return 'Hors délai';
    return 'À venir';
  }

  // --- Vaccination -------------------------------------------------------------------------
  ouvrirSeance(): void {
    const attendues = new Set(this.e?.carnet?.prochaineSeance?.doses.map(d => d.code) ?? []);
    this.choix = {};
    for (const d of this.e?.carnet?.doses ?? []) if (d.statut !== 'Faite') this.choix[d.code] = attendues.has(d.code);
    this.lots = {};
    this.seance = { date: aujourdhui(), lot: '', site: '', lieu: '', observations: '' };
    this.seanceOuverte = true;
  }

  get dosesSaisissables(): DoseCarnet[] {
    return (this.e?.carnet?.doses ?? []).filter(d => d.statut !== 'Faite');
  }

  get nbChoisies(): number {
    return Object.values(this.choix).filter(Boolean).length;
  }

  async vacciner(): Promise<void> {
    const doses = Object.entries(this.choix).filter(([, v]) => v).map(([code]) => ({
      code, date: this.seance.date, lot: this.lots[code] ?? '', site: this.seance.site, lieu: this.seance.lieu, observations: this.seance.observations,
    }));
    if (await this.action(() => this.service.vacciner(this.id, doses), `${doses.length} dose(s) enregistrée(s). La séance suivante est programmée.`)) this.seanceOuverte = false;
  }

  /** Saisies annulées (restent visibles, barrées). */
  get annulees(): Administration[] {
    return (this.e?.vaccinations ?? []).filter(v => v.annulation);
  }

  administration(code: string): Administration | undefined {
    return this.e?.vaccinations.find(v => v.code === code && !v.annulation);
  }

  async annulerDose(): Promise<void> {
    if (!this.annulation) return;
    const { v, motif } = this.annulation;
    if (await this.action(() => this.service.annulerVaccination(this.id, v.id, motif), 'Saisie annulée.')) this.annulation = null;
  }

  // --- Croissance ----------------------------------------------------------------------------
  async ajouterSuivi(): Promise<void> {
    if (await this.action(() => this.service.ajouterSuivi(this.id, this.formSuivi), 'Visite enregistrée.')) {
      this.formSuivi = { date: aujourdhui(), poidsG: null, tailleCm: null, perimetreCranienCm: null, perimetreBrachialCm: null, temperature: null, alimentation: '', developpement: '', observations: '' };
    }
  }

  /** Mesures de croissance (naissance + visites), en mois depuis la naissance. */
  get mesures(): { mois: number; date: string; poidsG: number | null; tailleCm: number | null; pc: number | null }[] {
    if (!this.e) return [];
    const naissance = Date.parse(`${this.e.dateNaissance}T00:00:00Z`);
    const mois = (d: string) => Math.round(((Date.parse(`${d}T00:00:00Z`) - naissance) / (30.44 * 86_400_000)) * 10) / 10;
    const n = this.e.naissance;
    const l = [{ mois: 0, date: this.e.dateNaissance, poidsG: n.poidsG, tailleCm: n.tailleCm, pc: n.perimetreCranienCm }];
    for (const s of [...this.e.suivis].sort((a, b) => a.date.localeCompare(b.date))) l.push({ mois: mois(s.date), date: s.date, poidsG: s.poidsG, tailleCm: s.tailleCm, pc: s.perimetreCranienCm });
    return l;
  }

  private dessinerCourbe(canvas: HTMLCanvasElement): void {
    const sombre = this.theme.sombre();
    const texte = sombre ? '#94a3b8' : '#64748b';
    const grille = sombre ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)';
    const points = this.mesures.filter(m => m.poidsG != null).map(m => ({ x: m.mois, y: (m.poidsG as number) / 1000 }));
    this.graphe = new Chart(canvas, {
      type: 'line',
      data: { datasets: [{ label: 'Poids (kg)', data: points, borderColor: sombre ? '#4a8fd8' : '#0055a5', backgroundColor: sombre ? '#4a8fd8' : '#0055a5', borderWidth: 2, pointRadius: 4, tension: 0.25 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
        scales: {
          x: { type: 'linear', min: 0, suggestedMax: 12, title: { display: true, text: 'Âge (mois)', color: texte }, ticks: { color: texte }, grid: { color: grille } },
          y: { type: 'linear', suggestedMin: 2, title: { display: true, text: 'Poids (kg)', color: texte }, ticks: { color: texte }, grid: { color: grille } },
        },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a', callbacks: { label: i => ` ${(i.raw as { y: number }).y} kg à ${(i.raw as { x: number }).x} mois` } } },
      },
    });
  }

  // --- Naissance et statut -------------------------------------------------------------------
  enregistrerNaissance(): void {
    if (this.formNaissance) this.action(() => this.service.modifier(this.id, { naissance: this.formNaissance! }), 'Données de naissance enregistrées.');
  }

  changerStatut(statut: StatutEnfant): void {
    this.action(() => this.service.modifier(this.id, { statut }), `Statut : ${statut}.`);
  }

  // --- Rendez-vous ---------------------------------------------------------------------------
  async creerRdv(): Promise<void> {
    this.envoi = true;
    this.erreur = '';
    try {
      await this.service.creerRendezVous(this.id, { date: new Date(this.formRdv.date).toISOString(), motif: this.formRdv.motif, consignes: this.formRdv.consignes });
      this.appliquer(await this.service.obtenir(this.id));
      this.formRdv = { date: '', motif: '', consignes: '' };
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  ouvrirAction(r: RendezVous, action: ActionRdv): void {
    this.actionRdv = { r, action, date: versSaisieLocale(r.date), motif: '' };
  }

  async validerAction(): Promise<void> {
    const a = this.actionRdv;
    if (!a) return;
    this.envoi = true;
    this.erreur = '';
    try {
      await this.service.modifierRendezVous(this.id, a.r.id, a.action, a.action === 'reporter' ? { date: new Date(a.date).toISOString(), motif: a.motif } : { motif: a.motif });
      this.appliquer(await this.service.obtenir(this.id));
      this.actionRdv = null;
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  attendu(s: StatutRdv): boolean {
    return s === 'Planifié' || s === 'Confirmé' || s === 'Reporté';
  }

  classeRdv(s: StatutRdv): string {
    return {
      Planifié: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      Confirmé: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
      Reporté: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      Effectué: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
      Annulé: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      Absent: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    }[s];
  }
}
