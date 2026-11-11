import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PROVINCES_RDC } from '../../data/carte-rdc';
import { zonesDeProvince } from '../../data/zones-sante';
import {
  DonneesEtablissement, DonneesMedecinChef, Etablissement, EtablissementsService, MedecinChef, SECTEURS_ETABLISSEMENT, SERVICES_ETABLISSEMENT,
  ServiceEtablissement, StatutEtablissement, TYPES_ETABLISSEMENT, TypeEtablissement, SecteurEtablissement,
} from '../../data/etablissements.service';
import { messageErreur } from '../../data/session.service';
import { ESPACE_COMITE } from '../../data/espace';
import { ChampsMedecinChefComponent, medecinChefNettoye, medecinChefVide } from '../../components/champs-medecin-chef.component';

const MAX_PHOTOS = 6;
const PHOTO_MAX_OCTETS = 5 * 1024 * 1024;

function formulaireVide() {
  return {
    nom: '', type: '' as TypeEtablissement | '', secteur: '' as SecteurEtablissement | '',
    province: 'Kinshasa', districtSanitaire: '', zonesSante: [] as string[], aireSante: '', adresse: '',
    latitude: null as number | null, longitude: null as number | null,
    telephone: '', email: '', responsable: '', fonctionResponsable: '', lits: 0,
    services: new Set<ServiceEtablissement>(),
  };
}

function formulaireDepuis(e: Etablissement) {
  return {
    nom: e.nom, type: e.type as TypeEtablissement | '', secteur: e.secteur as SecteurEtablissement | '',
    province: e.province, districtSanitaire: e.districtSanitaire ?? '',
    // Seules les zones du référentiel sont reprises (les anciennes saisies libres sont à re-choisir).
    zonesSante: zonesEtablissement(e).filter(z => zonesDeProvince(e.province).includes(z)),
    aireSante: e.aireSante, adresse: e.adresse,
    latitude: e.latitude, longitude: e.longitude,
    telephone: e.telephone, email: e.email, responsable: e.responsable, fonctionResponsable: e.fonctionResponsable, lits: e.lits,
    services: new Set(e.services),
  };
}

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
  imports: [FormsModule, RouterLink, ChampsMedecinChefComponent],
  templateUrl: './etablissements.component.html',
})
export class EtablissementsComponent implements OnDestroy {
  service = inject(EtablissementsService);
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
  readonly secteurs = SECTEURS_ETABLISSEMENT;
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
      const texte = `${e.nom} ${e.code} ${e.province} ${zonesEtablissement(e).join(' ')} ${e.aireSante} ${e.responsable}`.toLowerCase();
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
  localisation = false;
  localisationErreur = '';
  notification: string | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  get codePropose(): string {
    return this.enEdition?.code ?? this.service.prochainCode(this.form.province);
  }

  get nomExiste(): boolean {
    return this.service.nomExiste(this.form.nom, this.form.province, this.enEdition?.id);
  }

  get coordonneesValides(): boolean {
    const { latitude: lat, longitude: lng } = this.form;
    if (lat == null && lng == null) return true;
    return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
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
  }

  /** Coche ou décoche une zone ; l'ordre de sélection est gardé (la première est la zone principale). */
  basculerZone(z: string): void {
    const zones = this.form.zonesSante;
    this.form.zonesSante = zones.includes(z) ? zones.filter(x => x !== z) : [...zones, z];
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

  /** Remplit les coordonnées GPS avec la position de l'appareil (sur place). */
  localiser(): void {
    if (!navigator.geolocation) {
      this.localisationErreur = 'Géolocalisation indisponible sur cet appareil.';
      return;
    }
    this.localisation = true;
    this.localisationErreur = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.form.latitude = +pos.coords.latitude.toFixed(5);
        this.form.longitude = +pos.coords.longitude.toFixed(5);
        this.localisation = false;
      },
      () => {
        this.localisationErreur = 'Position introuvable. Saisissez les coordonnées à la main.';
        this.localisation = false;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
    this.viderNouvellesPhotos();
    this.photoErreur = this.localisationErreur = this.erreurEnregistrement = '';
    this.rechercheZone = '';
    this.panneauOuvert = true;
    document.body.style.overflow = 'hidden';
  }

  fermer(): void {
    this.panneauOuvert = false;
    this.viderNouvellesPhotos();
    document.body.style.overflow = '';
  }

  async enregistrer(f: NgForm): Promise<void> {
    if (this.enregistrement) return;
    if (f.invalid || this.nomExiste || !this.coordonneesValides || !this.form.services.size || !this.form.zonesSante.length) {
      this.erreurEnregistrement = this.enEdition
        ? 'Vérifiez les champs signalés en rouge (nom, type, secteur, zones de santé, adresse, responsable, téléphone, services, coordonnées).'
        : 'Vérifiez les champs signalés en rouge, y compris l’identité du médecin chef.';
      return;
    }
    this.enregistrement = true;
    this.erreurEnregistrement = '';
    const donnees: DonneesEtablissement = {
      nom: this.form.nom.trim(),
      type: this.form.type as TypeEtablissement,
      secteur: this.form.secteur as SecteurEtablissement,
      province: this.form.province,
      districtSanitaire: this.form.districtSanitaire.trim(),
      zonesSante: [...this.form.zonesSante],
      aireSante: this.form.aireSante.trim(),
      adresse: this.form.adresse.trim(),
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      telephone: this.form.telephone.trim(),
      email: this.form.email.trim().toLowerCase(),
      responsable: this.form.responsable.trim(),
      fonctionResponsable: this.form.fonctionResponsable.trim(),
      lits: this.form.lits || 0,
      services: this.servicesDisponibles.filter(s => this.form.services.has(s)),
    };
    const fichiers = this.nouvellesPhotos.map(p => p.fichier);
    try {
      if (this.enEdition) {
        const e = await this.service.modifier(this.enEdition.id, donnees, this.photosConservees, fichiers);
        this.fermer();
        this.notifier(`${e.nom} a été mis à jour.`);
      } else {
        const e = await this.service.ajouter(donnees, fichiers, medecinChefNettoye(this.chef));
        this.fermer();
        this.notifier(`${e.nom} est enregistré sous le code ${e.code}, avec son médecin chef.`);
        // Identifiants du médecin chef : affichés une seule fois.
        this.compteCree = { etablissement: e.nom, chef: e.medecinChef, motDePasse: e.motDePasseTemporaire };
      }
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
