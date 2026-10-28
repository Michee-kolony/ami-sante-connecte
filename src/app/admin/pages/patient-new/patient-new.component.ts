import { Component, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { aujourdhui, dateHeureChiffres, dpaNaegele, jourChiffres, jourFr } from '../../data/format';
import {
  Doublon, FOETUS_MAX, FoetusEcho, MATURITES_PLACENTA, PRESENTATIONS_FOETUS, PatientesService, QUANTITES_LIQUIDE, SEXES_FOETUS,
  SaisieDatation, SaisieEchographie, doublonsDe, foetusVide, profilCpnVersApi, profilCpnVide,
} from '../../data/patientes.service';
import { EtablissementsService } from '../../data/etablissements.service';
import { MesurePreventive, ReferentielsService, parGroupe } from '../../data/referentiels.service';
import { SessionService, messageErreur } from '../../data/session.service';
import { HorsLigneService, estMiseEnFile, localIdDe } from '../../data/hors-ligne/hors-ligne.service';
import { enJpeg } from '../../components/prise-photo.component';

interface Step {
  title: string;
  subtitle: string;
  icon: string;
  /** Couleur de la carte (Tailwind : classes écrites en entier pour être générées). */
  teinte: Teinte;
  clinical?: boolean;
}

interface Teinte {
  /** Fond et bordure de la carte, barre de gauche. */
  carte: string;
  /** Pastille de l'icône. */
  icone: string;
  /** Titre. */
  titre: string;
}

const TEINTES: Record<string, Teinte> = {
  bleu: {
    carte: 'border-l-brand-600 bg-brand-50/60 dark:border-l-brand-400 dark:bg-brand-500/5',
    icone: 'bg-gradient-to-br from-brand-500 to-brand-700 text-white', titre: 'text-brand-800 dark:text-brand-300',
  },
  vert: {
    carte: 'border-l-teal-500 bg-teal-50/60 dark:border-l-teal-400 dark:bg-teal-500/5',
    icone: 'bg-gradient-to-br from-teal-400 to-emerald-600 text-white', titre: 'text-teal-800 dark:text-teal-300',
  },
  violet: {
    carte: 'border-l-violet-500 bg-violet-50/60 dark:border-l-violet-400 dark:bg-violet-500/5',
    icone: 'bg-gradient-to-br from-violet-400 to-purple-600 text-white', titre: 'text-violet-800 dark:text-violet-300',
  },
  ambre: {
    carte: 'border-l-amber-500 bg-amber-50/60 dark:border-l-amber-400 dark:bg-amber-500/5',
    icone: 'bg-gradient-to-br from-amber-400 to-orange-600 text-white', titre: 'text-amber-800 dark:text-amber-300',
  },
  rose: {
    carte: 'border-l-rose-500 bg-rose-50/60 dark:border-l-rose-400 dark:bg-rose-500/5',
    icone: 'bg-gradient-to-br from-rose-400 to-red-600 text-white', titre: 'text-rose-800 dark:text-rose-300',
  },
  ciel: {
    carte: 'border-l-sky-500 bg-sky-50/60 dark:border-l-sky-400 dark:bg-sky-500/5',
    icone: 'bg-gradient-to-br from-sky-400 to-cyan-600 text-white', titre: 'text-sky-800 dark:text-sky-300',
  },
  indigo: {
    carte: 'border-l-indigo-500 bg-indigo-50/60 dark:border-l-indigo-400 dark:bg-indigo-500/5',
    icone: 'bg-gradient-to-br from-indigo-400 to-blue-700 text-white', titre: 'text-indigo-800 dark:text-indigo-300',
  },
};

/** Case de la fiche papier : libellé court imprimé, valeur du référentiel enregistrée. */
interface CaseFiche {
  l: string;
  v: string;
}

/** Libellé imprimé sur la fiche : l'abréviation entre parenthèses si elle existe (« Tuberculose (TBC) » → TBC). */
const libelleCourt = (v: string) => v.match(/\(([^)]+)\)$/)?.[1] ?? v;

const DAY = 86_400_000;

