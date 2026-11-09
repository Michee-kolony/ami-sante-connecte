import { Component, Input } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { DonneesMedecinChef } from '../data/etablissements.service';
import { GRADES, PIECES_IDENTITE, SPECIALITES } from '../data/soignants.service';

/** Identité vide du médecin chef d'un nouvel établissement. */
export function medecinChefVide(): DonneesMedecinChef {
  return {
    prenom: '', nom: '', postnom: '', sexe: '', dateNaissance: '', lieuNaissance: '', nationalite: 'Congolaise',
    pieceType: '', pieceNumero: '', adresse: '', telephone: '', numeroOrdre: '',
    grade: 'Médecin généraliste', specialite: 'Médecine générale', email: '',
  };
}

/** Données envoyées au serveur (textes nettoyés). */
export function medecinChefNettoye(c: DonneesMedecinChef): DonneesMedecinChef {
  const t = (v: string) => v.trim();
  return {
    ...c, prenom: t(c.prenom), nom: t(c.nom), postnom: t(c.postnom), lieuNaissance: t(c.lieuNaissance), nationalite: t(c.nationalite),
    pieceNumero: t(c.pieceNumero), adresse: t(c.adresse), telephone: t(c.telephone), numeroOrdre: t(c.numeroOrdre),
    email: t(c.email).toLowerCase(),
  };
}

/**
 * Champs d'identité du médecin chef, enregistrés par le comité de pilotage avec l'établissement.
 * Les champs s'inscrivent dans le formulaire parent (validation commune).
 */
@Component({
  selector: 'app-champs-medecin-chef',
  standalone: true,
  imports: [FormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  template: `
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label class="label" for="mc-prenom">Prénom <span class="req">*</span></label>
        <input id="mc-prenom" name="mcPrenom" class="input" required [(ngModel)]="chef.prenom" #prenom="ngModel"
               [class.border-rose-400]="prenom.invalid && (prenom.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-nom">Nom <span class="req">*</span></label>
        <input id="mc-nom" name="mcNom" class="input uppercase" required [(ngModel)]="chef.nom" #nom="ngModel"
               [class.border-rose-400]="nom.invalid && (nom.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-postnom">Postnom</label>
        <input id="mc-postnom" name="mcPostnom" class="input uppercase" [(ngModel)]="chef.postnom">
      </div>
      <div>
        <label class="label" for="mc-sexe">Sexe <span class="req">*</span></label>
        <select id="mc-sexe" name="mcSexe" class="input" required [(ngModel)]="chef.sexe" #sexe="ngModel"
                [class.border-rose-400]="sexe.invalid && (sexe.touched || soumis)">
          <option value="" disabled>Choisir…</option>
          <option value="F">Femme</option>
          <option value="M">Homme</option>
        </select>
      </div>
      <div>
        <label class="label" for="mc-ddn">Date de naissance <span class="req">*</span></label>
        <input id="mc-ddn" name="mcDdn" type="date" class="input" required [(ngModel)]="chef.dateNaissance" #ddn="ngModel"
               [class.border-rose-400]="ddn.invalid && (ddn.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-lieu">Lieu de naissance <span class="req">*</span></label>
        <input id="mc-lieu" name="mcLieu" class="input" required [(ngModel)]="chef.lieuNaissance" #lieu="ngModel"
               [class.border-rose-400]="lieu.invalid && (lieu.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-nat">Nationalité <span class="req">*</span></label>
        <input id="mc-nat" name="mcNat" class="input" required [(ngModel)]="chef.nationalite" #nat="ngModel"
               [class.border-rose-400]="nat.invalid && (nat.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-piece">Pièce d’identité <span class="req">*</span></label>
        <select id="mc-piece" name="mcPiece" class="input" required [(ngModel)]="chef.pieceType" #piece="ngModel"
                [class.border-rose-400]="piece.invalid && (piece.touched || soumis)">
          <option value="" disabled>Choisir…</option>
          @for (p of pieces; track p) { <option [value]="p">{{ p }}</option> }
        </select>
      </div>
      <div>
        <label class="label" for="mc-piece-num">N° de la pièce</label>
        <input id="mc-piece-num" name="mcPieceNum" class="input uppercase" [(ngModel)]="chef.pieceNumero">
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="mc-adresse">Adresse <span class="req">*</span></label>
        <input id="mc-adresse" name="mcAdresse" class="input" required [(ngModel)]="chef.adresse" #adresse="ngModel"
               [class.border-rose-400]="adresse.invalid && (adresse.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-tel">Téléphone <span class="req">*</span></label>
        <input id="mc-tel" name="mcTel" type="tel" class="input" required placeholder="+243 …" [(ngModel)]="chef.telephone" #tel="ngModel"
               [class.border-rose-400]="tel.invalid && (tel.touched || soumis)">
      </div>
      <div>
        <label class="label" for="mc-grade">Grade <span class="req">*</span></label>
        <select id="mc-grade" name="mcGrade" class="input" required [(ngModel)]="chef.grade">
          @for (g of grades; track g) { <option [value]="g">{{ g }}</option> }
        </select>
      </div>
      <div>
        <label class="label" for="mc-spe">Spécialité <span class="req">*</span></label>
        <select id="mc-spe" name="mcSpe" class="input" required [(ngModel)]="chef.specialite">
          @for (s of specialites; track s) { <option [value]="s">{{ s }}</option> }
        </select>
      </div>
      <div>
        <label class="label" for="mc-ordre">N° d’Ordre (CNOM)</label>
        <input id="mc-ordre" name="mcOrdre" class="input uppercase" [(ngModel)]="chef.numeroOrdre">
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="mc-email">E-mail de connexion <span class="req">*</span></label>
        <input id="mc-email" name="mcEmail" type="email" class="input" required email autocomplete="off" [(ngModel)]="chef.email" #mail="ngModel"
               [class.border-rose-400]="mail.invalid && (mail.touched || soumis)">
        <p class="hint">Un mot de passe temporaire est généré : il s’affichera une seule fois, à remettre au médecin chef, qui le changera à sa première connexion.</p>
      </div>
    </div>
  `,
})
export class ChampsMedecinChefComponent {
  @Input({ required: true }) chef!: DonneesMedecinChef;
  /** Formulaire déjà soumis : les champs invalides sont signalés. */
  @Input() soumis = false;

  readonly pieces = PIECES_IDENTITE;
  readonly grades = GRADES['Médecin'];
  readonly specialites = SPECIALITES['Médecin'];
}
