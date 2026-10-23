import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OuiNonComponent } from '../../components/oui-non.component';
import { AvatarComponent } from '../../components/avatar.component';
import { PartogrammeComponent } from '../../components/partogramme.component';
import { PrisePhotoComponent } from '../../components/prise-photo.component';
import {
  AccouchementsService, Admission, Alerte, AlertesMaterniteService, DonneesAccouchement, DossierAccouchement, ExamenClinique,
  MereSurveillancePP, MesuresSortie, NouveauNeSurveillancePP, SaisieNouveauNe, SaisieSurveillance, classeZone,
} from '../../data/accouchements.service';
import { naissanceVide, totalApgar, Apgar } from '../../data/enfants.service';
import { aujourdhui, dateHeureChiffres, jourChiffres, versSaisieLocale } from '../../data/format';
import { SessionService, messageErreur } from '../../data/session.service';
import { alarme } from '../../../shared/son';

type Onglet = 'admission' | 'examen' | 'travail' | 'accouchement' | 'nouveau-nes' | 'post-partum';

const cloner = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/** datetime-local (heure du poste) → ISO ; vide → null. */
const iso = (v: string | null | undefined): string | null => (v ? new Date(v).toISOString() : null);
const local = (v: string | null | undefined): string => versSaisieLocale(v ?? null);
const vide = (v: unknown): boolean => v == null || v === '' || (Array.isArray(v) && !v.length);

/** Complète les champs vides de `cible` avec les valeurs de `source` ; renvoie le nombre de champs complétés. */
function completer(cible: Record<string, any>, source: Record<string, any> | null | undefined): number {
  let n = 0;
  for (const [k, v] of Object.entries(source ?? {})) {
    if (vide(v)) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      if (cible[k] == null || typeof cible[k] !== 'object') cible[k] = {};
      n += completer(cible[k], v);
    } else if (vide(cible[k])) {
      cible[k] = cloner(v);
      n++;
    }
  }
  return n;
}

function examenVide(): ExamenClinique {
  return {
    physique: { poidsKg: null, tailleCm: null, temperature: null, pouls: null, taSystolique: null, taDiastolique: null, oedemes: null, conjonctives: '', etatGeneral: '', systemes: {} },
    obstetrical: {
      hauteurUterineCm: null, presentation: '', position: '', bcf: null, contractions10min: null, contractions: '', mouvementsFoetauxActifs: null,
      speculum: '', colAspect: '', toucherVaginal: { effacementPct: null, dilatationCm: null, oedemeCol: null },
      pocheEaux: { etat: '', rompueLe: null, aspectLiquide: '' }, engagement: '', bassin: '',
    },
    laboratoire: {}, conclusion: '', pronostic: '', conduiteATenir: '', examineLe: null,
  };
}

function surveillanceVide(): SaisieSurveillance {
  return {
    le: '', saignement: '', contractions10min: null, dureeContractionsSec: null, bcf: null, temperature: null, pouls: null,
    taSystolique: null, taDiastolique: null, diurese: '', dilatationCm: null, affection: '', traitements: '', membranes: '',
    liquideAmniotique: '', ocytocine: { uParMl: null, gouttesMin: null }, medicamentsIV: '', engagement: '', incident: '',
  };
}

function accouchementVide(): DonneesAccouchement {
  return {
    mode: '', heure: null, multiple: null, nombreEnfants: 1, dechirure: { presente: null, degre: null }, episiotomie: null,
    indicationCesarienne: '', accoucheur: '', assiste: '',
    delivrance: {
      ocytocine10UI: { administree: null, heure: null }, tractionControlee: null, massageUterin: null, mode: '', heure: null,
      placenta: { complet: null, aspect: '' }, membranesCompletes: null, pertesSangMl: null, hemorragie: '',
    },
  };
}

function mereVide(): MereSurveillancePP {
  return { taSystolique: null, taDiastolique: null, pouls: null, temperature: null, respiration: null, conscience: '', saignement: '', globeSecurite: null, vessieDiurese: '', allaitement: '', reactionsPsy: '' };
}

/**
 * Dossier d'accouchement : admission (I), examen clinique (II), surveillance du travail et
 * partogramme (III), accouchement et délivrance (IV), nouveau-nés (V), post-partum et sortie (VI).
 */
@Component({
  selector: 'app-accouchement',
  standalone: true,
  imports: [FormsModule, RouterLink, OuiNonComponent, PartogrammeComponent, AvatarComponent, PrisePhotoComponent],
  templateUrl: './accouchement.component.html',
})
export class AccouchementComponent implements OnChanges {
  /** AC-ACC-… (route /admin/accouchements/:id). */
  @Input() id = '';

