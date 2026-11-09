import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_COMITE } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';

interface EtablissementLie { id: string | null; code: string; nom: string; province: string; type: string; statut: 'Actif' | 'Suspendu' | null }

interface AmbulanceComite {
  id: string; code: string; immatriculation: string; modele: string; annee: number | null; type: string;
  statut: 'Disponible' | 'En mission' | 'Maintenance' | 'Hors service'; infirmier: string; kilometrage: number; carburant: number;
  prochaineRevision: string | null; urgence: string | null; creeLe: string | null; positionLe: string | null; missions: number;
  etablissement: EtablissementLie;
  chauffeur: { id: string; matricule: string; nom: string; telephone: string; photo: string | null } | null;
}

interface ChauffeurComite {
  id: string; matricule: string; prenom: string; nom: string; postnom: string; telephone: string; photo: string | null;
  permis: string; permisExpire: string | null; statut: 'Actif' | 'Suspendu'; derniereConnexion: string | null;
  doitChangerMotDePasse: boolean; creeLe: string | null; missions: number;
  etablissement: EtablissementLie;
  ambulance: { code: string; immatriculation: string; statut: string } | null;
}

/** État d'une ambulance : couleur d'état + pictogramme + libellé (jamais la couleur seule). */
const ETATS: Record<AmbulanceComite['statut'], { icone: string; classe: string; point: string; bande: string }> = {
  Disponible: { icone: 'fa-circle-check', classe: 'text-accent-700 dark:text-accent-300', point: 'bg-accent-500', bande: 'from-accent-500 to-accent-700' },
  'En mission': { icone: 'fa-truck-medical', classe: 'text-amber-700 dark:text-amber-300', point: 'bg-amber-500', bande: 'from-amber-400 to-amber-600' },
  Maintenance: { icone: 'fa-screwdriver-wrench', classe: 'text-orange-700 dark:text-orange-300', point: 'bg-orange-500', bande: 'from-orange-400 to-orange-600' },
  'Hors service': { icone: 'fa-ban', classe: 'text-rose-700 dark:text-rose-300', point: 'bg-rose-500', bande: 'from-rose-500 to-rose-700' },
};

/**
 * Toutes les ambulances et tous les chauffeurs de la plateforme, avec leur établissement associé.
 * Lecture seule : chaque établissement gère sa propre flotte.
 */
