import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { AvatarComponent } from '../../components/avatar.component';
import { AlerteUrgence, BASE_SECOURS, EtatAlerte, Gravite, STATUTS_COURSE, StatutCourse, jour } from '../../data/urgences';
import { UrgencesService } from '../../data/urgences.service';
import { Ambulance, Chauffeur, FlotteService } from '../../data/flotte.service';
import { HistoriqueUrgencesComponent } from './historique-urgences.component';
import { Itineraire, adresseDe, calculerItineraire } from '../../data/tomtom';
import {
  TEINTE, coucheOsm, coucheTomTom, coucheTrafic, creerCarte, deplacerAmbulance, iconeAmbulance, iconePatiente,
  lierPhotoEtablissement, marqueurEtablissement, urlTomTom,
} from '../../data/carte';
import { EtablissementsService } from '../../data/etablissements.service';
import { SessionService, messageErreur } from '../../data/session.service';
import { Soignant, SoignantsService } from '../../data/soignants.service';
import { ThemeService } from '../../../shared/theme.service';

type Filtre = 'actives' | 'toutes';
type Vue = 'direct' | 'historique';

/** Nouveau calcul de l'itinéraire de l'ambulance : après ce délai ou ce déplacement. */
const RECALCUL_MS = 30_000;
const RECALCUL_M = 250;

/**
 * Urgences en direct : alertes de détresse envoyées par les patientes (application mobile), avec
 * sirène tant qu'une alerte n'est pas prise en charge. La régulation envoie un chauffeur et une
 * ambulance ; la position GPS de l'ambulance arrive chaque seconde de l'application chauffeur et
 * le marqueur glisse sur la carte. Le chauffeur indique le statut de la course.
 */