function parse(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Enregistrement d'une patiente (médecin) : les données de la « Fiche de consultation prénatale »
 * papier du Ministère (identité, DDR/DPA, antécédents cochés, rendez-vous), plus la photo et le
 * compte de l'espace patiente, saisies étape par étape. La fiche papier remplie est prévisualisée
 * avant l'enregistrement. Les doublons possibles sont vérifiés pendant la saisie puis par le serveur.
 */
@Component({
  selector: 'app-patient-new',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrl: './patient-new.component.css',
  templateUrl: './patient-new.component.html',
})
export class PatientNewComponent implements OnDestroy {
  private service = inject(PatientesService);
  private router = inject(Router);
  session = inject(SessionService);
  /** Les 26 provinces viennent du serveur (même liste que l'énumération du modèle Patiente). */
  referentiels = inject(ReferentielsService);
  private etablissementsService = inject(EtablissementsService);
  /** Réseau : sans connexion, l'enregistrement est gardé sur l'appareil puis envoyé automatiquement. */
  readonly horsLigne = inject(HorsLigneService);
  etablissementsActifs = computed(() => this.etablissementsService.etablissements().filter(e => e.statut === 'Actif'));
  chargementEtablissements = true;
  fmt = jourFr;
  /** Affichage de la fiche papier en aperçu : dates en chiffres, cases abrégées comme à l'impression. */
  jc = (iso: string | null | undefined) => (iso ? jourChiffres(iso) : '');
  dhc = (v: string) => (v ? dateHeureChiffres(new Date(v)) : '');
  court = libelleCourt;
  today = aujourdhui();
  step = 0;
  /** Étape dépliée : aucune à l'arrivée, le médecin ouvre lui-même la première (-1 = toutes fermées). */
  ouverte = -1;
  envoi = false;
  erreur = '';

  steps: Step[] = [
    { title: 'Identité', subtitle: 'Femme enceinte, contact, résidence, DDR et DPA', icon: 'fa-id-card', teinte: TEINTES['bleu'], clinical: true },
    { title: 'Antécédents', subtitle: 'Médicaux, gynéco-chirurgicaux et obstétricaux', icon: 'fa-notes-medical', teinte: TEINTES['violet'], clinical: true },
    { title: 'Mesures préventives', subtitle: 'VAT, SP, MILD, vermifuge, dépistages, PF, PTME', icon: 'fa-shield-heart', teinte: TEINTES['vert'], clinical: true },
    { title: 'Laboratoire', subtitle: 'Hb, GE, TDR palu, GS, urines, selles…', icon: 'fa-flask', teinte: TEINTES['ambre'], clinical: true },
    { title: 'Échographie', subtitle: 'Fœtus, biométrie, placenta, liquide, col, conclusion', icon: 'fa-wave-square', teinte: TEINTES['ciel'], clinical: true },
    { title: 'Éléments de référence', subtitle: 'Signes justifiant d’orienter la femme : oui / non', icon: 'fa-hospital-user', teinte: TEINTES['rose'], clinical: true },
    { title: 'Rendez-vous', subtitle: 'Premier rendez-vous et prévisualisation de la fiche', icon: 'fa-calendar-check', teinte: TEINTES['indigo'] },
  ];

  // --- Mesures préventives et laboratoire (enregistrés dans le brouillon de la 1re CPN) ----
  /** Réponse oui / non (null : non renseigné) et valeur notée, par code de mesure. */
  mesures: Record<string, { reponse: boolean | null; valeur: string }> = {};
  /** Résultats d'examens, par code. */
  labo: Record<string, string> = {};

  get groupesMesures(): { groupe: string; elements: MesurePreventive[] }[] {
    return parGroupe(this.referentiels.cpn()?.MESURES_PREVENTIVES ?? []);
  }

  mesure(code: string): { reponse: boolean | null; valeur: string } {
    return (this.mesures[code] ??= { reponse: null, valeur: '' });
  }

  /** Un second clic sur la réponse choisie la retire (non renseigné). */
  repondreMesure(code: string, reponse: boolean): void {
    const m = this.mesure(code);
    m.reponse = m.reponse === reponse ? null : reponse;
  }

  // --- Échographie obstétricale (enregistrée avec ses fichiers après la création du dossier) ----
  readonly sexesFoetus = SEXES_FOETUS;
  readonly presentationsFoetus = PRESENTATIONS_FOETUS;
  readonly quantitesLiquide = QUANTITES_LIQUIDE;
  readonly maturitesPlacenta = MATURITES_PLACENTA;
  readonly foetusMax = FOETUS_MAX;
  /** Biométrie de chaque fœtus (mm ; poids estimé en g). */
  readonly biometrie: { k: keyof FoetusEcho; l: string }[] = [
    { k: 'bipMm', l: 'BIP (mm)' }, { k: 'perimetreCranienMm', l: 'PC (mm)' }, { k: 'perimetreAbdominalMm', l: 'PA (mm)' },
    { k: 'longueurFemoraleMm', l: 'LF (mm)' }, { k: 'poidsEstimeG', l: 'Poids estimé (g)' },
  ];
  echo: SaisieEchographie = {
    date: '', motif: '', agSemaines: null, agJours: null, nombreFoetus: 1, foetus: [foetusVide()],
    placenta: { localisation: '', aspect: '', maturite: '' }, liquideAmniotique: { quantite: '', indiceCm: null },
    col: { longueurMm: null, aspect: '' }, anomalies: '', conclusion: '', praticien: '',
  };
  /** Compte rendu (PDF) ou images joints. */
  fichiersEcho: File[] = [];
  erreurFichierEcho = '';

  /** Nombre de fœtus : une fiche par fœtus (F1, F2…), les saisies existantes sont gardées. */
  changerNombreFoetus(v: number | null): void {
    // Champ vide ou invalide pendant la saisie : on garde la valeur courante (rétablie au blur).
    if (v === null || !Number.isFinite(v)) return;
    const n = Math.min(FOETUS_MAX, Math.max(1, Math.round(v)));
    this.echo.nombreFoetus = n;
    this.echo.foetus = Array.from({ length: n }, (_, i) => this.echo.foetus[i] ?? foetusVide());
  }

  ajouterFichiersEcho(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const choisis = Array.from(input.files ?? []);
    input.value = '';
    this.erreurFichierEcho = '';
    for (const f of choisis) {
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) { this.erreurFichierEcho = 'Formats acceptés : PDF, JPG, PNG ou WebP.'; continue; }
      if (f.size > 10 * 1024 * 1024) { this.erreurFichierEcho = 'Chaque fichier doit faire 10 Mo au maximum.'; continue; }
      if (this.fichiersEcho.length >= 6) { this.erreurFichierEcho = '6 fichiers au maximum.'; break; }
      this.fichiersEcho = [...this.fichiersEcho, f];
    }
  }

  retirerFichierEcho(f: File): void {
    this.fichiersEcho = this.fichiersEcho.filter(x => x !== f);
  }

  /** Une rubrique de l'échographie est remplie (la date devient alors obligatoire). */
  get echoCommencee(): boolean {
    const e = this.echo;
    return !!(e.date || e.motif.trim() || e.agSemaines !== null || e.conclusion.trim() || e.praticien.trim() || e.anomalies.trim()
      || e.placenta.localisation.trim() || e.liquideAmniotique.quantite || e.col.longueurMm !== null || this.fichiersEcho.length
      || e.foetus.some(f => f.activiteCardiaque !== null || f.bcf !== null || !!f.sexe || !!f.presentation || f.poidsEstimeG !== null || f.bipMm !== null));
  }

  get echoDateFuture(): boolean {
    return !!this.echo.date && this.echo.date > this.today;
  }

  // --- Éléments de référence de la femme (brouillon de la 1re CPN ; horodatés par le serveur) ----
  /** Réponse par motif du référentiel : true (oui), false (non), absent (non renseigné). */
  reference: Record<string, boolean> = {};
  /** Précision libre (« Autres raisons », maladie chronique…). */
  precisionReference = '';

  get motifsReference(): string[] {
    return this.referentiels.cpn()?.MOTIFS_REFERENCE ?? [];
  }

  /** Un second clic sur la réponse choisie la retire (non renseigné). */
  repondreReference(motif: string, oui: boolean): void {
    if (this.reference[motif] === oui) delete this.reference[motif];
    else this.reference[motif] = oui;
  }

  /** Motifs cochés « oui » : seuls ceux-là sont enregistrés (la référence est alors horodatée). */
  get motifsRetenus(): string[] {
    return this.motifsReference.filter(m => this.reference[m] === true);
  }

  /** Mesures, examens ou référence saisis : ils partent dans le brouillon de la première consultation prénatale. */
  get mesuresOuLaboSaisis(): boolean {
    return Object.values(this.mesures).some(m => m.reponse !== null || !!m.valeur.trim())
      || Object.values(this.labo).some(v => !!v.trim())
      || this.motifsRetenus.length > 0 || !!this.precisionReference.trim();
  }

  get mesuresApercu(): { libelle: string; reponse: boolean | null; valeur: string }[] {
    return (this.referentiels.cpn()?.MESURES_PREVENTIVES ?? [])
      .map(m => ({ libelle: m.libelle, ...this.mesure(m.code) }))
      .filter(m => m.reponse !== null || !!m.valeur.trim());
  }

  /** Fiche CPN : identité complémentaire, biologie et antécédents cochés (référentiel du serveur). */
  fiche = profilCpnVide();
  /** Date imprimée en tête de la fiche. */
  readonly dateFiche = jourChiffres(aujourdhui());
  readonly annee = aujourdhui().slice(0, 4);

  /** Cases de la fiche, dans l'ordre imprimé (valeurs du référentiel servi par le serveur). */
  casesFiche(ref: 'ATCD_MEDICAUX' | 'ATCD_GYNECO_CHIRURGICAUX'): CaseFiche[] {
    return (this.referentiels.cpn()?.[ref] ?? []).map(v => ({ l: libelleCourt(v), v }));
  }

  coche(liste: 'atcdMedicaux' | 'atcdGynecoChirurgicaux' | 'atcdObstetricaux', v: string): boolean {
    return this.fiche[liste].includes(v);
  }

  basculer(liste: 'atcdMedicaux' | 'atcdGynecoChirurgicaux' | 'atcdObstetricaux', v: string): void {
    const l = this.fiche[liste];
    this.fiche[liste] = l.includes(v) ? l.filter(x => x !== v) : [...l, v];
  }

  /** Complication post-partum (NON / OUI) : case « Complication du post-partum » du référentiel. */
  get complicationPostPartum(): boolean | null {
    return this.coche('atcdObstetricaux', 'Complication du post-partum') ? true : this.complicationNon ? false : null;
  }
  private complicationNon = false;

  choisirComplication(oui: boolean): void {
    const v = 'Complication du post-partum';
    if (oui !== this.coche('atcdObstetricaux', v)) this.basculer('atcdObstetricaux', v);
    this.complicationNon = !oui;
  }

  /** Pastille à cocher (saisie des antécédents). */
  pastille(actif: boolean): string {
    return actif
      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50';
  }

  /** Cases obstétricales suggérées par l'âge, la parité, le poids et l'intervalle (jamais cochées seules). */
  get suggestionsObst(): string[] {
    const s: string[] = [];
    const primipare = this.form.parite === 0;
    const age = this.ageCalcule;
    if (primipare && age != null && age < 19) s.push('Primipare de moins de 19 ans');
    if (primipare && age != null && age > 35) s.push('Primipare de plus de 35 ans');
    if ((this.fiche.plusGrosPoidsNaissanceG ?? 0) > 4000) s.push('Enfant de plus de 4 kg');
    if (this.fiche.dernierAccouchement) {
      const mois = (Date.now() - Date.parse(this.fiche.dernierAccouchement)) / (30.44 * DAY);
      if (mois >= 0 && mois < 36) s.push('Intervalle inférieur à 3 ans');
    }
    return s.filter(x => !this.fiche.atcdObstetricaux.includes(x));
  }

  /** Lignes « Adresse » et « Adresse/Tél » de la fiche en aperçu. */
  get adresseApercu(): string {
    const f = this.form;
    return [f.avenue, f.quartier, f.commune, f.province].filter(Boolean).join(', ');
  }

  get contactApercu(): string {
    return [this.form.urgenceAdresse, this.form.urgenceTel].filter(Boolean).join(' · ');
  }

  get etablissement() {
    return this.etablissementsActifs().find(e => e.id === this.form.etablissementId) ?? null;
  }

  form = {
    nom: '', postnom: '', prenom: '',
    ageMode: 'date' as 'date' | 'age',
    dateNaissance: '', ageDeclare: null as number | null,
    piece: '',
    tel1: '', tel1Partage: false, tel2: '', email: '',
    /** Saisis par la patiente : identifiants de son espace en ligne. */
    motDePasse: '', confirmation: '',
    urgenceNom: '', urgenceLien: '', urgenceTel: '', urgenceAdresse: '',
    // Par défaut, la province de l'établissement de connexion (à corriger si la patiente vit ailleurs).
    province: '', commune: '', quartier: '', avenue: '', repere: '',
    aire: '',
    /** Établissement de prise en charge (actif) : par défaut celui de la connexion. */
    etablissementId: '',
    dateReference: aujourdhui(),
    ddrConnue: true,
    ddr: '',
    ddrFiabilite: 'Fiable' as 'Fiable' | 'Incertaine' | 'Inconnue',
    agMethode: 'Échographie' as 'Échographie' | 'Examen clinique',
    agSemaines: null as number | null,
    agJours: null as number | null,
    dpaSaisie: '',
    dpaJustification: '',
    grossesseMultiple: null as boolean | null,
    facteurs: [] as string[],
    gestite: null as number | null, parite: null as number | null, enfantsVivants: null as number | null,
    avortements: null as number | null, cesariennes: null as number | null,
    complications: '', antecedentsMedicaux: '', antecedentsChirurgicaux: '', allergies: '', medicaments: '',
    prochainRdv: '',
    motifRdv: 'Première consultation prénatale',
  };

  communes: Partial<Record<string, string[]>> = {
    Kinshasa: ['Bandalungwa', 'Barumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kintambo', 'Limete', 'Lingwala', 'Masina', 'Matete', 'Ngaliema', 'Ngiri-Ngiri', 'Selembao'],
    'Kongo-Central': ['Matadi', 'Boma', 'Mbanza-Ngungu'],
  };

  // --- Doublons (vérifiés pendant la saisie, puis par le serveur) ------------------
  doublons: Doublon[] = [];
  verificationDoublons = false;
  /** Le serveur a signalé des doublons à l'envoi : confirmation explicite requise. */
  doublonsBloquants = false;
  confirmationDoublons = false;
  /** Même e-mail qu'un dossier existant : c'est la même patiente, la création est impossible. */
  emailExistant = false;
  private minuteurDoublons?: ReturnType<typeof setTimeout>;

  constructor() {
    this.chargerProvinces();
    this.referentiels.chargerCpn().catch(() => {});
    this.etablissementsService.charger(true)
      .then(() => {
        const id = this.session.etablissement()?.id;
        if (!this.form.etablissementId && id && this.etablissementsActifs().some(e => e.id === id)) this.choisirEtablissement(id);
      })
      .catch(() => {})
      .finally(() => (this.chargementEtablissements = false));
  }

  /** Établissement choisi : son aire de santé et sa province servent de valeurs proposées. */
  choisirEtablissement(id = this.form.etablissementId): void {
    this.form.etablissementId = id;
    const e = this.etablissementsActifs().find(x => x.id === id);
    if (!e) return;
    if (!this.form.aire) this.form.aire = e.aireSante;
    if (!this.form.province && this.referentiels.provinces().includes(e.province)) this.form.province = e.province;
  }

  chargerProvinces(): void {
    this.referentiels.chargerProvinces()
      .then(liste => {
        const p = this.session.etablissement()?.province;
        if (!this.form.province && p && liste.includes(p)) this.form.province = p;
      })
      .catch(() => {});
  }

  ngOnDestroy(): void {
    clearTimeout(this.minuteurDoublons);
    this.retirerPhoto();
    this.fermerCamera();
    document.body.style.overflow = '';
  }

  /** Relance la recherche de doublons 500 ms après la dernière frappe. */
  verifierDoublons(): void {
    clearTimeout(this.minuteurDoublons);
    this.doublonsBloquants = false;
    this.confirmationDoublons = false;
    const criteres = {
      nom: this.form.nom.trim(), prenom: this.form.prenom.trim(),
      dateNaissance: this.form.ageMode === 'date' ? this.form.dateNaissance : '',
      telephone: this.form.tel1,
    };
    if (!criteres.nom && criteres.telephone.replace(/\D/g, '').length < 9) {
      this.doublons = [];
      return;
    }
    this.minuteurDoublons = setTimeout(async () => {
      this.verificationDoublons = true;
      try {
        this.doublons = await this.service.doublons(criteres);
      } catch {
        this.doublons = [];
      } finally {
        this.verificationDoublons = false;
      }
    }, 500);
  }

  get structureNom(): string {
    return this.etablissementsActifs().find(e => e.id === this.form.etablissementId)?.nom ?? 'Établissement à choisir';
  }

  // --- Identité ----------------------------------------------------------
  get ageCalcule(): number | null {
    if (this.form.ageMode === 'age') return this.form.ageDeclare;
    if (!this.form.dateNaissance) return null;
    return Math.floor((parse(this.today) - parse(this.form.dateNaissance)) / (365.25 * DAY));
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

  get emailInvalide(): boolean {
    return !!this.form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim());
  }

  // --- Compte patiente (même règle que le serveur) ---------------------------
  afficherMdp = false;

  get reglesMdp(): { label: string; ok: boolean }[] {
    const m = this.form.motDePasse;
    return [
      { label: '8 caractères au moins', ok: m.length >= 8 },
      { label: 'Au moins une lettre', ok: /[A-Za-z]/.test(m) },
      { label: 'Au moins un chiffre', ok: /\d/.test(m) },
      { label: 'Confirmation identique', ok: !!m && m === this.form.confirmation },
    ];
  }

  // --- Photo (obligatoire) ----------------------------------------------------
  photoFichier: File | null = null;
  photoApercu: string | null = null;
  photoErreur = '';

  async choisirPhoto(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    this.photoErreur = '';
    if (fichier) await this.appliquerPhoto(fichier);
  }

  private async appliquerPhoto(fichier: File): Promise<void> {
    if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
      this.photoErreur = 'Format accepté : JPG, PNG ou WebP.';
      return;
    }
    // Les photos d'appareil dépassent souvent 2 Mo : on les réduit avant de vérifier la taille.
    const photo = await enJpeg(fichier).catch(() => fichier);
    if (photo.size > 2 * 1024 * 1024) {
      this.photoErreur = 'La photo doit faire 2 Mo au maximum.';
      return;
    }
    this.retirerPhoto();
    this.photoFichier = photo;
    this.photoApercu = URL.createObjectURL(photo);
  }

  retirerPhoto(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
    this.photoFichier = null;
    this.photoApercu = null;
  }

  // --- Appareil photo (aperçu en direct dans la page) --------------------------
  camera: MediaStream | null = null;
  cameraFace: 'environment' | 'user' = 'environment';
  cameraErreur = '';

  /**
   * Ouvre l'appareil photo de l'appareil. Sans accès possible (HTTP, navigateur ancien),
   * on se rabat sur le champ fichier, qui ouvre l'appareil photo natif sur mobile.
   */
  async ouvrirCamera(repli: HTMLInputElement): Promise<void> {
    this.photoErreur = '';
    this.cameraErreur = '';
    if (!navigator.mediaDevices?.getUserMedia) {
      repli.click();
      return;
    }
    try {
      this.fermerCamera();
      this.camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.cameraFace, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch (e) {
      const nom = (e as DOMException)?.name;
      this.photoErreur = nom === 'NotAllowedError'
        ? 'Accès à l’appareil photo refusé. Autorisez-le dans les réglages du navigateur, ou choisissez un fichier.'
        : 'Appareil photo introuvable ou indisponible. Choisissez un fichier.';
    }
  }

  /** Bascule entre la caméra arrière et la caméra avant (selfie). */
  async changerCamera(repli: HTMLInputElement): Promise<void> {
    this.cameraFace = this.cameraFace === 'environment' ? 'user' : 'environment';
    await this.ouvrirCamera(repli);
  }

  /** Capture l'image affichée, puis la traite comme un fichier choisi (JPEG, 2 Mo max). */
  async capturer(video: HTMLVideoElement): Promise<void> {
    if (!video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.92));
    if (!blob) {
      this.cameraErreur = 'Capture impossible, réessayez.';
      return;
    }
    this.fermerCamera();
    await this.appliquerPhoto(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }

  fermerCamera(): void {
    this.camera?.getTracks().forEach(t => t.stop());
    this.camera = null;
  }

  // --- Datation (aperçu ; le serveur recalcule et fait foi) -----------------
  get referenceFuture(): boolean {
    return !this.form.ddrConnue && !!this.form.dateReference && this.form.dateReference > this.today;
  }

  get ddrApresReference(): boolean {
    return this.form.ddrConnue && !!this.form.ddr && this.form.ddr > this.today;
  }

  get agCalcule(): { sa: number; j: number } | null {
    let t: number;
    if (this.form.ddrConnue) {
      if (!this.form.ddr) return null;
      t = Math.round((parse(this.today) - parse(this.form.ddr)) / DAY);
    } else {
      if (this.form.agSemaines === null || !this.form.dateReference) return null;
      t = this.form.agSemaines * 7 + (this.form.agJours ?? 0) + Math.round((parse(this.today) - parse(this.form.dateReference)) / DAY);
    }
    return t < 0 ? null : { sa: Math.floor(t / 7), j: t % 7 };
  }

  get agHorsPlage(): boolean {
    const a = this.agCalcule;
    return a !== null && a.sa > 44;
  }

  get dpaCalculee(): string | null {
    if (this.form.ddrConnue) return this.form.ddr ? dpaNaegele(this.form.ddr) : null;
    if (this.form.agSemaines === null || !this.form.dateReference) return null;
    const jours = this.form.agSemaines * 7 + (this.form.agJours ?? 0);
    return toIso(parse(this.form.dateReference) + (280 - jours) * DAY);
  }

  /**
   * Change un champ de datation et préremplit la DPA validée avec la DPA calculée, tant que le
   * médecin ne l'a pas modifiée lui-même (champ vide ou encore égal à l'ancienne DPA calculée).
   */
  majDatation(maj: Partial<typeof this.form>): void {
    const avant = this.dpaCalculee;
    Object.assign(this.form, maj);
    if (!this.form.dpaSaisie || this.form.dpaSaisie === avant) this.form.dpaSaisie = this.dpaCalculee ?? '';
  }

  get ecartDpa(): number | null {
    const ref = this.dpaCalculee;
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

  /** Datation renseignée ? (sinon la grossesse reste « à dater » lors de la consultation). */
  get datationSaisie(): SaisieDatation | null {
    if (this.form.ddrConnue) {
      if (!this.form.ddr) return null;
      return { methode: 'DDR', ddr: this.form.ddr, ddrFiabilite: this.form.ddrFiabilite, dpa: this.form.dpaSaisie || null, justification: this.form.dpaJustification };
    }
    if (this.form.agSemaines === null) return null;
    return {
      methode: this.form.agMethode, dateReference: this.form.dateReference, agSemaines: this.form.agSemaines,
      agJours: this.form.agJours ?? 0, dpa: this.form.dpaSaisie || null, justification: this.form.dpaJustification,
    };
  }

  // --- Synthèse ----------------------------------------------------------
  get manquants(): string[] {
    const m: string[] = [];
    if (!this.form.nom.trim()) m.push('Nom');
    if (this.ageCalcule === null) m.push('Date de naissance ou âge');
    if (!this.photoFichier) m.push('Photo de la patiente');
    if (!this.form.email.trim() || this.emailInvalide) m.push('E-mail de la patiente');
    if (this.reglesMdp.some(r => !r.ok)) m.push('Mot de passe de la patiente');
    if (!this.referentiels.provinces().includes(this.form.province)) m.push('Province de résidence');
    if (!this.etablissementsActifs().some(e => e.id === this.form.etablissementId)) m.push('Établissement sanitaire');
    if (this.ecartSensible && !this.form.dpaJustification.trim()) m.push('Justification de la DPA');
    if (this.ddrApresReference || this.referenceFuture) m.push('Datation à corriger');
    if (this.doublonsBloquants && !this.confirmationDoublons) m.push('Confirmation des doublons');
    if (this.echoCommencee && !this.echo.date) m.push('Date de l’échographie');
    if (this.echoDateFuture) m.push('Date de l’échographie à corriger');
    return m;
  }

  get alertes(): string[] {
    const a: string[] = [];
    if (this.ageImprobable) a.push('Âge improbable — à vérifier');
    if (this.telInvalide) a.push('Format du téléphone principal à vérifier');
    if (this.referenceFuture) a.push('Date de l’examen dans le futur');
    if (this.ddrApresReference) a.push('DDR dans le futur');
    if (this.agHorsPlage) a.push('Âge gestationnel hors plage (0–44 SA)');
    if (this.ecartSensible) a.push(`DPA saisie différente de ${this.ecartDpa} j de la DPA calculée`);
    if (!this.datationSaisie) a.push('Grossesse non datée : à compléter en consultation');
    return a;
  }

  // --- Prévisualisation de la fiche avant l'enregistrement -------------------
  apercuOuvert = false;

  ouvrirApercu(): void {
    if (this.manquants.length) return;
    this.apercuOuvert = true;
    document.body.style.overflow = 'hidden';
  }

  fermerApercu(): void {
    this.apercuOuvert = false;
    document.body.style.overflow = '';
  }

  /** « Modifier » dans l'aperçu : revient à l'étape concernée. */
  modifierEtape(i: number): void {
    this.fermerApercu();
    this.ouverte = -1;
    this.goTo(i);
  }

  async confirmerEnregistrement(): Promise<void> {
    await this.enregistrer();
    // Toujours sur la page : erreur ou doublons à confirmer, affichés en haut du formulaire.
    this.fermerApercu();
  }

  // --- État de chaque étape (icône verte, rouge ou bleue) ----------------------
  /** Étapes déjà ouvertes, et la plus avancée atteinte. */
  private visitees = new Set<number>();
  private etapeMax = -1;

  /** Informations essentielles manquantes dans une étape (les autres doivent seulement avoir été ouvertes). */
  manquantsEtape(i: number): string[] {
    const f = this.form;
    const m: string[] = [];
    if (!this.visitees.has(i)) return ['étape non ouverte'];
    if (i === 0) {
      if (!f.nom.trim()) m.push('nom');
      if (this.ageCalcule === null) m.push('âge');
      if (!this.photoFichier) m.push('photo');
      if (this.ddrApresReference || this.referenceFuture) m.push('datation à corriger');
      if (this.ecartSensible && !f.dpaJustification.trim()) m.push('justification de la DPA');
      if (!f.email.trim() || this.emailInvalide) m.push('e-mail');
      if (this.reglesMdp.some(r => !r.ok)) m.push('mot de passe');
      if (!this.referentiels.provinces().includes(f.province)) m.push('province');
      if (!this.etablissementsActifs().some(e => e.id === f.etablissementId)) m.push('formation sanitaire');
    }
    if (i === 4) {
      if (this.echoCommencee && !this.echo.date) m.push('date de l’examen');
      if (this.echoDateFuture) m.push('date dans le futur');
    }
    if (i === 1) {
      if (f.gestite === null) m.push('gestité');
      if (f.parite === null) m.push('parité');
    }
    return m;
  }

  /**
   * « valide » (vert) : étape ouverte et complète ; « incomplet » (rouge) : étape dépassée sans
   * être ouverte ou remplie ; « neutre » (bleu) : étape ouverte en ce moment ou pas encore atteinte.
   */
  statutEtape(i: number): 'valide' | 'incomplet' | 'neutre' {
    if (i === this.ouverte || i > this.etapeMax) return 'neutre';
    return this.manquantsEtape(i).length ? 'incomplet' : 'valide';
  }

  next(): void { if (this.step < this.steps.length - 1) this.goTo(this.step + 1); }
  prev(): void { if (this.step > 0) this.goTo(this.step - 1); }
  /** Ouvre l'étape (cartes en accordéon) et fait défiler jusqu'à sa carte ; un second clic la referme. */
  goTo(i: number): void {
    if (this.ouverte === i) { this.ouverte = -1; return; }
    this.step = i;
    this.ouverte = i;
    this.visitees.add(i);
    this.etapeMax = Math.max(this.etapeMax, i);
    setTimeout(() => document.getElementById(`etape-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async enregistrer(): Promise<void> {
    if (this.manquants.length || this.envoi || !this.photoFichier) return;
    // Sans réseau, tout part en une seule saisie gardée sur l'appareil ; l'échographie (avec ses
    // fichiers) s'ajoute depuis le dossier une fois la connexion revenue.
    if (!this.horsLigne.enLigne() && this.echo.date) {
      this.erreur = 'Hors connexion : l’échographie (étape 5) ne peut pas être gardée sur l’appareil avec ses fichiers. Videz l’étape 5 pour enregistrer maintenant, puis ajoutez l’échographie depuis le dossier une fois la connexion revenue.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.envoi = true;
    this.erreur = '';
    const f = this.form;
    const fiche = profilCpnVersApi(this.fiche);
    try {
      const { numero, consultationId } = await this.service.creer({
        patiente: {
          ...fiche.patiente,
          nom: f.nom, postnom: f.postnom, prenom: f.prenom,
          dateNaissance: f.ageMode === 'date' ? f.dateNaissance || null : null,
          ageDeclare: f.ageMode === 'age' ? f.ageDeclare : null,
          pieceIdentite: f.piece, telephone: f.tel1, telephonePartage: f.tel1Partage, telephone2: f.tel2, email: f.email,
          contactUrgence: { nom: f.urgenceNom, lien: f.urgenceLien, telephone: f.urgenceTel, adresse: f.urgenceAdresse },
          adresse: { province: f.province, commune: f.commune, quartier: f.quartier, avenue: f.avenue, repere: f.repere, aireSante: f.aire },
          antecedents: {
            gestite: f.gestite, parite: f.parite, enfantsVivants: f.enfantsVivants, avortements: f.avortements, cesariennes: f.cesariennes,
            complicationsObstetricales: f.complications, medicaux: f.antecedentsMedicaux, chirurgicaux: f.antecedentsChirurgicaux,
            allergies: f.allergies, medicaments: f.medicaments,
            ...fiche.antecedents,
          },
        },
        etablissementId: f.etablissementId,
        grossesse: { datation: this.datationSaisie, facteursRisque: f.facteurs, grossesseMultiple: f.grossesseMultiple },
        rendezVous: f.prochainRdv ? { date: new Date(f.prochainRdv).toISOString(), motif: f.motifRdv } : null,
        compte: { motDePasse: f.motDePasse },
        confirmerMalgreDoublons: this.doublonsBloquants && this.confirmationDoublons,
        // Mesures, laboratoire et référence : brouillon de la 1re CPN, créé dans la même requête
        // (avec l'heure réelle de la saisie, même envoyée plus tard par la synchronisation).
        premiereConsultation: this.mesuresOuLaboSaisis ? {
          date: new Date().toISOString(), mesuresPreventives: this.mesures, laboratoire: this.labo,
          reference: { motifs: this.motifsRetenus, precision: this.precisionReference.trim() },
        } : null,
      }, this.photoFichier);
      if (this.echo.date) {
        // Échographie : enregistrée avec ses fichiers (en ligne seulement).
        try {
          const dossier = await this.service.dossier(numero);
          const grossesse = dossier.grossesses.find(g => g.statut === 'En cours') ?? dossier.grossesses[0];
          await this.service.creerEchographie(grossesse.id, this.echo, this.fichiersEcho);
        } catch {
          // Dossier créé : l'échographie se complète depuis le dossier.
        }
      }
      if (consultationId) this.router.navigate(['/admin/consultations', consultationId]);
      else this.router.navigate(['/admin/patientes', numero], { queryParams: { nouveau: 1 } });
    } catch (err) {
      if (estMiseEnFile(err)) {
        // Hors connexion : dossier gardé sur l'appareil, créé au retour du réseau (page Synchronisation).
        this.router.navigate(localIdDe(err) ? ['/admin/hors-ligne', localIdDe(err)] : ['/admin/synchronisation']);
        return;
      }
      const doublons = doublonsDe(err);
      if (doublons) {
        this.doublons = doublons;
        this.doublonsBloquants = true;
        this.confirmationDoublons = false;
        this.emailExistant = !!(err as { error?: { emailExistant?: boolean } }).error?.emailExistant;
      } else {
        this.erreur = messageErreur(err);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.envoi = false;
    }
  }
}
