import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ComiteSessionService, ProfilComite } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';

const PHOTO_MAX_OCTETS = 2 * 1024 * 1024;

/** Profil du membre du comité : photo, informations et mot de passe. */
@Component({
  selector: 'app-comite-compte',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mon profil</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Ces informations sont visibles par les autres membres du comité de pilotage.</p>
      </div>

      @if (session.membre(); as m) {
        @if (m.doitChangerMotDePasse) {
          <div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
            <i class="fa-solid fa-key mt-0.5"></i>
            <span>Votre mot de passe vous a été remis : choisissez-en un personnel (en bas de cette page) avant d’accéder aux autres pages.</span>
          </div>
        }

        <!-- Carte d'identité -->
        <div class="card overflow-hidden">
          <div class="h-28 bg-gradient-to-r from-brand-700 via-brand-600 to-accent-600"></div>
          <div class="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
            <div class="relative -mt-14 h-28 w-28 flex-none">
              @if (apercu || (m.photo && !retirer)) {
                <img [src]="apercu || m.photo" alt="Photo de profil" class="h-28 w-28 rounded-2xl object-cover shadow-lg ring-4 ring-white dark:ring-slate-900">
              } @else {
                <span class="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 text-3xl font-bold text-brand-700 shadow-lg ring-4 ring-white dark:from-brand-500/30 dark:to-accent-500/20 dark:text-brand-200 dark:ring-slate-900">{{ m.prenom.charAt(0) }}{{ m.nom.charAt(0) }}</span>
              }
              <label class="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white transition hover:bg-brand-700 dark:ring-slate-900" title="Changer la photo">
                <i class="fa-solid fa-camera"></i>
                <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" (change)="choisirPhoto($event)">
              </label>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xl font-bold text-slate-900 dark:text-white">{{ m.prenom }} {{ m.nom }}</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ m.fonction || 'Membre du comité de pilotage' }}@if (m.organisation) { · {{ m.organisation }} }</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400"><i class="fa-solid fa-envelope mr-1"></i>{{ m.email }}</p>
            </div>
            @if (m.photo && !retirer && !apercu) {
              <button type="button" class="btn-ghost text-xs text-rose-600" (click)="retirer = true"><i class="fa-solid fa-trash"></i> Retirer la photo</button>
            }
          </div>
          @if (photoErreur) { <p class="px-6 pb-4 text-sm text-rose-600 dark:text-rose-400">{{ photoErreur }}</p> }
          @if (apercu || retirer) { <p class="px-6 pb-4 text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-circle-info mr-1"></i>Enregistrez le profil pour appliquer le changement de photo.</p> }
        </div>

        <!-- Informations -->
        <form class="card space-y-5 p-6" #fp="ngForm" (ngSubmit)="enregistrer(fp)" novalidate>
          <h2 class="card-title"><i class="fa-solid fa-id-card text-brand-600 dark:text-brand-400"></i> Mes informations</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="p-prenom">Prénom <span class="req">*</span></label>
              <input id="p-prenom" name="prenom" class="input" required [(ngModel)]="profil.prenom">
            </div>
            <div>
              <label class="label" for="p-nom">Nom <span class="req">*</span></label>
              <input id="p-nom" name="nom" class="input uppercase" required [(ngModel)]="profil.nom">
            </div>
            <div>
              <label class="label" for="p-sexe">Sexe</label>
              <select id="p-sexe" name="sexe" class="input" [(ngModel)]="profil.sexe">
                <option value="">Non précisé</option>
                <option value="F">Femme</option>
                <option value="M">Homme</option>
              </select>
            </div>
            <div>
              <label class="label" for="p-tel">Téléphone</label>
              <input id="p-tel" name="telephone" type="tel" class="input" placeholder="+243 …" [(ngModel)]="profil.telephone">
            </div>
            <div>
              <label class="label" for="p-fonction">Fonction au comité</label>
              <input id="p-fonction" name="fonction" class="input" placeholder="Président, secrétaire, membre…" [(ngModel)]="profil.fonction">
            </div>
            <div>
              <label class="label" for="p-org">Institution représentée</label>
              <input id="p-org" name="organisation" class="input" placeholder="Ministère, partenaire, hôpital…" [(ngModel)]="profil.organisation">
            </div>
          </div>
          @if (erreurProfil) { <p class="text-sm text-rose-600 dark:text-rose-400" role="alert">{{ erreurProfil }}</p> }
          @if (profilEnregistre) { <p class="text-sm text-accent-700 dark:text-accent-300" role="status"><i class="fa-solid fa-circle-check mr-1"></i>Profil enregistré.</p> }
          <div class="flex justify-end">
            <button type="submit" class="btn-primary" [disabled]="envoiProfil"><i class="fa-solid" [class]="envoiProfil ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i> Enregistrer le profil</button>
          </div>
        </form>
      }

      <!-- Mot de passe -->
      <form class="card space-y-4 p-6" #f="ngForm" (ngSubmit)="changer(f)" novalidate>
        <h2 class="card-title"><i class="fa-solid fa-lock text-brand-600 dark:text-brand-400"></i> Changer mon mot de passe</h2>
        <div>
          <label class="label" for="mdp-actuel">Mot de passe actuel</label>
          <input id="mdp-actuel" name="actuel" type="password" class="input" required autocomplete="current-password" [(ngModel)]="actuel">
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="mdp-nouveau">Nouveau mot de passe</label>
            <input id="mdp-nouveau" name="nouveau" type="password" class="input" required autocomplete="new-password" [(ngModel)]="nouveau">
          </div>
          <div>
            <label class="label" for="mdp-confirmation">Confirmation</label>
            <input id="mdp-confirmation" name="confirmation" type="password" class="input" required autocomplete="new-password" [(ngModel)]="confirmation">
          </div>
        </div>
        <p class="hint">10 caractères au moins, avec majuscule, minuscule, chiffre et caractère spécial.</p>
        @if (erreur) { <p class="text-sm text-rose-600 dark:text-rose-400" role="alert">{{ erreur }}</p> }
        @if (succes) { <p class="text-sm text-accent-700 dark:text-accent-300" role="status"><i class="fa-solid fa-circle-check mr-1"></i>Mot de passe modifié.</p> }
        <div class="flex justify-end">
          <button type="submit" class="btn-primary" [disabled]="envoi"><i class="fa-solid" [class]="envoi ? 'fa-spinner fa-spin' : 'fa-key'"></i> Changer le mot de passe</button>
        </div>
      </form>
    </div>
  `,
})
export class ComiteCompteComponent implements OnDestroy {
  session = inject(ComiteSessionService);

  // --- Profil -----------------------------------------------------------------------
  profil: ProfilComite = this.profilActuel();
  photo: File | null = null;
  apercu: string | null = null;
  retirer = false;
  photoErreur = '';
  envoiProfil = false;
  erreurProfil = '';
  profilEnregistre = false;

  private profilActuel(): ProfilComite {
    const m = this.session.membre();
    return { prenom: m?.prenom ?? '', nom: m?.nom ?? '', sexe: m?.sexe ?? '', fonction: m?.fonction ?? '', organisation: m?.organisation ?? '', telephone: m?.telephone ?? '' };
  }

  choisirPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    this.photoErreur = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      this.photoErreur = 'Format accepté : JPG, PNG ou WebP.';
      return;
    }
    if (f.size > PHOTO_MAX_OCTETS) {
      this.photoErreur = 'La photo dépasse 2 Mo.';
      return;
    }
    this.libererApercu();
    this.photo = f;
    this.apercu = URL.createObjectURL(f);
    this.retirer = false;
  }

  async enregistrer(f: NgForm): Promise<void> {
    this.erreurProfil = '';
    this.profilEnregistre = false;
    if (f.invalid) {
      this.erreurProfil = 'Le prénom et le nom sont obligatoires.';
      return;
    }
    this.envoiProfil = true;
    try {
      const p = this.profil;
      await this.session.modifierProfil({ ...p, prenom: p.prenom.trim(), nom: p.nom.trim() }, this.photo, this.retirer);
      this.photo = null;
      this.retirer = false;
      this.libererApercu();
      this.profil = this.profilActuel();
      this.profilEnregistre = true;
    } catch (err) {
      this.erreurProfil = messageErreur(err);
    } finally {
      this.envoiProfil = false;
    }
  }

  private libererApercu(): void {
    if (this.apercu) URL.revokeObjectURL(this.apercu);
    this.apercu = null;
  }

  // --- Mot de passe -------------------------------------------------------------------
  actuel = '';
  nouveau = '';
  confirmation = '';
  envoi = false;
  erreur = '';
  succes = false;

  async changer(f: NgForm): Promise<void> {
    this.erreur = '';
    this.succes = false;
    if (f.invalid) {
      this.erreur = 'Remplissez les trois champs.';
      return;
    }
    if (this.nouveau !== this.confirmation) {
      this.erreur = 'La confirmation ne correspond pas au nouveau mot de passe.';
      return;
    }
    this.envoi = true;
    try {
      await this.session.changerMotDePasse(this.actuel, this.nouveau);
      this.succes = true;
      f.resetForm();
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  ngOnDestroy(): void {
    this.libererApercu();
  }
}
