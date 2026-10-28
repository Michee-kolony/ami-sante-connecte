import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService, messageErreur } from '../../data/session.service';
import { AvatarComponent } from '../../components/avatar.component';
import { PrisePhotoComponent } from '../../components/prise-photo.component';
import { RelanceService, type Reco } from '../../data/relance.service';
import { EtablissementsService } from '../../data/etablissements.service';

/**
 * Comptes des relais communautaires (RECO) : création, secteur couvert (attribution automatique
 * des tâches), suspension, mot de passe temporaire et révocation des sessions d'un téléphone perdu.
 */
@Component({
  selector: 'app-relance-recos',
  standalone: true,
  imports: [DatePipe, FormsModule, AvatarComponent, PrisePhotoComponent],
  template: `
<div class="space-y-4">
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }
  @if (secret(); as s) {
    <div class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" role="status">
      <p><i class="fa-solid fa-key"></i> Identifiants à remettre <strong>en personne</strong> au RECO (ils ne seront plus affichés) :</p>
      <p class="mt-1 font-mono text-base">{{ s.matricule }} · {{ s.motDePasse }}</p>
      <p class="mt-1 text-xs">Il devra choisir son propre mot de passe à la première connexion sur <strong>/reco</strong>.</p>
      <button type="button" class="btn-ghost mt-2 text-xs" (click)="secret.set(null)">J’ai remis les identifiants</button>
    </div>
  }

  <div class="card overflow-hidden">
    <div class="card-header">
      <h2 class="card-title"><i class="fa-solid fa-people-group text-brand-600"></i> Relais communautaires ({{ recos().length }})</h2>
      <button type="button" class="btn-primary text-xs" (click)="nouveau()"><i class="fa-solid fa-user-plus"></i> Ajouter un RECO</button>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50/70 dark:bg-slate-800/50"><tr>
          <th class="table-th">RECO</th><th class="table-th">Secteur</th><th class="table-th">Tâches</th><th class="table-th">Synchronisation</th><th class="table-th">Statut</th><th class="table-th"><span class="sr-only">Actions</span></th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (r of recos(); track r.id) {
            <tr>
              <td class="table-td">
                <div class="flex items-center gap-3">
                  <app-avatar [photo]="r.photo ?? undefined" [prenom]="r.prenom" [nomFamille]="r.nom" class="h-11 w-11 shrink-0 rounded-full text-sm ring-2 ring-white dark:ring-slate-900" />
                  <div class="min-w-0">
                    <p class="font-medium text-slate-800 dark:text-slate-100">{{ r.prenom }} {{ r.nom }}</p>
                    <p class="text-xs text-slate-500">{{ r.matricule }} · {{ r.telephone }}</p>
                    @if (!r.photo) { <p class="text-xs text-amber-600"><i class="fa-solid fa-camera"></i> Photo manquante</p> }
                  </div>
                </div>
              </td>
              <td class="table-td"><p>{{ r.zones.join(', ') || '—' }}</p><p class="text-xs text-slate-500">{{ r.aireSante }}</p></td>
              <td class="table-td whitespace-nowrap">{{ r.ouvertes }} ouverte(s) @if (r.enRetard) { <span class="text-rose-600">· {{ r.enRetard }} en retard</span> }</td>
              <td class="table-td whitespace-nowrap text-xs">{{ r.derniereSynchronisation ? (r.derniereSynchronisation | date:'dd/MM/yyyy HH:mm') : 'jamais' }}</td>
              <td class="table-td"><span class="badge" [class]="r.statut === 'Actif' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'">{{ r.statut }}</span></td>
              <td class="table-td whitespace-nowrap text-right">
                <button type="button" class="btn-ghost px-2 text-xs" (click)="modifier(r)" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-ghost px-2 text-xs" (click)="motDePasse(r)" title="Nouveau mot de passe temporaire"><i class="fa-solid fa-key"></i></button>
                <button type="button" class="btn-ghost px-2 text-xs" (click)="revoquer(r)" title="Téléphone perdu : révoquer les sessions"><i class="fa-solid fa-mobile-screen-button"></i></button>
                @if (peutSupprimer()) {
                  <button type="button" class="btn-ghost px-2 text-xs text-rose-600" (click)="demanderSuppression(r)" title="Supprimer définitivement"><i class="fa-solid fa-trash"></i></button>
                }
                <button type="button" class="btn-ghost px-2 text-xs" (click)="basculer(r)" [title]="r.statut === 'Actif' ? 'Suspendre' : 'Réactiver'"><i class="fa-solid" [class]="r.statut === 'Actif' ? 'fa-user-lock' : 'fa-user-check'"></i></button>
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="px-5 py-8 text-center text-sm text-slate-500">Aucun RECO enregistré pour cette structure.</td></tr> }
        </tbody>
      </table>
    </div>
  </div>

  @if (edition(); as e) {
    <form class="card space-y-4 p-5" (ngSubmit)="enregistrer()">
      <h3 class="card-title">{{ e.id ? 'Modifier ' + e.matricule : 'Nouveau RECO' }}</h3>
      <div>
        @if (e.id && e.photo && !photo) {
          <div class="mb-3 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <img [src]="e.photo" alt="Photo actuelle du RECO" class="h-20 w-20 rounded-2xl object-cover shadow ring-1 ring-slate-200 dark:ring-slate-700">
            <span>Photo actuelle. Prenez-en une nouvelle ci-dessous pour la remplacer.</span>
          </div>
        }
        <app-prise-photo [(fichier)]="photo" libelle="Photo de profil du RECO" [requise]="!e.id || !e.photo"
          aide="Obligatoire : de face, visage bien éclairé. Elle permet aux familles et au superviseur de reconnaître le relais. JPG, PNG ou WebP, 2 Mo max." />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="rp">Prénom <span class="req">*</span></label><input id="rp" name="rp" class="input" [(ngModel)]="e.prenom" required></div>
        <div><label class="label" for="rn">Nom <span class="req">*</span></label><input id="rn" name="rn" class="input" [(ngModel)]="e.nom" required></div>
        <div><label class="label" for="rpn">Postnom</label><input id="rpn" name="rpn" class="input" [(ngModel)]="e.postnom"></div>
        <div><label class="label" for="rs">Sexe <span class="req">*</span></label>
          <select id="rs" name="rs" class="input" [(ngModel)]="e.sexe" required><option value="F">Femme</option><option value="M">Homme</option></select></div>
        <div><label class="label" for="rt">Téléphone <span class="req">*</span></label><input id="rt" name="rt" class="input" [(ngModel)]="e.telephone" required></div>
        <div class="sm:col-span-2"><label class="label" for="re">Structure de rattachement <span class="req">*</span></label>
          <select id="re" name="re" class="input" [(ngModel)]="e.etablissementId" required [disabled]="!!session.etablissement()">
            <option [ngValue]="undefined" disabled>Choisir le centre de santé…</option>
            @for (s of structures(); track s.id) { <option [ngValue]="s.id">{{ s.nom }} ({{ s.code }}){{ s.aireSante ? ' — aire ' + s.aireSante : '' }}</option> }
          </select>
          <p class="hint">{{ session.etablissement() ? 'Structure de votre session : vous ne gérez que ses RECO.' : 'Le RECO reçoit les tâches des personnes suivies par cette structure.' }}</p></div>
        <div><label class="label" for="ra">Aire de santé</label><input id="ra" name="ra" class="input" [(ngModel)]="e.aireSante" placeholder="Celle de la structure par défaut"></div>
        <div class="sm:col-span-2"><label class="label" for="rz">Secteur couvert (quartiers, villages, avenues)</label>
          <input id="rz" name="rz" class="input" [(ngModel)]="zones" placeholder="Salongo, Kemi, Livulu">
          <p class="hint">Séparez par des virgules. Les tâches d’une personne habitant l’un de ces quartiers sont attribuées automatiquement à ce RECO (au moins chargé s’ils sont plusieurs).</p></div>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" (click)="edition.set(null)">Annuler</button>
        <button type="submit" class="btn-primary" [disabled]="envoi()">Enregistrer</button>
      </div>
    </form>
  }
</div>

<!-- Confirmation de suppression -->
@if (aSupprimer(); as r) {
  <div class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titre-suppression">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="annulerSuppression()" aria-hidden="true"></div>
    <div class="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div class="flex items-start gap-4 p-6">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              [class]="r.ouvertes ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'">
          <i class="fa-solid text-lg" [class]="r.ouvertes ? 'fa-triangle-exclamation' : 'fa-trash'"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="titre-suppression" class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ r.ouvertes ? 'Suppression impossible pour le moment' : 'Supprimer ce RECO ?' }}
          </h2>
          <div class="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <app-avatar [photo]="r.photo ?? undefined" [prenom]="r.prenom" [nomFamille]="r.nom" class="h-11 w-11 shrink-0 rounded-full text-sm" />
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-800 dark:text-slate-100">{{ r.prenom }} {{ r.nom }}</p>
              <p class="text-xs text-slate-500">{{ r.matricule }} · {{ r.zones.join(', ') || r.aireSante || 'secteur non renseigné' }}</p>
            </div>
          </div>
          @if (r.ouvertes) {
            <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Ce relais a encore <strong>{{ r.ouvertes }} tâche(s) ouverte(s)</strong>. Réattribuez-les à un autre RECO (onglet <strong>Tâches</strong>) pour qu’aucune famille ne reste sans suivi, puis revenez ici.
            </p>
          } @else {
            <ul class="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <li class="flex gap-2"><i class="fa-solid fa-xmark mt-1 text-rose-500"></i> Il ne pourra plus se connecter à l’application RECO.</li>
              <li class="flex gap-2"><i class="fa-solid fa-xmark mt-1 text-rose-500"></i> Sa photo de profil sera effacée.</li>
              <li class="flex gap-2"><i class="fa-solid fa-check mt-1 text-accent-600"></i> L’historique des tâches déjà traitées est conservé.</li>
            </ul>
            <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Action définitive. Pour un arrêt temporaire (congé, téléphone perdu), préférez <strong>Suspendre</strong>.
            </p>
          }
          @if (erreurSuppression()) {
            <p class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">{{ erreurSuppression() }}</p>
          }
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:justify-end">
        <button type="button" class="btn-secondary" (click)="annulerSuppression()" [disabled]="envoi()">{{ r.ouvertes ? 'Fermer' : 'Annuler' }}</button>
        @if (r.ouvertes) {
          <button type="button" class="btn-secondary" (click)="basculer(r); annulerSuppression()"><i class="fa-solid fa-user-lock"></i> Suspendre à la place</button>
        } @else {
          <button type="button" class="btn bg-rose-600 text-white shadow-sm hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500" (click)="confirmerSuppression()" [disabled]="envoi()">
            @if (envoi()) { <i class="fa-solid fa-spinner fa-spin"></i> Suppression… } @else { <i class="fa-solid fa-trash"></i> Supprimer définitivement }
          </button>
        }
      </div>
    </div>
  </div>
}
  `,
  host: { '(document:keydown.escape)': 'annulerSuppression()' },
})
export class RelanceRecosComponent implements OnInit {
  private service = inject(RelanceService);
  readonly session = inject(SessionService);
  private etablissements = inject(EtablissementsService);
  /** Structures actives proposées comme rattachement. */
  readonly structures = computed(() => this.etablissements.etablissements().filter(s => s.statut === 'Actif'));

