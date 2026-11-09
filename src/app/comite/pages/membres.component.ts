import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { API_COMITE, ComiteSessionService, MembreComite } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';

interface NouveauMembre {
  prenom: string; nom: string; email: string; sexe: '' | 'F' | 'M'; fonction: string; organisation: string; telephone: string;
}
const vide = (): NouveauMembre => ({ prenom: '', nom: '', email: '', sexe: '', fonction: '', organisation: '', telephone: '' });

/** Membres du comité de pilotage : chacun peut en ajouter un autre. */
@Component({
  selector: 'app-comite-membres',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Membres du comité</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Les personnes qui pilotent le projet AMI Santé Connect. Chaque membre peut ajouter un nouveau membre.</p>
        </div>
        <button type="button" class="btn-primary" (click)="ouvrir()"><i class="fa-solid fa-user-plus"></i> Ajouter un membre</button>
      </div>

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="charger()">Réessayer</button>
        </div>
      }

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        @if (!recu() && !erreur()) {
          @for (i of [1, 2, 3]; track i) { <div class="card h-56 p-6"><div class="skeleton h-full w-full"></div></div> }
        }
        @for (m of membres(); track m.id) {
          <article class="card group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
            <div class="h-20 bg-gradient-to-r from-brand-700 via-brand-600 to-accent-600"></div>
            <div class="px-5 pb-5">
              <div class="relative z-10 -mt-10 flex items-end justify-between">
                @if (m.photo) {
                  <img [src]="m.photo" alt="" class="h-20 w-20 rounded-2xl object-cover shadow-md ring-4 ring-white dark:ring-slate-900">
                } @else {
                  <span class="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 text-2xl font-bold text-brand-700 shadow-md ring-4 ring-white dark:from-brand-500/30 dark:to-accent-500/20 dark:text-brand-200 dark:ring-slate-900">{{ m.prenom.charAt(0) }}{{ m.nom.charAt(0) }}</span>
                }
                <div class="flex flex-wrap justify-end gap-1">
                  @if (m.estPresident) {
                    <span class="badge bg-amber-100 font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"><i class="fa-solid fa-crown"></i> Président</span>
                  }
                  @if (m.id === moi()) {
                    <span class="badge bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">Vous</span>
                  } @else if (m.doitChangerMotDePasse) {
                    <span class="badge bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" title="N’a pas encore choisi son mot de passe">Invitation en attente</span>
                  }
                </div>
              </div>
              <div class="mt-3 flex items-start justify-between gap-2">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ m.prenom }} {{ m.nom }}</h2>
                @if (estPresident() && m.id !== moi()) {
                  <button type="button" class="btn-ghost -mr-2 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10" (click)="aRetirer = m; erreurRetrait = ''" [title]="'Retirer ' + m.prenom + ' ' + m.nom + ' du comité'" [attr.aria-label]="'Retirer ' + m.prenom + ' ' + m.nom + ' du comité'">
                    <i class="fa-solid fa-user-minus"></i>
                  </button>
                }
              </div>
              <p class="text-sm font-medium text-brand-700 dark:text-brand-300">{{ m.fonction || 'Membre du comité' }}</p>
              @if (m.organisation) { <p class="text-sm text-slate-500 dark:text-slate-400"><i class="fa-solid fa-building-columns mr-1.5 text-slate-400"></i>{{ m.organisation }}</p> }
              <div class="mt-4 space-y-1.5 text-sm">
                <a [href]="'mailto:' + m.email" class="flex items-center gap-2 truncate text-slate-600 hover:text-brand-700 dark:text-slate-300"><i class="fa-solid fa-envelope w-4 text-slate-400"></i>{{ m.email }}</a>
                @if (m.telephone) { <a [href]="'tel:' + m.telephone.split(' ').join('')" class="flex items-center gap-2 text-slate-600 hover:text-brand-700 dark:text-slate-300"><i class="fa-solid fa-phone w-4 text-slate-400"></i>{{ m.telephone }}</a> }
              </div>
              <p class="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {{ m.derniereConnexion ? 'Dernière connexion le ' + (m.derniereConnexion | date: 'dd/MM/yyyy') : 'Jamais connecté' }}
                @if (m.ajoutePar) { · ajouté par {{ m.ajoutePar.nom }} }
              </p>
            </div>
          </article>
        }
      </div>
    </div>

    <!-- Ajout d'un membre -->
    @if (panneau) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-ajout-membre">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="panneau = false"></div>
        <form #f="ngForm" (ngSubmit)="ajouter(f)" novalidate class="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h2 id="titre-ajout-membre" class="text-lg font-semibold text-slate-900 dark:text-white">Ajouter un membre du comité</h2>
            <button type="button" class="btn-ghost px-3" (click)="panneau = false" aria-label="Fermer"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="label" for="m-prenom">Prénom <span class="req">*</span></label>
                <input id="m-prenom" name="prenom" class="input" required [(ngModel)]="form.prenom" #pr="ngModel" [class.border-rose-400]="pr.invalid && f.submitted">
              </div>
              <div>
                <label class="label" for="m-nom">Nom <span class="req">*</span></label>
                <input id="m-nom" name="nom" class="input uppercase" required [(ngModel)]="form.nom" #no="ngModel" [class.border-rose-400]="no.invalid && f.submitted">
              </div>
            </div>
            <div>
              <label class="label" for="m-email">E-mail de connexion <span class="req">*</span></label>
              <input id="m-email" name="email" type="email" class="input" required email autocomplete="off" [(ngModel)]="form.email" #em="ngModel" [class.border-rose-400]="em.invalid && f.submitted">
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="label" for="m-sexe">Sexe</label>
                <select id="m-sexe" name="sexe" class="input" [(ngModel)]="form.sexe">
                  <option value="">Non précisé</option><option value="F">Femme</option><option value="M">Homme</option>
                </select>
              </div>
              <div>
                <label class="label" for="m-tel">Téléphone</label>
                <input id="m-tel" name="telephone" type="tel" class="input" placeholder="+243 …" [(ngModel)]="form.telephone">
              </div>
            </div>
            <div>
              <label class="label" for="m-fonction">Fonction au comité</label>
              <input id="m-fonction" name="fonction" class="input" placeholder="Président, secrétaire, membre…" [(ngModel)]="form.fonction">
            </div>
            <div>
              <label class="label" for="m-org">Institution représentée</label>
              <input id="m-org" name="organisation" class="input" placeholder="Ministère, partenaire, hôpital…" [(ngModel)]="form.organisation">
            </div>
            <p class="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              <i class="fa-solid fa-key mt-0.5 text-brand-600"></i>
              Un mot de passe temporaire est généré et affiché une seule fois. Le nouveau membre le change à sa première connexion, puis complète son profil (photo comprise).
            </p>
          </div>
          @if (erreurAjout) {
            <p class="border-t border-rose-100 bg-rose-50 px-6 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300" role="alert"><i class="fa-solid fa-circle-exclamation mr-1"></i>{{ erreurAjout }}</p>
          }
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secondary" (click)="panneau = false">Annuler</button>
            <button type="submit" class="btn-primary" [disabled]="envoi"><i class="fa-solid" [class]="envoi ? 'fa-spinner fa-spin' : 'fa-user-plus'"></i> Ajouter le membre</button>
          </div>
        </form>
      </div>
    }

    <!-- Retrait d'un membre (président seulement) -->
    @if (aRetirer; as m) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titre-retrait-membre" (keydown.escape)="annulerRetrait()">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="annulerRetrait()"></div>
        <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-xl text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"><i class="fa-solid fa-user-minus"></i></span>
          <h2 id="titre-retrait-membre" class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Retirer {{ m.prenom }} {{ m.nom }} du comité ?</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Son compte est supprimé définitivement : il ne pourra plus se connecter à l’espace du comité de pilotage. Pour le réintégrer, il faudra l’ajouter à nouveau.</p>
          @if (erreurRetrait) { <p class="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">{{ erreurRetrait }}</p> }
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secondary" (click)="annulerRetrait()" [disabled]="retrait">Annuler</button>
            <button type="button" class="btn bg-rose-600 text-white hover:bg-rose-700" (click)="retirer()" [disabled]="retrait">
              <i class="fa-solid" [class]="retrait ? 'fa-spinner fa-spin' : 'fa-user-minus'"></i> Retirer du comité
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Identifiants du nouveau membre -->
    @if (cree; as c) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titre-membre-cree">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-xl text-accent-600 dark:bg-accent-500/10 dark:text-accent-400"><i class="fa-solid fa-landmark"></i></span>
          <h2 id="titre-membre-cree" class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Identifiants de {{ c.membre.prenom }} {{ c.membre.nom }}</h2>
          <dl class="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
            <div><dt class="text-xs text-slate-500 dark:text-slate-400">Adresse de connexion</dt><dd class="font-medium text-slate-900 dark:text-white">{{ adresseConnexion }}</dd></div>
            <div><dt class="text-xs text-slate-500 dark:text-slate-400">E-mail</dt><dd class="font-medium text-slate-900 dark:text-white">{{ c.membre.email }}</dd></div>
            <div><dt class="text-xs text-slate-500 dark:text-slate-400">Mot de passe temporaire</dt><dd class="select-all font-mono text-lg font-semibold tracking-wide text-brand-800 dark:text-brand-200">{{ c.motDePasseTemporaire }}</dd></div>
          </dl>
          <p class="mt-4 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i>Ce mot de passe ne sera plus affiché. Transmettez-le de façon sûre : il devra être changé à la première connexion.</p>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secondary" (click)="copier()"><i class="fa-solid" [class]="copie ? 'fa-check' : 'fa-copy'"></i> {{ copie ? 'Copié' : 'Copier' }}</button>
            <button type="button" class="btn-primary" (click)="cree = null">J’ai noté les identifiants</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ComiteMembresComponent {
  private http = inject(HttpClient);
  private session = inject(ComiteSessionService);
  moi = computed(() => this.session.membre()?.id);
  /** Seul le président du comité peut retirer un membre (le serveur le vérifie aussi). */
  estPresident = computed(() => !!this.session.membre()?.estPresident);

  aRetirer: MembreComite | null = null;
  retrait = false;
  erreurRetrait = '';

  annulerRetrait(): void {
    if (!this.retrait) this.aRetirer = null;
  }

  async retirer(): Promise<void> {
    const m = this.aRetirer;
    if (!m || this.retrait) return;
    this.retrait = true;
    this.erreurRetrait = '';
    try {
      await firstValueFrom(this.http.delete(`${API_COMITE}/membres/${m.id}`));
      this.membres.update(l => l.filter(x => x.id !== m.id));
      this.aRetirer = null;
    } catch (err) {
      this.erreurRetrait = messageErreur(err);
    } finally {
      this.retrait = false;
    }
  }

  membres = signal<MembreComite[]>([]);
  recu = signal(false);
  erreur = signal('');
  readonly adresseConnexion = `${location.origin}/comite/connexion`;

  panneau = false;
  form: NouveauMembre = vide();
  envoi = false;
  erreurAjout = '';
  cree: { membre: MembreComite; motDePasseTemporaire: string } | null = null;
  copie = false;

  constructor() {
    this.charger();
  }

  charger(): void {
    this.erreur.set('');
    firstValueFrom(this.http.get<MembreComite[]>(`${API_COMITE}/membres`))
      .then(l => { this.membres.set(l); this.recu.set(true); })
      .catch(err => this.erreur.set(messageErreur(err)));
  }

  ouvrir(): void {
    this.form = vide();
    this.erreurAjout = '';
    this.panneau = true;
  }

  async ajouter(f: NgForm): Promise<void> {
    if (this.envoi) return;
    if (f.invalid) {
      this.erreurAjout = 'Prénom, nom et e-mail valide sont obligatoires.';
      return;
    }
    this.envoi = true;
    this.erreurAjout = '';
    try {
      const r = await firstValueFrom(this.http.post<{ membre: MembreComite; motDePasseTemporaire: string }>(`${API_COMITE}/membres`,
        { ...this.form, email: this.form.email.trim().toLowerCase() }));
      this.membres.update(l => [...l, r.membre].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
      this.panneau = false;
      this.cree = r;
    } catch (err) {
      this.erreurAjout = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  async copier(): Promise<void> {
    const c = this.cree;
    if (!c) return;
    await navigator.clipboard?.writeText(`AMI Santé Connect — Comité de pilotage\nAdresse : ${this.adresseConnexion}\nE-mail : ${c.membre.email}\nMot de passe temporaire : ${c.motDePasseTemporaire}`).catch(() => {});
    this.copie = true;
    setTimeout(() => (this.copie = false), 2000);
  }
}
