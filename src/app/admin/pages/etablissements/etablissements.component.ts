import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PROVINCES_RDC } from '../../data/carte-rdc';
import { zonesDeProvince } from '../../data/zones-sante';
import {
  DonneesEtablissement, DonneesMedecinChef, Etablissement, EtablissementsService, MedecinChef, SERVICES_ETABLISSEMENT,
  ServiceEtablissement, StatutEtablissement, TYPES_ETABLISSEMENT, TypeEtablissement, SecteurEtablissement,
} from '../../data/etablissements.service';
import { messageErreur } from '../../data/session.service';
import { ESPACE_COMITE } from '../../data/espace';
import { ChampsMedecinChefComponent, medecinChefNettoye, medecinChefVide } from '../../components/champs-medecin-chef.component';
import { FicheEtapesComponent } from '../../components/fiche-etapes.component';
import {
  CATEGORIES_DU_TYPE, ETAPES, FicheAmi, FicheEtablissementService, SECTEUR_DU_STATUT, TYPES_ANCIENS, VERS_SERVICES_PLATEFORME, adresseComposee,
  classeStatut, ficheDepuis, ficheVide, nomPersonne, profilCatalogue, sectionsAEnvoyer, sectionsModifiees, serviceVide,
} from '../../data/fiche-etablissement';

const MAX_PHOTOS = 6;
const PHOTO_MAX_OCTETS = 5 * 1024 * 1024;

function formulaireVide() {
  return {
    nom: '', type: '' as TypeEtablissement | '', secteur: '' as SecteurEtablissement | '',
    province: 'Kinshasa', districtSanitaire: '', zonesSante: [] as string[], aireSante: '', adresse: '',
    latitude: null as number | null, longitude: null as number | null,
    telephone: '', email: '', responsable: '', fonctionResponsable: '', lits: 0,
    services: new Set<ServiceEtablissement>(),
    /** Fiche « Identification générale » (étapes 1 à 10). */
    fiche: ficheVide(),
  };
}

function formulaireDepuis(e: Etablissement) {
  return {
    // Ancien type (ex. « Hôpital général de référence ») : repris en type + catégorie.
    nom: e.nom, type: (TYPES_ANCIENS[e.type]?.type ?? e.type) as TypeEtablissement | '', secteur: e.secteur as SecteurEtablissement | '',
    province: e.province, districtSanitaire: e.districtSanitaire ?? '',
    // Seules les zones du référentiel sont reprises (les anciennes saisies libres sont à re-choisir).
    zonesSante: zonesEtablissement(e).filter(z => zonesDeProvince(e.province).includes(z)),
    aireSante: e.aireSante, adresse: e.adresse,
    latitude: e.latitude, longitude: e.longitude,
    telephone: e.telephone, email: e.email, responsable: e.responsable, fonctionResponsable: e.fonctionResponsable, lits: e.lits,
    services: new Set(e.services),
    fiche: ficheVide(),
  };
}

/** Services de la plateforme (liste courte des établissements anciens) → services du catalogue. */
const SERVICES_REPRIS: Record<string, { hopital: string[]; centreSante: string[] }> = {
  CPN: { hopital: ['CPN'], centreSante: ['CPN'] },
  Maternité: { hopital: ['Maternité', 'Salle d’accouchement'], centreSante: ['Maternité', 'Salle d’accouchement'] },
  Vaccination: { hopital: ['Vaccination et PEV'], centreSante: ['Vaccination et PEV'] },
  Urgences: { hopital: ['Urgences médicales'], centreSante: ['Urgences de première ligne'] },
  Ambulance: { hopital: ['Transport et ambulance'], centreSante: [] },
  Pédiatrie: { hopital: ['Pédiatrie'], centreSante: ['Consultation préscolaire'] },
  Laboratoire: { hopital: ['Laboratoire de biologie médicale'], centreSante: ['Laboratoire de première ligne'] },
  Imagerie: { hopital: ['Imagerie médicale'], centreSante: [] },
  Chirurgie: { hopital: ['Chirurgie générale'], centreSante: [] },
};

