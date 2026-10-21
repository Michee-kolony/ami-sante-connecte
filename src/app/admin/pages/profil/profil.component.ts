import { Component, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AvatarComponent } from '../../components/avatar.component';
import { EtablissementsService } from '../../data/etablissements.service';
import { SessionService, messageErreur } from '../../data/session.service';
import { Affectation, GRADES, ORDRE, PIECES_IDENTITE, SPECIALITES, Soignant, categorieDuRole } from '../../data/soignants.service';
import { reglesMotDePasse } from '../../../shared/mot-de-passe';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

/** Champs modifiables par le soignant lui-même (rôle, e-mail et statut sont gérés par le médecin chef). */
function formulaireDepuis(s: Soignant) {
  return {
    prenom: s.prenom, nom: s.nom, postnom: s.postnom ?? '', sexe: s.sexe,
    dateNaissance: s.dateNaissance, lieuNaissance: s.lieuNaissance, nationalite: s.nationalite,
    pieceType: s.pieceType, pieceNumero: s.pieceNumero, adresse: s.adresse, telephone: s.telephone,
    numeroOrdre: s.numeroOrdre ?? '', grade: s.grade, specialite: s.specialite,
  };
}

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  templateUrl: './profil.component.html',
})
export class ProfilComponent implements OnDestroy {
  session = inject(SessionService);
  private etablissementsService = inject(EtablissementsService);
  readonly pieces = PIECES_IDENTITE;
  readonly dateMax = new Date().toISOString().slice(0, 10);

  /** Le médecin chef choisit lui-même ses établissements ; les autres soignants y sont affectés par lui. */
  peutChoisirEtablissements = this.session.peutGererSoignants;
  etablissementsActifs = computed(() => this.etablissementsService.etablissements().filter(e => e.statut === 'Actif'));
  affectations: Affectation[] = this.affectationsValides();

  constructor() {
    if (this.peutChoisirEtablissements()) {
      this.etablissementsService.charger(true)
        .then(() => (this.affectations = this.affectationsValides()))
        .catch(() => {});
    }
  }

  /** Affectations actuelles, sans celles qui désignent un établissement inexistant. */
  private affectationsValides(): Affectation[] {
    const ids = new Set(this.etablissementsService.etablissements().map(e => e.id));
    return (this.moi.affectations ?? []).filter(a => ids.has(a.etablissementId)).map(a => ({ ...a }));
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

  form = formulaireDepuis(this.moi);
  photoFichier: File | null = null;
  photoApercu: string | null = null;
  photoErreur = '';
  enregistrement = false;
  erreur = '';
  succes = '';

  mdp = { actuel: '', nouveau: '', confirmation: '' };
  afficherMdp = false;
  changementMdp = false;
  erreurMdp = '';
  succesMdp = '';

  get moi(): Soignant {
    return this.session.soignant()!;
  }

  get categorie() {
    return categorieDuRole(this.moi.role);
  }

  get grades(): string[] {
    return GRADES[this.categorie];
  }

  get specialites(): string[] {
    return SPECIALITES[this.categorie];
  }

  get ordre(): string {
    return ORDRE[this.categorie];
  }

  get regles() {
    return reglesMotDePasse(this.mdp.nouveau);
  }

  get mdpValide(): boolean {
    return this.regles.every(r => r.ok) && this.mdp.nouveau === this.mdp.confirmation;
  }

  choisirPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
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
    this.annulerPhoto();
    this.photoFichier = fichier;
    this.photoApercu = URL.createObjectURL(fichier);
  }

  annulerPhoto(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
    this.photoApercu = null;
    this.photoFichier = null;
  }

  async enregistrer(f: NgForm): Promise<void> {
    if (f.invalid || this.enregistrement) return;
    if (this.peutChoisirEtablissements() && this.etablissementsActifs().length && !this.affectations.length) {
      this.erreur = 'Cochez au moins un établissement.';
      return;
    }
    this.enregistrement = true;
    this.erreur = this.succes = '';
    try {
      const s = await this.session.modifierProfil({
        ...this.form,
        ...(this.peutChoisirEtablissements() && this.affectations.length ? { affectations: JSON.stringify(this.affectations) } : {}),
        prenom: this.form.prenom.trim(),
        nom: this.form.nom.trim().toUpperCase(),
        postnom: this.form.postnom.trim().toUpperCase(),
        pieceNumero: this.form.pieceNumero.trim().toUpperCase(),
        numeroOrdre: this.form.numeroOrdre.trim().toUpperCase(),
      }, this.photoFichier);
      this.annulerPhoto();
      this.form = formulaireDepuis(s);
      this.succes = 'Profil enregistré.';
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.enregistrement = false;
    }
  }

  async changerMotDePasse(f: NgForm): Promise<void> {
    if (f.invalid || !this.mdpValide || this.changementMdp) return;
    this.changementMdp = true;
    this.erreurMdp = this.succesMdp = '';
    try {
      await this.session.changerMotDePasse(this.mdp.actuel, this.mdp.nouveau);
      this.mdp = { actuel: '', nouveau: '', confirmation: '' };
      f.resetForm();
      this.succesMdp = 'Mot de passe modifié.';
    } catch (err) {
      this.erreurMdp = messageErreur(err);
    } finally {
      this.changementMdp = false;
    }
  }

  ngOnDestroy(): void {
    this.annulerPhoto();
  }
}
