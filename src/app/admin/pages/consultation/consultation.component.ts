import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { agLisible, dateHeureFr, jourFr, versSaisieLocale } from '../../data/format';
import {
  Consultation, Constantes, Dossier, ExamenCpn, FACTEURS_RISQUE, Grossesse, PatientesService, ReponseMesure, SaisieConsultation,
  TYPES_CONSULTATION, Traitement, TypeConsultation,
} from '../../data/patientes.service';
import { ReferentielCpn, ReferentielsService, parGroupe } from '../../data/referentiels.service';
import { OuiNonComponent } from '../../components/oui-non.component';
import { SessionService, messageErreur } from '../../data/session.service';

const JOUR = 86_400_000;
const constantesVides = (): Constantes => ({
  poidsKg: null, taSystolique: null, taDiastolique: null, temperature: null, pouls: null, hauteurUterineCm: null, bcf: null,
  saO2: null, frequenceRespiratoire: null,
});
const examenVide = (): ExamenCpn => ({ signes: {}, etatGeneral: '', perimetreBrachialCm: null, mouvementsFoetaux: '', presentation: '' });

/**
 * Consultation prénatale : brouillon modifiable par son auteur, puis finalisée (verrouillée).
 * Une consultation finalisée ne change plus : les corrections sont des addenda signés.
 * Routes : /admin/patientes/:id/consultation (nouvelle) et /admin/consultations/:cid.
 */