/** Zones de santé d'un établissement (les plus anciens n'ont qu'une zone, `zoneSante`). */
export function zonesEtablissement(e: Pick<Etablissement, 'zoneSante' | 'zonesSante'>): string[] {
  return e.zonesSante?.length ? e.zonesSante : e.zoneSante ? [e.zoneSante] : [];
}

interface NouvellePhoto {
  fichier: File;
  apercu: string;
}

@Component({
  selector: 'app-etablissements',
  standalone: true,
  imports: [FormsModule, RouterLink, ChampsMedecinChefComponent, FicheEtapesComponent],
  providers: [FicheEtablissementService],
  templateUrl: './etablissements.component.html',
})
export class EtablissementsComponent implements OnDestroy {
  service = inject(EtablissementsService);
  private ficheService = inject(FicheEtablissementService);
  readonly etapes = ETAPES;
  readonly classeStatut = classeStatut;
  private sanitizer = inject(DomSanitizer);
  etablissements = this.service.etablissements;
  /**
   * Seul le comité de pilotage ajoute, modifie, suspend ou supprime un établissement, et désigne
   * son médecin chef. Dans l'administration, la page est une liste en lecture seule.
   */
  readonly comite = inject(ESPACE_COMITE);
  peutGerer = signal(this.comite).asReadonly();
  chargement = true;
  readonly lignesSquelette = [1, 2, 3, 4, 5, 6];
  erreurChargement = '';

  readonly types = TYPES_ETABLISSEMENT;
  readonly servicesDisponibles = SERVICES_ETABLISSEMENT;
  readonly provinces = PROVINCES_RDC.map(p => p.nom).sort((a, b) => a.localeCompare(b, 'fr'));
  readonly maxPhotos = MAX_PHOTOS;

  constructor() {
    this.service.charger(true)
      .catch(err => (this.erreurChargement = messageErreur(err)))
      .finally(() => (this.chargement = false));
  }

