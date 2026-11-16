import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import {
  CANAUX_CONTACT, CATEGORIES_DU_TYPE, COEFFICIENTS_DEFAUT, CHAMPS_CHEF, CONTINUITES, Catalogue, ETATS_BATIMENT, ETATS_INTRANTS, FicheAmi, JOURS,
  LIBELLES_CATEGORIE, LigneService, METHODES_GPS, MOYENS_REFERENCE, Profil, REGIMES_GESTION, ROUTES, SOURCES_CODE, SOURCES_ELECTRICITE,
  SOURCES_POPULATION, STABILITES, STATUTS_FONCTIONNEMENT, STATUTS_JURIDIQUES, SYSTEMES_RAPPORTAGE, TITRES_RESPONSABLE, adresseComposee,
  FicheEtablissementService, populationVide, profilCatalogue, responsableFonctionnelVide,
} from '../data/fiche-etablissement';

/** Champs portés par l'établissement lui-même, saisis dans ces étapes quand le formulaire les fournit. */
export interface ChampsEtablissement {
  latitude: number | null;
  longitude: number | null;
  telephone: string;
  email: string;
}

/** État d'un service (§8), une seule question par service. */
type EtatService = '' | 'Fonctionnel' | 'Partiel' | 'Non fonctionnel' | 'Absent';

/**
 * Étapes 1 à 10 de la fiche « Identification générale de la structure ». Chaque information n'est
 * demandée qu'une fois : ce qui se déduit d'une autre réponse est affiché (catégorie d'un centre
 * de santé, adresse détaillée, bâtiments hors service, totaux des lits, cibles…), jamais ressaisi.
 * Toutes les étapes sont rendues (masquées sauf l'étape courante) pour que la validation du
 * formulaire parent les couvre. Pour le médecin chef, seuls les champs facultatifs sont modifiables.
 */
