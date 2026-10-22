import { Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { FicheCpnPatienteComponent } from '../../components/fiche-cpn-patiente.component';
import { PatientSuiviComponent } from './patient-suivi.component';
import { agLisible, apercuDatation, aujourdhui, dateHeureChiffres, jourChiffres, jourLocal } from '../../data/format';
import {
  CanalRappel, ConsultationResume, Dossier, EntreeJournal, FACTEURS_RISQUE, Grossesse, ISSUES, MODES_ACCOUCHEMENT,
  PatientesService, RendezVous, SaisieDatation, StatutRdv, profilCpnDe, profilCpnVersApi, profilCpnVide,
} from '../../data/patientes.service';
import { MesurePreventive, ReferentielsService, parGroupe } from '../../data/referentiels.service';
import { SessionService, messageErreur } from '../../data/session.service';

type Onglet = 'resume' | 'consultations' | 'rendez-vous' | 'historique';
type ActionRdv = 'confirmer' | 'reporter' | 'effectue' | 'absent' | 'annuler';
type Fenetre = null | 'datation' | 'issue' | 'rdv' | 'action-rdv' | 'grossesse' | 'risques' | 'infos' | 'fiche';

/**
 * Dossier prénatal d'une patiente, partagé entre tous les médecins. L'ouverture est journalisée
 * par le serveur ; elle est distincte des consultations, qui ont chacune leur auteur.
 */
@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, PatientSuiviComponent, FicheCpnPatienteComponent],
  templateUrl: './patient-detail.component.html',
})
export class PatientDetailComponent implements OnChanges, OnDestroy {
  /** Identifiant AC-PAT-… (route /admin/patientes/:id). */
  @Input() id = '';
  /** ?nouveau=1 après l'enregistrement. */
  @Input() nouveau?: string;
  /** ?action=nouvelle-grossesse : patiente déjà inscrite qui revient pour une nouvelle grossesse. */
  @Input() action?: string;
  private actionFaite = false;
  /** Grossesse consultée dans l'historique (null : la grossesse en cours, sinon la plus récente). */
  grossesseChoisie: string | null = null;

