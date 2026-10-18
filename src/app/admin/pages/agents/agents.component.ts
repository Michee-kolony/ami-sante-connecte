import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AvatarComponent } from '../../components/avatar.component';
import { Agent, AgentsService, FonctionAgent } from '../../data/agents.service';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

function formulaireVide() {
  return {
    prenom: '', nom: '', postnom: '', sexe: 'F' as 'F' | 'M',
    fonction: 'Vaccinateur' as FonctionAgent,
    telephone: '', email: '', aire: 'AS Camp Tshatshi',
    motDePasse: '', confirmation: '',
    doitChangerMotDePasse: true,
  };
}

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  templateUrl: './agents.component.html',
})
export class AgentsComponent implements OnDestroy {
  private service = inject(AgentsService);
  agents = this.service.agents;

  fonctions: FonctionAgent[] = ['Vaccinateur', 'Superviseur vaccination', 'Relais communautaire'];
  aires = ['AS Camp Tshatshi', 'AS Kokolo'];

  // --- Liste -----------------------------------------------------------------
  recherche = signal('');
  filtreFonction = signal<'Toutes' | FonctionAgent>('Toutes');

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.agents().filter(a => {
      const okFonction = this.filtreFonction() === 'Toutes' || a.fonction === this.filtreFonction();
      const texte = `${a.prenom} ${a.nom} ${a.postnom} ${a.matricule} ${a.email} ${a.telephone}`.toLowerCase();
      return okFonction && (!q || texte.includes(q));
    });
  });

  stats = computed(() => {
    const liste = this.agents();
    return {
      total: liste.length,
      actifs: liste.filter(a => a.statut === 'Actif').length,
      vaccinateurs: liste.filter(a => a.fonction === 'Vaccinateur').length,
      vaccinations: liste.reduce((s, a) => s + a.vaccinationsMois, 0),
    };
  });

  // --- Formulaire d'ajout ------------------------------------------------------
  panneauOuvert = false;
  form = formulaireVide();
  afficherMdp = false;
  photoApercu: string | null = null;
  photoErreur = '';
  notification: string | null = null;
  private timerNotif?: ReturnType<typeof setTimeout>;

  get matriculePropose(): string {
    return this.service.prochainMatricule(this.form.fonction);
  }

  get emailDejaUtilise(): boolean {
    return !!this.form.email && this.service.emailExiste(this.form.email);
  }

  /** Règles du mot de passe affichées sous le champ. */
  get regles() {
    const m = this.form.motDePasse;
    return [
      { ok: m.length >= 10, texte: 'Au moins 10 caractères' },
      { ok: /[A-Z]/.test(m) && /[a-z]/.test(m), texte: 'Majuscules et minuscules' },
      { ok: /\d/.test(m), texte: 'Au moins un chiffre' },
      { ok: /[^A-Za-z0-9]/.test(m), texte: 'Au moins un caractère spécial' },
    ];
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

  ouvrir(): void {
    this.form = formulaireVide();
    this.retirerPhoto();
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
    this.photoApercu = URL.createObjectURL(fichier);
  }

  retirerPhoto(): void {
    if (this.photoApercu) URL.revokeObjectURL(this.photoApercu);
    this.photoApercu = null;
  }

  /** Génère un mot de passe temporaire solide (sans caractères ambigus). */
  genererMotDePasse(): void {
    const groupes = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
    const tous = groupes.join('');
    const hasard = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    const car = groupes.map(g => g[hasard(g.length)]);
    while (car.length < 12) car.push(tous[hasard(tous.length)]);
    for (let i = car.length - 1; i > 0; i--) {
      const j = hasard(i + 1);
      [car[i], car[j]] = [car[j], car[i]];
    }
    this.form.motDePasse = this.form.confirmation = car.join('');
    this.afficherMdp = true;
  }

  enregistrer(f: NgForm): void {
    if (f.invalid || this.emailDejaUtilise || !this.motDePasseValide || !this.confirmationOk) return;
    // TODO serveur : envoyer { ...agent, motDePasse } en HTTPS ; le serveur crée le compte et hache le mot de passe.
    const agent = this.service.ajouter({
      matricule: this.matriculePropose,
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim().toUpperCase(),
      postnom: this.form.postnom.trim().toUpperCase(),
      sexe: this.form.sexe,
      fonction: this.form.fonction,
      telephone: this.form.telephone.trim(),
      email: this.form.email.trim().toLowerCase(),
      aire: this.form.aire,
      statut: 'Actif',
      photo: this.photoApercu ?? undefined,
      vaccinationsMois: 0,
      derniereConnexion: null,
      doitChangerMotDePasse: this.form.doitChangerMotDePasse,
    });
    this.photoApercu = null; // l'aperçu appartient désormais à l'agent créé
    this.fermer();
    this.notifier(`Compte créé pour ${agent.prenom} ${agent.nom}. Communiquez-lui ses identifiants de façon sécurisée.`);
  }

  basculer(a: Agent): void {
    this.service.basculerStatut(a.id);
    this.notifier(a.statut === 'Actif'
      ? `L’accès de ${a.prenom} ${a.nom} est suspendu.`
      : `L’accès de ${a.prenom} ${a.nom} est réactivé.`);
  }

  reinitialiser(a: Agent): void {
    this.notifier(`Un lien de réinitialisation du mot de passe sera envoyé à ${a.email}.`);
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