@Component({
  selector: 'app-fiche-etapes',
  standalone: true,
  imports: [FormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  templateUrl: './fiche-etapes.component.html',
})
export class FicheEtapesComponent implements OnInit, OnChanges {
  /** Fourni par la page parente : adresse de l'espace (comité ou médecin chef). */
  private ficheService = inject(FicheEtablissementService);
  private sanitizer = inject(DomSanitizer);

  @Input({ required: true }) fiche!: FicheAmi;
  /** Étape affichée (1 à 10). */
  @Input() etape = 1;
  @Input() role: 'comite' | 'chef' = 'comite';
  @Input() soumis = false;
  /** Type de structure : choisit le catalogue (hôpital ou centre de santé) et les catégories possibles. */
  @Input() type: string | null = null;
  /** Rattachement déduit (affiché à l'étape 2). */
  @Input() bczs = '';
  @Input() dps = '';
  /** GPS, téléphone et e-mail de l'établissement (formulaire du comité) ; null : affichés ailleurs. */
  @Input() etab: ChampsEtablissement | null = null;
  /** Pièce jointe de l'acte de création choisie (envoyée par le parent). */
  @Output() pieceActe = new EventEmitter<File>();

  readonly categoriesDuType = CATEGORIES_DU_TYPE;
  readonly libellesCategorie = LIBELLES_CATEGORIE;
  readonly statutsFonctionnement = STATUTS_FONCTIONNEMENT;
  readonly statutsJuridiques = STATUTS_JURIDIQUES;
  readonly regimes = REGIMES_GESTION;
  readonly sourcesCode = SOURCES_CODE;
  readonly methodesGps = METHODES_GPS;
  readonly sourcesPopulation = SOURCES_POPULATION;
  readonly canaux = CANAUX_CONTACT;
  readonly titres = TITRES_RESPONSABLE;
  readonly etatsBatiment = ETATS_BATIMENT;
  readonly stabilites = STABILITES;
  readonly continuites = CONTINUITES;
  readonly routes = ROUTES;
  readonly sourcesElectricite = SOURCES_ELECTRICITE;
  readonly moyensReference = MOYENS_REFERENCE;
  readonly systemesRapportage = SYSTEMES_RAPPORTAGE;
  readonly etatsIntrants = ETATS_INTRANTS;
  readonly jours = JOURS;
  readonly saisonnalites = ['Accessible toute l’année', 'Difficile en saison des pluies', 'Coupée en saison des pluies'];
  readonly etatsService: EtatService[] = ['Fonctionnel', 'Partiel', 'Non fonctionnel', 'Absent'];
  readonly ouiNon = ['Oui', 'Non'];

  catalogue: Catalogue | null = null;
  erreurCatalogue = '';
  localisation = false;
  localisationErreur = '';
  pieceChoisie = '';

  ngOnInit(): void {
    this.ficheService.catalogue()
      .then(c => (this.catalogue = c))
      .catch(() => (this.erreurCatalogue = 'Catalogue de la fiche indisponible (connexion ?). Rechargez la page.'));
  }

  ngOnChanges(): void {
    this.completerResponsables();
  }

  get comite(): boolean {
    return this.role === 'comite';
  }

  get profil(): Profil {
    return profilCatalogue(this.type);
  }

  /** Le champ (ou la section entière) est-il modifiable pour ce rôle ? */
  peut(section: string, champ?: string): boolean {
    if (this.comite) return true;
    const droit = CHAMPS_CHEF[section];
    return droit === true || (!!droit && !!champ && droit.includes(champ));
  }

  /** Erreur affichée sur un champ obligatoire du comité laissé vide. */
  manque(valeur: unknown): boolean {
    return this.comite && this.soumis && (valeur == null || valeur === '');
  }

  // --- 1. Identification générale -------------------------------------------------------------
  /** Catégories du type choisi : une seule → déduite (affichée), plusieurs → à choisir. */
  get categoriesPossibles(): string[] {
    return CATEGORIES_DU_TYPE[this.type ?? ''] ?? [];
  }
  get categorieDeduite(): string | null {
    const c = this.categoriesPossibles;
    return c.length === 1 ? c[0] : null;
  }
  ajouterAncienNom(): void {
    this.fiche.identification.anciensNoms.push({ nom: '', debut: null, fin: null });
  }
  choisirPiece(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    this.pieceChoisie = fichier.name;
    this.pieceActe.emit(fichier);
  }

  // --- 2. Localisation -------------------------------------------------------------------------
  get adresse(): string {
    return adresseComposee(this.fiche.localisation);
  }
  get gpsValide(): boolean {
    const e = this.etab;
    if (!e || (e.latitude == null && e.longitude == null)) return true;
    return e.latitude != null && e.longitude != null && e.latitude >= -90 && e.latitude <= 90 && e.longitude >= -180 && e.longitude <= 180;
  }
  private carteCache: { cle: string; url: SafeResourceUrl } | null = null;
  /** Point cartographique (OpenStreetMap) des coordonnées saisies. */
  get carte(): SafeResourceUrl | null {
    const e = this.etab;
    if (!e || e.latitude == null || e.longitude == null || !this.gpsValide) return null;
    const cle = `${e.latitude},${e.longitude}`;
    if (this.carteCache?.cle !== cle) {
      const [lat, lng] = [e.latitude, e.longitude];
      this.carteCache = {
        cle,
        url: this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.006},${lng + 0.01},${lat + 0.006}&layer=mapnik&marker=${lat},${lng}`),
      };
    }
    return this.carteCache.url;
  }
  /** Remplit les coordonnées avec la position de l'appareil (sur place), méthode et date comprises. */
  localiser(): void {
    const e = this.etab;
    if (!e) return;
    if (!navigator.geolocation) {
      this.localisationErreur = 'Géolocalisation indisponible sur cet appareil.';
      return;
    }
    this.localisation = true;
    this.localisationErreur = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        e.latitude = +pos.coords.latitude.toFixed(5);
        e.longitude = +pos.coords.longitude.toFixed(5);
        const gps = this.fiche.localisation.gps;
        gps.precisionM = Math.round(pos.coords.accuracy);
        gps.date = new Date().toISOString().slice(0, 10);
        gps.methode ??= 'Smartphone';
        this.localisation = false;
      },
      () => {
        this.localisationErreur = 'Position introuvable. Saisissez les coordonnées à la main.';
        this.localisation = false;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // --- 3. Population cible ---------------------------------------------------------------------
  ajouterAnnee(): void {
    const max = this.fiche.populations.reduce((m, p) => Math.max(m, p.annee), new Date().getFullYear() - 1);
    this.fiche.populations.push(populationVide(max + 1));
  }
  /** Années déjà enregistrées sur le serveur : conservées, jamais supprimées. */
  retirerAnnee(i: number): void {
    if (!this.fiche.populations[i].saisiLe) this.fiche.populations.splice(i, 1);
  }
  anneeEnDouble(annee: number): boolean {
    return this.fiche.populations.filter(p => p.annee === annee).length > 1;
  }
  ecarts(p: FicheAmi['populations'][number]): string[] {
    const t = p.tranches;
    const a: string[] = [];
    const lib = (cle: string) => this.catalogue?.groupesPopulation.find(g => g.cle === cle)?.libelle ?? cle;
    for (const [cle, v] of Object.entries(t)) if (v != null && p.totale != null && v > p.totale) a.push(`${lib(cle)} > population totale`);
    if (t['moins1'] != null && t['de0a23m'] != null && t['moins1'] > t['de0a23m']) a.push('0-11 mois > 0-23 mois');
    if (t['de0a23m'] != null && t['moins5'] != null && t['de0a23m'] > t['moins5']) a.push('0-23 mois > 0-59 mois');
    if (t['moins1'] != null && t['de12a23m'] != null && t['de0a23m'] != null && t['moins1'] + t['de12a23m'] !== t['de0a23m']) {
      a.push(`0-11 mois + 12-23 mois = ${t['moins1'] + t['de12a23m']} ≠ 0-23 mois (${t['de0a23m']})`);
    }
    return a;
  }
  get populationBase(): { annee: number; totale: number; source: string | null } | null {
    const p = [...this.fiche.populations].filter(x => x.totale != null).sort((a, b) => b.annee - a.annee)[0];
    return p ? { annee: p.annee, totale: p.totale!, source: p.source } : null;
  }
  /** Aperçu des cibles (le serveur applique les coefficients validés du module Épidémiologie). */
  get cibles() {
    const base = this.populationBase?.totale ?? null;
    return COEFFICIENTS_DEFAUT.map(c => {
      const annuelle = base != null ? Math.round(base * c.pct / 100) : null;
      const part = (d: number) => (annuelle != null ? Math.round(annuelle / d) : null);
      return { ...c, annuelle, semestrielle: part(2), trimestrielle: part(4), mensuelle: part(12) };
    });
  }

  // --- 4. Contacts -------------------------------------------------------------------------------
  telephoneValide(v: string | null | undefined): boolean {
    return !v || /^\+243\d{9}$/.test(v.replace(/[\s.()-]/g, ''));
  }
  ajouterContact(): void {
    this.fiche.contacts.contactsService.push({ service: '', nom: '', fonction: '', telephone: '', email: '', debut: null, fin: null });
  }

  // --- 5. Responsables -------------------------------------------------------------------------
  /** Une ligne par domaine fonctionnel (CPN, Maternité, PEV…), jamais deux. */
  private completerResponsables(): void {
    if (!this.fiche) return;
    const domaines = this.catalogue?.domainesFonctionnels ?? ['CPN', 'Maternité', 'PEV', 'Surveillance', 'Données', 'Informatique'];
    for (const d of domaines) {
      if (!this.fiche.responsablesFonctionnels.some(r => r.domaine === d)) this.fiche.responsablesFonctionnels.push(responsableFonctionnelVide(d));
    }
  }
  choisirTitre(titre: string | null): void {
    const org = this.fiche.organisation;
    org.titreResponsable = titre;
    // La fonction est le titre choisi (précisée à la main seulement pour « Autre »).
    org.responsable.fonction = titre && titre !== 'Autre' ? titre : '';
  }

  // --- 6. Services et activités ------------------------------------------------------------------
  /** Liste déroulante d'un service : grande, contrastée, colorée selon l'état choisi. */
  classeEtatService(etat: EtatService): string {
    const base = 'w-44 shrink-0 cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-70';
    switch (etat) {
      case 'Fonctionnel': return `${base} border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-100`;
      case 'Partiel': return `${base} border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-100`;
      case 'Non fonctionnel': return `${base} border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-400 dark:bg-rose-500/20 dark:text-rose-100`;
      case 'Absent': return `${base} border-slate-500 bg-slate-100 text-slate-900 dark:border-slate-400 dark:bg-slate-700 dark:text-white`;
      default: return `${base} border-slate-400 bg-white text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-white`;
    }
  }
  /** Choix de la liste ouverte : texte foncé et gras sur fond clair (sombre en mode sombre). */
  classeOptionService(etat: EtatService): string {
    switch (etat) {
      case 'Fonctionnel': return 'bg-white font-semibold text-emerald-800 dark:bg-slate-900 dark:text-emerald-300';
      case 'Partiel': return 'bg-white font-semibold text-amber-800 dark:bg-slate-900 dark:text-amber-300';
      case 'Non fonctionnel': return 'bg-white font-semibold text-rose-800 dark:bg-slate-900 dark:text-rose-300';
      case 'Absent': return 'bg-white font-semibold text-slate-900 dark:bg-slate-900 dark:text-white';
      default: return 'bg-white font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300';
    }
  }
  libelleService(nom: string): string {
    return this.catalogue?.libellesService[this.profil]?.[nom] ?? nom;
  }
  ouvreModule(nom: string): boolean {
    return Object.values(this.catalogue?.servicesModule ?? {}).some(noms => noms.includes(nom));
  }
  /** Ligne d'un service du catalogue, enregistrée sous ce nom ou sous son ancien nom. */
  private ligneService(nom: string): LigneService | undefined {
    const anciens = Object.entries(this.catalogue?.servicesRenommes[this.profil] ?? {}).filter(([, n]) => n === nom).map(([a]) => a);
    return this.fiche.services.find(s => s.service === nom) ?? this.fiche.services.find(s => anciens.includes(s.service));
  }
  etatService(nom: string): EtatService {
    const s = this.ligneService(nom);
    if (!s) return '';
    if (s.existence === 'Non') return 'Absent';
    return s.fonctionnel === 'Oui' ? 'Fonctionnel' : s.fonctionnel === 'Partiel' ? 'Partiel' : s.fonctionnel === 'Non' ? 'Non fonctionnel' : '';
  }
  definirEtatService(nom: string, etat: EtatService): void {
    let s = this.ligneService(nom);
    if (!s) {
      if (!etat) return;
      s = { service: nom, existence: null, disponible: null, fonctionnel: null, jours: [], horaires: '' };
      this.fiche.services.push(s);
    }
    s.service = nom; // ancien nom repris sous le nom du catalogue
    const [existence, disponible, fonctionnel] = ({
      '': [null, null, null], Fonctionnel: ['Oui', 'Oui', 'Oui'], Partiel: ['Oui', 'Oui', 'Partiel'],
      'Non fonctionnel': ['Oui', 'Non', 'Non'], Absent: ['Non', null, null],
    } as const)[etat];
    Object.assign(s, { existence, disponible, fonctionnel });
  }
  servicesRenseignes(elements: string[]): number {
    return elements.filter(n => this.etatService(n)).length;
  }
  get modulesPrevus(): string[] {
    const m = this.catalogue?.servicesModule ?? {};
    return Object.keys(m).filter(mod => this.fiche.services.some(s => m[mod].includes(s.service) && s.fonctionnel === 'Oui'));
  }
  get aucunServiceFonctionnel(): boolean {
    return !this.fiche.services.some(s => s.fonctionnel === 'Oui' || s.fonctionnel === 'Partiel');
  }

  // --- 7. Infrastructures ----------------------------------------------------------------------
  get batimentsHorsService(): number | null {
    const i = this.fiche.infrastructures;
    return i.batiments != null && i.batimentsFonctionnels != null ? Math.max(0, i.batiments - i.batimentsFonctionnels) : null;
  }
  get lits(): { installes: number; operationnels: number } {
    const u = this.fiche.infrastructures.litsParUnite;
    return { installes: u.reduce((s, x) => s + (x.installes ?? 0), 0), operationnels: u.reduce((s, x) => s + (x.operationnels ?? 0), 0) };
  }
  ajouterUnite(): void {
    this.fiche.infrastructures.litsParUnite.push({ unite: '', installes: null, operationnels: null });
  }
  get continuiteElectricite(): string | null {
    const h = this.fiche.infrastructures.electriciteDetail.heuresParJour;
    return h == null ? null : h >= 24 ? 'Continue' : h === 0 ? 'Absente' : 'Intermittente';
  }
  basculer(liste: string[], valeur: string): void {
    const i = liste.indexOf(valeur);
    if (i >= 0) liste.splice(i, 1);
    else liste.push(valeur);
  }

  // --- 8. Ressources humaines ------------------------------------------------------------------
  effectif(fonction: string): number | null {
    return this.fiche.personnel.find(p => p.fonction === fonction)?.nombre ?? null;
  }
  definirEffectif(fonction: string, nombre: number | null): void {
    const p = this.fiche.personnel.find(x => x.fonction === fonction);
    if (p) p.nombre = nombre;
    else if (nombre != null) this.fiche.personnel.push({ fonction, nombre });
  }
  totalPersonnel(elements?: string[]): number {
    return this.fiche.personnel.filter(p => !elements || elements.includes(p.fonction)).reduce((s, p) => s + (p.nombre ?? 0), 0);
  }

  // --- 9. Équipements ----------------------------------------------------------------------------
  quantite(categorie: string, nom: string, champ: 'total' | 'fonctionnels'): number | null {
    return this.fiche.equipements.find(q => q.categorie === categorie && q.nom === nom)?.[champ] ?? null;
  }
  definirQuantite(categorie: string, nom: string, champ: 'total' | 'fonctionnels', valeur: number | null): void {
    const q = this.fiche.equipements.find(x => x.categorie === categorie && x.nom === nom);
    if (q) q[champ] = valeur;
    else if (valeur != null) this.fiche.equipements.push({ categorie, nom, total: null, fonctionnels: null, [champ]: valeur });
  }
  equipementsRenseignes(g: { titre: string; elements: string[] }): number {
    return g.elements.filter(n => this.quantite(g.titre, n, 'total') != null).length;
  }
  incoherent(categorie: string, nom: string): boolean {
    const t = this.quantite(categorie, nom, 'total');
    const f = this.quantite(categorie, nom, 'fonctionnels');
    return t != null && f != null && f > t;
  }
  /** Équipements hors catalogue (saisis librement ou venus d'une ancienne fiche). */
  get autresEquipements() {
    const groupes = this.catalogue?.equipements[this.profil] ?? [];
    return this.fiche.equipements.filter(q => !groupes.some(g => g.titre === q.categorie && g.elements.includes(q.nom)));
  }
  ajouterEquipement(): void {
    this.fiche.equipements.push({ categorie: 'Autre', nom: '', total: null, fonctionnels: null });
  }
  retirerEquipement(q: FicheAmi['equipements'][number]): void {
    this.fiche.equipements.splice(this.fiche.equipements.indexOf(q), 1);
  }

  // --- 10. Informations opérationnelles -------------------------------------------------------
  get servicesOuverts(): LigneService[] {
    return this.fiche.services.filter(s => s.existence === 'Oui');
  }
  /** Matériel numérique recensé à l'étape 9 (ordinateurs et tablettes) : pas ressaisi. */
  get materielNumerique(): number {
    return this.fiche.equipements.filter(q => /ordinateur|tablette/i.test(q.nom)).reduce((s, q) => s + (q.total ?? 0), 0);
  }
  get connectiviteResume(): string {
    const c = this.fiche.infrastructures.connectivite;
    const r = [c.internet === 'Oui' ? 'Internet' : c.internet === 'Non' ? 'Pas d’internet' : null, c.reseauMobile === 'Oui' ? 'réseau mobile' : null, c.stabilite]
      .filter(Boolean);
    return r.length ? r.join(' · ') : 'non renseignée (étape 7)';
  }
  get alimentationResume(): string {
    const e = this.fiche.infrastructures.electriciteDetail;
    return e.sources.length ? `${e.sources.join(', ')}${this.continuiteElectricite ? ' · ' + this.continuiteElectricite.toLowerCase() : ''}` : 'non renseignée (étape 7)';
  }
}