  /** Suppression définitive : médecin chef de service et médecin directeur (le serveur vérifie aussi). */
  peutSupprimer = input(false);
  recos = signal<Reco[]>([]);
  /** RECO dont la suppression est demandée (fenêtre de confirmation ouverte). */
  aSupprimer = signal<Reco | null>(null);
  erreurSuppression = signal('');
  edition = signal<Partial<Reco> | null>(null);
  zones = '';
  photo: File | null = null;
  secret = signal<{ matricule: string; motDePasse: string } | null>(null);
  erreur = signal('');
  envoi = signal(false);

  ngOnInit(): void {
    this.charger();
    this.etablissements.charger().catch(() => {});
  }

  private async faire<T>(action: () => Promise<T>): Promise<T | undefined> {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      return await action();
    } catch (err) {
      this.erreur.set(messageErreur(err));
      return undefined;
    } finally {
      this.envoi.set(false);
    }
  }

  async charger(): Promise<void> {
    const r = await this.faire(() => this.service.recos());
    if (r) this.recos.set(r);
  }

  nouveau(): void {
    this.zones = '';
    this.photo = null;
    this.edition.set({ prenom: '', nom: '', postnom: '', sexe: 'F', telephone: '', aireSante: '', etablissementId: this.session.etablissement()?.id ?? (this.structures().length === 1 ? this.structures()[0].id : undefined) });
  }

  modifier(r: Reco): void {
    this.zones = r.zones.join(', ');
    this.photo = null;
    this.edition.set({ ...r });
  }

  async enregistrer(): Promise<void> {
    const e = this.edition();
    if (!e) return;
    if (!e.etablissementId) {
      this.erreur.set('Choisissez la structure de rattachement du RECO.');
      return;
    }
    const donnees = { etablissementId: e.etablissementId, prenom: e.prenom, nom: e.nom, postnom: e.postnom, sexe: e.sexe, telephone: e.telephone, aireSante: e.aireSante, zones: this.zones.split(',').map(z => z.trim()).filter(Boolean) };
    if (!this.photo && (!e.id || !e.photo)) {
      this.erreur.set('La photo de profil du RECO est obligatoire.');
      return;
    }
    const photo = this.photo;
    if (e.id) {
      const r = await this.faire(() => this.service.modifierReco(e.id!, donnees, photo));
      if (!r) return;
      this.recos.update(l => l.map(x => (x.id === r.id ? { ...x, ...r } : x)));
    } else {
      const r = await this.faire(() => this.service.creerReco(donnees, photo!));
      if (!r) return;
      this.recos.update(l => [...l, r.reco]);
      if (r.motDePasse) this.secret.set({ matricule: r.reco.matricule, motDePasse: r.motDePasse });
    }
    this.photo = null;
    this.edition.set(null);
  }

  async motDePasse(r: Reco): Promise<void> {
    if (!confirm(`Générer un nouveau mot de passe temporaire pour ${r.prenom} ${r.nom} ? Ses sessions ouvertes seront fermées.`)) return;
    const s = await this.faire(() => this.service.reinitialiserMotDePasse(r.id));
    if (s) this.secret.set(s);
  }

  async revoquer(r: Reco): Promise<void> {
    if (!confirm(`Téléphone perdu ou compromis : fermer toutes les sessions de ${r.prenom} ${r.nom} ? Les actions non synchronisées de ce téléphone seront perdues.`)) return;
    await this.faire(() => this.service.revoquerSessions(r.id));
  }

  async basculer(r: Reco): Promise<void> {
    const statut = r.statut === 'Actif' ? 'Suspendu' : 'Actif';
    if (statut === 'Suspendu' && !confirm(`Suspendre ${r.prenom} ${r.nom} ? Ses ${r.ouvertes} tâche(s) ouverte(s) devront être réattribuées (le superviseur est alerté).`)) return;
    const x = await this.faire(() => this.service.changerStatutReco(r.id, statut));
    if (x) this.recos.update(l => l.map(y => (y.id === x.id ? x : y)));
  }

  /** Ouvre la fenêtre de confirmation (elle explique le blocage s'il reste des tâches ouvertes). */
  demanderSuppression(r: Reco): void {
    this.erreurSuppression.set('');
    this.aSupprimer.set(r);
  }

  annulerSuppression(): void {
    if (!this.envoi()) this.aSupprimer.set(null);
  }

  async confirmerSuppression(): Promise<void> {
    const r = this.aSupprimer();
    if (!r) return;
    this.envoi.set(true);
    this.erreurSuppression.set('');
    try {
      await this.service.supprimerReco(r.id);
      this.recos.update(l => l.filter(x => x.id !== r.id));
      this.aSupprimer.set(null);
    } catch (err) {
      this.erreurSuppression.set(messageErreur(err));
    } finally {
      this.envoi.set(false);
    }
  }
}
