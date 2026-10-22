import { Component, Input, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { EnLigneComponent } from '../../components/en-ligne.component';
import { PresenceService } from '../../data/presence.service';
import { EtablissementsService } from '../../data/etablissements.service';
import {
  Affectation, AuteurAjout, CATEGORIES, CategorieSoignant, GRADES, ORDRE, PIECES_IDENTITE, PieceIdentite, ROLES_SOIGNANT, RoleSoignant,
  SPECIALITES, Soignant, SoignantsService, StatutSoignant, categorieDuRole, nomAuteur,
} from '../../data/soignants.service';
import { SessionService, messageErreur } from '../../data/session.service';
import { genererMotDePasse, reglesMotDePasse } from '../../../shared/mot-de-passe';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

function formulaireVide(role: RoleSoignant = 'Médecin') {
  const categorie = categorieDuRole(role);
  return {
    prenom: '', nom: '', postnom: '', sexe: 'F' as 'F' | 'M',
    dateNaissance: '', lieuNaissance: '', nationalite: 'Congolaise',
    pieceType: 'Carte d’électeur' as PieceIdentite, pieceNumero: '', adresse: '', telephone: '',
    numeroOrdre: '', grade: GRADES[categorie][0], specialite: SPECIALITES[categorie][0],
    affectations: [] as Affectation[],
    email: '', role,
    motDePasse: '', confirmation: '', doitChangerMotDePasse: true,
  };
}

/** Âge en années révolues. */
function age(dateNaissance: string): number {
  const n = new Date(dateNaissance);
  const auj = new Date();
  return auj.getFullYear() - n.getFullYear() - (auj < new Date(auj.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
}

@Component({
  selector: 'app-soignants',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, EnLigneComponent],
  templateUrl: './soignants.component.html',
})
export class SoignantsComponent implements OnDestroy {
  service = inject(SoignantsService);
  presence = inject(PresenceService);
  private etablissementsService = inject(EtablissementsService);
  soignants = this.service.soignants;
  private session = inject(SessionService);
  /** Seul le médecin chef peut ajouter, suspendre, réinitialiser ou supprimer un compte. */
  peutGerer = this.session.peutGererSoignants;
  erreurChargement = '';
  /** Squelette seulement au premier chargement : une liste déjà reçue reste affichée pendant l'actualisation. */
  enChargement = computed(() => this.service.chargement() && !this.soignants().length);
  readonly lignesSquelette = [1, 2, 3, 4, 5, 6];

  /** ?ajout=1 (raccourci « Ajout soignant » de l'accès rapide) : ouvre directement le formulaire. */
  @Input() set ajout(v: string | undefined) {
    if (v === '1' && this.peutGerer()) setTimeout(() => this.ouvrir());
  }

  constructor() {
    this.service.charger().catch(err => (this.erreurChargement = messageErreur(err)));
    // Les établissements créés par le médecin chef alimentent la liste des affectations.
    this.etablissementsService.charger(true).catch(err => (this.erreurChargement = messageErreur(err)));
  }

  readonly rolesParCategorie = ROLES_SOIGNANT;
  readonly categories = CATEGORIES;
  readonly pieces = PIECES_IDENTITE;
  /** Seuls les établissements actifs peuvent recevoir un nouveau soignant. */
  etablissementsActifs = computed(() => this.etablissementsService.etablissements().filter(e => e.statut === 'Actif'));

  nomEtablissement(id: string): string {
    return this.etablissementsService.etablissements().find(e => e.id === id)?.nom ?? '—';
  }

  /** Établissements proposables pour une ligne : ceux déjà choisis sur les autres lignes sont exclus. */
  etablissementsDisponibles(ligne: Affectation) {
    const pris = new Set(this.form.affectations.filter(a => a !== ligne).map(a => a.etablissementId));
    return this.etablissementsActifs().filter(e => !pris.has(e.id));
  }

  get peutAjouterAffectation(): boolean {
    return this.form.affectations.length < this.etablissementsActifs().length;
  }

  ajouterAffectation(): void {
    const libre = this.etablissementsDisponibles({ etablissementId: '', service: '' })[0];
    if (libre) this.form.affectations.push({ etablissementId: libre.id, service: '' });
  }

  retirerAffectation(a: Affectation): void {
    if (this.form.affectations.length > 1) this.form.affectations = this.form.affectations.filter(x => x !== a);
  }

  categorie(s: Soignant): CategorieSoignant {
    return categorieDuRole(s.role);
  }

  /** « Dr » devant le nom des médecins uniquement. */
  nomComplet(s: { prenom: string; nom: string; role: RoleSoignant }): string {
    return `${categorieDuRole(s.role) === 'Médecin' ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  }

  // --- Liste -----------------------------------------------------------------
  recherche = signal('');
  filtreCategorie = signal<'Toutes' | CategorieSoignant>('Toutes');
  filtreStatut = signal<'Tous' | StatutSoignant>('Tous');

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.soignants().filter(s => {
      const etablissements = s.affectations.map(a => this.nomEtablissement(a.etablissementId)).join(' ');
      const texte = `${s.prenom} ${s.nom} ${s.postnom} ${s.matricule} ${s.numeroOrdre} ${s.email} ${s.specialite} ${s.role} ${etablissements}`.toLowerCase();
      return (this.filtreCategorie() === 'Toutes' || categorieDuRole(s.role) === this.filtreCategorie())
        && (this.filtreStatut() === 'Tous' || s.statut === this.filtreStatut())
        && (!q || texte.includes(q));
    });
  });

  // --- Onglets -------------------------------------------------------------------
  onglet = signal<'liste' | 'historique'>('liste');
  readonly onglets: { id: 'liste' | 'historique'; label: string; icon: string }[] = [
    { id: 'liste', label: 'Personnel', icon: 'fa-user-doctor' },
    { id: 'historique', label: 'Historique des ajouts', icon: 'fa-clock-rotate-left' },
  ];

  // --- Historique des ajouts (traçabilité) ---------------------------------------
  /** Ajouts du plus récent au plus ancien. */
  historique = computed(() => [...this.soignants()].sort((a, b) => (b.creeLe ?? '').localeCompare(a.creeLe ?? '')));

  auteur(a: AuteurAjout): string {
    return nomAuteur(a);
  }

  /** L'auteur a encore un compte (sinon son nom reste affiché, sans lien). */
  existe(id: string): boolean {
    return this.soignants().some(s => s.id === id);
  }

  stats = computed(() => {
    const liste = this.soignants();
    return {
      total: liste.length,
      medecins: liste.filter(s => categorieDuRole(s.role) === 'Médecin').length,
      infirmiers: liste.filter(s => categorieDuRole(s.role) === 'Infirmier').length,
      sagesFemmes: liste.filter(s => categorieDuRole(s.role) === 'Sage-femme').length,
      multiSites: liste.filter(s => s.affectations.length > 1).length,
    };
  });

  async basculer(s: Soignant): Promise<void> {
    try {
      await this.service.basculer(s.id);
      this.notifier(s.statut === 'Actif'
        ? `L’accès de ${this.nomComplet(s)} est suspendu.`
        : `L’accès de ${this.nomComplet(s)} est réactivé.`);
    } catch (err) {
      this.notifier(messageErreur(err));
    }
  }

  // --- Suppression ---------------------------------------------------------------
  aSupprimer: Soignant | null = null;
  suppression = false;
  erreurSuppression = '';
  /** Matricule retapé par le médecin chef pour confirmer. */
  saisieConfirmation = '';

  estMoi(s: Soignant): boolean {
    return s.id === this.session.soignant()?.id;
  }

  get suppressionConfirmee(): boolean {
    return !!this.aSupprimer && this.saisieConfirmation.trim().toUpperCase() === this.aSupprimer.matricule;
  }

  demanderSuppression(s: Soignant): void {
    this.aSupprimer = s;
    this.erreurSuppression = '';
    this.saisieConfirmation = '';
  }

  annulerSuppression(): void {
    if (!this.suppression) this.aSupprimer = null;
  }

  async confirmerSuppression(): Promise<void> {
    const s = this.aSupprimer;
    if (!s || !this.suppressionConfirmee || this.suppression) return;
    this.suppression = true;
    try {
      await this.service.supprimer(s.id);
      this.aSupprimer = null;
      this.notifier(`Le compte de ${this.nomComplet(s)} (${s.matricule}) a été supprimé.`);
    } catch (err) {
      this.erreurSuppression = messageErreur(err);
    } finally {
      this.suppression = false;
    }
  }

  // --- Formulaire d'ajout ------------------------------------------------------
  panneauOuvert = false;
  form = formulaireVide();
  photoApercu: string | null = null;
  /** Photo d'identité choisie : obligatoire, envoyée au serveur avec le formulaire. */
  photoFichier: File | null = null;
  photoErreur = '';
  erreurEnregistrement = '';
  afficherMdp = false;
  enregistrement = false;
  notification: string | null = null;
  /** Mot de passe temporaire affiché une seule fois après une réinitialisation. */
  identifiants: { nom: string; email: string; motDePasse: string } | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  readonly dateMax = new Date().toISOString().slice(0, 10);

  get categorieForm(): CategorieSoignant {
    return categorieDuRole(this.form.role);
  }

  get grades(): string[] {
    return GRADES[this.categorieForm];
  }

  get specialites(): string[] {
    return SPECIALITES[this.categorieForm];
  }

  get ordre(): string {
    return ORDRE[this.categorieForm];
  }

  /** Changer de catégorie remet grade et spécialité sur des valeurs valides. */
  changerRole(role: RoleSoignant): void {
    this.form.role = role;
    if (!this.grades.includes(this.form.grade)) this.form.grade = this.grades[0];
    if (!this.specialites.includes(this.form.specialite)) this.form.specialite = this.specialites[0];
  }

  get matriculePropose(): string {
    return this.service.prochainMatricule(this.form.role);
  }

  get emailDejaUtilise(): boolean {
    return this.service.emailExiste(this.form.email);
  }

  get numeroOrdreDejaUtilise(): boolean {
    return this.service.numeroOrdreExiste(this.form.numeroOrdre);
  }

  /** Âge plausible pour un professionnel de santé en exercice. */
  get ageValide(): boolean {
    return !this.form.dateNaissance || (age(this.form.dateNaissance) >= 18 && age(this.form.dateNaissance) <= 90);
  }

  get regles() {
    return reglesMotDePasse(this.form.motDePasse);
  }

  get force(): number {
    return this.regles.filter(r => r.ok).length;
  }

  get motDePasseValide(): boolean {
    return this.force === this.regles.length;
  }

  get confirmationOk(): boolean {
    return this.form.confirmation.length > 0 && this.form.confirmation === this.form.motDePasse;
  }

  genererMotDePasse(): void {
    this.form.motDePasse = this.form.confirmation = genererMotDePasse();
    this.afficherMdp = true;
  }

  /** Nouveau mot de passe temporaire, à remettre au soignant en personne. */
  async reinitialiser(s: Soignant): Promise<void> {
    try {
      const motDePasse = await this.service.reinitialiserMotDePasse(s.id);
      this.identifiants = { nom: this.nomComplet(s), email: s.email, motDePasse };
    } catch (err) {
      this.notifier(messageErreur(err));
    }
  }

  copier(texte: string): void {
    navigator.clipboard?.writeText(texte);
  }

  ouvrir(): void {
    this.form = formulaireVide();
    this.ajouterAffectation();
    this.retirerPhoto();
    this.photoErreur = '';
    this.erreurEnregistrement = '';
    this.afficherMdp = false;
    this.panneauOuvert = true;
    document.body.style.overflow = 'hidden';
  }

  fermer(): void {
    this.panneauOuvert = false;
    document.body.style.overflow = '';
  }

  choisirPhoto(event: Event): void {
    const fichier = (event.target as HTMLInputElement).files?.[0];
    this.photoErreur = '';
    if (!fichier) return;
    if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
      this.photoErreur = 'Format accepté : JPG, PNG ou WebP.';
      return;
    }
    if (fichier.size > PHOTO_MAX_OCTETS) {
      this.photoErreur = 'La photo ne doit pas dépasser 2 Mo.';
      return;
    }
    this.retirerPhoto();
    this.photoFichier = fichier;
    this.photoApercu = URL.createObjectURL(fichier);
  }

  retirerPhoto(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
    this.photoApercu = null;
    this.photoFichier = null;
  }

  async enregistrer(f: NgForm): Promise<void> {
    if (this.enregistrement) return;
    const problemes = this.problemesFormulaire(f);
    if (problemes.length) {
      this.erreurEnregistrement = `À corriger avant d’enregistrer : ${problemes.join(', ')}.`;
      return;
    }
    this.enregistrement = true;
    this.erreurEnregistrement = '';
    let s: Soignant;
    try {
      s = await this.service.ajouter({
        prenom: this.form.prenom.trim(),
        nom: this.form.nom.trim().toUpperCase(),
        postnom: this.form.postnom.trim().toUpperCase(),
        sexe: this.form.sexe,
        dateNaissance: this.form.dateNaissance,
        lieuNaissance: this.form.lieuNaissance.trim(),
        nationalite: this.form.nationalite.trim(),
        pieceType: this.form.pieceType,
        pieceNumero: this.form.pieceNumero.trim().toUpperCase(),
        adresse: this.form.adresse.trim(),
        telephone: this.form.telephone.trim(),
        numeroOrdre: this.form.numeroOrdre.trim().toUpperCase(),
        grade: this.form.grade,
        specialite: this.form.specialite,
        affectations: this.form.affectations.map(a => ({ etablissementId: a.etablissementId, service: a.service.trim() })),
        email: this.form.email.trim().toLowerCase(),
        role: this.form.role,
        doitChangerMotDePasse: this.form.doitChangerMotDePasse,
      }, this.photoFichier!, this.form.motDePasse);
    } catch (err) {
      this.erreurEnregistrement = messageErreur(err);
      return;
    } finally {
      this.enregistrement = false;
    }
    this.retirerPhoto(); // la photo est désormais servie depuis R2
    this.fermer();
    this.notifier(`Compte créé pour ${this.nomComplet(s)} (${s.matricule}, ${s.role}). Identifiant de connexion : ${s.email}. Remettez-lui son mot de passe en personne.`);
  }

  /** Liste lisible de ce qui empêche l'enregistrement (vide si tout est bon). */
  private problemesFormulaire(f: NgForm): string[] {
    const libelles: Record<string, string> = {
      prenom: 'prénom', nom: 'nom', dateNaissance: 'date de naissance', lieuNaissance: 'lieu de naissance',
      nationalite: 'nationalité', telephone: 'téléphone (9 à 20 chiffres)', pieceType: 'type de pièce',
      adresse: 'adresse', grade: 'grade', specialite: 'spécialité', email: 'e-mail valide', role: 'rôle',
    };
    const p = Object.entries(f.controls)
      .filter(([nom, c]) => c.invalid && libelles[nom])
      .map(([nom]) => libelles[nom]);
    if (!this.photoFichier) p.push('photo d’identité');
    if (!this.form.affectations.length) p.push('au moins un établissement');
    if (!this.ageValide) p.push('date de naissance (âge entre 18 et 90 ans)');
    if (this.emailDejaUtilise) p.push('e-mail déjà utilisé');
    if (this.numeroOrdreDejaUtilise) p.push('numéro d’Ordre déjà enregistré');
    if (!this.motDePasseValide) p.push('mot de passe trop faible');
    else if (!this.confirmationOk) p.push('confirmation du mot de passe');
    return p;
  }

  private notifier(message: string): void {
    this.notification = message;
    clearTimeout(this.timerNotif);
    this.timerNotif = setTimeout(() => (this.notification = null), 6000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timerNotif);
    this.retirerPhoto();
    document.body.style.overflow = '';
  }
}
