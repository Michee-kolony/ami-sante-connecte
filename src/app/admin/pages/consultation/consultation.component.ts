import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { agLisible, dateHeureFr, jourFr, versSaisieLocale } from '../../data/format';
import {
  Consultation, Constantes, Dossier, FACTEURS_RISQUE, Grossesse, PatientesService, SaisieConsultation, TYPES_CONSULTATION,
  Traitement, TypeConsultation,
} from '../../data/patientes.service';
import { SessionService, messageErreur } from '../../data/session.service';

const JOUR = 86_400_000;
const constantesVides = (): Constantes => ({ poidsKg: null, taSystolique: null, taDiastolique: null, temperature: null, pouls: null, hauteurUterineCm: null, bcf: null });

/**
 * Consultation prénatale : brouillon modifiable par son auteur, puis finalisée (verrouillée).
 * Une consultation finalisée ne change plus : les corrections sont des addenda signés.
 * Routes : /admin/patientes/:id/consultation (nouvelle) et /admin/consultations/:cid.
 */
@Component({
  selector: 'app-consultation',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './consultation.component.html',
})
export class ConsultationComponent implements OnChanges {
  /** Numéro AC-PAT de la patiente (nouvelle consultation). */
  @Input() id = '';
  /** Consultation existante. */
  @Input() cid = '';
  /** Type proposé (?type=…) et rendez-vous honoré (?rdv=…). */
  @Input() type?: TypeConsultation;
  @Input() rdv?: string;

  private service = inject(PatientesService);
  private router = inject(Router);
  session = inject(SessionService);
  ag = agLisible;
  jour = jourFr;
  dateHeure = dateHeureFr;
  readonly types = TYPES_CONSULTATION;
  readonly facteursProposes = FACTEURS_RISQUE;
  readonly examensProposes = [
    'Groupe sanguin / Rhésus', 'Hémoglobine', 'Test VIH', 'Syphilis (RPR/TPHA)', 'Glycémie', 'Albuminurie', 'Goutte épaisse / TDR paludisme',
    'Échographie obstétricale', 'ECBU', 'Hépatite B',
  ];

  dossier: Dossier | null = null;
  consultation: Consultation | null = null;
  chargement = true;
  erreur = '';
  envoi = false;
  erreurEnvoi = '';
  notification = '';
  confirmationFinalisation = false;

  form = this.formulaireVide();
  nouvelExamen = '';

  private formulaireVide() {
    return {
      type: 'Suivi prénatal' as TypeConsultation,
      date: versSaisieLocale(new Date()),
      motif: '', symptomes: '', examenClinique: '', evaluation: '', decisions: '', resultatsRevus: '', conseils: '', orientation: '',
      constantes: constantesVides(),
      facteursRisque: [] as string[],
      examensDemandes: [] as string[],
      traitements: [] as Traitement[],
      prochainRdv: { date: '', motif: 'Consultation prénatale de suivi', consignes: '' },
    };
  }

