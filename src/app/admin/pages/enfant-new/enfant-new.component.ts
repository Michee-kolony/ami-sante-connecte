import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { PrisePhotoComponent } from '../../components/prise-photo.component';
import type { NouvellePatienteAdmission } from '../../data/accouchements.service';
import { DoseCalendrier, EnfantsService, MereEnfant, SaisieEnfantHorsPlateforme, parSeance } from '../../data/enfants.service';
import { Doublon, PatientesService, ResumePatiente, doublonsDe } from '../../data/patientes.service';
import { aujourdhui } from '../../data/format';
import { messageErreur } from '../../data/session.service';

const mereVide = (): NouvellePatienteAdmission => ({
  nom: '', postnom: '', prenom: '', dateNaissance: '', ageDeclare: null, telephone: '', email: '',
  adresse: { commune: '', quartier: '', avenue: '' },
  contactUrgence: { nom: '', lien: '', telephone: '' },
});

const enfantVide = (): SaisieEnfantHorsPlateforme => ({
  nom: '', postnom: '', prenom: '', sexe: '', dateNaissance: '', heureNaissance: '', lieuNaissance: '',
  naissance: { poidsG: null, tailleCm: null, perimetreCranienCm: null },
});

/**
 * Enfant né hors plateforme : sa mère n'a pas suivi ses CPN ni accouché ici, et vient le faire
 * vacciner. Mère retrouvée (dossier existant) ou enregistrée avec lui (photo et compte de
 * l'application patiente), doses déjà reçues recopiées du carnet papier. Tout le personnel.
 */
@Component({
  selector: 'app-enfant-new',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, PrisePhotoComponent],
  templateUrl: './enfant-new.component.html',
})
export class EnfantNewComponent implements OnInit {
  /** ?mere=AC-PAT-… : ouvert depuis le dossier de la mère. */
  @Input() mere?: string;

  private service = inject(EnfantsService);
  private patientes = inject(PatientesService);
  private router = inject(Router);
  aujourdhui = aujourdhui();

  // Mère
  recherche = '';
  resultats: ResumePatiente[] = [];
  rechercheEnCours = false;
  choisie: ResumePatiente | null = null;
  sansDossier = false;
  nouvelle: NouvellePatienteAdmission = mereVide();
  photoMere: File | null = null;
  compte = { motDePasse: '', confirmation: '' };
  afficherMdp = false;
  doublons: Doublon[] = [];

  // Enfant
  enfant: SaisieEnfantHorsPlateforme = enfantVide();
  photo: File | null = null;

  // Doses déjà reçues (carnet papier) : cochées, avec leur date
  seances: { seance: string; doses: DoseCalendrier[] }[] = [];
  recues: Record<string, { coche: boolean; date: string; lieu: string }> = {};

