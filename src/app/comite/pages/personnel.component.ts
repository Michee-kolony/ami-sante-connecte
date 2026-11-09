import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_COMITE } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';
import { CATEGORIES, CategorieSoignant, RoleSoignant, categorieDuRole } from '../../admin/data/soignants.service';

/** Établissement d'affectation, tel que renvoyé au comité. */
interface AffectationComite {
  etablissementId: string; service: string; code: string; nom: string; province: string; type: string;
  statut: 'Actif' | 'Suspendu' | null;
}

/** Soignant vu par le comité (informations professionnelles, sans pièce d'identité ni adresse). */
interface SoignantComite {
  id: string; matricule: string; prenom: string; nom: string; postnom: string; sexe: 'F' | 'M'; photo: string | null;
  numeroOrdre: string; grade: string; specialite: string; email: string; telephone: string;
  role: RoleSoignant; statut: 'Actif' | 'Suspendu'; derniereConnexion: string | null; doitChangerMotDePasse: boolean;
  creeLe: string | null; ajoutePar: { nom: string; role: string } | null;
  affectations: AffectationComite[];
}

/** Couleurs propres à chaque catégorie (bandeau des cartes, pastilles, barre de répartition). */
const TEINTES: Record<CategorieSoignant, { bande: string; pastille: string; barre: string; initiales: string }> = {
  Médecin: {
    bande: 'from-brand-600 to-brand-800', pastille: 'bg-brand-500', barre: 'bg-brand-600',
    initiales: 'from-brand-100 to-brand-200 text-brand-800 dark:from-brand-500/30 dark:to-brand-600/30 dark:text-brand-100',
  },
  Infirmier: {
    bande: 'from-violet-500 to-violet-700', pastille: 'bg-violet-500', barre: 'bg-violet-500',
    initiales: 'from-violet-100 to-violet-200 text-violet-800 dark:from-violet-500/30 dark:to-violet-600/30 dark:text-violet-100',
  },
  'Sage-femme': {
    bande: 'from-accent-500 to-accent-700', pastille: 'bg-accent-500', barre: 'bg-accent-500',
    initiales: 'from-accent-100 to-accent-200 text-accent-800 dark:from-accent-500/30 dark:to-accent-600/30 dark:text-accent-100',
  },
};

/**
 * Personnel soignant de toute la plateforme (médecins, infirmier·ères, sages-femmes) avec leurs
 * établissements d'affectation. Lecture seule : chaque médecin chef gère le personnel de son établissement.
 */
