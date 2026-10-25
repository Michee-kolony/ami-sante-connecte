import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { PrisePhotoComponent } from '../../components/prise-photo.component';
import { AccouchementsService, AlerteSalle, AlertesMaterniteService, NouvellePatienteAdmission, ResumeAccouchement, classeZone } from '../../data/accouchements.service';
import { Doublon, PatientesService, ResumePatiente, doublonsDe } from '../../data/patientes.service';
import { dateHeureChiffres, versSaisieLocale } from '../../data/format';
import { messageErreur } from '../../data/session.service';

type Filtre = 'En cours' | 'Clôturé' | 'Tous';

const nouvelleVide = (): NouvellePatienteAdmission => ({
  nom: '', postnom: '', prenom: '', dateNaissance: '', ageDeclare: null, telephone: '', email: '',
  adresse: { commune: '', quartier: '', avenue: '' },
  contactUrgence: { nom: '', lien: '', telephone: '' },
});

/**
 * Salle de travail : dossiers d'accouchement ouverts (phase, zone du partogramme, alertes),
 * alertes à prendre en charge et admission d'une patiente. Médecins et sages-femmes.
 */
@Component({
  selector: 'app-salle-travail',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, PrisePhotoComponent],
  templateUrl: './salle-travail.component.html',
})
export class SalleTravailComponent implements OnInit {
  /** ?patiente=AC-PAT-… : admission ouverte depuis le dossier de la patiente. */
  @Input() patiente?: string;

  private service = inject(AccouchementsService);
  private patientes = inject(PatientesService);
  private router = inject(Router);
  alertesService = inject(AlertesMaterniteService);
  dateHeure = dateHeureChiffres;
  zone = classeZone;

  filtres: Filtre[] = ['En cours', 'Clôturé', 'Tous'];
  filtre: Filtre = 'En cours';
  dossiers: ResumeAccouchement[] = [];
  chargement = true;
  erreur = '';

  // Admission
  admissionOuverte = false;
  recherche = '';
  resultats: ResumePatiente[] = [];
  rechercheEnCours = false;
  choisie: ResumePatiente | null = null;
  /** Femme venue directement accoucher, sans dossier dans la plateforme (pas de CPN). */
  sansDossier = false;
  nouvelle: NouvellePatienteAdmission = nouvelleVide();
  /** Photo d'identification de la nouvelle patiente (obligatoire, comme à l'enregistrement CPN). */
  photo: File | null = null;
  /** Compte de l'application patiente : mot de passe choisi par elle (même règle que le serveur). */
  compte = { motDePasse: '', confirmation: '' };
  afficherMdp = false;
  /** Dossiers possiblement identiques signalés par le serveur avant de créer la nouvelle patiente. */
  doublons: Doublon[] = [];
  form = { motif: '', admiseLe: '', debutTravail: '', provenance: '' };
  envoi = false;
  erreurAdmission = '';

  async ngOnInit(): Promise<void> {
    this.service.chargerReferentiel().catch(() => undefined);
    await this.charger();
    if (this.patiente) {
      this.ouvrirAdmission();
      this.recherche = this.patiente;
      await this.chercher();
      if (this.resultats.length === 1) this.choisir(this.resultats[0]);
    }
  }

  get referentiel() {
    return this.service.referentiel();
  }

  get stats() {
    const ouverts = this.dossiers.filter(d => d.statut !== 'Clôturé');
    return {
      travail: ouverts.filter(d => d.statut === 'En travail').length,
      postPartum: ouverts.filter(d => d.statut === 'Post-partum').length,
      rouge: ouverts.filter(d => d.zoneActuelle === 'Rouge' && d.statut === 'En travail').length,
      critiques: this.alertesService.actives().filter(a => a.niveau === 'Critique').length,
    };
  }