  async ngOnChanges(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      if (this.cid) {
        this.consultation = await this.service.consultation(this.cid);
        this.dossier = await this.service.dossier(this.consultation.patienteId);
        this.remplir(this.consultation);
      } else {
        this.consultation = null;
        this.dossier = await this.service.dossier(this.id);
        this.form = this.formulaireVide();
        const premiere = this.dossier.consultations.some(c => c.type === 'Première consultation prénatale' && c.statut === 'Finalisée');
        this.form.type = this.type && TYPES_CONSULTATION.includes(this.type) ? this.type : premiere ? 'Suivi prénatal' : 'Première consultation prénatale';
        if (premiere && this.form.type === 'Première consultation prénatale') this.form.type = 'Suivi prénatal';
        // Facteurs déjà relevés sur la grossesse : proposés, à confirmer par le médecin.
        this.form.facteursRisque = [...(this.grossesse?.facteursRisque ?? [])];
        if (!this.grossesse) this.erreur = 'Aucune grossesse en cours : ouvrez une nouvelle grossesse depuis le dossier.';
      }
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  private remplir(c: Consultation): void {
    this.form = {
      type: c.type, date: versSaisieLocale(c.date),
      motif: c.motif, symptomes: c.symptomes, examenClinique: c.examenClinique, evaluation: c.evaluation, decisions: c.decisions,
      resultatsRevus: c.resultatsRevus, conseils: c.conseils, orientation: c.orientation,
      constantes: { ...constantesVides(), ...c.constantes },
      facteursRisque: [...c.facteursRisque], examensDemandes: [...c.examensDemandes],
      traitements: c.traitements.map(t => ({ ...t })),
      prochainRdv: { date: versSaisieLocale(c.prochainRdv?.date ?? null), motif: c.prochainRdv?.motif || 'Consultation prénatale de suivi', consignes: c.prochainRdv?.consignes ?? '' },
    };
  }

  // --- État -------------------------------------------------------------------------
  get grossesse(): Grossesse | null {
    if (!this.dossier) return null;
    if (this.consultation) return this.dossier.grossesses.find(g => g.id === this.consultation!.grossesseId) ?? null;
    return this.dossier.grossesses.find(g => g.statut === 'En cours') ?? null;
  }

  /** Modifiable : nouvelle consultation, ou brouillon dont on est l'auteur. */
  get modifiable(): boolean {
    if (!this.consultation) return !!this.grossesse;
    return this.consultation.statut === 'Brouillon' && this.estAuteur;
  }

  get estAuteur(): boolean {
    return !!this.consultation && this.consultation.auteur.id === this.session.soignant()?.id;
  }

  get premiereDejaFaite(): boolean {
    return !!this.dossier?.consultations.some(c => c.type === 'Première consultation prénatale' && c.statut === 'Finalisée' && c.id !== this.consultation?.id);
  }

  /** Âge gestationnel à la date de la consultation (aperçu ; figé par le serveur à la finalisation). */
  get agALaDate(): number | null {
    if (this.consultation?.statut === 'Finalisée') return this.consultation.agJours;
    const d = this.grossesse?.datation;
    if (!d || !this.form.date) return null;
    const ref = Date.parse(`${d.dateReference}T00:00:00Z`);
    const jourConsult = Date.parse(this.form.date.slice(0, 10) + 'T00:00:00Z');
    return d.agReferenceJours + Math.round((jourConsult - ref) / JOUR);
  }

  get dateFuture(): boolean {
    return !!this.form.date && new Date(this.form.date).getTime() > Date.now() + 5 * 60000;
  }

  /** Repères à signaler au médecin : aucune conclusion automatique. */
  get reperes(): string[] {
    const c = this.form.constantes;
    const r: string[] = [];
    if ((c.taSystolique ?? 0) >= 140 || (c.taDiastolique ?? 0) >= 90) r.push('Tension artérielle ≥ 140/90 : à réévaluer selon le protocole.');
    if ((c.temperature ?? 0) >= 38) r.push('Température ≥ 38 °C.');
    if (c.bcf != null && (c.bcf < 110 || c.bcf > 160)) r.push('Bruits du cœur fœtal hors de 110–160 bpm.');
    return r;
  }

  get manquants(): string[] {
    const m: string[] = [];
    if (!this.form.date) m.push('Date et heure');
    if (this.dateFuture) m.push('Date dans le futur');
    if (this.form.type === 'Première consultation prénatale' && this.premiereDejaFaite) m.push('Type : la première consultation est déjà finalisée');
    if (this.form.traitements.some(t => !t.produit.trim() && (t.dose || t.frequence))) m.push('Nom du produit pour chaque traitement');
    return m;
  }

  // --- Saisie -----------------------------------------------------------------------
  basculer(liste: 'facteursRisque' | 'examensDemandes', v: string): void {
    const l = this.form[liste];
    this.form[liste] = l.includes(v) ? l.filter(x => x !== v) : [...l, v];
  }

  ajouterExamen(): void {
    const v = this.nouvelExamen.trim();
    if (v && !this.form.examensDemandes.includes(v)) this.form.examensDemandes = [...this.form.examensDemandes, v];
    this.nouvelExamen = '';
  }

  ajouterTraitement(): void {
    this.form.traitements = [...this.form.traitements, { produit: '', dose: '', voie: 'Orale', frequence: '', duree: '', indication: '' }];
  }

  retirerTraitement(t: Traitement): void {
    this.form.traitements = this.form.traitements.filter(x => x !== t);
  }

  private saisie(finaliser: boolean): SaisieConsultation {
    const f = this.form;
    return {
      type: f.type, date: new Date(f.date).toISOString(),
      motif: f.motif, symptomes: f.symptomes, examenClinique: f.examenClinique, evaluation: f.evaluation, decisions: f.decisions,
      resultatsRevus: f.resultatsRevus, conseils: f.conseils, orientation: f.orientation,
      constantes: f.constantes, facteursRisque: f.facteursRisque, examensDemandes: f.examensDemandes,
      traitements: f.traitements.filter(t => t.produit.trim()),
      prochainRdv: { date: f.prochainRdv.date ? new Date(f.prochainRdv.date).toISOString() : null, motif: f.prochainRdv.motif, consignes: f.prochainRdv.consignes },
      ...(this.rdv && !this.consultation ? { rendezVousId: this.rdv } : {}),
      finaliser,
    };
  }

  async enregistrer(finaliser: boolean): Promise<void> {
    if (this.manquants.length || this.envoi || !this.grossesse) return;
    this.envoi = true;
    this.erreurEnvoi = '';
    try {
      const c = this.consultation
        ? await this.service.modifierConsultation(this.consultation.id, this.saisie(finaliser))
        : await this.service.creerConsultation(this.grossesse.id, this.saisie(finaliser));
      this.confirmationFinalisation = false;
      if (finaliser) {
        this.router.navigate(['/admin/patientes', this.dossier!.patiente.numero], { queryParams: {} });
        return;
      }
      this.notification = 'Brouillon enregistré. Vous seul·e pouvez le compléter et le finaliser.';
      if (!this.consultation) {
        this.router.navigate(['/admin/consultations', c.id], { replaceUrl: true });
      } else {
        this.consultation = c;
      }
    } catch (err) {
      this.erreurEnvoi = messageErreur(err);
      this.confirmationFinalisation = false;
    } finally {
      this.envoi = false;
    }
  }

  // --- Addendum et annulation ----------------------------------------------------------
  addendum = { texte: '', motif: '' };
  annulation = { ouverte: false, motif: '' };

  async ajouterAddendum(): Promise<void> {
    if (!this.consultation || !this.addendum.texte.trim() || !this.addendum.motif.trim()) return;
    this.envoi = true;
    this.erreurEnvoi = '';
    try {
      this.consultation = await this.service.ajouterAddendum(this.consultation.id, this.addendum.texte, this.addendum.motif);
      this.addendum = { texte: '', motif: '' };
      this.notification = 'Addendum signé et ajouté. La note initiale reste inchangée.';
    } catch (err) {
      this.erreurEnvoi = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  async annuler(): Promise<void> {
    if (!this.consultation || !this.annulation.motif.trim()) return;
    this.envoi = true;
    this.erreurEnvoi = '';
    try {
      this.consultation = await this.service.annulerConsultation(this.consultation.id, this.annulation.motif);
      this.annulation = { ouverte: false, motif: '' };
      this.notification = 'Consultation annulée. Elle reste visible dans l’historique avec son motif.';
    } catch (err) {
      this.erreurEnvoi = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  dr(nom: string, role: string): string {
    return role.startsWith('Médecin') ? `Dr ${nom}` : nom;
  }
}