@Component({
  selector: 'app-consultation',
  standalone: true,
  imports: [FormsModule, RouterLink, OuiNonComponent],
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
  referentiels = inject(ReferentielsService);
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
      examenCpn: examenVide(),
      mesuresPreventives: {} as Record<string, ReponseMesure>,
      laboratoire: {} as Record<string, string>,
      echographie: '',
      reference: { motifs: [] as string[], precision: '' },
    };
  }

  /** Complète le formulaire avec chaque code du référentiel CPN (liaisons de saisie toujours définies). */
  private completerFiche(r: ReferentielCpn | null): void {
    if (!r) return;
    const f = this.form;
    for (const s of r.SIGNES_CPN) f.examenCpn.signes[s.code] ??= null;
    for (const m of r.MESURES_PREVENTIVES) f.mesuresPreventives[m.code] ??= { reponse: null, valeur: '' };
    for (const e of r.EXAMENS_LABO) f.laboratoire[e.code] ??= '';
  }

  async ngOnChanges(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    const referentiel = this.referentiels.chargerCpn().catch(() => null);
    try {
      if (this.cid) {
        this.consultation = await this.service.consultation(this.cid);
        this.dossier = await this.service.dossier(this.consultation.patienteId);
        this.remplir(this.consultation);
      } else {
        this.consultation = null;
        this.dossier = await this.service.dossier(this.id);
        this.form = this.formulaireVide();
        const gid = this.grossesse?.id;
        const premiere = this.dossier.consultations.some(c => c.grossesseId === gid && c.type === 'Première consultation prénatale' && c.statut === 'Finalisée');
        this.form.type = this.type && TYPES_CONSULTATION.includes(this.type) ? this.type : premiere ? 'Suivi prénatal' : 'Première consultation prénatale';
        if (premiere && this.form.type === 'Première consultation prénatale') this.form.type = 'Suivi prénatal';
        // Facteurs déjà relevés sur la grossesse : proposés, à confirmer par le médecin.
        this.form.facteursRisque = [...(this.grossesse?.facteursRisque ?? [])];
        if (!this.grossesse) this.erreur = 'Aucune grossesse en cours : ouvrez une nouvelle grossesse depuis le dossier.';
      }
      this.completerFiche(await referentiel);
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
      examenCpn: { ...examenVide(), ...c.examenCpn, signes: { ...(c.examenCpn?.signes ?? {}) } },
      mesuresPreventives: Object.fromEntries(Object.entries(c.mesuresPreventives ?? {}).map(([k, v]) => [k, { ...v }])),
      laboratoire: { ...(c.laboratoire ?? {}) },
      echographie: c.echographie ?? '',
      reference: { motifs: [...(c.reference?.motifs ?? [])], precision: c.reference?.precision ?? '' },
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
    const gid = this.grossesse?.id;
    return !!this.dossier?.consultations.some(c => c.grossesseId === gid && c.type === 'Première consultation prénatale' && c.statut === 'Finalisée' && c.id !== this.consultation?.id);
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

  // --- Fiche CPN ----------------------------------------------------------------------
  get signesGroupes() {
    return parGroupe(this.referentiels.cpn()?.SIGNES_CPN ?? []);
  }

  get mesuresGroupes() {
    return parGroupe(this.referentiels.cpn()?.MESURES_PREVENTIVES ?? []);
  }

  /** Semaines d'aménorrhée révolues à la date de la visite. */
  get sa(): number | null {
    const j = this.agALaDate;
    return j == null || j < 0 ? null : Math.floor(j / 7);
  }

  /** Mesure déjà réalisée lors d'une consultation finalisée de cette grossesse (autre que celle-ci). */
  dejaFaite(code: string): { date: string; valeur: string } | null {
    const m = this.grossesse?.mesuresPreventives?.[code];
    return m && m.consultationId !== this.consultation?.id ? m : null;
  }

  /** Mesure attendue à cet âge gestationnel, pas encore faite ni cochée. */
  attendue(code: string, semaine?: number): boolean {
    return semaine != null && this.sa != null && this.sa >= semaine && !this.dejaFaite(code) && this.form.mesuresPreventives[code]?.reponse !== true;
  }

  /** Motifs de référence suggérés par les données saisies : jamais cochés automatiquement. */
  get suggestionsReference(): string[] {
    const f = this.form;
    const c = f.constantes;
    const s = f.examenCpn.signes;
    const p = this.dossier?.patiente;
    const hb = parseFloat((f.laboratoire['hb'] ?? '').replace(',', '.'));
    const r: string[] = [];
    if (s['goitre'] === true) r.push('Goitre');
    if (s['paleur'] === true && hb < 7) r.push('Conjonctives pâles et Hb < 7 g/dl');
    if ((c.taSystolique ?? 0) > 140) r.push('TA systolique > 140');
    if ((c.taDiastolique ?? 0) > 90 && s['proteinurie'] === true) r.push('TA diastolique > 90 et protéinurie ++');
    if (this.sa != null && this.sa >= 20 && c.bcf === 0) r.push('BCF négatifs à partir de 20 SA');
    if (this.sa != null && this.sa >= 20 && /^(0|absents?|n[ée]g)/i.test(f.examenCpn.mouvementsFoetaux.trim())) r.push('Mouvements fœtaux négatifs à partir de 20 SA');
    if (this.sa != null && this.sa >= 36 && (f.examenCpn.presentation === 'Transversale' || s['presentationTransversale'] === true)) r.push('Présentation transversale à partir de 36 SA');
    if (s['masseSein'] === true) r.push('Masse suspecte du sein');
    if (p?.antecedents.atcdGynecoChirurgicaux?.includes('Utérus cicatriciel') || p?.antecedents.atcdGynecoChirurgicaux?.includes('Césarienne')) r.push('Utérus cicatriciel');
    if (p?.antecedents.atcdGynecoChirurgicaux?.includes('Fistule')) r.push('Fistule réparée');
    if (p?.antecedents.atcdMedicaux?.includes('Drépanocytose (SCA/SS)') || p?.electrophoreseHb === 'SS') r.push('Drépanocytose');
    const hu = c.hauteurUterineCm;
    if (hu != null && this.sa != null && this.sa >= 20 && Math.abs(hu - this.sa) > 3) r.push('Discordance HU / âge de la grossesse');
    return r.filter(x => !f.reference.motifs.includes(x));
  }

  basculerMotif(m: string): void {
    const l = this.form.reference.motifs;
    this.form.reference.motifs = l.includes(m) ? l.filter(x => x !== m) : [...l, m];
  }

  /** Prochain rendez-vous à « date de la visite + n semaines » (heure de la visite conservée). */
  rdvDans(semaines: number): void {
    const base = this.form.date ? new Date(this.form.date) : new Date();
    this.form.prochainRdv.date = versSaisieLocale(new Date(base.getTime() + semaines * 7 * JOUR));
    this.form.prochainRdv.motif ||= 'Consultation prénatale de suivi';
  }

  /** Repères à signaler au médecin : aucune conclusion automatique. */
  get reperes(): string[] {
    const c = this.form.constantes;
    const r: string[] = [];
    if (c.saO2 != null && c.saO2 < 95) r.push('SaO2 < 95 %.');
    if (this.form.examenCpn.perimetreBrachialCm != null && this.form.examenCpn.perimetreBrachialCm < 23) r.push('Périmètre brachial < 23 cm : malnutrition à évaluer.');
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
      examenCpn: f.examenCpn, mesuresPreventives: f.mesuresPreventives, laboratoire: f.laboratoire, echographie: f.echographie,
      reference: f.reference,
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