@Component({
  selector: 'app-urgences',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, HistoriqueUrgencesComponent],
  template: `
<div class="mx-auto max-w-7xl space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Urgences
        @if (nouvelles > 0) {
          <span class="badge bg-rose-600 text-white">
            <span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-white"></span></span>
            {{ nouvelles }} nouvelle{{ nouvelles > 1 ? 's' : '' }}
          </span>
        }
      </h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Alertes de détresse envoyées par les patientes depuis leur application, localisées par GPS. Ambulances suivies en direct.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" (click)="urgences.basculerSon()" class="btn-secondary" [attr.aria-pressed]="urgences.muet()"
              [title]="urgences.muet() ? 'Réactiver la sirène des nouvelles alertes' : 'Couper la sirène des nouvelles alertes'">
        <i class="fa-solid" [class]="urgences.muet() ? 'fa-volume-xmark text-rose-500' : 'fa-volume-high text-accent-600'"></i>
        {{ urgences.muet() ? 'Son coupé' : 'Son activé' }}
      </button>
      <div class="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-semibold dark:bg-slate-800" role="tablist" aria-label="Vue">
        @for (v of vues; track v.id) {
          <button type="button" role="tab" (click)="vue = v.id" [attr.aria-selected]="vue === v.id"
                  class="flex items-center gap-2 rounded-lg px-4 py-2 transition"
                  [class]="vue === v.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'">
            <i class="fa-solid {{ v.icon }}"></i> {{ v.label }}
          </button>
        }
      </div>
    </div>
  </div>

  @if (erreur) {
    <div class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
      <i class="fa-solid fa-circle-exclamation mt-0.5"></i><span class="flex-1">{{ erreur }}</span>
      <button type="button" (click)="erreur = ''" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
    </div>
  }

  <!-- Alertes en attente de prise en charge : visibles tout de suite, sans chercher dans la page -->
  @for (n of enAttente; track n.id) {
    <div class="flex flex-col gap-3 rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 shadow-lg shadow-rose-500/20 sm:flex-row sm:items-center dark:bg-rose-500/10" role="alert">
      <span class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-600 text-xl text-white">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60"></span>
        <i class="fa-solid fa-truck-medical relative"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-bold text-rose-800 dark:text-rose-200">Nouvelle alerte · {{ n.patiente }} <span class="font-mono text-xs font-normal">{{ n.id }}</span></p>
        <p class="text-sm text-rose-700 dark:text-rose-300">{{ n.motif }} · gravité {{ n.gravite }} · {{ n.heure }}{{ n.commune ? ' · ' + n.commune : '' }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" (click)="ouvrir(n)"><i class="fa-solid fa-eye"></i> Voir</button>
        <button type="button" class="btn-primary !bg-rose-600 hover:!bg-rose-700" [disabled]="envoi" (click)="prendreEnCharge(n)">
          <i class="fa-solid fa-hand-holding-medical"></i> Prendre en charge
        </button>
      </div>
    </div>
  }

  @if (vue === 'historique') {
    <app-historique-urgences (suivre)="suivreSurCarte($event)" />
  }

  <!-- Suivi en direct : masqué plutôt que détruit, pour garder la carte et les ambulances en mouvement -->
  <div class="space-y-6" [class.hidden]="vue !== 'direct'">
  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Liste des alertes -->
    <div class="card flex flex-col overflow-hidden lg:max-h-[38rem]">
      <div class="card-header">
        <h2 class="card-title"><i class="fa-solid fa-triangle-exclamation text-rose-500"></i> Alertes</h2>
        <div class="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold dark:bg-slate-800" role="group" aria-label="Alertes affichées">
          @for (f of filtres; track f.id) {
            <button type="button" (click)="changerFiltre(f.id)" [attr.aria-pressed]="filtre === f.id"
                    class="rounded-md px-2 py-1 transition"
                    [class]="filtre === f.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'">
              {{ f.label }}
            </button>
          }
        </div>
      </div>
      <ul class="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        @for (a of visibles; track a.id) {
          <li>
            <button type="button" (click)="selectionner(a)"
                    class="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    [class]="selection?.id === a.id ? '!bg-brand-50 dark:!bg-brand-500/10' : a.etat === 'nouvelle' ? 'bg-rose-50/60 dark:bg-rose-500/5' : ''">
              <span class="relative shrink-0">
                <app-avatar [photo]="a.photo" [prenom]="a.patiente.split(' ')[0]" [nomFamille]="a.patiente.split(' ')[1]" class="h-10 w-10 rounded-full text-xs" />
                <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 {{ teinte(a.gravite) }}"></span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ a.patiente }}</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">{{ a.date === aujourdhui ? a.heure : a.date.split('-').reverse().join('/') + ' ' + a.heure }}</span>
                </span>
                <span class="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">{{ a.motif }}</span>
                <span class="mt-1.5 flex flex-wrap items-center gap-2">
                  @if (a.commune) { <span class="text-xs text-slate-500 dark:text-slate-400"><i class="fa-solid fa-location-dot mr-1"></i>{{ a.quartier ? a.quartier + ', ' : '' }}{{ a.commune }}</span> }
                  <span class="badge {{ badgeEtat(a.etat) }}">{{ a.etat }}</span>
                  @if (a.ambulanceId && estActive(a)) {
                    <span class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><i class="fa-solid fa-truck-medical"></i> {{ a.ambulanceId }} · {{ a.statutCourse }}</span>
                  }
                  @if (urgences.nonLus()[a.id]; as n) {
                    <span class="badge bg-rose-600 text-white"><i class="fa-solid fa-comment"></i> {{ n }}</span>
                  }
                </span>
              </span>
            </button>
          </li>
        } @empty {
          <li class="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            @if (urgences.charge()) { <i class="fa-solid fa-circle-check mb-2 block text-2xl text-accent-500"></i>Aucune alerte active. }
            @else { <i class="fa-solid fa-spinner fa-spin mb-2 block text-2xl"></i>Chargement… }
          </li>
        }
      </ul>
    </div>

    <!-- Carte -->
    <div class="card overflow-hidden lg:col-span-2">
      <div #carte class="relative z-0 h-[26rem] w-full lg:h-[38rem]" role="region" aria-label="Carte des alertes de détresse et des ambulances"></div>
    </div>
  </div>

  <!-- Détail de l'alerte sélectionnée -->
  @if (selection; as a) {
    @let amb = flotte.ambulance(a.ambulanceId);
    <div #detail class="card scroll-mt-24 overflow-hidden" [class.ring-2]="a.etat === 'nouvelle' || (estActive(a) && !a.statutCourse)" [class.ring-rose-500]="a.etat === 'nouvelle'" [class.ring-brand-500]="a.etat !== 'nouvelle'">
      <div class="card-header flex-wrap">
        <h2 class="card-title"><i class="fa-solid fa-truck-medical text-rose-500"></i> {{ a.id }} — {{ a.patiente }}</h2>
        <a [routerLink]="['/admin/patientes', a.patienteId]" class="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Ouvrir le dossier <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="grid gap-5 p-5 md:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Motif · gravité</p>
          <p class="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{{ a.motif }} · <span class="capitalize">{{ a.gravite }}</span></p>
          @if (a.precisions) { <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">« {{ a.precisions }} »</p> }
          <p class="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Adresse estimée</p>
          <p class="mt-1 text-sm text-slate-800 dark:text-slate-200">{{ adresse ?? ((a.quartier ? a.quartier + ', ' : '') + (a.commune || 'Position GPS')) }}</p>
          <p class="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{{ a.lat.toFixed(5) }}, {{ a.lng.toFixed(5) }}{{ a.precisionM ? ' · ±' + a.precisionM + ' m' : '' }}</p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ amb?.position && estActive(a) ? 'Ambulance → patiente' : 'Itinéraire depuis la structure' }}</p>
          @if (calcul && !itineraire) {
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Calcul TomTom…</p>
          } @else if (itineraire) {
            @let it = itineraire;
            <p class="mt-1 text-xl font-bold text-slate-900 dark:text-white">{{ minutes(it.dureeS) }} min <span class="text-sm font-medium text-slate-500 dark:text-slate-400">· {{ (it.distanceM / 1000).toFixed(1) }} km</span></p>
            @if (it.retardS > 60) {
              <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-car-burst mr-1"></i>dont {{ minutes(it.retardS) }} min liées au trafic</p>
            }
          } @else {
            <p class="mt-1 text-sm text-rose-600 dark:text-rose-400">Itinéraire indisponible.</p>
          }
          @if (amb) {
            <p class="mt-3 flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300">
              <i class="fa-solid fa-truck-medical"></i>
              <span><strong>{{ amb.id }}</strong> · {{ amb.immatriculation }} — {{ a.chauffeur }}</span>
            </p>
            @if (a.infirmier) {
              <p class="mt-1 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><i class="fa-solid fa-user-nurse text-brand-600 dark:text-brand-400"></i> {{ a.infirmier.nom }} · {{ a.infirmier.role }}</p>
            }
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              @if (amb.position) { GPS reçu à {{ heureGps(amb.position.le) }}{{ amb.position.vitesse != null ? ' · ' + amb.position.vitesse + ' km/h' : '' }} }
              @else { En attente de la première position GPS de l’application chauffeur. }
            </p>
          }
        </div>
        <div class="flex flex-wrap content-start items-start gap-2 md:justify-end">
          @if (a.telephone) { <a [href]="lienTel(a)" class="btn-secondary"><i class="fa-solid fa-phone"></i> {{ a.telephone }}</a> }
          @if (a.etat === 'nouvelle') {
            <button class="btn-primary" [disabled]="envoi" (click)="prendreEnCharge(a)"><i class="fa-solid fa-hand-holding-medical"></i> Prendre en charge</button>
          }
          @if (estActive(a)) {
            @if (a.statutCourse && a.statutCourse !== 'Assignée') {
              <button class="btn-primary" [disabled]="envoi" (click)="cloturer(a)"><i class="fa-solid fa-check"></i> Clôturer</button>
            }
            @if (!annulation) {
              <button class="btn-ghost text-slate-500" (click)="annulation = true" title="Alerte déclenchée par erreur"><i class="fa-solid fa-ban"></i> Fausse alerte</button>
            } @else {
              <div class="flex w-full flex-wrap gap-2 md:justify-end">
                <input class="input md:w-64" [(ngModel)]="motifAnnulation" placeholder="Motif (ex. appel : la patiente va bien)" aria-label="Motif de l’annulation">
                <button class="btn-secondary" (click)="annulation = false">Retour</button>
                <button class="btn-primary !bg-rose-600" [disabled]="!motifAnnulation.trim() || envoi" (click)="annuler(a)">Annuler l’alerte</button>
              </div>
            }
          }
        </div>
      </div>

      <!-- Envoi du chauffeur et de l'ambulance -->
      @if (estActive(a) && (!a.statutCourse || a.statutCourse === 'Assignée')) {
        <div class="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {{ a.statutCourse ? 'Changer l’équipe (avant le départ)' : 'Étape suivante : envoyer un chauffeur, une ambulance et un·e infirmier·ère' }}
          </p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <label class="label" for="envoi-chauffeur">Chauffeur</label>
              <select id="envoi-chauffeur" class="input" [ngModel]="choixChauffeur" (ngModelChange)="choisirChauffeur($event)">
                <option [ngValue]="''">— Choisir —</option>
                @for (c of chauffeursEnvoyables(); track c.id) {
                  <option [ngValue]="c.id">{{ c.prenom }} {{ c.nom }} · {{ c.matricule }}{{ flotte.enLigne(c) ? ' · en ligne' : ' · hors ligne' }}</option>
                }
              </select>
            </div>
            <div>
              <label class="label" for="envoi-ambulance">Ambulance</label>
              <select id="envoi-ambulance" class="input" [(ngModel)]="choixAmbulance">
                <option [ngValue]="''">— Choisir —</option>
                @for (x of ambulancesEnvoyables(); track x.id) {
                  <option [ngValue]="x.id">{{ x.id }} · {{ x.immatriculation }} · {{ x.type.split(' — ')[0] }}</option>
                }
              </select>
            </div>
            <div>
              <label class="label" for="envoi-infirmier">Infirmier·ère / sage-femme</label>
              <select id="envoi-infirmier" class="input" [(ngModel)]="choixInfirmier">
                <option [ngValue]="''">— Sans accompagnant —</option>
                @for (s of infirmiers(); track s.id) {
                  <option [ngValue]="s.id">{{ s.prenom }} {{ s.nom }} · {{ s.role }}</option>
                }
              </select>
            </div>
            <button class="btn-primary self-end" [disabled]="!choixChauffeur || !choixAmbulance || envoi" (click)="envoyer(a)">
              <i class="fa-solid" [class]="envoi ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i> {{ a.statutCourse ? 'Réaffecter' : 'Envoyer' }}
            </button>
          </div>
          @if (!chauffeursEnvoyables().length || !ambulancesEnvoyables().length) {
            <p class="mt-2 text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>
              {{ !chauffeursEnvoyables().length ? 'Aucun chauffeur disponible (tous occupés ou suspendus).' : 'Aucune ambulance disponible (toutes occupées ou à l’atelier).' }}</p>
          }
        </div>
      }

      <!-- Statut de la course, indiqué par le chauffeur -->
      @if (a.statutCourse) {
        <div class="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Statut de la course (application chauffeur)</p>
          <ol class="flex flex-wrap gap-2">
            @for (s of etapesCourse; track s; let i = $index) {
              <li class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  [class]="i < rangCourse(a) ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : i === rangCourse(a) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'">
                <i class="fa-solid" [class]="i < rangCourse(a) ? 'fa-check' : i === rangCourse(a) ? 'fa-circle-dot' : 'fa-circle'"></i> {{ s }}
              </li>
            }
          </ol>
        </div>
      }

      <!-- Conversation : patiente, chauffeur envoyé et régulation -->
      <div class="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
        <p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <i class="fa-solid fa-comments"></i> Conversation avec la patiente{{ a.chauffeur ? ' et le chauffeur' : '' }}
        </p>
        <div #fil class="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40" role="log" aria-live="polite">
          @for (m of urgences.messages()[a.id] ?? []; track m.id) {
            <div class="flex" [class.justify-end]="m.auteur.type === 'regulation'">
              <div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm" [class]="bulle(m.auteur.type)">
                <p class="text-[11px] font-semibold opacity-80">{{ m.auteur.nom }} · {{ libelleAuteur[m.auteur.type] }} · {{ heureGps(m.le).slice(0, 5) }}</p>
                <p class="whitespace-pre-line break-words">{{ m.texte }}</p>
              </div>
            </div>
          } @empty {
            <p class="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              {{ estActive(a) ? 'Aucun message. Écrivez à la patiente' + (a.chauffeur ? ' et au chauffeur' : '') + ' : tout le monde voit la conversation.' : 'Mission terminée : la conversation a été supprimée définitivement.' }}
            </p>
          }
        </div>
        @if (estActive(a)) {
        <form class="mt-3 flex gap-2" (ngSubmit)="envoyerMessage(a)">
          <input class="input flex-1" name="message" [(ngModel)]="brouillon" maxlength="1000" autocomplete="off"
                 placeholder="Message à la patiente{{ a.chauffeur ? ' et au chauffeur' : '' }}…" aria-label="Message">
          <button type="submit" class="btn-primary" [disabled]="!brouillon.trim() || envoiMessage"><i class="fa-solid fa-paper-plane"></i><span class="sr-only">Envoyer</span></button>
        </form>
        }
      </div>

      <!-- Chronologie, conservée dans l'historique -->
      <div class="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chronologie</p>
        <ol class="flex flex-wrap gap-x-6 gap-y-3">
          @for (e of a.evenements; track $index; let dernier = $last) {
            <li class="flex items-center gap-2 text-sm">
              <span class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ e.date.slice(11) }}</span>
              <span class="font-medium" [class]="dernier ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'">{{ e.type }}</span>
              <span class="text-xs text-slate-400">· {{ e.auteur }}{{ e.detail ? ' — ' + e.detail : '' }}</span>
            </li>
          }
        </ol>
      </div>
    </div>
  }
  </div>
</div>
  `,
})
export class UrgencesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('carte', { static: true }) carteRef!: ElementRef<HTMLDivElement>;
  private zone = inject(NgZone);
  private theme = inject(ThemeService);

  urgences = inject(UrgencesService);
  flotte = inject(FlotteService);
  private etablissements = inject(EtablissementsService);
  private session = inject(SessionService);
  private soignants = inject(SoignantsService);
  @ViewChild('detail') detailRef?: ElementRef<HTMLDivElement>;

  vue: Vue = 'direct';
  vues: { id: Vue; label: string; icon: string }[] = [
    { id: 'direct', label: 'En direct', icon: 'fa-tower-broadcast' },
    { id: 'historique', label: 'Historique', icon: 'fa-clock-rotate-left' },
  ];
  filtre: Filtre = 'actives';
  filtres: { id: Filtre; label: string }[] = [
    { id: 'actives', label: 'Actives' },
    { id: 'toutes', label: 'Du jour' },
  ];
  etapesCourse = STATUTS_COURSE.filter(s => s !== 'Assignée');
  aujourdhui = jour(0);

  selection: AlerteUrgence | null = null;
  adresse: string | null = null;
  itineraire: Itineraire | null = null;
  calcul = false;
  envoi = false;
  erreur = '';
  annulation = false;
  motifAnnulation = '';
  brouillon = '';
  envoiMessage = false;
  libelleAuteur = { patiente: 'Patiente', chauffeur: 'Chauffeur', regulation: 'Régulation' };
  @ViewChild('fil') filRef?: ElementRef<HTMLDivElement>;
  choixChauffeur = '';
  choixAmbulance = '';
  choixInfirmier = '';

  /** Infirmier·ères et sages-femmes actifs, qui peuvent accompagner l'ambulance. */
  infirmiers(): Soignant[] {
    return this.soignants.soignants().filter(s => s.statut === 'Actif' && /^(Infirmier|Sage-femme)/.test(s.role));
  }

  /** Alertes en attente de prise en charge, de la plus ancienne à la plus récente. */
  get enAttente(): AlerteUrgence[] {
    return this.urgences.alertes().filter(a => a.etat === 'nouvelle').reverse();
  }

  /** Chauffeurs actifs et libres (ou celui déjà affecté à l'alerte sélectionnée). */
  chauffeursEnvoyables(): Chauffeur[] {
    return this.flotte.chauffeurs().filter(c => c.statut === 'Actif'
      && (this.flotte.disponibilite(c) === 'Disponible' || c.id === this.selection?.chauffeurId));
  }

  /** Ambulances disponibles (ou celle déjà affectée à l'alerte sélectionnée). */
  ambulancesEnvoyables(): Ambulance[] {
    return this.flotte.ambulances().filter(a => a.statut === 'Disponible' || a.id === this.selection?.ambulanceId);
  }

  private carte?: L.Map;
  private marqueurs = L.layerGroup();
  private trace?: L.Polyline;
  private redimension?: ResizeObserver;
  private fondTomTom?: L.TileLayer;
  private calqueAmbulances = L.layerGroup();
  private calqueEtablissements = L.layerGroup();
  private base?: L.Marker;
  private photoBase: string | null = null;
  private marqueursAmbulances = new Map<string, L.Marker>();
  private adresses = new Map<string, Promise<string | null>>();
  /** Origine et heure du dernier calcul d'itinéraire (pour le recalculer quand l'ambulance avance). */
  private dernierCalcul: { alerte: string; depart: L.LatLng; le: number } | null = null;

  constructor() {
    effect(() => {
      const url = urlTomTom(this.theme.sombre());
      this.zone.runOutsideAngular(() => this.fondTomTom?.setUrl(url));
    });
    // Alertes reçues ou modifiées en temps réel : la carte et la sélection suivent.
    effect(() => {
      this.urgences.alertes();
      untracked(() => {
        if (this.selection && !this.visibles.includes(this.selection)) this.deselectionner();
        this.dessinerMarqueurs();
        if (!this.selection && this.carte && this.enAttente[0]) this.selectionner(this.enAttente[0]);
      });
    });
    // Positions des ambulances (chaque seconde) : le marqueur glisse vers la nouvelle position.
    effect(() => {
      const liste = this.flotte.ambulances();
      untracked(() => {
        this.zone.runOutsideAngular(() => this.placerAmbulances(liste));
        this.peutEtreRecalculer();
      });
    });
    effect(() => {
      const fil = this.urgences.messages()[this.selection?.id ?? ''];
      if (fil?.length) untracked(() => this.defilerFil());
    });
    // Établissements géolocalisés (page Établissements sanitaires) : croix d'hôpital nommée.
    effect(() => {
      const liste = this.etablissements.etablissements();
      const actuel = this.session.etablissement()?.id;
      untracked(() => this.zone.runOutsideAngular(() => {
        this.calqueEtablissements.clearLayers();
        for (const e of liste) {
          if (e.nom === BASE_SECOURS.nom) {
            this.photoBase = e.photos[0] ?? null;
            if (this.base) lierPhotoEtablissement(this.base, BASE_SECOURS.nom, this.photoBase);
            continue;
          }
          if (e.latitude == null || e.longitude == null || e.statut !== 'Actif') continue;
          marqueurEtablissement(e.latitude, e.longitude, e.nom, e.id === actuel, e.photos[0]).addTo(this.calqueEtablissements);
        }
      }));
    });
    this.etablissements.charger().catch(() => {});
    if (!this.soignants.soignants().length) this.soignants.charger().catch(() => {});
  }

  /** Alertes du jour et alertes encore en cours (même d'un jour précédent). */
  get alertes(): AlerteUrgence[] {
    return this.urgences.alertes().filter(a => a.date === this.aujourdhui || this.estActive(a));
  }

  get visibles(): AlerteUrgence[] {
    return this.filtre === 'toutes' ? this.alertes : this.alertes.filter(a => this.estActive(a));
  }

  get nouvelles(): number {
    return this.urgences.nouvelles();
  }

  suivreSurCarte(a: AlerteUrgence): void {
    this.vue = 'direct';
    if (!this.estActive(a)) this.filtre = 'toutes';
    this.selectionner(a);
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const osm = coucheOsm();
      ({ carte: this.carte, redimension: this.redimension } = creerCarte(this.carteRef.nativeElement, {
        center: [BASE_SECOURS.lat, BASE_SECOURS.lng],
        zoom: 13,
        layers: [osm, this.calqueEtablissements, this.calqueAmbulances, this.marqueurs],
      }));
      L.control.layers(
        { 'OpenStreetMap': osm, 'TomTom': this.fondTomTom = coucheTomTom(this.theme.sombre()) },
        {
          'Établissements sanitaires': this.calqueEtablissements,
          'Ambulances': this.calqueAmbulances,
          'Trafic en temps réel (TomTom)': coucheTrafic(),
        },
      ).addTo(this.carte);
      L.control.scale({ imperial: false }).addTo(this.carte);
      this.base = marqueurEtablissement(BASE_SECOURS.lat, BASE_SECOURS.lng, BASE_SECOURS.nom, true, this.photoBase).addTo(this.carte);
      this.placerAmbulances(this.flotte.ambulances());
    });
    this.dessinerMarqueurs();
    // La plus ancienne alerte en attente est ouverte d'office.
    const enAttente = this.alertes.filter(a => a.etat === 'nouvelle').at(-1);
    if (enAttente) this.selectionner(enAttente);
  }

  ngOnDestroy(): void {
    this.urgences.ouvrirConversation(null);
    this.redimension?.disconnect();
    this.carte?.remove();
  }

  changerFiltre(f: Filtre): void {
    this.filtre = f;
    if (this.selection && !this.visibles.includes(this.selection)) this.deselectionner();
    this.dessinerMarqueurs();
  }

  async selectionner(a: AlerteUrgence): Promise<void> {
    if (this.selection !== a) {
      this.annulation = false;
      this.motifAnnulation = '';
      this.choixChauffeur = a.chauffeurId ?? '';
      this.choixAmbulance = a.ambulanceId ?? '';
      this.choixInfirmier = a.infirmier?.id ?? '';
      this.brouillon = '';
      this.urgences.ouvrirConversation(a.id).then(() => this.defilerFil()).catch(() => {});
    }
    this.selection = a;
    this.adresse = null;
    this.itineraire = null;
    this.dernierCalcul = null;
    this.trace?.remove();
    this.carte?.flyTo([a.lat, a.lng], 15, { duration: 0.8 });
    const adresse = this.adresseDe(a);
    this.calculerItineraire(a, true);
    const texte = await adresse;
    if (this.selection === a) this.adresse = texte;
  }

  /** Le chauffeur choisi part avec son ambulance attitrée si elle est disponible. */
  choisirChauffeur(id: string): void {
    this.choixChauffeur = id;
    const attitree = this.flotte.affectations().get(id);
    if (attitree && this.ambulancesEnvoyables().some(x => x.id === attitree.id)) this.choixAmbulance = attitree.id;
  }

  /** Depuis le bandeau : l'alerte s'ouvre et la page descend jusqu'à son détail. */
  ouvrir(a: AlerteUrgence): void {
    this.vue = 'direct';
    this.selectionner(a);
    this.defilerVersDetail();
  }

  /**
   * Prise en charge (la sirène s'arrête dès qu'aucune alerte n'attend plus) : le détail s'ouvre
   * sur l'envoi du chauffeur, de l'ambulance et de l'infirmier·ère.
   */
  async prendreEnCharge(a: AlerteUrgence): Promise<void> {
    this.vue = 'direct';
    if (this.selection !== a) this.selectionner(a);
    if (await this.action(() => this.urgences.prendreEnCharge(a))) this.defilerVersDetail();
  }

  async envoyer(a: AlerteUrgence): Promise<void> {
    if (await this.action(() => this.urgences.affecter(a, this.choixChauffeur, this.choixAmbulance, this.choixInfirmier || null))) this.calculerItineraire(a, true);
  }

  private defilerVersDetail(): void {
    setTimeout(() => this.detailRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async cloturer(a: AlerteUrgence): Promise<void> {
    await this.action(() => this.urgences.cloturer(a, 'Clôturée par la régulation'));
  }

  async annuler(a: AlerteUrgence): Promise<void> {
    if (await this.action(() => this.urgences.annuler(a, this.motifAnnulation.trim()))) this.annulation = false;
  }

  private async action(f: () => Promise<unknown>): Promise<boolean> {
    this.envoi = true;
    this.erreur = '';
    try {
      await f();
      return true;
    } catch (err) {
      this.erreur = messageErreur(err);
      return false;
    } finally {
      this.envoi = false;
    }
  }

  estActive(a: AlerteUrgence | undefined | null): boolean {
    return a?.etat === 'nouvelle' || a?.etat === 'prise en charge';
  }

  rangCourse(a: AlerteUrgence): number {
    return (this.etapesCourse as (StatutCourse | null)[]).indexOf(a.statutCourse);
  }

  teinte(g: Gravite): string {
    return TEINTE[g];
  }

  badgeEtat(e: EtatAlerte): string {
    switch (e) {
      case 'nouvelle': return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
      case 'prise en charge': return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
      case 'annulée': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
      default: return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
    }
  }

  lienTel(a: AlerteUrgence): string {
    return 'tel:' + a.telephone.replace(/\s/g, '');
  }

  minutes(s: number): number {
    return Math.max(1, Math.round(s / 60));
  }

  heureGps(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR');
  }

  private adresseDe(a: AlerteUrgence): Promise<string | null> {
    const cle = `${a.lat.toFixed(4)},${a.lng.toFixed(4)}`;
    let p = this.adresses.get(cle);
    if (!p) {
      p = adresseDe(a.lat, a.lng).catch(() => null);
      this.adresses.set(cle, p);
    }
    return p;
  }

  /** Départ : position GPS de l'ambulance engagée, sinon la structure de rattachement. */
  private depart(a: AlerteUrgence): L.LatLng {
    const p = this.estActive(a) ? this.flotte.ambulance(a.ambulanceId)?.position : null;
    return p ? L.latLng(p.lat, p.lng) : L.latLng(BASE_SECOURS.lat, BASE_SECOURS.lng);
  }

  private async calculerItineraire(a: AlerteUrgence, recentrer = false): Promise<void> {
    const depart = this.depart(a);
    this.dernierCalcul = { alerte: a.id, depart, le: Date.now() };
    this.calcul = true;
    try {
      const it = await calculerItineraire([depart.lat, depart.lng], [a.lat, a.lng]);
      if (this.selection !== a) return;
      this.itineraire = it;
      this.zone.runOutsideAngular(() => {
        this.trace?.remove();
        if (!this.carte) return;
        this.trace = L.polyline(it.points, { color: '#e11d48', weight: 5, opacity: 0.85 }).addTo(this.carte);
        if (recentrer) this.carte.flyToBounds(this.trace.getBounds(), { padding: [40, 40], duration: 0.8 });
      });
    } catch {
      if (this.selection === a) this.itineraire = null;
    } finally {
      if (this.selection === a) this.calcul = false;
    }
  }

  /** L'ambulance a bien avancé (ou 30 s écoulées) : durée et tracé restants recalculés. */
  private peutEtreRecalculer(): void {
    const a = this.selection;
    const d = this.dernierCalcul;
    if (!a || !d || d.alerte !== a.id || !this.estActive(a) || this.calcul) return;
    const ici = this.depart(a);
    if (Date.now() - d.le >= RECALCUL_MS || ici.distanceTo(d.depart) >= RECALCUL_M) this.calculerItineraire(a);
  }

  private placerAmbulances(liste: Ambulance[]): void {
    if (!this.carte) return;
    const vues = new Set<string>();
    for (const a of liste) {
      if (!a.position || a.statut === 'Hors service') continue;
      vues.add(a.id);
      const c: Chauffeur | undefined = this.flotte.chauffeur(a.chauffeurId);
      const infobulle = `<strong>${a.id}</strong> · ${a.immatriculation}<br>${a.statut === 'En mission' ? `Occupée → ${a.alerteId}` : a.statut}`
        + (c ? `<br>${c.prenom} ${c.nom}` : '') + (a.position.vitesse != null ? ` · ${a.position.vitesse} km/h` : '');
      let m = this.marqueursAmbulances.get(a.id);
      if (!m) {
        m = L.marker([a.position.lat, a.position.lng], { icon: iconeAmbulance(a.statut === 'En mission' ? 34 : 26), zIndexOffset: 500 })
          .bindTooltip(infobulle, { direction: 'top', offset: [0, -11] })
          .on('click', () => this.zone.run(() => {
            const alerte = this.urgences.alerte(this.flotte.ambulance(a.id)?.alerteId);
            if (alerte) this.selectionner(alerte);
          }))
          .addTo(this.calqueAmbulances);
        m.getElement()?.classList.add('ambulance-fluide');
        this.marqueursAmbulances.set(a.id, m);
      } else {
        deplacerAmbulance(m, [a.position.lat, a.position.lng]);
        m.setTooltipContent(infobulle);
        m.getElement()?.classList.toggle('ambulance-libre', a.statut !== 'En mission');
      }
    }
    for (const [code, m] of this.marqueursAmbulances) {
      if (vues.has(code)) continue;
      m.remove();
      this.marqueursAmbulances.delete(code);
    }
  }

  async envoyerMessage(a: AlerteUrgence): Promise<void> {
    const texte = this.brouillon.trim();
    if (!texte) return;
    this.envoiMessage = true;
    try {
      await this.urgences.envoyerMessage(a.id, texte);
      this.brouillon = '';
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoiMessage = false;
    }
  }

  bulle(type: 'patiente' | 'chauffeur' | 'regulation'): string {
    return type === 'regulation' ? 'bg-brand-600 text-white'
      : type === 'chauffeur' ? 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100'
      : 'bg-white text-slate-800 dark:bg-slate-700 dark:text-slate-100';
  }

  /** Dernier message visible en bas du fil. */
  private defilerFil(): void {
    setTimeout(() => this.filRef?.nativeElement.scrollTo({ top: this.filRef.nativeElement.scrollHeight }));
  }

  private deselectionner(): void {
    this.urgences.ouvrirConversation(null);
    this.selection = null;
    this.trace?.remove();
  }

  private dessinerMarqueurs(): void {
    this.marqueurs.clearLayers();
    for (const a of this.visibles) {
      L.marker([a.lat, a.lng], { icon: iconePatiente(a, a.etat === 'nouvelle'), zIndexOffset: a.etat === 'nouvelle' ? 800 : 0 })
        .bindTooltip(`<strong>${a.patiente}</strong><br>${a.motif}`, { direction: 'top', offset: [0, -18] })
        .on('click', () => this.zone.run(() => this.selectionner(a)))
        .addTo(this.marqueurs);
    }
  }
}