  private service = inject(AccouchementsService);
  private alertes = inject(AlertesMaterniteService);
  private router = inject(Router);
  session = inject(SessionService);
  dateHeure = dateHeureChiffres;
  jour = jourChiffres;
  zone = classeZone;
  apgarTotal = totalApgar;

  onglet: Onglet = 'travail';
  onglets: { k: Onglet; l: string; i: string }[] = [
    { k: 'admission', l: 'I · Admission', i: 'fa-id-card' },
    { k: 'examen', l: 'II · Examen clinique', i: 'fa-stethoscope' },
    { k: 'travail', l: 'III · Travail & partogramme', i: 'fa-chart-line' },
    { k: 'accouchement', l: 'IV · Accouchement', i: 'fa-hand-holding-medical' },
    { k: 'nouveau-nes', l: 'V · Nouveau-né', i: 'fa-baby' },
    { k: 'post-partum', l: 'VI · Post-partum & sortie', i: 'fa-house-medical-circle-check' },
  ];

  d: DossierAccouchement | null = null;
  chargement = true;
  erreur = '';
  notification = '';
  envoi = false;
  /** Alertes renvoyées par la dernière saisie (bandeau). */
  nouvellesAlertes: Alerte[] = [];

  /** Champs complétés depuis le suivi prénatal, non encore enregistrés. */
  completesAdmission = 0;
  completesExamen = 0;
  syntheseOuverte = true;

  formAdmission!: Admission & { debutTravailLocal: string };
  formExamen!: ExamenClinique;
  formSurv: SaisieSurveillance = surveillanceVide();
  formAcc!: DonneesAccouchement;
  formNN!: SaisieNouveauNe;
  /** Photo du nouveau-né en cours d'enregistrement (obligatoire s'il est né vivant). */
  photoNN: File | null = null;
  formPP!: { creneau: string; le: string; mere: MereSurveillancePP; nouveauNes: NouveauNeSurveillancePP[]; observations: string };
  formTrait = { pour: 'Mère', enfantId: '', produit: '', dose: '', voie: '', frequence: '', duree: '', statut: 'Prévu' };
  formSortie!: { date: string; rdvCpon: string; observations: string; conseils: string; mesures: MesuresSortie };

  /** Âge gestationnel en jours → « 38 SA 2 j ». */
  sa(jours: number): string {
    return `${Math.floor(jours / 7)} SA ${jours % 7} j`;
  }

  get ref() {
    return this.service.referentiel();
  }

  get clos(): boolean {
    return this.d?.statut === 'Clôturé';
  }

  async ngOnChanges(): Promise<void> {
    await this.service.chargerReferentiel().catch(() => undefined);
    await this.charger(true);
  }

