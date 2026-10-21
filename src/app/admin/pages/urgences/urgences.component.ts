import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import * as L from 'leaflet';
import { AlerteUrgence, AmbulanceEnRoute, BASE_SECOURS, EtatAlerte, Gravite, PROGRESSION_INITIALE, jour } from '../../data/urgences';
import { UrgencesService } from '../../data/urgences.service';
import { FlotteService } from '../../data/flotte.service';
import { UTILISATEUR } from '../../data/mock-data';
import { HistoriqueUrgencesComponent } from './historique-urgences.component';
import { Itineraire, adresseDe, calculerItineraire } from '../../data/tomtom';
import {
  SIMULATION, TEINTE, coucheOsm, coucheTomTom, coucheTrafic, creerCarte, deplacerAmbulance, iconeAmbulance, iconePatiente,
  lierPhotoEtablissement, marqueurEtablissement, pointSurTrajet, urlTomTom,
} from '../../data/carte';
import { EtablissementsService } from '../../data/etablissements.service';
import { SessionService } from '../../data/session.service';
import { ThemeService } from '../../../shared/theme.service';

type Filtre = 'actives' | 'toutes';
type Vue = 'direct' | 'historique';
type InfosTomTom = { adresse: string | null; itineraire: Itineraire | null };

/**
 * Urgences : localisation en direct des patientes ayant déclenché une alerte de détresse.
 * Fond OpenStreetMap (gratuit) par défaut ; TomTom fournit les fonds alternatifs,
 * le trafic, l'adresse la plus proche et l'itinéraire depuis la structure.
 * Les ambulances engagées avancent sur cet itinéraire jusqu'à la patiente.
 */
