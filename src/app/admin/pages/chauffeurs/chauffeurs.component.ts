import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AvatarComponent } from '../../components/avatar.component';
import { CarteService, Chauffeur, FlotteService, LIBELLE_STATUT, StatutChauffeur, joursAvant } from '../../data/flotte.service';
import { messageErreur } from '../../data/session.service';
import { genererMotDePasse, reglesMotDePasse } from '../../../shared/mot-de-passe';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

function formulaireVide() {
  return {
    prenom: '', nom: '', postnom: '', telephone: '', permis: '', permisExpire: '', ambulanceId: null as string | null,
    motDePasse: '', confirmation: '', doitChangerMotDePasse: true,
  };
}

const echapper = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  templateUrl: './chauffeurs.component.html',
})
export class ChauffeursComponent implements OnDestroy {
  flotte = inject(FlotteService);
  chauffeurs = this.flotte.chauffeurs;
  libelleStatut = LIBELLE_STATUT;

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
    this.flotte.affectations();
    return {
      total: liste.length,
      actifs: liste.filter(c => c.statut === 'Actif').length,
      mission: liste.filter(c => this.flotte.disponibilite(c) === 'Occupé').length,
      permis: liste.filter(c => joursAvant(c.permisExpire) <= 60).length,
    };
  });

  joursPermis(c: Chauffeur): number {
    return joursAvant(c.permisExpire);
  }

  async basculer(c: Chauffeur): Promise<void> {
    if (this.flotte.disponibilite(c) === 'Occupé') return;
    const actif = c.statut === 'Actif';
    try {
      await this.flotte.basculerChauffeur(c.id);
      this.notifier(actif
        ? `${c.prenom} ${c.nom} est suspendu, déconnecté de l’application et retiré de son ambulance.`
        : `${c.prenom} ${c.nom} est de nouveau actif. Affectez-lui une ambulance depuis la page Ambulances.`);
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  // --- Formulaire d'ajout ------------------------------------------------------
  panneauOuvert = false;
  form = formulaireVide();
  photoApercu: string | null = null;
  private photoFichier: File | null = null;
  photoErreur = '';
  erreur = '';
  notification: string | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  /** Ambulances pouvant recevoir le nouveau chauffeur (pas en mission). */
  ambulancesAffectables = computed(() => this.flotte.ambulances().filter(a => a.statut !== 'En mission'));

  afficherMdp = false;
  enregistrement = false;
  /** Mot de passe temporaire affiché une seule fois après une réinitialisation. */
  identifiants: { nom: string; matricule: string; motDePasse: string } | null = null;

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

  /** Nouveau mot de passe temporaire (généré par le serveur), à remettre au chauffeur en personne. */
  async reinitialiser(c: Chauffeur): Promise<void> {
    try {
      const r = await this.flotte.reinitialiserMotDePasse(c.id);
      this.identifiants = { nom: `${c.prenom} ${c.nom}`, ...r };
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  copier(texte: string): void {
    navigator.clipboard?.writeText(texte);
  }

  get permisExiste(): boolean {
    const p = this.form.permis.trim().toUpperCase();
    return !!p && this.chauffeurs().some(c => c.permis === p);
  }

  ouvrir(): void {
    this.form = formulaireVide();
    this.retirerPhoto();
    this.afficherMdp = false;
    this.erreur = '';
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
    if (f.invalid || !this.photoFichier || this.permisExiste || !this.motDePasseValide || !this.confirmationOk || this.enregistrement) return;
    this.enregistrement = true;
    this.erreur = '';
    try {
      const c = await this.flotte.ajouterChauffeur({
        prenom: this.form.prenom.trim(),
        nom: this.form.nom.trim().toUpperCase(),
        postnom: this.form.postnom.trim().toUpperCase(),
        telephone: this.form.telephone.trim(),
        permis: this.form.permis.trim().toUpperCase(),
        permisExpire: this.form.permisExpire,
        motDePasse: this.form.motDePasse,
        doitChangerMotDePasse: this.form.doitChangerMotDePasse,
        ambulance: this.form.ambulanceId,
      }, this.photoFichier);
      this.retirerPhoto();
      this.fermer();
      this.notifier(`Compte créé pour ${c.prenom} ${c.nom}. Identifiant de l’application ami-connecte-chauffeur : ${c.matricule}. Remettez-lui son mot de passe en personne.`);
    } catch (err) {
      this.erreur = messageErreur(err);
      this.fermer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.enregistrement = false;
    }
  }

  // --- Carte de service --------------------------------------------------------
  carte = signal<CarteService | null>(null);

  async ouvrirCarte(c: Chauffeur): Promise<void> {
    try {
      this.carte.set(await this.flotte.carteService(c.id));
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  /** Impression dans une fenêtre dédiée : la carte seule, au format carte bancaire. */
  imprimerCarte(k: CarteService): void {
    const c = k.chauffeur;
    const e = (t: string | null | undefined) => echapper(t ?? '');
    const photo = c.photo
      ? `<img class="photo" src="${e(c.photo)}" alt="">`
      : `<div class="photo initiales">${e(c.prenom.charAt(0) + c.nom.charAt(0))}</div>`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Carte de service ${e(c.matricule)}</title>
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: system-ui, sans-serif; }
  .carte { width: 85.6mm; height: 54mm; padding: 3.5mm 4mm; color: #fff; background: linear-gradient(135deg, #0055a5, #003366); position: relative; overflow: hidden; }
  .entete { display: flex; justify-content: space-between; font-size: 6.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
  .corps { display: flex; gap: 3mm; margin-top: 3mm; }
  .photo { width: 17mm; height: 21mm; object-fit: cover; border-radius: 2mm; border: .5mm solid rgba(255,255,255,.8); background: #fff; }
  .initiales { display: flex; align-items: center; justify-content: center; color: #003366; font-size: 16pt; font-weight: 700; }
  .infos { flex: 1; min-width: 0; line-height: 1.25; }
  .nom { font-size: 10pt; font-weight: 800; }
  .petit { font-size: 6.5pt; opacity: .85; }
  .matricule { font-family: ui-monospace, monospace; font-size: 8.5pt; font-weight: 700; margin-top: 1mm; }
  .qr { width: 17mm; height: 17mm; background: #fff; padding: .6mm; border-radius: 1mm; align-self: flex-end; }
  .pied { position: absolute; left: 4mm; right: 4mm; bottom: 2.5mm; display: flex; justify-content: space-between; font-size: 5.5pt; opacity: .8; }
</style></head><body>
<div class="carte">
  <div class="entete"><span>AMI Santé Connect</span><span>Carte de service</span></div>
  <div class="corps">
    ${photo}
    <div class="infos">
      <div class="nom">${e(c.prenom)} ${e(c.nom)}</div>
      ${c.postnom ? `<div class="petit">${e(c.postnom)}</div>` : ''}
      <div class="petit" style="margin-top:1mm">Chauffeur ambulancier</div>
      <div class="matricule">${e(c.matricule)}</div>
      <div class="petit">${c.ambulance ? `${e(c.ambulance.code)} · ${e(c.ambulance.immatriculation)}` : 'Sans ambulance attitrée'}</div>
    </div>
    <img class="qr" src="${k.qr}" alt="">
  </div>
  <div class="pied"><span>Émise le ${e(k.emiseLe.split('-').reverse().join('/'))} · Tél. ${e(c.telephone)}</span><span>${e(k.controle)}</span></div>
</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
    const fenetre = window.open('', '_blank', 'width=480,height=360');
    if (!fenetre) {
      this.erreur = 'Fenêtre d’impression bloquée : autorisez les fenêtres surgissantes pour ce site.';
      return;
    }
    fenetre.document.write(html);
    fenetre.document.close();
  }

  private notifier(message: string): void {
    this.notification = message;
    clearTimeout(this.timerNotif);
    this.timerNotif = setTimeout(() => (this.notification = null), 6000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timerNotif);
    document.body.style.overflow = '';
  }
}
