import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { AccouchementsService, AlerteSalle, AlertesMaterniteService, ResumeAccouchement, classeZone } from '../../data/accouchements.service';
import { PatientesService, ResumePatiente } from '../../data/patientes.service';
import { dateHeureChiffres, versSaisieLocale } from '../../data/format';
import { messageErreur } from '../../data/session.service';

type Filtre = 'En cours' | 'Clôturé' | 'Tous';

/**
 * Salle de travail : dossiers d'accouchement ouverts (phase, zone du partogramme, alertes),
 * alertes à prendre en charge et admission d'une patiente. Médecins et sages-femmes.
 */
@Component({
  selector: 'app-salle-travail',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
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
    this.form = { motif: '', admiseLe: versSaisieLocale(new Date()), debutTravail: '', provenance: '' };
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

  async admettre(): Promise<void> {
    if (!this.choisie) return;
    this.envoi = true;
    this.erreurAdmission = '';
    try {
      const d = await this.service.admettre(this.choisie.id, {
        motif: this.form.motif,
        admiseLe: this.form.admiseLe ? new Date(this.form.admiseLe).toISOString() : undefined,
        debutTravail: this.form.debutTravail ? new Date(this.form.debutTravail).toISOString() : null,
        provenance: this.form.provenance,
      } as never);
      this.router.navigate(['/admin/accouchements', d.numero]);
    } catch (err) {
      this.erreurAdmission = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