  async charger(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      const statut = this.filtre === 'En cours' ? undefined : this.filtre;
      [this.dossiers] = await Promise.all([this.service.lister({ statut }), this.alertesService.actualiser()]);
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  changerFiltre(f: Filtre): void {
    this.filtre = f;
    this.charger();
  }

  async acquitter(a: AlerteSalle): Promise<void> {
    try {
      await this.service.acquitter(a.accouchementId, a.id);
      this.alertesService.retirer(a.id);
      this.dossiers = await this.service.lister({ statut: this.filtre === 'En cours' ? undefined : this.filtre });
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  iconeAlerte(code: string): string {
    return { 'BCF': 'fa-heart-pulse', 'Zone jaune': 'fa-triangle-exclamation', 'Stagnation': 'fa-hourglass-half', 'Zone rouge': 'fa-circle-exclamation' }[code] ?? 'fa-bell';
  }

  ouvrirAdmission(): void {
    this.admissionOuverte = true;
    this.erreurAdmission = '';
    this.choisie = null;
    this.resultats = [];
    this.sansDossier = false;
    this.nouvelle = nouvelleVide();
    this.photo = null;
    this.compte = { motDePasse: '', confirmation: '' };
    this.doublons = [];
    this.form ={ motif: '', admiseLe: versSaisieLocale(new Date()), debutTravail: '', provenance: '' };
  }

  async chercher(): Promise<void> {
    if (this.recherche.trim().length < 2) return;
    this.rechercheEnCours = true;
    try {
      this.resultats = (await this.patientes.rechercher(this.recherche, 'Tous', 1, 8)).resultats;
    } catch (err) {
      this.erreurAdmission = messageErreur(err);
    } finally {
      this.rechercheEnCours = false;
    }
  }

  choisir(p: ResumePatiente): void {
    this.choisie = p;
  }

  /** Bascule vers la fiche d'identité rapide, en reprenant le nom tapé dans la recherche. */
  ouvrirSansDossier(): void {
    this.sansDossier = true;
    this.doublons = [];
    this.erreurAdmission = '';
    if (!this.nouvelle.nom && this.recherche.trim() && !/^AC-PAT-|^\+?\d/.test(this.recherche.trim())) {
      const [nom, ...reste] = this.recherche.trim().split(/\s+/);
      this.nouvelle.nom = nom;
      this.nouvelle.prenom = reste.join(' ');
    }
  }

  /** Doublon reconnu : c'est la même femme, on l'admet avec son dossier existant. */
  choisirDoublon(d: Doublon): void {
    this.choisie = { ...d, photoUrl: null, grossesse: null } as unknown as ResumePatiente;
    this.sansDossier = false;
    this.doublons = [];
  }

  get emailInvalide(): boolean {
    return !!this.nouvelle.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.nouvelle.email.trim());
  }

  get reglesMdp(): { label: string; ok: boolean }[] {
    const m = this.compte.motDePasse;
    return [
      { label: '8 caractères au moins', ok: m.length >= 8 },
      { label: 'Au moins une lettre', ok: /[A-Za-z]/.test(m) },
      { label: 'Au moins un chiffre', ok: /\d/.test(m) },
      { label: 'Confirmation identique', ok: !!m && m === this.compte.confirmation },
    ];
  }

  get peutAdmettre(): boolean {
    if (this.sansDossier) {
      return !!this.photo && !!this.nouvelle.nom.trim() && (!!this.nouvelle.dateNaissance || this.nouvelle.ageDeclare != null)
        && !!this.nouvelle.email.trim() && !this.emailInvalide && this.reglesMdp.every(r => r.ok);
    }
    return !!this.choisie;
  }

  async admettre(confirmerMalgreDoublons = false): Promise<void> {
    if (!this.peutAdmettre) return;
    this.envoi = true;
    this.erreurAdmission = '';
    const admission = {
      motif: this.form.motif,
      admiseLe: this.form.admiseLe ? new Date(this.form.admiseLe).toISOString() : undefined,
      debutTravail: this.form.debutTravail ? new Date(this.form.debutTravail).toISOString() : null,
      provenance: this.form.provenance,
    } as never;
    try {
      const d = this.sansDossier
        ? await this.service.admettreSansDossier(this.nouvelle, this.compte.motDePasse, this.photo!, admission, confirmerMalgreDoublons)
        : await this.service.admettre(this.choisie!.id, admission);
      this.router.navigate(['/admin/accouchements', d.numero]);
    } catch (err) {
      const doublons = this.sansDossier ? doublonsDe(err) : null;
      if (doublons) this.doublons = doublons;
      else this.erreurAdmission = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