  async charger(premier = false): Promise<void> {
    this.chargement = premier;
    this.erreur = '';
    try {
      this.appliquer(await this.service.obtenir(this.id));
      if (premier && this.d) {
        this.onglet = this.d.accouchement ? (this.d.nouveauNes.length ? 'post-partum' : 'nouveau-nes') : 'travail';
        this.syntheseOuverte = !this.d.accouchement;
      }
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  /** Dossier reçu du serveur : les formulaires repartent de ses valeurs. */
  private appliquer(d: DossierAccouchement): void {
    this.d = d;
    // Champs encore vides : complétés depuis le suivi prénatal (à vérifier puis enregistrer).
    const a = cloner(d.admission);
    if (!a.antecedents.gynecoObstetricaux.cesariennes) a.antecedents.gynecoObstetricaux.cesariennes = [];
    this.completesAdmission = completer(a, d.preRemplissage?.admission);
    this.formAdmission = { ...a, debutTravailLocal: local(a.debutTravail) };
    const e = d.examenClinique ? cloner(d.examenClinique) : examenVide();
    this.completesExamen = d.examenClinique ? 0 : completer(e, d.preRemplissage?.examen);
    e.obstetrical.pocheEaux.rompueLe = local(e.obstetrical.pocheEaux.rompueLe);
    e.examineLe = local(e.examineLe ?? new Date().toISOString());
    this.formExamen = e;
    const acc = d.accouchement ? cloner(d.accouchement) : accouchementVide();
    acc.heure = local(acc.heure);
    acc.delivrance.heure = local(acc.delivrance.heure);
    acc.delivrance.ocytocine10UI.heure = local(acc.delivrance.ocytocine10UI.heure);
    this.formAcc = acc;
    this.formNN = {
      prenom: '', sexe: '', neLe: local(d.accouchement?.heure ?? null), etatNaissance: 'Vivant', rang: d.nouveauNes.length + 1, naissance: naissanceVide(),
    };
    const prochain = d.planningPostPartum?.find(c => c.statut !== 'Faite');
    this.formPP = {
      creneau: prochain?.code ?? 'Supplémentaire', le: local(new Date().toISOString()), mere: mereVide(), observations: '',
      nouveauNes: d.nouveauNes.filter(n => n.etatNaissance === 'Vivant').map(n => ({ enfantId: n.id, respiration: null, coloration: '', temperatureAxillaire: null, signesDanger: '' })),
    };
    const pp = d.postPartum;
    this.formSortie = {
      date: pp.sortie?.date ?? aujourdhui(), rdvCpon: local(pp.sortie?.rdvCpon ?? null), observations: pp.sortie?.observations ?? '',
      conseils: pp.conseils ?? '', mesures: cloner(pp.mesuresPreventives ?? { mere: {}, nouveauNe: {} }),
    };
  }

  /** Enregistrement commun : envoi, rechargement des formulaires, message. */
  private async enregistrer(action: () => Promise<DossierAccouchement>, message: string): Promise<boolean> {
    this.envoi = true;
    this.erreur = '';
    try {
      this.appliquer(await action());
      this.notifier(message);
      return true;
    } catch (err) {
      this.erreur = messageErreur(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    } finally {
      this.envoi = false;
    }
  }

  private notifier(m: string): void {
    this.notification = m;
    setTimeout(() => (this.notification = ''), 4000);
  }

  // --- I. Admission ----------------------------------------------------------------------
  ajouterCesarienne(): void {
    this.formAdmission.antecedents.gynecoObstetricaux.cesariennes.push({ annee: null, indication: '' });
  }

  enregistrerAdmission(): void {
    const { debutTravailLocal, admisePar, admiseLe, ...reste } = this.formAdmission;
    this.enregistrer(() => this.service.modifierAdmission(this.id, { ...reste, debutTravail: iso(debutTravailLocal) }), 'Admission enregistrée.');
  }

  // --- II. Examen clinique ---------------------------------------------------------------
  enregistrerExamen(): void {
    const e = cloner(this.formExamen);
    e.obstetrical.pocheEaux.rompueLe = iso(e.obstetrical.pocheEaux.rompueLe);
    e.examineLe = iso(e.examineLe);
    delete e.examinateur;
    this.enregistrer(() => this.service.examiner(this.id, e), 'Examen clinique enregistré.');
  }

  // --- III. Surveillance du travail ------------------------------------------------------
  /** Phase de la prochaine saisie : active si déjà commencée ou si la dilatation atteint 4 cm. */
  get phaseSaisie(): 'Latence' | 'Active' {
    return this.d?.phaseActiveLe || (this.formSurv.dilatationCm ?? 0) >= 4 ? 'Active' : 'Latence';
  }

  get bcfHorsNorme(): boolean {
    const b = this.formSurv.bcf;
    return b != null && (b < 120 || b > 160);
  }

  nouvelleSaisie(): void {
    this.formSurv = { ...surveillanceVide(), le: local(new Date().toISOString()) };
  }

  async enregistrerSurveillance(): Promise<void> {
    if (!this.d) return;
    this.envoi = true;
    this.erreur = '';
    try {
      const r = await this.service.surveiller(this.id, { ...this.formSurv, le: iso(this.formSurv.le) ?? undefined });
      this.nouvellesAlertes = r.alertes;
      if (r.alertes.some(a => a.sonore)) alarme();
      if (r.alertes.length) this.alertes.actualiser();
      this.appliquer(await this.service.obtenir(this.id));
      this.nouvelleSaisie();
      this.notifier(r.alertes.length ? `Saisie enregistrée · ${r.alertes.length} alerte(s)` : 'Saisie enregistrée.');
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  async acquitter(a: Alerte): Promise<void> {
    try {
      await this.service.acquitter(this.id, a.id);
      this.alertes.retirer(a.id);
      this.nouvellesAlertes = this.nouvellesAlertes.filter(x => x.id !== a.id);
      this.appliquer(await this.service.obtenir(this.id));
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  get alertesActives(): Alerte[] {
    return (this.d?.alertes ?? []).filter(a => !a.acquitteeLe).sort((x, y) => y.le.localeCompare(x.le));
  }

  surveillancesRecentes() {
    return [...(this.d?.surveillances ?? [])].reverse();
  }

  // --- IV. Accouchement ------------------------------------------------------------------
  get hemorragieCalculee(): string {
    const v = this.formAcc.delivrance.pertesSangMl;
    if (v == null) return '';
    return v > (this.ref?.HEMORRAGIE_PHYSIOLOGIQUE_MAX_ML ?? 500) ? 'Pathologique' : 'Physiologique';
  }

  enregistrerAccouchement(): void {
    const a = cloner(this.formAcc);
    a.heure = iso(a.heure);
    a.delivrance.heure = iso(a.delivrance.heure);
    a.delivrance.ocytocine10UI.heure = iso(a.delivrance.ocytocine10UI.heure);
    delete a.enregistrePar;
    delete a.enregistreLe;
    const premier = !this.d?.accouchement;
    this.enregistrer(() => this.service.accoucher(this.id, a), 'Accouchement enregistré.').then(ok => {
      if (ok && premier) this.onglet = 'nouveau-nes';
    });
  }

  // --- V. Nouveau-né ---------------------------------------------------------------------
  apgarDe(m: number): Apgar {
    return this.formNN.naissance.apgar[`m${m}` as 'm1' | 'm5' | 'm10'];
  }

  async enregistrerNouveauNe(): Promise<void> {
    const n = cloner(this.formNN);
    n.neLe = iso(n.neLe);
    this.envoi = true;
    this.erreur = '';
    try {
      await this.service.ajouterNouveauNe(this.id, n, this.photoNN);
      this.photoNN = null;
      this.appliquer(await this.service.obtenir(this.id));
      this.notifier('Nouveau-né enregistré : son carnet de vaccination est ouvert et sa première séance programmée.');
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  prenomEnfant(id: string | null): string {
    const e = this.d?.nouveauNes.find(n => n.id === id);
    return e ? e.prenom || `Bébé ${e.rang}` : '';
  }

  // --- VI. Post-partum -------------------------------------------------------------------
  libelleCreneau(code: string): string {
    return this.ref?.CRENEAUX_POST_PARTUM.find(c => c.code === code)?.libelle ?? code;
  }

  enregistrerPostPartum(): void {
    const f = cloner(this.formPP);
    this.enregistrer(() => this.service.surveillerPostPartum(this.id, { ...f, le: iso(f.le) ?? undefined }), 'Surveillance post-partum enregistrée.');
  }

  enregistrerTraitement(): void {
    const t = this.formTrait;
    this.enregistrer(() => this.service.ajouterTraitement(this.id, { ...t, enfantId: t.pour === 'Nouveau-né' ? t.enfantId : null } as never), 'Traitement enregistré.')
      .then(ok => ok && (this.formTrait = { pour: 'Mère', enfantId: '', produit: '', dose: '', voie: '', frequence: '', duree: '', statut: 'Prévu' }));
  }

  administrer(traitementId: string): void {
    this.enregistrer(() => this.service.administrer(this.id, traitementId), 'Traitement administré.');
  }

  enregistrerSortie(): void {
    const s = this.formSortie;
    this.enregistrer(() => this.service.sortir(this.id, {
      date: s.date, rdvCpon: iso(s.rdvCpon), observations: s.observations, conseils: s.conseils, mesuresPreventives: s.mesures,
    }), 'Sortie et mesures préventives enregistrées.');
  }

  cloturer(): void {
    this.enregistrer(() => this.service.cloturer(this.id), 'Dossier clôturé. Le carnet vaccinal des enfants est à jour.');
  }

  // --- Suppression définitive (médecins ; le serveur vérifie le rôle et le numéro) -----------
  suppressionOuverte = false;
  saisieSuppression = '';
  erreurSuppression = '';

  get prenomsNouveauNes(): string {
    return (this.d?.nouveauNes ?? []).map(n => n.prenom || `Bébé ${n.rang}`).join(', ');
  }

  ouvrirSuppression(): void {
    this.suppressionOuverte = true;
    this.saisieSuppression = '';
    this.erreurSuppression = '';
  }

  async supprimer(): Promise<void> {
    if (!this.d) return;
    this.envoi = true;
    this.erreurSuppression = '';
    try {
      await this.service.supprimer(this.d.numero, this.saisieSuppression.trim().toUpperCase());
      this.alertes.actualiser();
      this.router.navigate(['/admin/accouchements']);
    } catch (err) {
      this.erreurSuppression = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  classePlanning(s: string): string {
    return {
      'Faite': 'bg-accent-500 text-white',
      'À faire': 'bg-amber-400 text-amber-950',
      'En retard': 'bg-rose-600 text-white',
      'À venir': 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700',
    }[s] ?? '';
  }
}
