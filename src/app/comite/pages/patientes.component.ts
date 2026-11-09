import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_COMITE } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';

interface EnfantIdentite { numero: string; prenom: string; nom: string; postnom: string; sexe: string; dateNaissance: string | null }
interface PatienteIdentite {
  id: string; numero: string; nom: string; postnom: string; prenom: string; dateNaissance: string | null; age: number | null;
  photo: string | null; residence: { province: string; commune: string; quartier: string };
  etablissement: { id: string; code: string; nom: string; province: string } | null; inscriteLe: string | null;
  enfants: EnfantIdentite[];
}
interface Reponse {
  total: number; page: number; parPage: number; pages: number; totalEnfants: number;
  etablissements: { id: string; nom: string }[];
  patientes: PatienteIdentite[];
}

/**
 * Patientes de toute la plateforme, pour le comité : identité et enfants seulement.
 * Aucune donnée médicale, aucun téléphone, aucun suivi de grossesse (règle du serveur).
 */
@Component({
  selector: 'app-comite-patientes',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="mx-auto max-w-7xl space-y-6">
      <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-brand-700 to-brand-800 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8">
        <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"></div>
        <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Comité de pilotage</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight">Patientes et enfants</h1>
            <p class="mt-2 text-sm leading-relaxed text-white/80">Identité des patientes enregistrées dans tous les établissements et de leurs enfants. Les données médicales et les coordonnées restent réservées aux soignants.</p>
          </div>
          <div class="flex items-end gap-6">
            <div>
              @if (!donnees()) { <div class="h-12 w-16 animate-pulse rounded-lg bg-white/20"></div> } @else { <p class="text-5xl font-bold tabular-nums">{{ donnees()!.total }}</p> }
              <p class="text-sm text-white/75">{{ recherche() || etablissement() ? 'patientes trouvées' : 'patientes' }}</p>
            </div>
            <div class="border-l border-white/20 pl-6">
              <p class="text-3xl font-bold tabular-nums">{{ donnees()?.totalEnfants ?? '—' }}</p>
              <p class="text-sm text-white/75">enfants</p>
            </div>
          </div>
        </div>
        <p class="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur"><i class="fa-solid fa-shield-halved"></i>Identité seulement · chaque consultation est inscrite au journal d’audit</p>
      </section>

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="charger()">Réessayer</button>
        </div>
      }

      <div class="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="search" class="input pl-10" placeholder="Nom, prénom, numéro AMI (patiente ou enfant)…" [value]="recherche()" (input)="rechercher($any($event.target).value)">
        </div>
        <select class="input lg:w-72" (change)="filtrer($any($event.target).value)" aria-label="Établissement">
          <option value="" [selected]="!etablissement()">Tous les établissements</option>
          @for (e of donnees()?.etablissements ?? []; track e.id) { <option [value]="e.id" [selected]="e.id === etablissement()">{{ e.nom }}</option> }
        </select>
      </div>

      @if (chargement() && !donnees()) {
        <div class="space-y-2.5">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="card h-[5.5rem] p-3"><div class="skeleton h-full w-full"></div></div> }</div>
      } @else if (donnees()) {
        @let d = donnees()!;
        <div class="space-y-2.5" [class.opacity-60]="chargement()">
          @for (p of d.patientes; track p.id) {
            <article class="card overflow-hidden">
              <button type="button" class="group flex h-[5.5rem] w-full text-left" (click)="basculer(p.id)" [attr.aria-expanded]="ouverte() === p.id">
                <div class="relative w-20 flex-none overflow-hidden sm:w-24">
                  @if (p.photo) { <img [src]="p.photo" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover"> }
                  @else { <span class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-100 to-brand-100 text-2xl font-bold text-violet-800 dark:from-violet-500/30 dark:to-brand-500/20 dark:text-violet-100">{{ (p.prenom || p.nom).charAt(0) }}{{ p.nom.charAt(0) }}</span> }
                  <span class="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-violet-500 to-brand-600"></span>
                </div>
                <div class="grid min-w-0 flex-1 items-center gap-x-5 gap-y-1 px-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
                  <div class="min-w-0">
                    <h3 class="truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{{ p.prenom }} {{ p.nom }} {{ p.postnom }}</h3>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ p.numero }}</span>@if (p.age != null) { · {{ p.age }} ans }</p>
                  </div>
                  <div class="hidden min-w-0 sm:block">
                    <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100"><i class="fa-solid fa-hospital mr-1.5 text-xs text-slate-400"></i>{{ p.etablissement?.nom ?? 'Établissement non renseigné' }}</p>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400">Inscrite le {{ p.inscriteLe ? (p.inscriteLe | date: 'dd/MM/yyyy') : '—' }}</p>
                  </div>
                  <div class="hidden min-w-0 lg:block">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Résidence</p>
                    <p class="truncate text-sm text-slate-700 dark:text-slate-200">{{ residence(p) }}</p>
                  </div>
                  <div class="hidden items-center gap-3 lg:flex">
                    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="p.enfants.length ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">
                      <i class="fa-solid fa-baby"></i>{{ p.enfants.length }} enfant(s)
                    </span>
                    <i class="fa-solid fa-chevron-down text-xs text-slate-400 transition" [class.rotate-180]="ouverte() === p.id"></i>
                  </div>
                </div>
              </button>

              @if (ouverte() === p.id) {
                <div class="grid gap-5 border-t border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30 md:grid-cols-2">
                  <section>
                    <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-id-card mr-1"></i> Identité</h4>
                    <dl class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                      <div class="flex justify-between gap-3 px-3 py-2"><dt class="text-slate-500 dark:text-slate-400">Numéro AMI</dt><dd class="font-mono text-slate-900 dark:text-white">{{ p.numero }}</dd></div>
                      <div class="flex justify-between gap-3 px-3 py-2"><dt class="text-slate-500 dark:text-slate-400">Nom complet</dt><dd class="text-right text-slate-900 dark:text-white">{{ p.prenom }} {{ p.nom }} {{ p.postnom }}</dd></div>
                      <div class="flex justify-between gap-3 px-3 py-2"><dt class="text-slate-500 dark:text-slate-400">Date de naissance</dt><dd class="text-slate-900 dark:text-white">{{ p.dateNaissance ? (p.dateNaissance | date: 'dd/MM/yyyy') : (p.age != null ? 'Âge déclaré : ' + p.age + ' ans' : '—') }}</dd></div>
                      <div class="flex justify-between gap-3 px-3 py-2"><dt class="text-slate-500 dark:text-slate-400">Résidence</dt><dd class="text-right text-slate-900 dark:text-white">{{ residence(p) }}</dd></div>
                      <div class="flex justify-between gap-3 px-3 py-2"><dt class="text-slate-500 dark:text-slate-400">Établissement</dt><dd class="text-right text-slate-900 dark:text-white">{{ p.etablissement?.nom ?? '—' }}@if (p.etablissement?.code) { <span class="block font-mono text-xs text-slate-500">{{ p.etablissement!.code }}</span> }</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-baby mr-1"></i> Enfants ({{ p.enfants.length }})</h4>
                    @for (e of p.enfants; track e.numero) {
                      <div class="mb-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full" [class]="e.sexe === 'Féminin' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10' : 'bg-sky-50 text-sky-600 dark:bg-sky-500/10'"><i class="fa-solid" [class]="e.sexe === 'Féminin' ? 'fa-venus' : 'fa-mars'"></i></span>
                        <div class="min-w-0">
                          <p class="truncate font-medium text-slate-900 dark:text-white">{{ e.prenom || 'Prénom non renseigné' }} {{ e.nom }} {{ e.postnom }}</p>
                          <p class="text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ e.numero }}</span> · {{ e.sexe }}@if (e.dateNaissance) { · né(e) le {{ e.dateNaissance | date: 'dd/MM/yyyy' }} }</p>
                        </div>
                      </div>
                    } @empty {
                      <p class="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Aucun enfant enregistré.</p>
                    }
                  </section>
                </div>
              }
            </article>
          } @empty {
            <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800"><i class="fa-solid fa-person-pregnant"></i></span>
              <p class="font-medium text-slate-900 dark:text-white">{{ recherche() || etablissement() ? 'Aucune patiente ne correspond à ces critères.' : 'Aucune patiente n’est encore enregistrée.' }}</p>
            </div>
          }
        </div>

        @if (d.pages > 1) {
          <nav class="flex items-center justify-between gap-3" aria-label="Pages">
            <button type="button" class="btn-secondary" [disabled]="d.page <= 1 || chargement()" (click)="aller(d.page - 1)"><i class="fa-solid fa-chevron-left"></i> Précédentes</button>
            <span class="text-sm text-slate-500 dark:text-slate-400">Page {{ d.page }} sur {{ d.pages }}</span>
            <button type="button" class="btn-secondary" [disabled]="d.page >= d.pages || chargement()" (click)="aller(d.page + 1)">Suivantes <i class="fa-solid fa-chevron-right"></i></button>
          </nav>
        }
      }
    </div>
  `,
})
export class ComitePatientesComponent {
  private http = inject(HttpClient);
  donnees = signal<Reponse | null>(null);
  chargement = signal(false);
  erreur = signal('');
  recherche = signal('');
  etablissement = signal('');
  page = signal(1);
  ouverte = signal<string | null>(null);
  private minuteur?: ReturnType<typeof setTimeout>;

  constructor() {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    const params: Record<string, string> = { page: String(this.page()) };
    if (this.recherche().trim()) params['q'] = this.recherche().trim();
    if (this.etablissement()) params['etablissement'] = this.etablissement();
    firstValueFrom(this.http.get<Reponse>(`${API_COMITE}/patientes`, { params }))
      .then(r => this.donnees.set(r))
      .catch(err => this.erreur.set(messageErreur(err)))
      .finally(() => this.chargement.set(false));
  }

  /** Recherche côté serveur, déclenchée après une courte pause de saisie. */
  rechercher(q: string): void {
    this.recherche.set(q);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => { this.page.set(1); this.charger(); }, 350);
  }

  filtrer(id: string): void {
    this.etablissement.set(id);
    this.page.set(1);
    this.charger();
  }

  aller(page: number): void {
    this.page.set(page);
    this.ouverte.set(null);
    this.charger();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  basculer(id: string): void {
    this.ouverte.set(this.ouverte() === id ? null : id);
  }

  residence(p: PatienteIdentite): string {
    return [p.residence.quartier, p.residence.commune, p.residence.province].filter(Boolean).join(', ') || '—';
  }
}
