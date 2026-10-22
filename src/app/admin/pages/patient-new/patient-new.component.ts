import { Component, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { aujourdhui, dateHeureChiffres, dpaNaegele, jourChiffres, jourFr } from '../../data/format';
import { Doublon, PatientesService, SaisieDatation, doublonsDe, profilCpnVersApi, profilCpnVide } from '../../data/patientes.service';
import { EtablissementsService } from '../../data/etablissements.service';
import { ReferentielsService } from '../../data/referentiels.service';
import { SessionService, messageErreur } from '../../data/session.service';

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
 * Photo convertie en JPEG (1000 px max) : plus légère sur une connexion lente, et lisible
 * par le générateur de la carte patiente côté serveur (qui ne lit ni le WebP ni le HEIC).
 */
async function enJpeg(fichier: File, cote = 1000): Promise<File> {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Conversion impossible');
  return new File([blob], fichier.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/**
 * Enregistrement d'une patiente (médecin) présenté comme la « Fiche de consultation prénatale »
 * papier du Ministère de la Santé : identité, DDR/DPA, antécédents cochés et rendez-vous, plus la
 * photo et le compte de l'espace patiente. Les doublons possibles sont vérifiés pendant la saisie
 * puis par le serveur ; la fiche est prévisualisée avant l'enregistrement.
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
  etablissementsActifs = computed(() => this.etablissementsService.etablissements().filter(e => e.statut === 'Actif'));
  chargementEtablissements = true;
  fmt = jourFr;
  today = aujourdhui();
  envoi = false;
  erreur = '';

  /** Fiche CPN : identité complémentaire, biologie et antécédents cochés (référentiel du serveur). */
  fiche = profilCpnVide();
  /** Date imprimée en tête de la fiche. */
  readonly dateFiche = jourChiffres(aujourdhui());
  readonly annee = aujourdhui().slice(0, 4);
  /** Après une tentative de prévisualisation incomplète : les champs obligatoires vides passent en rouge. */
  tentative = false;

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
    if (!fichier) return;
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
    if (this.manquants.length) {
      this.tentative = true;
      setTimeout(() => document.querySelector('.fiche .manquant')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    this.apercuOuvert = true;
    document.body.style.overflow = 'hidden';
  }

  fermerApercu(): void {
    this.apercuOuvert = false;
    document.body.style.overflow = '';
  }

  /** « Modifier » dans l'aperçu : revient à la section de la fiche. */
  allerA(id: string): void {
    this.fermerApercu();
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async confirmerEnregistrement(): Promise<void> {
    await this.enregistrer();
    // Toujours sur la page : erreur ou doublons à confirmer, affichés en haut du formulaire.
    this.fermerApercu();
  }

  /** Fiche telle qu'elle sera enregistrée, dans l'ordre de la fiche papier (valeurs vides : « — »). */
  get sectionsApercu(): { titre: string; icone: string; ancre: string; lignes: { l: string; v: string }[] }[] {
    const f = this.form;
    const c = this.fiche;
    const v = (x: unknown) => (x === null || x === undefined || x === '' || (Array.isArray(x) && !x.length) ? '—' : Array.isArray(x) ? x.join(', ') : String(x));
    const j = (iso: string | null | undefined) => (iso ? jourChiffres(iso) : '—');
    const ag = this.agCalcule;
    const e = this.etablissement;
    const datation = f.ddrConnue
      ? [{ l: 'DDR', v: j(f.ddr) }, { l: 'Fiabilité de la DDR', v: f.ddr ? f.ddrFiabilite : '—' }]
      : [{ l: 'Datation', v: f.agSemaines === null ? '—' : `${f.agMethode} du ${j(f.dateReference)} : ${f.agSemaines} SA + ${f.agJours ?? 0} j` }];
    const obst = c.atcdObstetricaux.filter(x => !x.startsWith('Primipare'));
    return [
      { titre: 'En-tête', icone: 'fa-hospital', ancre: 'fiche-entete', lignes: [
        { l: 'Formation sanitaire', v: e?.nom ?? '—' }, { l: 'Province', v: v(e?.province) }, { l: 'District sanitaire', v: v(e?.districtSanitaire) },
        { l: 'Zone de santé', v: v(e?.zoneSante) }, { l: 'A.S.', v: v(f.aire) },
      ] },
      { titre: 'Identité', icone: 'fa-id-card', ancre: 'fiche-identite', lignes: [
        { l: 'Nom et postnom', v: v(`${f.nom} ${f.postnom}`.trim().toUpperCase()) }, { l: 'Prénom', v: v(f.prenom) },
        { l: 'État matrimonial', v: v(c.etatCivil) },
        { l: f.ageMode === 'date' ? 'Date de naissance' : 'Âge déclaré', v: f.ageMode === 'date' ? j(f.dateNaissance) : v(f.ageDeclare != null ? `${f.ageDeclare} ans` : '') },
        { l: 'Âge', v: v(this.ageCalcule != null ? `${this.ageCalcule} ans` : '') }, { l: 'Occupation/F', v: v(c.occupation) },
        { l: 'Adresse', v: v([f.avenue, f.quartier, f.commune, f.province].filter(Boolean).join(', ')) },
        { l: 'Tél', v: v(f.tel1 ? `+243 ${f.tel1}${f.tel1Partage ? ' (partagé)' : ''}${f.tel2 ? ' / +243 ' + f.tel2 : ''}` : '') },
        { l: 'GS / Rh', v: v([c.groupeSanguin, c.rhesus].filter(Boolean).join(' ')) },
        { l: 'Taille', v: v(c.tailleCm != null ? `${c.tailleCm} cm` : '') }, { l: 'Électrophorèse Hb', v: v(c.electrophoreseHb) },
        { l: 'Nom du partenaire', v: v(c.nomPartenaire) }, { l: 'Occupation/H', v: v(c.occupationPartenaire) },
        { l: 'Personne à contacter', v: v([f.urgenceNom, f.urgenceLien && `(${f.urgenceLien})`].filter(Boolean).join(' ')) },
        { l: 'Adresse/Tél (urgence)', v: v([f.urgenceAdresse, f.urgenceTel].filter(Boolean).join(' · ')) },
        ...datation,
        { l: 'DPA', v: j(f.dpaSaisie || this.dpaCalculee) },
        { l: 'Âge gestationnel aujourd’hui', v: ag ? `${ag.sa} SA + ${ag.j} j` : '—' },
        ...(this.ecartSensible ? [{ l: 'Justification de la DPA', v: v(f.dpaJustification) }] : []),
        { l: 'Primipare', v: v(c.atcdObstetricaux.filter(x => x.startsWith('Primipare'))) },
      ] },
      { titre: '1) Antécédents médicaux', icone: 'fa-stethoscope', ancre: 'fiche-atcd', lignes: [
        { l: 'Cochés', v: v(c.atcdMedicaux.map(libelleCourt)) }, { l: 'Test connu', v: j(c.testVihConnuLe) },
        { l: 'Autres', v: v(f.antecedentsMedicaux) },
      ] },
      { titre: '2) Gynécologiques et chirurgicaux', icone: 'fa-user-doctor', ancre: 'fiche-atcd', lignes: [
        { l: 'Cochés', v: v(c.atcdGynecoChirurgicaux.map(libelleCourt)) }, { l: 'Autres', v: v(f.antecedentsChirurgicaux) },
      ] },
      { titre: '3) Obstétricaux', icone: 'fa-baby', ancre: 'fiche-atcd-obst', lignes: [
        { l: 'Parité', v: v(f.parite) }, { l: 'Gestité', v: v(f.gestite) }, { l: 'Enfants en vie', v: v(f.enfantsVivants) },
        { l: 'Avortements', v: v(f.avortements) }, { l: 'Cochés', v: v(obst) },
        { l: 'Plus gros poids de naissance', v: v(c.plusGrosPoidsNaissanceG != null ? `${c.plusGrosPoidsNaissanceG} g` : '') },
        { l: 'Dernier accouchement', v: j(c.dernierAccouchement) },
        { l: 'Complication post-partum', v: this.complicationPostPartum === null ? '—' : this.complicationPostPartum ? 'OUI' : 'NON' },
        ...(this.complicationPostPartum ? [{ l: 'Lesquelles', v: v(f.complications) }] : []),
      ] },
      { titre: 'Rendez-vous', icone: 'fa-calendar-check', ancre: 'fiche-rdv', lignes: [
        { l: 'CS', v: f.prochainRdv ? dateHeureChiffres(new Date(f.prochainRdv)) : 'Aucun (consultation immédiate)' },
      ] },
      { titre: 'Espace patiente', icone: 'fa-mobile-screen', ancre: 'fiche-compte', lignes: [
        { l: 'E-mail', v: v(f.email) }, { l: 'Mot de passe', v: f.motDePasse ? 'Défini (non affiché)' : '—' },
        { l: 'Photo', v: this.photoFichier ? 'Ajoutée' : '—' },
      ] },
    ];
  }

  /** Champ obligatoire vide, signalé en rouge après une tentative de prévisualisation. */
  manque(champ: 'nom' | 'age' | 'photo' | 'email' | 'mdp' | 'province' | 'etablissement'): boolean {
    if (!this.tentative) return false;
    const f = this.form;
    switch (champ) {
      case 'nom': return !f.nom.trim();
      case 'age': return this.ageCalcule === null;
      case 'photo': return !this.photoFichier;
      case 'email': return !f.email.trim() || this.emailInvalide;
      case 'mdp': return this.reglesMdp.some(r => !r.ok);
      case 'province': return !this.referentiels.provinces().includes(f.province);
      case 'etablissement': return !this.etablissementsActifs().some(e => e.id === f.etablissementId);
    }
  }

  async enregistrer(): Promise<void> {
    if (this.manquants.length || this.envoi || !this.photoFichier) return;
    this.envoi = true;
    this.erreur = '';
    const f = this.form;
    const fiche = profilCpnVersApi(this.fiche);
    try {
      const { numero } = await this.service.creer({
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
      }, this.photoFichier);
      this.router.navigate(['/admin/patientes', numero], { queryParams: { nouveau: 1 } });
    } catch (err) {
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