  // --- Liste -----------------------------------------------------------------
  recherche = signal('');
  filtreStatut = signal<'Tous' | StatutEtablissement>('Tous');

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.etablissements().filter(e => {
      const texte = `${e.nom} ${e.code} ${e.codeAmi ?? ''} ${e.province} ${zonesEtablissement(e).join(' ')} ${e.aireSante} ${e.responsable}`.toLowerCase();
      return (this.filtreStatut() === 'Tous' || e.statut === this.filtreStatut()) && (!q || texte.includes(q));
    });
  });

  stats = computed(() => {
    const liste = this.etablissements();
    return {
      total: liste.length,
      actifs: liste.filter(e => e.statut === 'Actif').length,
      provinces: new Set(liste.map(e => e.province)).size,
      lits: liste.reduce((s, e) => s + e.lits, 0),
    };
  });

  lienCarte(e: Etablissement): string {
    return `https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=16/${e.latitude}/${e.longitude}`;
  }

  async basculer(e: Etablissement): Promise<void> {
    try {
      await this.service.basculer(e.id);
      this.notifier(e.statut === 'Actif'
        ? `${e.nom} est suspendu : ses utilisateurs ne peuvent plus s’y connecter.`
        : `${e.nom} est de nouveau actif.`);
    } catch (err) {
      this.notifier(messageErreur(err));
    }
  }

  // --- Fiche (photos + carte) -------------------------------------------------
  fiche: Etablissement | null = null;
  photoIndex = 0;
  carteFiche: SafeResourceUrl | null = null;

  ouvrirFiche(e: Etablissement, index = 0): void {
    this.fiche = e;
    this.photoIndex = index;
    this.carteFiche = e.latitude != null && e.longitude != null
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.openstreetmap.org/export/embed.html?bbox=${e.longitude - 0.01},${e.latitude - 0.006},${e.longitude + 0.01},${e.latitude + 0.006}&layer=mapnik&marker=${e.latitude},${e.longitude}`)
      : null;
  }

  photoSuivante(pas: number): void {
    const n = this.fiche?.photos.length ?? 0;
    if (n) this.photoIndex = (this.photoIndex + pas + n) % n;
  }

  // --- Suppression ---------------------------------------------------------------
  aSupprimer: Etablissement | null = null;
  saisieConfirmation = '';
  suppression = false;
  erreurSuppression = '';

  get suppressionConfirmee(): boolean {
    return !!this.aSupprimer && this.saisieConfirmation.trim().toUpperCase() === this.aSupprimer.code;
  }

  demanderSuppression(e: Etablissement): void {
    this.aSupprimer = e;
    this.saisieConfirmation = '';
    this.erreurSuppression = '';
  }

  annulerSuppression(): void {
    if (!this.suppression) this.aSupprimer = null;
  }

  async confirmerSuppression(): Promise<void> {
    const e = this.aSupprimer;
    if (!e || !this.suppressionConfirmee || this.suppression) return;
    this.suppression = true;
    try {
      await this.service.supprimer(e.id);
      this.aSupprimer = null;
      this.notifier(`${e.nom} (${e.code}) a été supprimé, ainsi que ses photos.`);
    } catch (err) {
      this.erreurSuppression = messageErreur(err);
    } finally {
      this.suppression = false;
    }
  }

  // --- Médecin chef (comité de pilotage) -------------------------------------------
  /** Identité du médecin chef saisie avec un nouvel établissement. */
  chef: DonneesMedecinChef = medecinChefVide();
  /** Compte créé : identifiants à remettre (le mot de passe n'est affiché qu'une fois). */
  compteCree: { etablissement: string; chef: MedecinChef; motDePasse: string } | null = null;
  /** Établissement dont on désigne le médecin chef (fenêtre dédiée). */
  aDesigner: Etablissement | null = null;
  chefADesigner: DonneesMedecinChef = medecinChefVide();
  designation = false;
  erreurDesignation = '';
  actionChef: string | null = null;

  chefActif(e: Etablissement): MedecinChef | undefined {
    return e.medecinsChefs?.find(c => c.statut === 'Actif');
  }

  sansChef = computed(() => this.etablissements().filter(e => !this.chefActif(e)).length);

  ouvrirDesignation(e: Etablissement): void {
    this.fiche = null;
    this.aDesigner = e;
    this.chefADesigner = medecinChefVide();
    this.erreurDesignation = '';
  }

  async designer(f: NgForm): Promise<void> {
    const e = this.aDesigner;
    if (!e || this.designation) return;
    if (f.invalid) {
      this.erreurDesignation = 'Vérifiez les champs signalés en rouge.';
      return;
    }
    this.designation = true;
    this.erreurDesignation = '';
    try {
      const r = await this.service.designerMedecinChef(e.id, medecinChefNettoye(this.chefADesigner));
      this.aDesigner = null;
      this.compteCree = { etablissement: e.nom, chef: r.medecinChef, motDePasse: r.motDePasseTemporaire };
    } catch (err) {
      this.erreurDesignation = messageErreur(err);
    } finally {
      this.designation = false;
    }
  }

  async basculerChef(e: Etablissement, c: MedecinChef): Promise<void> {
    this.actionChef = c.id;
    try {
      const maj = await this.service.basculerMedecinChef(e.id, c.id);
      this.fiche = this.etablissements().find(x => x.id === e.id) ?? null;
      this.notifier(maj.statut === 'Suspendu'
        ? `Le compte du Dr ${c.prenom} ${c.nom} est suspendu : il ne peut plus se connecter.`
        : `Le compte du Dr ${c.prenom} ${c.nom} est de nouveau actif.`);
    } catch (err) {
      this.notifier(messageErreur(err));
    } finally {
      this.actionChef = null;
    }
  }

  async reinitialiserChef(e: Etablissement, c: MedecinChef): Promise<void> {
    if (!confirm(`Générer un nouveau mot de passe temporaire pour le Dr ${c.prenom} ${c.nom} ? L’ancien ne fonctionnera plus.`)) return;
    this.actionChef = c.id;
    try {
      const r = await this.service.reinitialiserMedecinChef(e.id, c.id);
      this.fiche = null;
      this.compteCree = { etablissement: e.nom, chef: r.medecinChef, motDePasse: r.motDePasseTemporaire };
    } catch (err) {
      this.notifier(messageErreur(err));
    } finally {
      this.actionChef = null;
    }
  }

  copie = false;
  async copierIdentifiants(): Promise<void> {
    const c = this.compteCree;
    if (!c) return;
    await navigator.clipboard?.writeText(`AMI Santé Connect — ${c.etablissement}\nE-mail : ${c.chef.email}\nMot de passe temporaire : ${c.motDePasse}`).catch(() => {});
    this.copie = true;
    setTimeout(() => (this.copie = false), 2000);
  }

  // --- Formulaire d'ajout / modification ----------------------------------------
  panneauOuvert = false;
  /** Établissement en cours de modification (null = ajout). */
  enEdition: Etablissement | null = null;
  form = formulaireVide();
  photosConservees: string[] = [];
  nouvellesPhotos: NouvellePhoto[] = [];
  photoErreur = '';
  enregistrement = false;
  erreurEnregistrement = '';
  /** Le responsable principal (étape 5) est le médecin chef : son identité n'est pas ressaisie. */
  chefEstResponsable = true;
  /** Pièce jointe de l'acte de création, envoyée après l'enregistrement. */
  pieceActe: File | null = null;
  notification: string | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  get codePropose(): string {
    return this.enEdition?.code ?? this.service.prochainCode(this.form.province);
  }

  get nomExiste(): boolean {
    return this.service.nomExiste(this.form.nom, this.form.province, this.enEdition?.id);
  }

  get nombrePhotos(): number {
    return this.photosConservees.length + this.nouvellesPhotos.length;
  }

  readonly zonesEtablissement = zonesEtablissement;
  /** Filtre de la liste des zones (Kinshasa, Ituri… en comptent plus de 30). */
  rechercheZone = '';

  /** Zones de santé de la province choisie, filtrées par la recherche. */
  get zonesProvince(): readonly string[] {
    const q = this.rechercheZone.trim().toLowerCase();
    const zones = zonesDeProvince(this.form.province);
    return q ? zones.filter(z => z.toLowerCase().includes(q)) : zones;
  }

  get nombreZonesProvince(): number {
    return zonesDeProvince(this.form.province).length;
  }

  /** Zone saisie librement avant le référentiel, à remplacer par une zone de la liste. */
  get ancienneZone(): string | null {
    const e = this.enEdition;
    if (!e) return null;
    const hors = zonesEtablissement(e).filter(z => !zonesDeProvince(e.province).includes(z));
    return hors.length ? hors.join(', ') : null;
  }

  /** Changer de province vide les zones choisies : elles appartiennent à l'ancienne province. */
  changerProvince(province: string): void {
    this.form.province = province;
    this.form.zonesSante = this.form.zonesSante.filter(z => zonesDeProvince(province).includes(z));
    this.rechercheZone = '';
    this.chargerAires();
  }

  /** Coche ou décoche une zone ; l'ordre de sélection est gardé (la première est la zone principale). */
  basculerZone(z: string): void {
    const zones = this.form.zonesSante;
    this.form.zonesSante = zones.includes(z) ? zones.filter(x => x !== z) : [...zones, z];
    if (this.form.zonesSante[0] !== zones[0]) this.chargerAires();
  }

  // --- Fiche AMI : assistant en 10 étapes ----------------------------------------------
  /** Étape affichée dans le panneau (1 à 10). */
  etape = 1;
  chargementFiche = false;
  /** Sections de la fiche à l'ouverture (seules les sections modifiées sont envoyées). */
  private ficheInitiale: ReturnType<typeof sectionsAEnvoyer> | null = null;
  statutFiche: string | null = null;
  /** Aires de santé déjà connues de la zone principale (suggestions, cascade Zone → Aire). */
  airesConnues: string[] = [];

  chargerAires(): void {
    const zone = this.form.zonesSante[0];
    this.airesConnues = [];
    if (!zone) return;
    this.ficheService.aires(this.form.province, zone).then(a => (this.airesConnues = a)).catch(() => {});
  }

  get bczs(): string {
    return this.form.zonesSante[0] ? `BCZS ${this.form.zonesSante[0]}` : '';
  }
  get dps(): string {
    return `DPS ${this.form.province}`;
  }

  /**
   * Type de structure : la catégorie suit (déduite s'il n'y en a qu'une, à choisir pour un
   * hôpital ; une catégorie qui ne correspond plus au type est effacée).
   */
  changerType(type: TypeEtablissement | ''): void {
    this.form.type = type;
    const permises = CATEGORIES_DU_TYPE[type] ?? [];
    const id = this.form.fiche.identification;
    if (permises.length === 1) id.categorie = permises[0];
    else if (id.categorie && !permises.includes(id.categorie)) id.categorie = null;
  }

  get coordonneesValides(): boolean {
    const { latitude: lat, longitude: lng } = this.form;
    if (lat == null && lng == null) return true;
    return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /** Champs obligatoires manquants par étape (pastilles de l'assistant). */
  manquants(n: number): string[] {
    const f = this.form;
    const fi = f.fiche;
    const m: string[] = [];
    const vide = (v: unknown) => v == null || v === '';
    if (n === 1) {
      if (!f.nom.trim() || this.nomExiste) m.push('nom');
      if (!f.type) m.push('type');
      else if (vide(fi.identification.categorie) || !(CATEGORIES_DU_TYPE[f.type] ?? []).includes(fi.identification.categorie!)) m.push('catégorie');
      if (vide(fi.identification.statutActuel)) m.push('statut de fonctionnement');
      if (vide(fi.organisation.statutJuridique)) m.push('statut juridique');
      if (vide(fi.organisation.modeGestion)) m.push('régime de gestion');
      if (fi.identification.anciensNoms.some(a => !!a.debut && !!a.fin && a.fin < a.debut)) m.push('période d’un ancien nom');
    } else if (n === 2) {
      if (!f.zonesSante.length) m.push('zone de santé');
      if (!f.aireSante.trim()) m.push('aire de santé');
      if (!fi.localisation.territoire.trim()) m.push('ville ou territoire');
      if (!fi.localisation.quartier.trim()) m.push('quartier / village');
      if (!this.coordonneesValides) m.push('GPS');
    } else if (n === 3) {
      if (fi.populations.some(p => p.totale == null)) m.push('population totale');
    } else if (n === 4) {
      if (!/^[+0-9 ().-]{9,20}$/.test(f.telephone.trim())) m.push('téléphone principal');
      if (fi.contacts.contactsService.some(c => !c.service.trim())) m.push('service d’un contact');
    } else if (n === 5) {
      const r = fi.organisation.responsable;
      if (!r.nom.trim() || !r.prenom.trim() || !r.telephone.trim() || !fi.organisation.titreResponsable || !r.fonction.trim()) m.push('responsable principal');
    } else if (n === 6) {
      if (!fi.services.some(s => s.fonctionnel === 'Oui' || s.fonctionnel === 'Partiel')) m.push('service fonctionnel');
    } else if (n === 7) {
      if (fi.infrastructures.litsParUnite.some(u => !u.unite.trim())) m.push('unité de lits');
    } else if (n === 9) {
      if (fi.equipements.some(q => !q.nom.trim())) m.push('nom d’équipement');
    }
    return m;
  }

  /** Étapes obligatoires (1, 2, 4, 5, 6) encore incomplètes. */
  get etapesObligatoiresIncompletes(): number[] {
    return [1, 2, 4, 5, 6].filter(n => this.manquants(n).length);
  }

  allerA(n: number): void {
    this.etape = Math.min(ETAPES.length, Math.max(1, n));
    document.getElementById('corps-panneau-et')?.scrollTo({ top: 0 });
  }

  /** Complétude estimée pendant la saisie (la complétude officielle est calculée par le serveur). */
  get completudeEstimee(): number {
    const f = this.form.fiche;
    const id = f.identification;
    const loc = f.localisation;
    const infra = f.infrastructures;
    const op = f.operationnel;
    const valeurs: unknown[] = [
      this.form.nom, this.form.type, id.categorie, id.codeSnis, id.codeSnisSource, id.codeSnisVerifieLe, id.nomUsuel || id.sigle,
      f.organisation.statutJuridique, f.organisation.modeGestion, id.dateOuverture, id.acteCreation.numero, id.acteCreation.autorite, id.statutActuel,
      this.form.province, loc.territoire, loc.commune, loc.quartier, this.form.zonesSante[0], this.form.aireSante, this.adresse, loc.reperes,
      this.form.latitude, loc.gps.methode,
      f.populations.some(p => p.totale != null) || null, f.populations.some(p => p.source) || null,
      f.populations.some(p => Object.values(p.tranches).some(v => v != null)) || null,
      this.form.telephone, this.form.email, f.contacts.telephoneUrgence, f.contacts.canalPrivilegie,
      nomPersonne(f.organisation.responsable), f.organisation.titreResponsable, f.organisation.responsable.telephone, f.organisation.datePriseFonction,
      f.responsablesFonctionnels.some(r => r.nom.trim()) || null, f.services.some(s => s.fonctionnel) || null,
      infra.batiments, Object.values(infra.salles).some(v => v != null) || null, infra.litsParUnite.length || null,
      infra.eau.continuite, infra.toilettesFonctionnelles, infra.electriciteDetail.sources.length || null,
      infra.connectivite.internet ?? infra.connectivite.reseauMobile, infra.accessibilite.route, infra.etatBatiment.etat,
      f.personnel.some(p => p.nombre != null) || null, f.equipements.length || null,
      op.fonctionnement24h, op.urgences.disponible, op.intrants.etat, op.moyensReference.length || null, op.systemeRapportage.length || null,
      op.dateDerniereEvaluation,
    ];
    return Math.round((valeurs.filter(v => v != null && v !== '').length / valeurs.length) * 100);
  }

  /** Adresse détaillée composée à partir de l'étape 2 (l'ancienne adresse libre sert à défaut). */
  get adresse(): string {
    return adresseComposee(this.form.fiche.localisation) || this.form.adresse.trim();
  }

  /** Coche toutes les zones affichées (après filtre), sans changer la zone principale. */
  toutesLesZones(): void {
    this.form.zonesSante = [...this.form.zonesSante, ...this.zonesProvince.filter(z => !this.form.zonesSante.includes(z))];
  }

  aucuneZone(): void {
    this.form.zonesSante = [];
  }

  basculerService(s: ServiceEtablissement): void {
    this.form.services.has(s) ? this.form.services.delete(s) : this.form.services.add(s);
  }

  choisirPhotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichiers = Array.from(input.files ?? []);
    input.value = '';
    this.photoErreur = '';
    for (const f of fichiers) {
      if (this.nombrePhotos >= MAX_PHOTOS) {
        this.photoErreur = `${MAX_PHOTOS} photos au maximum.`;
        break;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
        this.photoErreur = 'Format accepté : JPG, PNG ou WebP.';
        continue;
      }
      if (f.size > PHOTO_MAX_OCTETS) {
        this.photoErreur = `« ${f.name} » dépasse 5 Mo.`;
        continue;
      }
      this.nouvellesPhotos.push({ fichier: f, apercu: URL.createObjectURL(f) });
    }
  }

  retirerPhotoConservee(url: string): void {
    this.photosConservees = this.photosConservees.filter(u => u !== url);
  }

  retirerNouvellePhoto(p: NouvellePhoto): void {
    URL.revokeObjectURL(p.apercu);
    this.nouvellesPhotos = this.nouvellesPhotos.filter(x => x !== p);
  }

  private viderNouvellesPhotos(): void {
    this.nouvellesPhotos.forEach(p => URL.revokeObjectURL(p.apercu));
    this.nouvellesPhotos = [];
  }

  ouvrir(e: Etablissement | null = null): void {
    this.enEdition = e;
    this.form = e ? formulaireDepuis(e) : formulaireVide();
    this.photosConservees = e ? [...e.photos] : [];
    if (!e) this.chef = medecinChefVide();
    this.chefEstResponsable = true;
    this.pieceActe = null;
    this.viderNouvellesPhotos();
    this.photoErreur = this.erreurEnregistrement = '';
    this.rechercheZone = '';
    this.etape = 1;
    this.statutFiche = e?.ficheAmi?.statut ?? null;
    this.ficheInitiale = null;
    this.panneauOuvert = true;
    document.body.style.overflow = 'hidden';
    this.chargerAires();
    if (e) {
      // La fiche complète (dont le registre du personnel) n'est chargée qu'à l'ouverture.
      this.chargementFiche = true;
      this.ficheService.obtenir(e.id)
        .then(r => {
          this.form.fiche = ficheDepuis(r.fiche);
          this.ficheInitiale = r.fiche ? sectionsAEnvoyer(this.form.fiche) : {};
          // Établissement antérieur à la fiche : reprise des informations déjà connues.
          if (!r.fiche) this.preremplirDepuis(e);
          // Ancien type (« Hôpital général de référence »…) : sa catégorie est reprise.
          const id = this.form.fiche.identification;
          if (TYPES_ANCIENS[e.type] && !id.categorie) id.categorie = TYPES_ANCIENS[e.type].categorie;
          this.changerType(this.form.type);
        })
        .catch(err => (this.erreurEnregistrement = `Fiche AMI non chargée : ${messageErreur(err)}`))
        .finally(() => (this.chargementFiche = false));
    }
  }

  /** Fiche ouverte pour un établissement ancien : responsable, statut et services déjà saisis. */
  private preremplirDepuis(e: Etablissement): void {
    const f: FicheAmi = this.form.fiche;
    const [prenom, ...reste] = e.responsable.split(' ');
    f.organisation.responsable = {
      ...f.organisation.responsable, prenom: reste.length ? prenom : '', nom: reste.length ? reste.join(' ') : prenom,
      fonction: e.fonctionResponsable, telephone: e.telephone,
    };
    if ((['Médecin directeur', 'Médecin chef', 'Infirmier titulaire', 'Administrateur gestionnaire'] as string[]).includes(e.fonctionResponsable)) {
      f.organisation.titreResponsable = e.fonctionResponsable;
    }
    const statuts: Record<string, string> = { Public: 'Public', Privé: 'Privé lucratif', Confessionnel: 'Confessionnel', Militaire: 'Militaire', ONG: 'Associatif' };
    f.organisation.statutJuridique = statuts[e.secteur] ?? null;
    const profil = profilCatalogue(e.type);
    for (const court of e.services) {
      for (const nom of SERVICES_REPRIS[court]?.[profil] ?? []) {
        if (!f.services.some(s => s.service === nom)) f.services.push({ ...serviceVide(nom), existence: 'Oui', disponible: 'Oui', fonctionnel: 'Oui' });
      }
    }
  }

  /** Pièce jointe de l'acte de création, choisie à l'étape 1 (envoyée après l'enregistrement). */
  choisirPieceActe(fichier: File): void {
    if (fichier.size > 10 * 1024 * 1024) {
      this.erreurEnregistrement = 'La pièce jointe dépasse 10 Mo.';
      return;
    }
    this.pieceActe = fichier;
  }

  fermer(): void {
    this.panneauOuvert = false;
    this.viderNouvellesPhotos();
    document.body.style.overflow = '';
  }

  async enregistrer(f: NgForm): Promise<void> {
    if (this.enregistrement || this.chargementFiche) return;
    const incomplete = this.etapes.map(e => e.n as number).find(n => this.manquants(n).length);
    if (f.invalid || this.nomExiste || incomplete) {
      this.erreurEnregistrement = incomplete
        ? `Étape ${incomplete} incomplète : ${this.manquants(incomplete).join(', ')}.`
        : 'Vérifiez les champs signalés en rouge, y compris le compte du médecin chef (étape 5).';
      this.allerA(incomplete ?? 5);
      return;
    }
    this.enregistrement = true;
    this.erreurEnregistrement = '';
    const fiche = this.form.fiche;
    const org = fiche.organisation;
    const lits = fiche.infrastructures.litsParUnite.reduce((s, u) => s + (u.installes ?? 0), 0);
    // Champs de l'établissement déduits de la fiche (le serveur applique les mêmes règles).
    const services = [...new Set(fiche.services
      .filter(s => s.disponible === 'Oui' && (s.fonctionnel === 'Oui' || s.fonctionnel === 'Partiel') && VERS_SERVICES_PLATEFORME[s.service])
      .map(s => VERS_SERVICES_PLATEFORME[s.service] as ServiceEtablissement))];
    const sections = sectionsAEnvoyer(fiche);
    const aEnvoyer = this.ficheInitiale ? sectionsModifiees(this.ficheInitiale, sections) : sections;
    const donnees: DonneesEtablissement = {
      nom: this.form.nom.trim(),
      type: this.form.type as TypeEtablissement,
      secteur: (SECTEUR_DU_STATUT[org.statutJuridique ?? ''] ?? this.form.secteur) as SecteurEtablissement,
      province: this.form.province,
      districtSanitaire: this.form.districtSanitaire.trim(),
      zonesSante: [...this.form.zonesSante],
      aireSante: this.form.aireSante.trim(),
      // Adresse détaillée composée (étape 2), jamais ressaisie.
      adresse: this.adresse,
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      telephone: this.form.telephone.trim(),
      email: this.form.email.trim().toLowerCase(),
      responsable: nomPersonne(org.responsable) || this.form.responsable,
      fonctionResponsable: org.responsable.fonction.trim() || this.form.fonctionResponsable,
      lits: fiche.infrastructures.litsParUnite.length ? lits : this.form.lits ?? 0,
      services: services.length ? services : this.servicesDisponibles.filter(s => this.form.services.has(s)),
      fiche: Object.keys(aEnvoyer).length ? aEnvoyer : undefined,
    };
    // Le médecin chef est le responsable principal : identité reprise de l'étape 5.
    const r = org.responsable;
    const chef = this.chefEstResponsable
      ? { ...this.chef, prenom: r.prenom, nom: r.nom, postnom: r.postnom, telephone: r.telephone }
      : this.chef;
    const fichiers = this.nouvellesPhotos.map(p => p.fichier);
    try {
      let e: Etablissement;
      if (this.enEdition) {
        e = await this.service.modifier(this.enEdition.id, donnees, this.photosConservees, fichiers);
        const retour = e.ficheAmi?.statut === 'Brouillon' && !!this.statutFiche && this.statutFiche !== 'Brouillon';
        this.notifier(`${e.nom} a été mis à jour.${retour ? ' La fiche AMI repasse en brouillon : soumettez-la de nouveau.' : ''}`);
      } else {
        const cree = await this.service.ajouter(donnees, fichiers, medecinChefNettoye(chef));
        e = cree;
        this.notifier(`${cree.nom} est enregistré (code AMI ${cree.codeAmi ?? cree.code}) avec son médecin chef. Sa fiche est en brouillon : ouvrez-la pour la soumettre à vérification.`);
        // Identifiants du médecin chef : affichés une seule fois.
        this.compteCree = { etablissement: cree.nom, chef: cree.medecinChef, motDePasse: cree.motDePasseTemporaire };
      }
      // Pièce jointe de l'acte de création : déposée une fois l'établissement enregistré.
      if (this.pieceActe) {
        await this.ficheService.ajouterPiece(e.id, 'acteCreation', this.pieceActe)
          .catch(err => this.notifier(`${e.nom} est enregistré, mais la pièce jointe de l’acte n’a pas été envoyée : ${messageErreur(err)}`));
      }
      this.fermer();
    } catch (err) {
      this.erreurEnregistrement = messageErreur(err);
    } finally {
      this.enregistrement = false;
    }
  }

  private notifier(message: string): void {
    this.notification = message;
    clearTimeout(this.timerNotif);
    this.timerNotif = setTimeout(() => (this.notification = null), 6000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timerNotif);
    this.viderNouvellesPhotos();
    document.body.style.overflow = '';
  }
}