  envoi = false;
  erreur = '';
  /** Enfant possiblement déjà enregistré pour cette mère. */
  enfantExistant: { id: string; numero: string } | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const calendrier = await this.service.chargerCalendrier();
      this.seances = parSeance(calendrier);
      this.recues = Object.fromEntries(calendrier.map(d => [d.code, { coche: false, date: '', lieu: '' }]));
    } catch (err) {
      this.erreur = messageErreur(err);
    }
    if (this.mere) {
      this.recherche = this.mere;
      await this.chercher();
      if (this.resultats.length === 1) this.choisir(this.resultats[0]);
    }
  }

  async chercher(): Promise<void> {
    if (this.recherche.trim().length < 2) return;
    this.rechercheEnCours = true;
    try {
      this.resultats = (await this.patientes.rechercher(this.recherche, 'Tous', 1, 8)).resultats;
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.rechercheEnCours = false;
    }
  }

  choisir(p: ResumePatiente): void {
    this.choisie = p;
    this.sansDossier = false;
    this.doublons = [];
    if (!this.enfant.nom) this.enfant.nom = p.nom;
  }

  /** Mère sans dossier : fiche d'identité rapide, en reprenant le nom tapé dans la recherche. */
  ouvrirSansDossier(): void {
    this.sansDossier = true;
    this.choisie = null;
    this.doublons = [];
    this.erreur = '';
    if (!this.nouvelle.nom && this.recherche.trim() && !/^AC-PAT-|^\+?\d/.test(this.recherche.trim())) {
      const [nom, ...reste] = this.recherche.trim().split(/\s+/);
      this.nouvelle.nom = nom;
      this.nouvelle.prenom = reste.join(' ');
    }
  }

  /** Doublon reconnu : c'est la même mère, on rattache l'enfant à son dossier existant. */
  choisirDoublon(d: Doublon): void {
    this.choisir({ ...d, photoUrl: null, grossesse: null } as unknown as ResumePatiente);
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

  get mereComplete(): boolean {
    if (this.choisie) return true;
    return this.sansDossier && !!this.photoMere && !!this.nouvelle.nom.trim()
      && (!!this.nouvelle.dateNaissance || this.nouvelle.ageDeclare != null)
      && !!this.nouvelle.email.trim() && !this.emailInvalide && this.reglesMdp.every(r => r.ok);
  }

  get dosesCochees(): string[] {
    return Object.keys(this.recues).filter(c => this.recues[c].coche);
  }

  /** Doses cochées sans date, ou datées avant la naissance / dans le futur. */
  get dosesIncompletes(): boolean {
    return this.dosesCochees.some(c => {
      const date = this.recues[c].date;
      return !date || date > this.aujourdhui || (!!this.enfant.dateNaissance && date < this.enfant.dateNaissance);
    });
  }

  /** Ce qui manque encore pour enregistrer (affiché sous le bouton). */
  get manquants(): string[] {
    const m: string[] = [];
    if (!this.mereComplete) m.push(this.sansDossier && !this.photoMere ? 'photo de la mère' : 'mère');
    if (!this.photo) m.push('photo de l’enfant');
    if (!this.enfant.sexe) m.push('sexe');
    if (!this.enfant.dateNaissance) m.push('date de naissance');
    if (this.dosesIncompletes) m.push('dates des doses déjà reçues');
    return m;
  }

  /** Coche une séance entière (même date pour toutes ses doses, la date de la première remplie). */
  cocherSeance(doses: DoseCalendrier[], coche: boolean): void {
    const date = doses.map(d => this.recues[d.code].date).find(Boolean) ?? '';
    for (const d of doses) this.recues[d.code] = { ...this.recues[d.code], coche, date: this.recues[d.code].date || date };
  }

  seanceCochee(doses: DoseCalendrier[]): boolean {
    return doses.every(d => this.recues[d.code].coche);
  }

  /** Date saisie sur une dose : reprise par les autres doses cochées de la même séance encore vides. */
  dater(doses: DoseCalendrier[], code: string, date: string): void {
    this.recues[code].date = date;
    for (const d of doses) if (d.code !== code && this.recues[d.code].coche && !this.recues[d.code].date) this.recues[d.code].date = date;
  }

  async enregistrer(confirmerMalgreDoublons = false): Promise<void> {
    if (this.manquants.length || this.envoi) return;
    this.envoi = true;
    this.erreur = '';
    this.enfantExistant = null;
    const mere: MereEnfant = this.choisie
      ? { mereId: this.choisie.id }
      : { nouvelleMere: this.nouvelle, motDePasse: this.compte.motDePasse, photoMere: this.photoMere! };
    const doses = this.dosesCochees.map(code => ({ code, date: this.recues[code].date, lieu: this.recues[code].lieu || this.enfant.lieuNaissance }));
    try {
      const e = await this.service.enregistrerHorsPlateforme(this.enfant, mere, this.photo!, doses, confirmerMalgreDoublons);
      this.router.navigate(['/admin/enfants', e.numero]);
    } catch (err) {
      const doublons = this.sansDossier ? doublonsDe(err) : null;
      if (doublons) this.doublons = doublons;
      else if (err instanceof HttpErrorResponse && err.status === 409 && err.error?.enfantExistant) {
        this.enfantExistant = err.error.enfantExistant;
        this.erreur = messageErreur(err);
      } else this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