@Component({
  selector: 'app-urgences',
  standalone: true,
  imports: [RouterLink, AvatarComponent, HistoriqueUrgencesComponent],
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
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Patientes du système ayant signalé une détresse, localisées par GPS. Chaque urgence et chaque étape de l’intervention sont conservées dans l’historique.</p>
    </div>
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

  @if (vue === 'historique') {
    <app-historique-urgences (suivre)="suivreSurCarte($event)" />
  }

  <!-- Suivi en direct : masqué plutôt que détruit, pour garder la carte et les ambulances en mouvement -->
  <div class="space-y-6" [class.hidden]="vue !== 'direct'">
  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Liste des alertes -->
    <div class="card flex flex-col overflow-hidden lg:max-h-[38rem]">
      <div class="card-header">
        <h2 class="card-title"><i class="fa-solid fa-triangle-exclamation text-rose-500"></i> Alertes du jour</h2>
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
                    [class]="selection?.id === a.id ? '!bg-brand-50 dark:!bg-brand-500/10' : ''">
              <span class="relative shrink-0">
                <app-avatar [photo]="a.photo" [prenom]="a.patiente.split(' ')[0]" [nomFamille]="a.patiente.split(' ')[1]" class="h-10 w-10 rounded-full text-xs" />
                <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 {{ teinte(a.gravite) }}"></span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ a.patiente }}</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">{{ a.heure }}</span>
                </span>
                <span class="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">{{ a.motif }}</span>
                <span class="mt-1.5 flex flex-wrap items-center gap-2">
                  <span class="text-xs text-slate-500 dark:text-slate-400"><i class="fa-solid fa-location-dot mr-1"></i>{{ a.quartier }}, {{ a.commune }}</span>
                  <span class="badge {{ badgeEtat(a.etat) }}">{{ a.etat }}</span>
                  @if (ambulanceDe(a); as amb) {
                    <span class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><i class="fa-solid fa-truck-medical"></i> {{ amb.id }}</span>
                  }
                </span>
              </span>
            </button>
          </li>
        } @empty {
          <li class="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"><i class="fa-solid fa-circle-check mb-2 block text-2xl text-accent-500"></i>Aucune alerte active.</li>
        }
      </ul>
    </div>

    <!-- Carte -->
    <div class="card overflow-hidden lg:col-span-2">
      <div #carte class="relative z-0 h-[26rem] w-full lg:h-[38rem]" role="region" aria-label="Carte des alertes de détresse"></div>
    </div>
  </div>

  <!-- Détail de l'alerte sélectionnée -->
  @if (selection; as a) {
    <div class="card overflow-hidden">
      <div class="card-header flex-wrap">
        <h2 class="card-title"><i class="fa-solid fa-truck-medical text-rose-500"></i> {{ a.id }} — {{ a.patiente }}</h2>
        <a [routerLink]="['/admin/patientes', a.patienteId]" class="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Ouvrir le dossier <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="grid gap-5 p-5 md:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Adresse estimée</p>
          <p class="mt-1 text-sm text-slate-800 dark:text-slate-200">{{ adresse ?? (a.quartier + ', ' + a.commune) }}</p>
          <p class="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{{ a.lat.toFixed(5) }}, {{ a.lng.toFixed(5) }}</p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Itinéraire depuis la structure</p>
          @if (calcul) {
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
          @if (ambulanceDe(a); as amb) {
            @let restant = restantS(amb);
            <p class="mt-3 flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300">
              <i class="fa-solid fa-truck-medical"></i>
              <span><strong>{{ amb.id }}</strong> · {{ amb.immatriculation }} —
                @if (amb.progression >= 1) { sur place } @else if (restant !== null) { arrivée dans {{ minutes(restant) }} min } @else { en route }
              </span>
            </p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ amb.equipage }}</p>
          }
        </div>
        <div class="flex flex-wrap items-start gap-2 md:justify-end">
          <a [href]="lienTel(a)" class="btn-secondary"><i class="fa-solid fa-phone"></i> {{ a.telephone }}</a>
          @if (a.etat === 'nouvelle') {
            <button class="btn-primary" (click)="changerEtat(a, 'prise en charge')"><i class="fa-solid fa-hand-holding-medical"></i> Prendre en charge</button>
            <button class="btn-ghost text-slate-500" (click)="changerEtat(a, 'annulée')" title="Alerte déclenchée par erreur"><i class="fa-solid fa-ban"></i> Fausse alerte</button>
          } @else if (a.etat === 'prise en charge') {
            <button class="btn-primary" (click)="changerEtat(a, 'résolue')"><i class="fa-solid fa-check"></i> Marquer résolue</button>
          }
        </div>
      </div>

      <!-- Chronologie, conservée dans l'historique -->
      <div class="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chronologie</p>
        <ol class="flex flex-wrap gap-x-6 gap-y-3">
          @for (e of a.evenements; track $index; let dernier = $last) {
            <li class="flex items-center gap-2 text-sm">
              <span class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ e.date.slice(11) }}</span>
              <span class="font-medium" [class]="dernier ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'">{{ e.type }}</span>
              <span class="text-xs text-slate-400">· {{ e.auteur }}</span>
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

  private urgences = inject(UrgencesService);
  private flotte = inject(FlotteService);
  private etablissements = inject(EtablissementsService);
  private session = inject(SessionService);

  vue: Vue = 'direct';
  vues: { id: Vue; label: string; icon: string }[] = [
    { id: 'direct', label: 'En direct', icon: 'fa-tower-broadcast' },
    { id: 'historique', label: 'Historique', icon: 'fa-clock-rotate-left' },
  ];

  /** Alertes du jour et alertes encore en cours (même d'un jour précédent). */
  get alertes(): AlerteUrgence[] {
    const aujourdhui = jour(0);
    return this.urgences.alertes().filter(a => a.date === aujourdhui || a.etat === 'nouvelle' || a.etat === 'prise en charge');
  }

  /** Ambulances actuellement en mission, avec leur avancement sur l'itinéraire. */
  ambulances: AmbulanceEnRoute[] = this.flotte.ambulances()
    .filter(a => a.alerteId)
    .map(a => ({
      id: a.id,
      immatriculation: a.immatriculation,
      equipage: this.flotte.equipage(a),
      alerteId: a.alerteId!,
      progression: PROGRESSION_INITIALE[a.id] ?? 0,
    }));
  filtre: Filtre = 'actives';
  filtres: { id: Filtre; label: string }[] = [
    { id: 'actives', label: 'Actives' },
    { id: 'toutes', label: 'Toutes' },
  ];

  selection: AlerteUrgence | null = null;
  adresse: string | null = null;
  itineraire: Itineraire | null = null;
  calcul = false;

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
  private chrono?: ReturnType<typeof setInterval>;
  /** Réponses TomTom par alerte : une alerte déjà consultée s'affiche instantanément. */
  private infos = new Map<string, Promise<InfosTomTom>>();
  /** Itinéraires déjà reçus, lisibles sans attendre (déplacement des ambulances). */
  private itineraires = new Map<string, Itineraire>();

  constructor() {
    // Le fond TomTom suit le thème (plan ↔ nuit) ; le fond OSM est assombri en CSS (styles.css).
    effect(() => {
      const url = urlTomTom(this.theme.sombre());
      this.zone.runOutsideAngular(() => this.fondTomTom?.setUrl(url));
    });
    // Une urgence peut être clôturée ailleurs (application ambulance) : on libère son ambulance et on redessine.
    effect(() => {
      this.urgences.alertes();
      untracked(() => {
        for (const m of this.ambulances.filter(m => !this.estActive(this.urgences.alerte(m.alerteId)))) this.retirerAmbulance(m);
        if (this.selection && !this.visibles.includes(this.selection)) this.deselectionner();
        this.dessinerMarqueurs();
      });
    });
    // Établissements géolocalisés (page Établissements sanitaires) : croix d'hôpital nommée.
    effect(() => {
      const liste = this.etablissements.etablissements();
      const actuel = this.session.etablissement()?.id;
      untracked(() => this.zone.runOutsideAngular(() => {
        this.calqueEtablissements.clearLayers();
        for (const e of liste) {
          // La base de secours a déjà son marqueur : il reprend seulement la photo de sa fiche.
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
    this.etablissements.charger().catch(() => {}); // hors connexion (maquette) : seule la base de secours s'affiche
  }

  get visibles(): AlerteUrgence[] {
    return this.filtre === 'toutes' ? this.alertes : this.alertes.filter(a => this.estActive(a));
  }

  get nouvelles(): number {
    return this.urgences.nouvelles();
  }

  /** Depuis l'historique : retour sur la carte, centrée sur l'urgence en cours. */
  suivreSurCarte(a: AlerteUrgence): void {
    this.vue = 'direct';
    this.selectionner(a);
  }

  ngAfterViewInit(): void {
    // Leaflet écoute souris et zoom en continu : on le garde hors de la détection de changements.
    this.zone.runOutsideAngular(() => {
      // OSM déjà préconnecté par ShellComponent.
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
          'Ambulances en route': this.calqueAmbulances,
          'Trafic en temps réel (TomTom)': coucheTrafic(),
        },
      ).addTo(this.carte);
      L.control.scale({ imperial: false }).addTo(this.carte);
      this.base = marqueurEtablissement(BASE_SECOURS.lat, BASE_SECOURS.lng, BASE_SECOURS.nom, true, this.photoBase).addTo(this.carte);
    });

    this.dessinerMarqueurs();

    // Les nouvelles alertes seront consultées en premier : adresse et itinéraire demandés d'avance.
    this.alertes.filter(a => a.etat === 'nouvelle').forEach(a => this.infosDe(a));

    // Les ambulances avancent hors de la détection de changements ; Angular n'est
    // sollicité que si l'alerte affichée en détail a une ambulance (compte à rebours).
    this.zone.runOutsideAngular(() => {
      this.chrono = setInterval(() => {
        this.deplacerAmbulances();
        if (this.selection && this.ambulanceDe(this.selection)) this.zone.run(() => {});
      }, 1000);
    });
    this.ambulances.forEach(m => this.suivre(m));
  }

  ngOnDestroy(): void {
    clearInterval(this.chrono);
    this.redimension?.disconnect();
    this.carte?.remove();
  }

  changerFiltre(f: Filtre): void {
    this.filtre = f;
    if (this.selection && !this.visibles.includes(this.selection)) this.deselectionner();
    this.dessinerMarqueurs();
  }

  async selectionner(a: AlerteUrgence): Promise<void> {
    this.selection = a;
    this.adresse = null;
    this.itineraire = null;
    this.calcul = true;
    this.trace?.remove();
    this.carte?.flyTo([a.lat, a.lng], 15, { duration: 0.8 });

    const infos = await this.infosDe(a);
    if (this.selection !== a) return; // une autre alerte a été choisie entre-temps

    this.adresse = infos.adresse;
    this.itineraire = infos.itineraire;
    this.calcul = false;

    if (this.itineraire && this.carte) {
      this.trace = L.polyline(this.itineraire.points, { color: '#e11d48', weight: 5, opacity: 0.85 }).addTo(this.carte);
      this.carte.flyToBounds(this.trace.getBounds(), { padding: [40, 40], duration: 0.8 });
    }
  }

  /** Chaque changement est inscrit dans la chronologie de l'urgence (UrgencesService). */
  changerEtat(a: AlerteUrgence, etat: EtatAlerte): void {
    const auteur = UTILISATEUR.nom;
    if (etat === 'prise en charge') {
      this.urgences.prendreEnCharge(a, auteur);
      // Première ambulance disponible (avec un chauffeur actif) envoyée vers la patiente.
      const libre = this.flotte.premiereDisponible();
      if (libre) {
        this.flotte.engager(libre.id, a.id);
        const c = this.flotte.chauffeur(libre.chauffeurId);
        this.urgences.ambulanceEnvoyee(a, libre.id, c ? `${c.prenom.charAt(0)}. ${c.nom}` : '—', auteur);
        const m: AmbulanceEnRoute = {
          id: libre.id, immatriculation: libre.immatriculation, equipage: this.flotte.equipage(libre), alerteId: a.id, progression: 0,
        };
        this.ambulances.push(m);
        this.suivre(m);
      }
    } else if (etat === 'résolue') {
      this.urgences.cloturer(a, auteur);
    } else if (etat === 'annulée') {
      this.urgences.annuler(a, auteur, 'Fausse alerte confirmée par la régulation');
    }
    // L'effet du constructeur libère l'ambulance et redessine la carte.
  }

  private estActive(a: AlerteUrgence | undefined): boolean {
    return a?.etat === 'nouvelle' || a?.etat === 'prise en charge';
  }

  private retirerAmbulance(m: AmbulanceEnRoute): void {
    if (this.flotte.ambulances().find(x => x.id === m.id)?.alerteId === m.alerteId) {
      this.flotte.engager(m.id, null); // retour à la base : de nouveau disponible
    }
    this.ambulances = this.ambulances.filter(x => x !== m);
    this.marqueursAmbulances.get(m.id)?.remove();
    this.marqueursAmbulances.delete(m.id);
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

  ambulanceDe(a: AlerteUrgence): AmbulanceEnRoute | undefined {
    return this.ambulances.find(m => m.alerteId === a.id);
  }

  /** Secondes restantes avant l'arrivée (null tant que l'itinéraire n'est pas connu). */
  restantS(m: AmbulanceEnRoute): number | null {
    const it = m.alerteId ? this.itineraires.get(m.alerteId) : undefined;
    return it ? (1 - m.progression) * it.dureeS : null;
  }

  lienTel(a: AlerteUrgence): string {
    return 'tel:' + a.telephone.replace(/\s/g, '');
  }

  minutes(s: number): number {
    return Math.max(1, Math.round(s / 60));
  }

  private infosDe(a: AlerteUrgence): Promise<InfosTomTom> {
    let infos = this.infos.get(a.id);
    if (!infos) {
      const depart: [number, number] = [BASE_SECOURS.lat, BASE_SECOURS.lng];
      infos = Promise.allSettled([adresseDe(a.lat, a.lng), calculerItineraire(depart, [a.lat, a.lng])])
        .then(([adresse, itineraire]) => {
          const it = itineraire.status === 'fulfilled' ? itineraire.value : null;
          if (it) this.itineraires.set(a.id, it);
          return { adresse: adresse.status === 'fulfilled' ? adresse.value : null, itineraire: it };
        });
      this.infos.set(a.id, infos);
    }
    return infos;
  }

  /** Demande l'itinéraire de l'ambulance puis l'affiche sur la carte. */
  private suivre(m: AmbulanceEnRoute): void {
    const alerte = this.alertes.find(a => a.id === m.alerteId);
    if (alerte) this.infosDe(alerte).then(() => this.zone.runOutsideAngular(() => this.placerAmbulance(m)));
  }

  private deplacerAmbulances(): void {
    for (const m of this.ambulances) {
      const it = m.alerteId ? this.itineraires.get(m.alerteId) : undefined;
      if (!it || m.progression >= 1) continue;
      m.progression = Math.min(1, m.progression + SIMULATION / it.dureeS);
      this.placerAmbulance(m);
    }
  }

  private placerAmbulance(m: AmbulanceEnRoute): void {
    const alerte = this.alertes.find(a => a.id === m.alerteId);
    const it = m.alerteId ? this.itineraires.get(m.alerteId) : undefined;
    if (!alerte || !it) return;

    const position = pointSurTrajet(it.points, m.progression);
    const statut = m.progression >= 1 ? 'sur place' : `arrivée dans ${this.minutes(this.restantS(m) ?? 0)} min`;
    const infobulle = `<strong>${m.id}</strong> · ${m.immatriculation}<br>→ ${alerte.patiente} — ${statut}`;

    let marqueur = this.marqueursAmbulances.get(m.id);
    if (!marqueur) {
      marqueur = L.marker(position, { icon: iconeAmbulance(), zIndexOffset: 500 })
        .bindTooltip(infobulle, { direction: 'top', offset: [0, -11] })
        .on('click', () => this.zone.run(() => this.selectionner(alerte)))
        .addTo(this.calqueAmbulances);
      this.marqueursAmbulances.set(m.id, marqueur);
    } else {
      deplacerAmbulance(marqueur, position);
      marqueur.setTooltipContent(infobulle);
    }
  }

  private deselectionner(): void {
    this.selection = null;
    this.trace?.remove();
  }

  private dessinerMarqueurs(): void {
    this.marqueurs.clearLayers();
    for (const a of this.visibles) {
      L.marker([a.lat, a.lng], { icon: iconePatiente(a, a.etat === 'nouvelle') })
        .bindTooltip(`<strong>${a.patiente}</strong><br>${a.motif}`, { direction: 'top', offset: [0, -18] })
        .on('click', () => this.zone.run(() => this.selectionner(a)))
        .addTo(this.marqueurs);
    }
  }
}