  private service = inject(PatientesService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  session = inject(SessionService);
  referentiels = inject(ReferentielsService);
  ag = agLisible;
  jour = jourChiffres;
  dateHeure = dateHeureChiffres;

  onglet: Onglet = 'resume';
  onglets: { k: Onglet; l: string; i: string }[] = [
    { k: 'resume', l: 'Résumé', i: 'fa-house-medical' },
    { k: 'consultations', l: 'Consultations', i: 'fa-stethoscope' },
    { k: 'rendez-vous', l: 'Rendez-vous', i: 'fa-calendar-check' },
    { k: 'historique', l: 'Historique & accès', i: 'fa-clock-rotate-left' },
  ];

  dossier: Dossier | null = null;
  chargement = true;
  erreur = '';
  notification = '';
  photoAgrandie = false;

  // --- Carte patiente (PDF généré par le serveur, génération journalisée) -----------------
  carteOuverte = false;
  carteChargement = false;
  carteErreur = '';
  /** URL locale (blob:) du PDF : affichée dans l'aperçu, libérée à la fermeture. */
  private carteUrl: string | null = null;
  carteApercu: SafeResourceUrl | null = null;

  async ouvrirCarte(): Promise<void> {
    if (!this.dossier) return;
    this.carteOuverte = true;
    this.carteChargement = true;
    this.carteErreur = '';
    this.libererCarte();
    try {
      const pdf = await this.service.carte(this.dossier.patiente.numero);
      this.carteUrl = URL.createObjectURL(pdf);
      this.carteApercu = this.sanitizer.bypassSecurityTrustResourceUrl(`${this.carteUrl}#toolbar=0&view=Fit`);
    } catch (err) {
      this.carteErreur = messageErreur(err);
    } finally {
      this.carteChargement = false;
    }
  }

  fermerCarte(): void {
    this.carteOuverte = false;
    this.libererCarte();
  }

  telechargerCarte(): void {
    if (!this.carteUrl || !this.dossier) return;
    const a = document.createElement('a');
    a.href = this.carteUrl;
    a.download = `carte-${this.dossier.patiente.numero}.pdf`;
    a.click();
  }

  /** Ouvre le PDF dans un onglet : impression depuis le lecteur du navigateur. */
  imprimerCarte(): void {
    if (this.carteUrl) window.open(this.carteUrl, '_blank', 'noopener');
  }

  private libererCarte(): void {
    if (this.carteUrl) URL.revokeObjectURL(this.carteUrl);
    this.carteUrl = null;
    this.carteApercu = null;
  }

  ngOnDestroy(): void {
    this.libererCarte();
  }

  // --- Suppression définitive (médecin chef ; le serveur vérifie le rôle et le numéro) ---
  suppressionOuverte = false;
  saisieSuppression = '';
  erreurSuppression = '';
  suppression = false;

  ouvrirSuppression(): void {
    this.saisieSuppression = '';
    this.erreurSuppression = '';
    this.suppressionOuverte = true;
  }

  fermerSuppression(): void {
    if (!this.suppression) this.suppressionOuverte = false;
  }

  async supprimerDossier(): Promise<void> {
    const numero = this.dossier?.patiente.numero;
    if (!numero || this.suppression || this.saisieSuppression.trim().toUpperCase() !== numero) return;
    this.suppression = true;
    this.erreurSuppression = '';
    try {
      await this.service.supprimer(numero, this.saisieSuppression.trim().toUpperCase());
      this.suppressionOuverte = false;
      this.router.navigate(['/admin/patientes'], { queryParams: { supprime: numero } });
    } catch (err) {
      this.erreurSuppression = messageErreur(err);
    } finally {
      this.suppression = false;
    }
  }

  journal: EntreeJournal[] | null = null;
  chargementJournal = false;
  filtreJournal: 'tout' | 'actes' | 'acces' = 'tout';

  async ngOnChanges(): Promise<void> {
    this.referentiels.chargerCpn().catch(() => {});
    await this.charger();
  }

  async charger(): Promise<void> {
    // Infirmier·ère : la vue suivi charge ses propres données (le dossier complet est refusé).
    if (this.session.estInfirmier()) return;
    this.chargement = !this.dossier;
    this.erreur = '';
    try {
      this.dossier = await this.service.dossier(this.id);
      if (this.action === 'nouvelle-grossesse' && !this.actionFaite) {
        this.actionFaite = true;
        if (!this.grossesse) this.ouvrir('grossesse');
        else this.notification = 'Une grossesse est déjà en cours : enregistrez d’abord son issue avant d’en déclarer une nouvelle.';
      }
      if (this.onglet === 'historique') this.chargerJournal();
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  changerOnglet(o: Onglet): void {
    this.onglet = o;
    if (o === 'historique') this.chargerJournal();
  }

  async chargerJournal(): Promise<void> {
    this.chargementJournal = true;
    try {
      this.journal = await this.service.journal(this.id);
    } catch (err) {
      this.notification = messageErreur(err);
    } finally {
      this.chargementJournal = false;
    }
  }

  // --- Lecture du dossier -------------------------------------------------------
  get grossesse(): Grossesse | null {
    return this.dossier?.grossesses.find(g => g.statut === 'En cours') ?? null;
  }

  /** Grossesse affichée : en cours, sinon la plus récente. */
  get grossesseAffichee(): Grossesse | null {
    return this.dossier?.grossesses.find(g => g.id === this.grossesseChoisie) ?? this.grossesse ?? this.dossier?.grossesses[0] ?? null;
  }

  /** La grossesse affichée est celle en cours (les actions cliniques ne portent que sur elle). */
  get vueActuelle(): boolean {
    return !!this.grossesse && this.grossesseAffichee?.id === this.grossesse.id;
  }

  /** Résumé de chaque grossesse pour l'historique (n°, statut, issue, nombre de CPN). */
  get historique(): { g: Grossesse; cpn: number }[] {
    return (this.dossier?.grossesses ?? []).map(g => ({
      g, cpn: this.dossier!.consultations.filter(c => c.grossesseId === g.id && c.statut === 'Finalisée').length,
    }));
  }

  choisirGrossesse(id: string): void {
    this.grossesseChoisie = id === this.grossesse?.id ? null : id;
  }

  get progression(): number {
    const j = this.grossesse?.agJours;
    return j == null ? 0 : Math.max(0, Math.min(100, Math.round((j / 280) * 100)));
  }

  get prochainRdv(): RendezVous | null {
    const maintenant = Date.now();
    return [...(this.dossier?.rendezVous ?? [])]
      .filter(r => ['Planifié', 'Confirmé', 'Reporté'].includes(r.statut) && new Date(r.date).getTime() >= maintenant - 12 * 3600000)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }

  /** Consultations de la grossesse affichée (les autres grossesses restent dans l'historique). */
  get consultations(): ConsultationResume[] {
    const g = this.grossesseAffichee;
    return (this.dossier?.consultations ?? []).filter(c => !g || c.grossesseId === g.id);
  }

  /** Mesures préventives de la grossesse affichée : réalisée, attendue (âge gestationnel atteint) ou à venir. */
  get mesures(): { groupe: string; elements: (MesurePreventive & { faite: { date: string; valeur: string } | null; attendue: boolean })[] }[] {
    const r = this.referentiels.cpn();
    const g = this.grossesseAffichee;
    if (!r || !g) return [];
    const sa = g.agJours == null ? null : Math.floor(g.agJours / 7);
    return parGroupe(r.MESURES_PREVENTIVES.map(m => {
      const faite = g.mesuresPreventives?.[m.code] ?? null;
      return { ...m, faite, attendue: !faite && g.statut === 'En cours' && m.semaine != null && sa != null && sa >= m.semaine };
    }));
  }

  get mesuresFaites(): number {
    return Object.keys(this.grossesseAffichee?.mesuresPreventives ?? {}).length;
  }

  /** Première CPN de la grossesse en cours (chaque grossesse a la sienne). */
  get premiereFaite(): boolean {
    const g = this.grossesse;
    return !!g && (this.dossier?.consultations ?? []).some(c => c.grossesseId === g.id && c.type === 'Première consultation prénatale' && c.statut === 'Finalisée');
  }

  get rdvAVenir(): RendezVous[] {
    return (this.dossier?.rendezVous ?? []).filter(r => ['Planifié', 'Confirmé', 'Reporté'].includes(r.statut)).sort((a, b) => a.date.localeCompare(b.date));
  }

  get rdvPasses(): RendezVous[] {
    return (this.dossier?.rendezVous ?? []).filter(r => !['Planifié', 'Confirmé', 'Reporté'].includes(r.statut));
  }

  get journalFiltre(): EntreeJournal[] {
    const j = this.journal ?? [];
    if (this.filtreJournal === 'acces') return j.filter(e => e.action.endsWith('.lecture') || e.action === 'acces.refuse');
    if (this.filtreJournal === 'actes') return j.filter(e => !e.action.endsWith('.lecture') && e.action !== 'acces.refuse');
    return j;
  }

  /** « Quartier, commune, province » (parties vides omises). */
  residence(a: { quartier: string; commune: string; province: string }): string {
    return [a.quartier, a.commune, a.province].filter(Boolean).join(', ');
  }

  dr(nom: string, role: string): string {
    return role.startsWith('Médecin') ? `Dr ${nom}` : nom;
  }

  estMoi(id: string): boolean {
    return id === this.session.soignant()?.id;
  }

  statutConsultationClass(s: string): string {
    return {
      'Brouillon': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
      'Finalisée': 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/30',
      'Annulée': 'bg-slate-100 text-slate-500 ring-1 ring-slate-200 line-through dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    }[s] ?? '';
  }

  statutRdvClass(s: StatutRdv): string {
    return {
      'Planifié': 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      'Confirmé': 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
      'Reporté': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      'Effectué': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      'Annulé': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      'Absent': 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    }[s];
  }

  iconeJournal(e: EntreeJournal): { i: string; c: string } {
    if (e.resultat === 'refusé') return { i: 'fa-ban', c: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' };
    if (e.action.endsWith('.lecture')) return { i: 'fa-eye', c: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
    if (e.action.startsWith('consultation')) return { i: 'fa-stethoscope', c: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' };
    if (e.action.startsWith('rdv')) return { i: 'fa-calendar-check', c: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' };
    if (e.action.startsWith('grossesse')) return { i: 'fa-person-pregnant', c: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' };
    return { i: 'fa-pen-to-square', c: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' };
  }

  /** Échographies de la grossesse affichée, de la plus récente à la plus ancienne. */
  get echographies() {
    const g = this.grossesseAffichee;
    return g ? (this.dossier?.echographies ?? []).filter(e => e.grossesseId === g.id) : [];
  }

  // --- Fenêtres d'action ---------------------------------------------------------
  fenetre: Fenetre = null;
  envoi = false;
  erreurFenetre = '';

  ouvrir(f: Fenetre): void {
    this.fenetre = f;
    this.erreurFenetre = '';
    const g = this.grossesse;
    if (f === 'datation') {
      const d = g?.datation;
      this.formDatation = {
        methode: d?.methode ?? 'DDR', ddr: d?.ddr ?? '', ddrFiabilite: d?.ddrFiabilite ?? 'Fiable', dateReference: aujourdhui(),
        agSemaines: null, agJours: null, dpa: '', justification: '',
      };
    }
    if (f === 'issue') this.formIssue = { date: aujourdhui(), issue: 'Naissance vivante', mode: 'Voie basse', lieu: this.session.etablissement()?.nom ?? '', complications: '', resume: '', orientation: '' };
    if (f === 'rdv') this.formRdv = { date: '', motif: 'Consultation prénatale de suivi', lieu: '', consignes: '', canalRappel: 'Aucun' };
    if (f === 'risques') this.formRisques = { facteurs: [...(g?.facteursRisque ?? [])], multiple: g?.grossesseMultiple ?? null };
    if (f === 'fiche' && this.dossier) this.formFiche = profilCpnDe(this.dossier.patiente);
    if (f === 'grossesse' && this.dossier) {
      const a = this.dossier.patiente.antecedents;
      const precedente = this.dossier.grossesses[0];
      const accouchement = precedente?.issue && ['Naissance vivante', 'Mort-né'].includes(precedente.issue.issue) ? precedente.issue.date : null;
      this.formGrossesse = {
        ddr: '', ddrFiabilite: 'Fiable', facteurs: [], multiple: null,
        // Propositions à vérifier par le médecin (la gestité compte la nouvelle grossesse).
        gestite: (a.gestite ?? this.dossier.grossesses.length) + 1, parite: a.parite, enfantsVivants: a.enfantsVivants, avortements: a.avortements,
        dernierAccouchement: accouchement ?? a.dernierAccouchement ?? '',
      };
    }
    if (f === 'infos' && this.dossier) {
      this.referentiels.chargerProvinces().catch(() => {});
      const p = this.dossier.patiente;
      this.formInfos = {
        telephone: p.telephone, telephone2: p.telephone2, email: p.email ?? '',
        province: p.adresse.province, commune: p.adresse.commune, quartier: p.adresse.quartier, avenue: p.adresse.avenue, repere: p.adresse.repere,
        urgenceNom: p.contactUrgence?.nom ?? '', urgenceLien: p.contactUrgence?.lien ?? '', urgenceTel: p.contactUrgence?.telephone ?? '', urgenceAdresse: p.contactUrgence?.adresse ?? '',
        allergies: p.antecedents?.allergies ?? '', medicaments: p.antecedents?.medicaments ?? '',
      };
    }
  }

  fermer(): void {
    this.fenetre = null;
  }

  private async executer(action: () => Promise<unknown>, message: string): Promise<void> {
    this.envoi = true;
    this.erreurFenetre = '';
    try {
      await action();
      this.fenetre = null;
      this.notification = message;
      await this.charger();
    } catch (err) {
      this.erreurFenetre = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  // Datation
  formDatation = { methode: 'DDR' as SaisieDatation['methode'], ddr: '', ddrFiabilite: 'Fiable' as 'Fiable' | 'Incertaine' | 'Inconnue', dateReference: '', agSemaines: null as number | null, agJours: null as number | null, dpa: '', justification: '' };

  /** AG du jour et DPA calculés pendant la saisie (aperçu ; le serveur recalcule). */
  get apercuDatation() {
    const f = this.formDatation;
    return f.methode === 'DDR'
      ? apercuDatation({ ddr: f.ddr })
      : apercuDatation({ dateReference: f.dateReference, agSemaines: f.agSemaines, agJours: f.agJours });
  }

  enregistrerDatation(): void {
    const g = this.grossesse;
    if (!g) return;
    const f = this.formDatation;
    const saisie: SaisieDatation = f.methode === 'DDR'
      ? { methode: 'DDR', ddr: f.ddr, ddrFiabilite: f.ddrFiabilite, dpa: f.dpa || null, justification: f.justification }
      : { methode: f.methode, dateReference: f.dateReference, agSemaines: f.agSemaines, agJours: f.agJours ?? 0, dpa: f.dpa || null, justification: f.justification };
    this.executer(() => this.service.dater(g.id, saisie), 'Datation enregistrée. L’ancienne valeur reste consultable.');
  }

  // Facteurs de risque
  readonly facteursProposes = FACTEURS_RISQUE;
  formRisques = { facteurs: [] as string[], multiple: null as boolean | null };

  basculerFacteur(f: string): void {
    const l = this.formRisques.facteurs;
    this.formRisques.facteurs = l.includes(f) ? l.filter(x => x !== f) : [...l, f];
  }

  enregistrerRisques(): void {
    const g = this.grossesse;
    if (g) this.executer(() => this.service.modifierGrossesse(g.id, { facteursRisque: this.formRisques.facteurs, grossesseMultiple: this.formRisques.multiple }), 'Facteurs de risque mis à jour.');
  }

  // Issue de grossesse
  readonly issues = ISSUES;
  readonly modes = MODES_ACCOUCHEMENT;
  formIssue = { date: '', issue: 'Naissance vivante', mode: 'Voie basse', lieu: '', complications: '', resume: '', orientation: '' };
  confirmationIssue = false;

  enregistrerIssue(): void {
    const g = this.grossesse;
    if (g) this.executer(() => this.service.enregistrerIssue(g.id, this.formIssue), 'Issue de grossesse enregistrée. Le dossier passe en suivi postnatal.');
  }

  // Nouvelle grossesse
  // Nouvelle grossesse : même dossier, même compte patiente ; l'historique reste consultable.
  formGrossesse = {
    ddr: '', ddrFiabilite: 'Fiable' as 'Fiable' | 'Incertaine' | 'Inconnue', facteurs: [] as string[], multiple: null as boolean | null,
    gestite: null as number | null, parite: null as number | null, enfantsVivants: null as number | null, avortements: null as number | null,
    dernierAccouchement: '',
  };

  get apercuNouvelleGrossesse() {
    return apercuDatation({ ddr: this.formGrossesse.ddr });
  }

  basculerFacteurNouvelle(f: string): void {
    const l = this.formGrossesse.facteurs;
    this.formGrossesse.facteurs = l.includes(f) ? l.filter(x => x !== f) : [...l, f];
  }

  /** Grossesse précédente (la plus récente), pour rappeler son issue dans la fenêtre. */
  get grossessePrecedente(): Grossesse | null {
    return this.dossier?.grossesses[0] ?? null;
  }

  nouvelleGrossesse(): void {
    const p = this.dossier?.patiente;
    if (!p) return;
    const f = this.formGrossesse;
    this.executer(async () => {
      const g = await this.service.nouvelleGrossesse(p.numero, {
        datation: f.ddr ? { methode: 'DDR', ddr: f.ddr, ddrFiabilite: f.ddrFiabilite } : null,
        facteursRisque: f.facteurs, grossesseMultiple: f.multiple,
      });
      await this.service.modifier(p.numero, {
        antecedents: {
          ...p.antecedents, gestite: f.gestite, parite: f.parite, enfantsVivants: f.enfantsVivants, avortements: f.avortements,
          dernierAccouchement: f.dernierAccouchement || null,
        },
      });
      this.grossesseChoisie = null;
      this.onglet = 'resume';
      return g;
    }, 'Nouvelle grossesse ouverte dans le même dossier. Les grossesses précédentes et leurs CPN restent dans l’historique.');
  }

  // Rendez-vous
  formRdv = { date: '', motif: '', lieu: '', consignes: '', canalRappel: 'Aucun' as CanalRappel };

  creerRdv(): void {
    if (!this.dossier || !this.formRdv.date) return;
    this.executer(() => this.service.creerRendezVous(this.dossier!.patiente.numero, { ...this.formRdv, date: new Date(this.formRdv.date).toISOString() }), 'Rendez-vous planifié.');
  }

  rdvAction: { rdv: RendezVous; action: ActionRdv } | null = null;
  formActionRdv = { date: '', motif: '' };

  demanderActionRdv(rdv: RendezVous, action: ActionRdv): void {
    if (action === 'confirmer' || action === 'effectue') {
      this.executer(() => this.service.modifierRendezVous(rdv.id, action), action === 'confirmer' ? 'Rendez-vous confirmé.' : 'Rendez-vous marqué comme effectué.');
      return;
    }
    this.rdvAction = { rdv, action };
    this.formActionRdv = { date: '', motif: '' };
    this.ouvrir('action-rdv');
  }

  confirmerActionRdv(): void {
    const a = this.rdvAction;
    if (!a) return;
    const libelle = { reporter: 'Rendez-vous reporté.', annuler: 'Rendez-vous annulé.', absent: 'Absence enregistrée.' }[a.action as 'reporter' | 'annuler' | 'absent'];
    this.executer(() => this.service.modifierRendezVous(a.rdv.id, a.action, {
      motif: this.formActionRdv.motif,
      ...(a.action === 'reporter' ? { date: new Date(this.formActionRdv.date).toISOString() } : {}),
    }), libelle);
  }

  /** Une consultation peut honorer un rendez-vous du jour. */
  estAujourdhui(r: RendezVous): boolean {
    return jourLocal(r.date) === aujourdhui();
  }

  // Fiche CPN (identité complémentaire, biologie, antécédents cochés)
  formFiche = profilCpnVide();

  enregistrerFiche(): void {
    const p = this.dossier?.patiente;
    if (!p) return;
    const { patiente, antecedents } = profilCpnVersApi(this.formFiche);
    this.executer(() => this.service.modifier(p.numero, { ...patiente, antecedents: { ...p.antecedents, ...antecedents } }), 'Fiche CPN mise à jour. La modification est tracée.');
  }

  // Informations administratives
  formInfos = {
    telephone: '', telephone2: '', email: '', province: '', commune: '', quartier: '', avenue: '', repere: '',
    urgenceNom: '', urgenceLien: '', urgenceTel: '', urgenceAdresse: '',
    allergies: '', medicaments: '',
  };

  enregistrerInfos(): void {
    const p = this.dossier?.patiente;
    if (!p) return;
    const f = this.formInfos;
    this.executer(() => this.service.modifier(p.numero, {
      telephone: f.telephone, telephone2: f.telephone2, email: f.email,
      adresse: { ...p.adresse, province: f.province, commune: f.commune, quartier: f.quartier, avenue: f.avenue, repere: f.repere },
      contactUrgence: { nom: f.urgenceNom, lien: f.urgenceLien, telephone: f.urgenceTel, adresse: f.urgenceAdresse },
      antecedents: { ...p.antecedents, allergies: f.allergies, medicaments: f.medicaments },
    }), 'Informations mises à jour. La modification est tracée.');
  }
}