@Component({
  selector: 'app-comite-flotte',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- En-tête -->
      <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-700 via-rose-600 to-brand-700 p-6 text-white shadow-xl shadow-rose-900/20 sm:p-8">
        <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"></div>
        <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Comité de pilotage</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight">Ambulances et chauffeurs</h1>
            <p class="mt-2 text-sm leading-relaxed text-white/80">Toute la flotte d’urgence inscrite dans le système et l’établissement auquel chaque ambulance et chaque chauffeur est rattaché. La flotte est gérée par chaque établissement.</p>
          </div>
          <div class="flex items-end gap-6">
            <div>
              @if (attente()) { <div class="h-12 w-16 animate-pulse rounded-lg bg-white/20"></div> } @else { <p class="text-5xl font-bold tabular-nums">{{ ambulances().length }}</p> }
              <p class="text-sm text-white/75">ambulances</p>
            </div>
            <div class="border-l border-white/20 pl-6">
              <p class="text-3xl font-bold tabular-nums">{{ chauffeurs().length }}</p>
              <p class="text-sm text-white/75">chauffeurs</p>
            </div>
          </div>
        </div>
        <!-- État de la flotte -->
        @if (ambulances().length) {
          <div class="relative mt-6 flex flex-wrap gap-2">
            @for (e of repartitionEtats(); track e.statut) {
              <span class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur"><i class="fa-solid {{ e.icone }}"></i>{{ e.statut }} <b class="tabular-nums">{{ e.n }}</b></span>
            }
          </div>
        }
      </section>

      @if (erreur()) {
        <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur() }}</span>
          <button type="button" class="font-semibold underline" (click)="charger()">Réessayer</button>
        </div>
      }

      <!-- Onglets et filtres -->
      <div class="card space-y-3 p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="flex flex-none rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
            <button type="button" role="tab" class="onglet" [class.onglet-actif]="onglet() === 'ambulances'" [attr.aria-selected]="onglet() === 'ambulances'" (click)="changerOnglet('ambulances')"><i class="fa-solid fa-truck-medical"></i> Ambulances <span class="text-xs opacity-70">{{ ambulances().length }}</span></button>
            <button type="button" role="tab" class="onglet" [class.onglet-actif]="onglet() === 'chauffeurs'" [attr.aria-selected]="onglet() === 'chauffeurs'" (click)="changerOnglet('chauffeurs')"><i class="fa-solid fa-id-badge"></i> Chauffeurs <span class="text-xs opacity-70">{{ chauffeurs().length }}</span></button>
          </div>
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="search" class="input pl-10" [placeholder]="onglet() === 'ambulances' ? 'Code, immatriculation, modèle, chauffeur…' : 'Nom, matricule, téléphone, permis…'" [value]="recherche()" (input)="recherche.set($any($event.target).value)">
          </div>
          <select class="input lg:w-64" (change)="choixEtablissement.set($any($event.target).value)" aria-label="Établissement">
            <option value="" [selected]="!filtreEtablissement()">Tous les établissements</option>
            @for (e of etablissements(); track e.id) { <option [value]="e.id" [selected]="e.id === filtreEtablissement()">{{ e.nom }}</option> }
          </select>
          <select class="input lg:w-44" (change)="statut.set($any($event.target).value)" aria-label="Statut">
            <option value="" [selected]="!statut()">Tous les statuts</option>
            @for (s of statutsOnglet(); track s) { <option [value]="s" [selected]="statut() === s">{{ s }}</option> }
          </select>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400"><b class="text-slate-900 dark:text-white">{{ onglet() === 'ambulances' ? ambulancesFiltrees().length : chauffeursFiltres().length }}</b> {{ onglet() === 'ambulances' ? 'ambulance(s)' : 'chauffeur(s)' }} affiché(s)</span>
          @if (filtreActif()) {
            <button type="button" class="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300" (click)="effacerFiltres()"><i class="fa-solid fa-xmark mr-1"></i>Effacer les filtres</button>
          }
        </div>
      </div>

      @if (attente()) {
        <div class="space-y-2.5">
          @for (i of [1, 2, 3, 4]; track i) { <div class="card h-[5.5rem] p-3"><div class="skeleton h-full w-full"></div></div> }
        </div>
      } @else if (onglet() === 'ambulances') {
        <!-- Ambulances -->
        <div class="space-y-2.5">
          @for (a of ambulancesFiltrees(); track a.id) {
            <article class="card group flex h-[5.5rem] cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" (click)="ficheAmbulance.set(a)" (keydown.enter)="ficheAmbulance.set(a)" tabindex="0" [attr.aria-label]="'Voir la fiche de l’ambulance ' + a.code">
              <div class="relative flex w-20 flex-none items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 to-slate-100 sm:w-24 dark:from-rose-500/10 dark:to-slate-800">
                <img src="images/ambulance.png" alt="" class="h-12 w-auto object-contain transition duration-300 group-hover:scale-110">
                <span class="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r {{ etat(a).bande }}"></span>
              </div>
              <div class="grid min-w-0 flex-1 items-center gap-x-5 gap-y-1 px-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
                <div class="min-w-0">
                  <h3 class="truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{{ a.code }} <span class="font-mono text-xs font-normal text-slate-500">{{ a.immatriculation }}</span></h3>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ a.modele }}@if (a.annee) { · {{ a.annee }} }</p>
                </div>
                <div class="hidden min-w-0 sm:block">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100" [title]="a.etablissement.nom"><i class="fa-solid fa-hospital mr-1.5 text-xs text-slate-400"></i>{{ a.etablissement.nom }}</p>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ a.type }}</p>
                </div>
                <div class="hidden min-w-0 lg:block">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Chauffeur</p>
                  <p class="truncate text-sm text-slate-700 dark:text-slate-200">{{ a.chauffeur ? a.chauffeur.nom : 'Non attribué' }}</p>
                </div>
                <div class="hidden lg:block">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Missions</p>
                  <p class="text-sm text-slate-700 dark:text-slate-200"><b class="tabular-nums">{{ a.missions }}</b>@if (a.urgence) { <span class="ml-1 text-xs text-amber-700 dark:text-amber-300">· {{ a.urgence }}</span> }</p>
                </div>
                <div class="hidden items-center gap-3 lg:flex">
                  <span class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold {{ etat(a).classe }}"><i class="fa-solid {{ etat(a).icone }}"></i>{{ a.statut }}</span>
                </div>
              </div>
            </article>
          } @empty {
            <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800"><i class="fa-solid fa-truck-medical"></i></span>
              <p class="font-medium text-slate-900 dark:text-white">{{ ambulances().length ? 'Aucune ambulance ne correspond à ces critères.' : 'Aucune ambulance n’est encore inscrite.' }}</p>
            </div>
          }
        </div>
      } @else {
        <!-- Chauffeurs -->
        <div class="space-y-2.5">
          @for (c of chauffeursFiltres(); track c.id) {
            <article class="card group flex h-[5.5rem] cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" (click)="ficheChauffeur.set(c)" (keydown.enter)="ficheChauffeur.set(c)" tabindex="0" [attr.aria-label]="'Voir la fiche de ' + c.prenom + ' ' + c.nom">
              <div class="relative w-20 flex-none overflow-hidden sm:w-24">
                @if (c.photo) {
                  <img [src]="c.photo" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105">
                } @else {
                  <span class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-100 to-rose-200 text-2xl font-bold text-rose-800 dark:from-rose-500/30 dark:to-rose-600/30 dark:text-rose-100">{{ c.prenom.charAt(0) }}{{ c.nom.charAt(0) }}</span>
                }
                <span class="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-rose-500 to-rose-700"></span>
              </div>
              <div class="grid min-w-0 flex-1 items-center gap-x-5 gap-y-1 px-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto]">
                <div class="min-w-0">
                  <h3 class="truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{{ c.prenom }} {{ c.nom }} {{ c.postnom }}</h3>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ c.matricule }}</span> · {{ c.telephone }}</p>
                </div>
                <div class="hidden min-w-0 sm:block">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100" [title]="c.etablissement.nom"><i class="fa-solid fa-hospital mr-1.5 text-xs text-slate-400"></i>{{ c.etablissement.nom }}</p>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ c.etablissement.province || '—' }}</p>
                </div>
                <div class="hidden min-w-0 lg:block">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ambulance</p>
                  <p class="truncate text-sm text-slate-700 dark:text-slate-200">{{ c.ambulance ? c.ambulance.code + ' · ' + c.ambulance.immatriculation : 'Aucune' }}</p>
                </div>
                <div class="hidden lg:block">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Missions</p>
                  <p class="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{{ c.missions }}</p>
                </div>
                <div class="hidden items-center gap-3 lg:flex">
                  <div class="text-right">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold" [class]="c.statut === 'Actif' ? 'text-accent-700 dark:text-accent-300' : 'text-rose-700 dark:text-rose-300'">
                      <span class="h-1.5 w-1.5 rounded-full" [class]="c.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>{{ c.statut }}
                    </span>
                    <p class="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">{{ c.derniereConnexion ? 'Vu le ' + (c.derniereConnexion | date: 'dd/MM/yy') : 'Jamais connecté' }}</p>
                  </div>
                  <a [href]="'tel:' + c.telephone.split(' ').join('')" (click)="$event.stopPropagation()" class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-accent-600 hover:text-white dark:bg-slate-800 dark:text-slate-300" [title]="'Appeler ' + c.telephone"><i class="fa-solid fa-phone text-xs"></i></a>
                </div>
              </div>
            </article>
          } @empty {
            <div class="card flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800"><i class="fa-solid fa-id-badge"></i></span>
              <p class="font-medium text-slate-900 dark:text-white">{{ chauffeurs().length ? 'Aucun chauffeur ne correspond à ces critères.' : 'Aucun chauffeur n’est encore inscrit.' }}</p>
            </div>
          }
        </div>
      }
    </div>

    <!-- Fiche d'une ambulance -->
    @if (ficheAmbulance(); as a) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-fiche-ambulance" (keydown.escape)="ficheAmbulance.set(null)">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="ficheAmbulance.set(null)"></div>
        <div class="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
          <div class="relative flex h-40 flex-none items-center justify-center bg-gradient-to-br from-rose-50 via-white to-slate-100 dark:from-rose-500/10 dark:via-slate-900 dark:to-slate-800">
            <img src="images/ambulance.png" alt="" class="h-28 w-auto object-contain drop-shadow-lg">
            <button type="button" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/10 text-slate-700 transition hover:bg-slate-900/20 dark:bg-white/10 dark:text-white" (click)="ficheAmbulance.set(null)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
            <span class="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r {{ etat(a).bande }}"></span>
          </div>
          <div class="px-6 pt-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 id="titre-fiche-ambulance" class="text-xl font-bold text-slate-900 dark:text-white">{{ a.code }}</h2>
                <p class="font-mono text-sm text-slate-500 dark:text-slate-400">{{ a.immatriculation }}</p>
              </div>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800 {{ etat(a).classe }}"><i class="fa-solid {{ etat(a).icone }}"></i>{{ a.statut }}</span>
            </div>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ a.modele }}@if (a.annee) { · {{ a.annee }} } · {{ a.type }}</p>
          </div>
          <div class="space-y-6 p-6">
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-hospital mr-1"></i> Établissement associé</h3>
              <div class="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <span class="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-solid fa-hospital"></i></span>
                <div class="min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white">{{ a.etablissement.nom }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">@if (a.etablissement.code) {<span class="font-mono">{{ a.etablissement.code }}</span> · }{{ a.etablissement.type }}@if (a.etablissement.province) { · {{ a.etablissement.province }} }</p>
                </div>
              </div>
            </section>
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-id-badge mr-1"></i> Équipage</h3>
              @if (a.chauffeur; as c) {
                <div class="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  @if (c.photo) { <img [src]="c.photo" alt="" class="h-11 w-11 rounded-full object-cover"> } @else { <span class="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">{{ c.nom.charAt(0) }}</span> }
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-slate-900 dark:text-white">{{ c.nom }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400"><span class="font-mono">{{ c.matricule }}</span> · {{ c.telephone }}</p>
                  </div>
                  <a [href]="'tel:' + c.telephone.split(' ').join('')" class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-accent-600 hover:text-white dark:bg-slate-800 dark:text-slate-300" [title]="'Appeler ' + c.telephone"><i class="fa-solid fa-phone text-sm"></i></a>
                </div>
              } @else {
                <p class="text-sm text-slate-500 dark:text-slate-400">Aucun chauffeur attitré.</p>
              }
              @if (a.infirmier) { <p class="mt-2 text-sm text-slate-600 dark:text-slate-300"><i class="fa-solid fa-user-nurse mr-1.5 text-slate-400"></i>Infirmier·ère embarqué·e : {{ a.infirmier }}</p> }
            </section>
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-gauge mr-1"></i> Véhicule</h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Missions effectuées</dt><dd class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ a.missions }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Kilométrage</dt><dd class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ a.kilometrage.toLocaleString('fr-FR') }} km</dd></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <dt class="text-xs text-slate-500 dark:text-slate-400">Carburant</dt>
                  <dd class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ a.carburant }} %</dd>
                  <div class="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"><div class="h-full rounded-full" [class]="a.carburant < 25 ? 'bg-rose-500' : 'bg-accent-500'" [style.width.%]="a.carburant"></div></div>
                </div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><dt class="text-xs text-slate-500 dark:text-slate-400">Prochaine révision</dt><dd class="font-semibold text-slate-900 dark:text-white">{{ a.prochaineRevision ? (a.prochaineRevision | date: 'dd/MM/yyyy') : '—' }}</dd></div>
              </dl>
              @if (a.urgence) { <p class="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><i class="fa-solid fa-truck-medical"></i>En mission : urgence {{ a.urgence }}</p> }
              <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">Inscrite le {{ a.creeLe ? (a.creeLe | date: 'dd/MM/yyyy') : '—' }}@if (a.positionLe) { · dernière position GPS reçue le {{ a.positionLe | date: 'dd/MM/yyyy HH:mm' }} }</p>
            </section>
          </div>
        </div>
      </div>
    }

    <!-- Fiche d'un chauffeur -->
    @if (ficheChauffeur(); as c) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-fiche-chauffeur" (keydown.escape)="ficheChauffeur.set(null)">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="ficheChauffeur.set(null)"></div>
        <div class="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
          <div class="relative h-32 flex-none bg-gradient-to-br from-rose-600 to-brand-700">
            <button type="button" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30" (click)="ficheChauffeur.set(null)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="relative z-10 px-6">
            <div class="-mt-14 flex items-end gap-4">
              @if (c.photo) {
                <img [src]="c.photo" alt="" class="h-28 w-28 rounded-3xl object-cover shadow-lg ring-4 ring-white dark:ring-slate-900">
              } @else {
                <span class="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-100 to-rose-200 text-3xl font-bold text-rose-800 shadow-lg ring-4 ring-white dark:from-rose-500/30 dark:to-rose-600/30 dark:text-rose-100 dark:ring-slate-900">{{ c.prenom.charAt(0) }}{{ c.nom.charAt(0) }}</span>
              }
              <span class="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="c.statut === 'Actif' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'">
                <span class="h-1.5 w-1.5 rounded-full" [class]="c.statut === 'Actif' ? 'bg-accent-500' : 'bg-rose-500'"></span>Compte {{ c.statut === 'Actif' ? 'actif' : 'suspendu' }}
              </span>
            </div>
            <h2 id="titre-fiche-chauffeur" class="mt-4 text-xl font-bold text-slate-900 dark:text-white">{{ c.prenom }} {{ c.nom }} {{ c.postnom }}</h2>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400"><span class="font-mono">{{ c.matricule }}</span> · Chauffeur d’ambulance</p>
            <a [href]="'tel:' + c.telephone.split(' ').join('')" class="btn-secondary mt-4 w-full justify-center"><i class="fa-solid fa-phone"></i> Appeler {{ c.telephone }}</a>
          </div>
          <div class="space-y-6 p-6">
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-hospital mr-1"></i> Établissement associé</h3>
              <div class="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <span class="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-solid fa-hospital"></i></span>
                <div class="min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white">{{ c.etablissement.nom }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">@if (c.etablissement.code) {<span class="font-mono">{{ c.etablissement.code }}</span> · }{{ c.etablissement.type }}@if (c.etablissement.province) { · {{ c.etablissement.province }} }</p>
                </div>
              </div>
            </section>
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-truck-medical mr-1"></i> Ambulance attitrée</h3>
              @if (c.ambulance; as a) {
                <div class="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <img src="images/ambulance.png" alt="" class="h-9 w-auto">
                  <div><p class="font-medium text-slate-900 dark:text-white">{{ a.code }}</p><p class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ a.immatriculation }} · {{ a.statut }}</p></div>
                </div>
              } @else {
                <p class="text-sm text-slate-500 dark:text-slate-400">Aucune ambulance attribuée.</p>
              }
            </section>
            <section>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><i class="fa-solid fa-shield-halved mr-1"></i> Compte et permis</h3>
              <dl class="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Missions effectuées</dt><dd class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ c.missions }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Permis de conduire</dt><dd class="text-right font-mono text-slate-900 dark:text-white">{{ c.permis || '—' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Expiration du permis</dt><dd class="text-right text-slate-900 dark:text-white">{{ c.permisExpire ? (c.permisExpire | date: 'dd/MM/yyyy') : '—' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Dernière connexion</dt><dd class="text-right text-slate-900 dark:text-white">{{ c.derniereConnexion ? (c.derniereConnexion | date: 'dd/MM/yyyy HH:mm') : 'Jamais' }}</dd></div>
                <div class="flex justify-between gap-3 px-3 py-2.5"><dt class="text-slate-500 dark:text-slate-400">Inscrit le</dt><dd class="text-right text-slate-900 dark:text-white">{{ c.creeLe ? (c.creeLe | date: 'dd/MM/yyyy') : '—' }}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    }
  `,
})
export class ComiteFlotteComponent {
  private http = inject(HttpClient);
  /** Filtre initial par établissement (?etablissement=<id>). */
  etablissement = input<string>('');

  ambulances = signal<AmbulanceComite[]>([]);
  chauffeurs = signal<ChauffeurComite[]>([]);
  recu = signal(false);
  erreur = signal('');
  attente = computed(() => !this.recu() && !this.erreur());
  ficheAmbulance = signal<AmbulanceComite | null>(null);
  ficheChauffeur = signal<ChauffeurComite | null>(null);

  onglet = signal<'ambulances' | 'chauffeurs'>('ambulances');
  recherche = signal('');
  statut = signal('');
  choixEtablissement = signal<string | null>(null);
  filtreEtablissement = computed(() => this.choixEtablissement() ?? this.etablissement() ?? '');
  filtreActif = computed(() => !!(this.recherche().trim() || this.statut() || this.filtreEtablissement()));

  constructor() {
    this.charger();
  }

  charger(): void {
    this.erreur.set('');
    firstValueFrom(this.http.get<{ ambulances: AmbulanceComite[]; chauffeurs: ChauffeurComite[] }>(`${API_COMITE}/flotte`))
      .then(d => { this.ambulances.set(d.ambulances); this.chauffeurs.set(d.chauffeurs); this.recu.set(true); })
      .catch(err => this.erreur.set(messageErreur(err)));
  }

  changerOnglet(o: 'ambulances' | 'chauffeurs'): void {
    this.onglet.set(o);
    this.statut.set('');
  }

  effacerFiltres(): void {
    this.recherche.set('');
    this.statut.set('');
    this.choixEtablissement.set('');
  }

  etat = (a: AmbulanceComite) => ETATS[a.statut];
  statutsOnglet = computed(() => (this.onglet() === 'ambulances' ? Object.keys(ETATS) : ['Actif', 'Suspendu']));

  repartitionEtats = computed(() => (Object.keys(ETATS) as AmbulanceComite['statut'][])
    .map(statut => ({ statut, icone: ETATS[statut].icone, n: this.ambulances().filter(a => a.statut === statut).length }))
    .filter(e => e.n));

  etablissements = computed(() => {
    const m = new Map<string, string>();
    for (const x of [...this.ambulances(), ...this.chauffeurs()]) if (x.etablissement.id) m.set(x.etablissement.id, x.etablissement.nom);
    return [...m.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  ambulancesFiltrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const etab = this.filtreEtablissement();
    return this.ambulances().filter(a => (!etab || a.etablissement.id === etab) && (!this.statut() || a.statut === this.statut())
      && (!q || `${a.code} ${a.immatriculation} ${a.modele} ${a.type} ${a.chauffeur?.nom ?? ''} ${a.etablissement.nom}`.toLowerCase().includes(q)));
  });

  chauffeursFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const etab = this.filtreEtablissement();
    return this.chauffeurs().filter(c => (!etab || c.etablissement.id === etab) && (!this.statut() || c.statut === this.statut())
      && (!q || `${c.prenom} ${c.nom} ${c.postnom} ${c.matricule} ${c.telephone} ${c.permis} ${c.ambulance?.code ?? ''} ${c.etablissement.nom}`.toLowerCase().includes(q)));
  });
}