@Component({
  selector: 'app-comite-personnel',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- En-tête : effectif et répartition -->
      <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-accent-700 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8">
        <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"></div>
        <div class="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent-400/20 blur-3xl"></div>
        <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Comité de pilotage</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight">Personnel soignant</h1>
            <p class="mt-2 text-sm leading-relaxed text-white/80">Tous les médecins, infirmier·ères et sages-femmes de la plateforme, avec leurs établissements d’affectation. Les comptes sont gérés par le médecin chef de chaque établissement.</p>
          </div>
          <div class="flex items-end gap-6">
            <div>
              @if (attente()) { <div class="h-12 w-16 animate-pulse rounded-lg bg-white/20"></div> } @else { <p class="text-5xl font-bold tabular-nums">{{ soignants().length }}</p> }
              <p class="text-sm text-white/75">soignants enregistrés</p>
            </div>
            <div class="border-l border-white/20 pl-6">
              <p class="text-3xl font-bold tabular-nums">{{ nbEtablissements() }}</p>
              <p class="text-sm text-white/75">établissements</p>
            </div>
          </div>
        </div>

        <!-- Barre de répartition par catégorie -->
        @if (soignants().length) {
          <div class="relative mt-6">
            <div class="flex h-2.5 overflow-hidden rounded-full bg-white/15">
              @for (r of repartition(); track r.categorie) {
                <div class="h-full transition-all {{ r.barre }}" [style.width.%]="r.pct" [title]="r.libelle + ' : ' + r.n"></div>
              }
            </div>
            <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              @for (r of repartition(); track r.categorie) {
                <button type="button" class="flex items-center gap-2 rounded-full px-2 py-0.5 transition hover:bg-white/10" [class.bg-white]="categorie() === r.categorie" [class.text-brand-800]="categorie() === r.categorie"
                        (click)="categorie.set(categorie() === r.categorie ? '' : r.categorie)">
                  <span class="h-2.5 w-2.5 rounded-full {{ r.pastille }}"></span>{{ r.libelle }} <b class="tabular-nums">{{ r.n }}</b> <span class="opacity-70">({{ r.pct }} %)</span>
                </button>
              }
              <span class="flex items-center gap-2 text-white/80"><i class="fa-solid fa-circle-check text-accent-300"></i>{{ actifs() }} comptes actifs</span>
            </div>
          </div>
        }
      </section>

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="charger()">Réessayer</button>
        </div>
      }

      <!-- Barre d'outils -->
      <div class="card space-y-3 p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="search" class="input pl-10" placeholder="Rechercher un nom, un matricule, un e-mail, une spécialité…" [value]="recherche()" (input)="recherche.set($any($event.target).value)">
          </div>
          <select class="input lg:w-72" (change)="choixEtablissement.set($any($event.target).value)" aria-label="Établissement">
            <option value="" [selected]="!filtreEtablissement()">Tous les établissements</option>
            @for (e of etablissements(); track e.id) { <option [value]="e.id" [selected]="e.id === filtreEtablissement()">{{ e.nom }} ({{ e.n }})</option> }
          </select>
          <select class="input lg:w-44" (change)="statut.set($any($event.target).value)" aria-label="Statut">
            <option value="" [selected]="!statut()">Tous les statuts</option>
            <option value="Actif" [selected]="statut() === 'Actif'">Actifs</option>
            <option value="Suspendu" [selected]="statut() === 'Suspendu'">Suspendus</option>
          </select>
          <div class="flex flex-none rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Affichage">
            <button type="button" class="onglet" [class.onglet-actif]="vue() === 'cartes'" (click)="vue.set('cartes')" title="Cartes"><i class="fa-solid fa-grip"></i><span class="sr-only">Cartes</span></button>
            <button type="button" class="onglet" [class.onglet-actif]="vue() === 'tableau'" (click)="vue.set('tableau')" title="Tableau"><i class="fa-solid fa-table-list"></i><span class="sr-only">Tableau</span></button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="badge border py-1 transition" [class]="!categorie() ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'" (click)="categorie.set('')">Toutes catégories</button>
          @for (c of categoriesListe; track c) {
            <button type="button" class="badge border py-1 transition" [class]="categorie() === c ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'" (click)="categorie.set(c)">
              <i class="fa-solid {{ categories[c].icone }}"></i>{{ categories[c].pluriel }}
            </button>
          }
          @if (vue() === 'cartes') {
            <label class="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600" [checked]="regrouper()" (change)="regrouper.set($any($event.target).checked)">
              Regrouper par établissement
            </label>
          }
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400"><b class="text-slate-900 dark:text-white">{{ filtres().length }}</b> soignant(s) sur {{ soignants().length }}</span>
          @if (filtreActif()) {
            <button type="button" class="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300" (click)="effacerFiltres()"><i class="fa-solid fa-xmark mr-1"></i>Effacer les filtres</button>
          }
        </div>
      </div>

      <!-- Squelettes -->
      @if (attente()) {
        <div class="space-y-2.5">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="card h-[5.5rem] p-3"><div class="skeleton h-full w-full"></div></div> }
        </div>
      } @else if (!filtres().length) {
        <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800"><i class="fa-solid fa-user-slash"></i></span>
          <p class="font-medium text-slate-900 dark:text-white">Aucun soignant ne correspond à ces critères.</p>
          @if (filtreActif()) { <button type="button" class="btn-secondary" (click)="effacerFiltres()">Effacer les filtres</button> }
        </div>
      } @else if (vue() === 'cartes') {
        @for (g of groupes(); track g.id) {
          <section class="space-y-4">
            @if (regrouper()) {
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-solid fa-hospital"></i></span>
                <div class="min-w-0">
                  <h2 class="font-semibold text-slate-900 dark:text-white">{{ g.nom }}</h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">@if (g.code) {<span class="font-mono">{{ g.code }}</span> · }{{ g.province }} · {{ g.soignants.length }} soignant(s)</p>
                </div>
                <div class="ml-2 h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
              </div>
            }
            <div class="space-y-2.5">
              @for (s of g.soignants; track s.id) {
                <!-- Carte compacte, sur toute la largeur : petite photo à gauche, informations alignées à droite -->
                <article class="card group flex h-[5.5rem] cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" (click)="fiche.set(s)" (keydown.enter)="fiche.set(s)" tabindex="0" [attr.aria-label]="'Voir la fiche de ' + s.prenom + ' ' + s.nom">
                  <div class="relative w-20 flex-none overflow-hidden sm:w-24">
                    @if (s.photo) {
                      <img [src]="s.photo" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105">
                    } @else {
                      <span class="absolute inset-0 flex items-center justify-center bg-gradient-to-br text-2xl font-bold {{ teinte(s).initiales }}">{{ s.prenom.charAt(0) }}{{ s.nom.charAt(0) }}</span>
                    }
                    <!-- Liseré de la catégorie -->
                    <span class="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r {{ teinte(s).bande }}" [title]="cat(s)"></span>
                  </div>

                  <div class="grid min-w-0 flex-1 items-center gap-x-5 gap-y-1 px-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                    <!-- Identité -->
                    <div class="min-w-0">
                      <h3 class="truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{{ titre(s) }}{{ s.prenom }} {{ s.nom }} {{ s.postnom }}</h3>
                      <p class="truncate text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ s.matricule }}</span> · {{ s.telephone }}</p>
                    </div>
                    <!-- Fonction -->
                    <div class="hidden min-w-0 sm:block">
                      <span class="badge max-w-full truncate {{ categories[cat(s)].badge }}"><i class="fa-solid {{ categories[cat(s)].icone }}"></i>{{ s.role }}</span>
                      <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{{ s.specialite }}</p>
                    </div>
                    <!-- Établissement(s) -->
                    <div class="hidden min-w-0 lg:block">
                      @if (s.affectations[0]; as a) {
                        <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100" [title]="a.nom">
                          <i class="fa-solid fa-hospital mr-1.5 text-xs text-slate-400"></i>{{ a.nom }}
                        </p>
                        <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                          {{ a.service || a.province }}@if (s.affectations.length > 1) { <span class="ml-1 rounded-full bg-slate-100 px-1.5 py-px font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300" [title]="autres(s)">+{{ s.affectations.length - 1 }} établissement(s)</span> }
                        </p>
                      }
                    </div>
                    <!-- Statut et contact -->
                    <div class="hidden items-center gap-3 lg:flex">
                      <div class="text-right">
                        <span class="inline-flex items-center gap-1.5 text-xs font-semibold" [class]="s.statut === 'Actif' ? 'text-accent-700 dark:text-accent-300' : 'text-rose-700 dark:text-rose-300'">
                          <span class="h-1.5 w-1.5 rounded-full" [class]="s.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>{{ s.statut }}
                        </span>
                        <p class="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">{{ s.derniereConnexion ? 'Vu le ' + (s.derniereConnexion | date: 'dd/MM/yy') : 'Jamais connecté' }}</p>
                      </div>
                      <span class="flex gap-1">
                        <a [href]="'tel:' + s.telephone.split(' ').join('')" (click)="$event.stopPropagation()" class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-accent-600 hover:text-white dark:bg-slate-800 dark:text-slate-300" [title]="'Appeler ' + s.telephone"><i class="fa-solid fa-phone text-xs"></i></a>
                      </span>
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      } @else {
        <!-- Vue tableau -->
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <thead class="bg-slate-50/70 dark:bg-slate-800/50">
                <tr>
                  <th class="table-th">Soignant</th>
                  <th class="table-th">Fonction</th>
                  <th class="table-th">Établissement(s) d’affectation</th>
                  <th class="table-th">Contact</th>
                  <th class="table-th">Accès</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (s of filtres(); track s.id) {
                  <tr class="cursor-pointer transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40" (click)="fiche.set(s)">
                    <td class="table-td">
                      <div class="flex items-center gap-3">
                        @if (s.photo) {
                          <img [src]="s.photo" alt="" loading="lazy" class="h-10 w-10 flex-none rounded-full object-cover">
                        } @else {
                          <span class="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold {{ teinte(s).initiales }}">{{ s.prenom.charAt(0) }}{{ s.nom.charAt(0) }}</span>
                        }
                        <div class="min-w-0">
                          <p class="font-medium text-slate-900 dark:text-white">{{ titre(s) }}{{ s.prenom }} {{ s.nom }} {{ s.postnom }}</p>
                          <p class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ s.matricule }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="table-td">
                      <span class="badge {{ categories[cat(s)].badge }}"><i class="fa-solid {{ categories[cat(s)].icone }}"></i>{{ s.role }}</span>
                      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ s.specialite }}</p>
                    </td>
                    <td class="table-td">
                      @for (a of s.affectations; track a.etablissementId; let premier = $first) {
                        <p class="whitespace-nowrap" [class]="premier ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'">
                          @if (premier && s.affectations.length > 1) { <i class="fa-solid fa-star mr-1 text-[10px] text-amber-500" title="Établissement principal"></i> }
                          {{ a.nom }}@if (a.service) { <span class="text-xs text-slate-500 dark:text-slate-400"> · {{ a.service }}</span> }
                        </p>
                      }
                    </td>
                    <td class="table-td text-slate-600 dark:text-slate-300">
                      <p class="whitespace-nowrap">{{ s.telephone }}</p>
                      <p class="max-w-[14rem] truncate text-xs text-slate-500 dark:text-slate-400">{{ s.email }}</p>
                    </td>
                    <td class="table-td">
                      <span class="inline-flex items-center gap-1.5 text-xs font-semibold" [class]="s.statut === 'Actif' ? 'text-accent-700 dark:text-accent-300' : 'text-rose-700 dark:text-rose-300'">
                        <span class="h-1.5 w-1.5 rounded-full" [class]="s.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>{{ s.statut }}
                      </span>
                      <p class="mt-0.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{{ s.derniereConnexion ? 'Vu le ' + (s.derniereConnexion | date: 'dd/MM/yyyy') : 'Jamais connecté' }}</p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Fiche du soignant -->
    @if (fiche(); as s) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-fiche-soignant" (keydown.escape)="fiche.set(null)">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="fiche.set(null)"></div>
        <div class="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
          <div class="relative h-32 flex-none bg-gradient-to-br {{ teinte(s).bande }}">
            <button type="button" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30" (click)="fiche.set(null)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="px-6">
            <div class="relative z-10 -mt-14 flex items-end gap-4">
              @if (s.photo) {
                <img [src]="s.photo" alt="" class="h-28 w-28 rounded-3xl object-cover shadow-lg ring-4 ring-white dark:ring-slate-900">
              } @else {
                <span class="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br text-3xl font-bold shadow-lg ring-4 ring-white dark:ring-slate-900 {{ teinte(s).initiales }}">{{ s.prenom.charAt(0) }}{{ s.nom.charAt(0) }}</span>
              }
              <span class="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="s.statut === 'Actif' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'">
                <span class="h-1.5 w-1.5 rounded-full" [class]="s.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>Compte {{ s.statut === 'Actif' ? 'actif' : 'suspendu' }}
              </span>
            </div>
            <h2 id="titre-fiche-soignant" class="mt-4 text-xl font-bold text-slate-900 dark:text-white">{{ titre(s) }}{{ s.prenom }} {{ s.nom }} {{ s.postnom }}</h2>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400"><span class="font-mono">{{ s.matricule }}</span> · {{ s.specialite }}</p>
            <span class="badge mt-3 {{ categories[cat(s)].badge }}"><i class="fa-solid {{ categories[cat(s)].icone }}"></i>{{ s.role }}</span>

            <div class="mt-5">
              <a [href]="'tel:' + s.telephone.split(' ').join('')" class="btn-secondary w-full justify-center"><i class="fa-solid fa-phone"></i> Appeler {{ s.telephone }}</a>
            </div>
          </div>

          <div class="space-y-6 p-6">
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-hospital mr-1"></i> Établissement(s) d’affectation</h3>
              <ul class="space-y-2">
                @for (a of s.affectations; track a.etablissementId; let premier = $first) {
                  <li class="flex items-start gap-3 rounded-2xl border p-3" [class]="premier ? 'border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5' : 'border-slate-200 dark:border-slate-700'">
                    <span class="flex h-9 w-9 flex-none items-center justify-center rounded-xl" [class]="premier ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'"><i class="fa-solid" [class]="premier ? 'fa-star' : 'fa-hospital'"></i></span>
                    <div class="min-w-0">
                      <p class="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">
                        {{ a.nom }}
                        @if (premier) { <span class="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Principal</span> }
                        @if (a.statut === 'Suspendu') { <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">Suspendu</span> }
                      </p>
                      <p class="text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ a.code }}</span> · {{ a.type }} · {{ a.province }}</p>
                      @if (a.service) { <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Service : {{ a.service }}</p> }
                    </div>
                  </li>
                }
              </ul>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-briefcase-medical mr-1"></i> Profession</h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Grade</dt><dd class="font-medium text-slate-900 dark:text-white">{{ s.grade }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Spécialité</dt><dd class="font-medium text-slate-900 dark:text-white">{{ s.specialite }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">N° d’Ordre</dt><dd class="font-mono font-medium text-slate-900 dark:text-white">{{ s.numeroOrdre || '—' }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Sexe</dt><dd class="font-medium text-slate-900 dark:text-white">{{ s.sexe === 'F' ? 'Femme' : 'Homme' }}</dd></div>
              </dl>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-shield-halved mr-1"></i> Compte</h3>
              <dl class="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Téléphone</dt><dd class="text-right text-slate-900 dark:text-white">{{ s.telephone }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">E-mail</dt><dd class="break-all text-right text-slate-900 dark:text-white">{{ s.email }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Dernière connexion</dt><dd class="text-right text-slate-900 dark:text-white">{{ s.derniereConnexion ? (s.derniereConnexion | date: 'dd/MM/yyyy HH:mm') : 'Jamais' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Mot de passe</dt><dd class="text-right text-slate-900 dark:text-white">{{ s.doitChangerMotDePasse ? 'Temporaire (à changer)' : 'Personnel' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Compte créé le</dt><dd class="text-right text-slate-900 dark:text-white">{{ s.creeLe ? (s.creeLe | date: 'dd/MM/yyyy') : '—' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Ajouté par</dt><dd class="text-right text-slate-900 dark:text-white">{{ s.ajoutePar ? s.ajoutePar.nom : '—' }}@if (s.ajoutePar) {<span class="block text-xs text-slate-500 dark:text-slate-400">{{ s.ajoutePar.role }}</span>}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    }
  `,
})
export class ComitePersonnelComponent {
  private http = inject(HttpClient);
  /** Filtre initial par établissement (lien « Voir le personnel » d'une fiche établissement). */
  etablissement = input<string>('');

  readonly categories = CATEGORIES;
  readonly categoriesListe: CategorieSoignant[] = ['Médecin', 'Infirmier', 'Sage-femme'];
  soignants = signal<SoignantComite[]>([]);
  recu = signal(false);
  erreur = signal('');
  attente = computed(() => !this.recu() && !this.erreur());
  fiche = signal<SoignantComite | null>(null);

  vue = signal<'cartes' | 'tableau'>('cartes');
  regrouper = signal(false);
  recherche = signal('');
  categorie = signal<CategorieSoignant | ''>('');
  statut = signal<'' | 'Actif' | 'Suspendu'>('');
  choixEtablissement = signal<string | null>(null);
  filtreEtablissement = computed(() => this.choixEtablissement() ?? this.etablissement() ?? '');
  filtreActif = computed(() => !!(this.recherche().trim() || this.categorie() || this.statut() || this.filtreEtablissement()));

  constructor() {
    this.charger();
  }

  charger(): void {
    this.erreur.set('');
    firstValueFrom(this.http.get<SoignantComite[]>(`${API_COMITE}/soignants`))
      .then(l => { this.soignants.set(l); this.recu.set(true); })
      .catch(err => this.erreur.set(messageErreur(err)));
  }

  effacerFiltres(): void {
    this.recherche.set('');
    this.categorie.set('');
    this.statut.set('');
    this.choixEtablissement.set('');
  }

  cat = (s: SoignantComite) => categorieDuRole(s.role);
  teinte = (s: SoignantComite) => TEINTES[this.cat(s)];
  titre = (s: SoignantComite) => (this.cat(s) === 'Médecin' ? 'Dr ' : '');
  /** Autres établissements d'affectation (infobulle « +N »). */
  autres = (s: SoignantComite) => s.affectations.slice(1).map(a => a.nom).join(', ');

  actifs = computed(() => this.soignants().filter(s => s.statut === 'Actif').length);

  repartition = computed(() => {
    const l = this.soignants();
    return this.categoriesListe.map(c => {
      const n = l.filter(s => this.cat(s) === c).length;
      return { categorie: c, libelle: CATEGORIES[c].pluriel, n, pct: l.length ? Math.round((n / l.length) * 100) : 0, barre: TEINTES[c].barre, pastille: TEINTES[c].pastille };
    });
  });

  /** Établissements présents dans la liste, avec leur effectif. */
  etablissements = computed(() => {
    const m = new Map<string, { id: string; nom: string; code: string; province: string; n: number }>();
    for (const s of this.soignants()) {
      for (const a of s.affectations) {
        const e = m.get(a.etablissementId) ?? { id: a.etablissementId, nom: a.nom, code: a.code, province: a.province, n: 0 };
        e.n++;
        m.set(a.etablissementId, e);
      }
    }
    return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });
  nbEtablissements = computed(() => this.etablissements().length);

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const etab = this.filtreEtablissement();
    return this.soignants().filter(s =>
      (!etab || s.affectations.some(a => a.etablissementId === etab))
      && (!this.categorie() || this.cat(s) === this.categorie())
      && (!this.statut() || s.statut === this.statut())
      && (!q || `${s.prenom} ${s.nom} ${s.postnom} ${s.matricule} ${s.email} ${s.specialite} ${s.role} ${s.affectations.map(a => a.nom).join(' ')}`.toLowerCase().includes(q)));
  });

  /** Cartes : une seule section, ou une section par établissement (un soignant peut figurer dans plusieurs). */
  groupes = computed(() => {
    const liste = this.filtres();
    if (!this.regrouper()) return [{ id: 'tous', nom: '', code: '', province: '', soignants: liste }];
    const etab = this.filtreEtablissement();
    return this.etablissements()
      .filter(e => !etab || e.id === etab)
      .map(e => ({ ...e, soignants: liste.filter(s => s.affectations.some(a => a.etablissementId === e.id)) }))
      .filter(g => g.soignants.length);
  });
}
