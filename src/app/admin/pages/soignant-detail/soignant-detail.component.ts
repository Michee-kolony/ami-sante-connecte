import { Component, Input, OnChanges, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { EtablissementsService } from '../../data/etablissements.service';
import { SessionService, messageErreur } from '../../data/session.service';
import {
  Affectation, AuteurAjout, CATEGORIES, GRADES, ORDRE, PIECES_IDENTITE, ROLES_SOIGNANT, RoleSoignant, SPECIALITES, Soignant, SoignantsService,
  categorieDuRole, nomAuteur,
} from '../../data/soignants.service';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

/** Âge en années révolues. */
function age(dateNaissance: string): number {
  const n = new Date(dateNaissance);
  const auj = new Date();
  return auj.getFullYear() - n.getFullYear() - (auj < new Date(auj.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
}

/** Fiche d'un médecin ou d'un infirmier, ouverte en cliquant sur sa photo dans la liste. */
@Component({
  selector: 'app-soignant-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './soignant-detail.component.html',
})
export class SoignantDetailComponent implements OnChanges, OnDestroy {
  /** Fourni par la route /admin/soignants/:id. */
  @Input() id = '';

  private service = inject(SoignantsService);
  private etablissementsService = inject(EtablissementsService);
  private session = inject(SessionService);
  /** Seul le médecin chef modifie le profil et les affectations des autres soignants. */
  peutGerer = this.session.peutGererSoignants;

  soignant: Soignant | null = null;
  chargement = true;
  erreur = '';
  photoAgrandie = false;
  notification = '';

  async ngOnChanges(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      // Liste fraîche : seuls les établissements actifs peuvent recevoir une affectation.
      [this.soignant] = await Promise.all([this.service.obtenir(this.id), this.etablissementsService.charger(true)]);
    } catch (err) {
      this.soignant = null;
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  ngOnDestroy(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
  }

  get estMedecin(): boolean {
    return !!this.soignant && categorieDuRole(this.soignant.role) === 'Médecin';
  }

  get ordre(): string {
    return this.soignant ? ORDRE[categorieDuRole(this.soignant.role)] : '';
  }

  get categorie() {
    return CATEGORIES[categorieDuRole(this.soignant?.role ?? 'Médecin')];
  }

  get estMoi(): boolean {
    return this.soignant?.id === this.session.soignant()?.id;
  }

  get age(): number | null {
    return this.soignant?.dateNaissance ? age(this.soignant.dateNaissance) : null;
  }

  auteur(a: AuteurAjout): string {
    return nomAuteur(a);
  }

  nomEtablissement(id: string): string {
    return this.etablissementsService.etablissements().find(e => e.id === id)?.nom ?? id;
  }

  // --- Modification par le médecin chef ---------------------------------------------
  readonly rolesParCategorie = ROLES_SOIGNANT;
  readonly categories = CATEGORIES;
  readonly pieces = PIECES_IDENTITE;
  readonly dateMax = new Date().toISOString().slice(0, 10);
  etablissementsActifs = computed(() => this.etablissementsService.etablissements().filter(e => e.statut === 'Actif'));

  panneauOuvert = false;
  enregistrement = false;
  erreurPanneau = '';
  form = {
    prenom: '', nom: '', postnom: '', sexe: 'F' as 'F' | 'M', dateNaissance: '', lieuNaissance: '', nationalite: '',
    pieceType: PIECES_IDENTITE[0], pieceNumero: '', adresse: '', telephone: '', email: '',
    role: 'Médecin' as RoleSoignant, numeroOrdre: '', grade: '', specialite: '',
  };
  affectations: Affectation[] = [];
  /** Affectations actuelles vers un établissement suspendu ou supprimé (retirées à l'enregistrement). */
  affectationsRetirees: string[] = [];
  photoFichier: File | null = null;
  photoApercu: string | null = null;
  photoErreur = '';

  ouvrirModification(): void {
    const s = this.soignant;
    if (!s) return;
    this.form = {
      prenom: s.prenom, nom: s.nom, postnom: s.postnom ?? '', sexe: s.sexe, dateNaissance: s.dateNaissance,
      lieuNaissance: s.lieuNaissance, nationalite: s.nationalite, pieceType: s.pieceType, pieceNumero: s.pieceNumero ?? '',
      adresse: s.adresse, telephone: s.telephone, email: s.email, role: s.role, numeroOrdre: s.numeroOrdre ?? '',
      grade: s.grade, specialite: s.specialite,
    };
    const actifs = new Set(this.etablissementsActifs().map(e => e.id));
    this.affectations = s.affectations.filter(a => actifs.has(a.etablissementId)).map(a => ({ ...a }));
    this.affectationsRetirees = s.affectations.filter(a => !actifs.has(a.etablissementId)).map(a => this.nomEtablissement(a.etablissementId));
    this.retirerPhoto();
    this.erreurPanneau = '';
    this.panneauOuvert = true;
  }

  fermerModification(): void {
    this.panneauOuvert = false;
    this.retirerPhoto();
  }

  get categorieForm() {
    return categorieDuRole(this.form.role);
  }

  get ordreForm(): string {
    return ORDRE[this.categorieForm];
  }

  /** Grades et spécialités de la catégorie, plus la valeur actuelle si elle n'y figure pas. */
  get grades(): string[] {
    const l = GRADES[this.categorieForm];
    return l.includes(this.form.grade) || !this.form.grade ? l : [this.form.grade, ...l];
  }

  get specialites(): string[] {
    const l = SPECIALITES[this.categorieForm];
    return l.includes(this.form.specialite) || !this.form.specialite ? l : [this.form.specialite, ...l];
  }

  changerRole(role: RoleSoignant): void {
    const avant = this.categorieForm;
    this.form.role = role;
    // Changement de catégorie (médecin ↔ infirmier) : grade et spécialité de la nouvelle catégorie.
    if (categorieDuRole(role) !== avant) {
      this.form.grade = GRADES[this.categorieForm][0];
      this.form.specialite = SPECIALITES[this.categorieForm][0];
    }
  }

  estAffecte(id: string): boolean {
    return this.affectations.some(a => a.etablissementId === id);
  }

  /** Coche ou décoche un établissement ; le premier coché reste l'établissement principal. */
  basculerEtablissement(id: string): void {
    this.affectations = this.estAffecte(id)
      ? this.affectations.filter(a => a.etablissementId !== id)
      : [...this.affectations, { etablissementId: id, service: '' }];
  }

  definirPrincipal(a: Affectation): void {
    this.affectations = [a, ...this.affectations.filter(x => x !== a)];
  }

  choisirPhoto(evt: Event): void {
    const fichier = (evt.target as HTMLInputElement).files?.[0];
    this.photoErreur = '';
    if (!fichier) return;
    if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
      this.photoErreur = 'Format accepté : JPG, PNG ou WebP.';
      return;
    }
    if (fichier.size > PHOTO_MAX_OCTETS) {
      this.photoErreur = 'La photo doit faire 2 Mo au maximum.';
      return;
    }
    this.retirerPhoto();
    this.photoFichier = fichier;
    this.photoApercu = URL.createObjectURL(fichier);
  }

  retirerPhoto(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
    this.photoFichier = null;
    this.photoApercu = null;
  }

  async enregistrer(f: NgForm): Promise<void> {
    if (f.invalid || !this.soignant || this.enregistrement) {
      f.form.markAllAsTouched();
      return;
    }
    if (!this.affectations.length) {
      this.erreurPanneau = 'Choisissez au moins un établissement actif.';
      return;
    }
    this.enregistrement = true;
    this.erreurPanneau = '';
    try {
      const { role, ...champs } = this.form;
      this.soignant = await this.service.modifier(this.soignant.id, {
        ...champs,
        // Le serveur refuse qu'un médecin chef change son propre rôle : on ne l'envoie pas.
        ...(this.estMoi ? {} : { role }),
        affectations: this.affectations,
      }, this.photoFichier);
      this.fermerModification();
      this.notification = 'Profil mis à jour.';
    } catch (err) {
      this.erreurPanneau = messageErreur(err);
    } finally {
      this.enregistrement = false;
    }
  }
}
