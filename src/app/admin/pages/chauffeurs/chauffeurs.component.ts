import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AvatarComponent } from '../../components/avatar.component';
import { Chauffeur, FlotteService, StatutChauffeur, joursAvant } from '../../data/flotte.service';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

function formulaireVide() {
  return { prenom: '', nom: '', postnom: '', telephone: '', permis: '', permisExpire: '', ambulanceId: null as string | null };
}

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  templateUrl: './chauffeurs.component.html',
})
export class ChauffeursComponent implements OnDestroy {
  flotte = inject(FlotteService);
  chauffeurs = this.flotte.chauffeurs;

  // --- Liste -----------------------------------------------------------------
  recherche = signal('');
  filtreStatut = signal<'Tous' | StatutChauffeur>('Tous');

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.chauffeurs().filter(c => {
      const texte = `${c.prenom} ${c.nom} ${c.postnom} ${c.matricule} ${c.telephone} ${c.permis}`.toLowerCase();
      return (this.filtreStatut() === 'Tous' || c.statut === this.filtreStatut()) && (!q || texte.includes(q));
    });
  });

  stats = computed(() => {
    const liste = this.chauffeurs();
    const affectations = this.flotte.affectations();
    return {
      total: liste.length,
      actifs: liste.filter(c => c.statut === 'Actif').length,
      mission: liste.filter(c => affectations.get(c.id)?.statut === 'En mission').length,
      permis: liste.filter(c => joursAvant(c.permisExpire) <= 60).length,
    };
  });

  joursPermis(c: Chauffeur): number {
    return joursAvant(c.permisExpire);
  }

  basculer(c: Chauffeur): void {
    if (this.flotte.affectations().get(c.id)?.statut === 'En mission') return;
    this.flotte.basculerChauffeur(c.id);
    this.notifier(c.statut === 'Actif'
      ? `${c.prenom} ${c.nom} est suspendu et retiré de son ambulance.`
      : `${c.prenom} ${c.nom} est de nouveau actif. Affectez-lui une ambulance depuis la page Ambulances.`);
  }

  // --- Formulaire d'ajout ------------------------------------------------------
  panneauOuvert = false;
  form = formulaireVide();
  photoApercu: string | null = null;
  photoErreur = '';
  notification: string | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  /** Ambulances pouvant recevoir le nouveau chauffeur (pas en mission). */
  ambulancesAffectables = computed(() => this.flotte.ambulances().filter(a => a.statut !== 'En mission'));

  get permisExiste(): boolean {
    const p = this.form.permis.trim().toUpperCase();
    return !!p && this.chauffeurs().some(c => c.permis === p);
  }

  ouvrir(): void {
    this.form = formulaireVide();
    this.retirerPhoto();
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
    this.photoApercu = URL.createObjectURL(fichier);
  }

  retirerPhoto(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
    this.photoApercu = null;
  }

  enregistrer(f: NgForm): void {
    if (f.invalid || this.permisExiste) return;
    const c = this.flotte.ajouterChauffeur({
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim().toUpperCase(),
      postnom: this.form.postnom.trim().toUpperCase(),
      telephone: this.form.telephone.trim(),
      photo: this.photoApercu ?? undefined,
      permis: this.form.permis.trim().toUpperCase(),
      permisExpire: this.form.permisExpire,
    });
    if (this.form.ambulanceId) this.flotte.affecterChauffeur(this.form.ambulanceId, c.id);
    this.photoApercu = null; // l'aperçu appartient désormais au chauffeur créé
    this.fermer();
    this.notifier(`${c.prenom} ${c.nom} (${c.matricule}) a été ajouté aux chauffeurs.`);
  }

  private notifier(message: string): void {
    this.notification = message;
    clearTimeout(this.timerNotif);
    this.timerNotif = setTimeout(() => (this.notification = null), 5000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timerNotif);
    document.body.style.overflow = '';
  }
}
