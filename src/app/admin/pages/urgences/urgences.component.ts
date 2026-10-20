import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import * as L from 'leaflet';
import { ALERTES, AlerteUrgence, AmbulanceEnRoute, BASE_SECOURS, EtatAlerte, Gravite, PROGRESSION_INITIALE } from '../../data/urgences';
import { FlotteService } from '../../data/flotte.service';
import { TOMTOM_TUILES, Itineraire, adresseDe, calculerItineraire } from '../../data/tomtom';
import { ThemeService } from '../../../shared/theme.service';

type Filtre = 'actives' | 'toutes';
type InfosTomTom = { adresse: string | null; itineraire: Itineraire | null };

// Simulation du déplacement des ambulances (×8 pour la démonstration),
// en attendant les positions GPS réelles envoyées par les véhicules.
const SIMULATION = 8;

// Couleurs des marqueurs (classes Tailwind, la carte Leaflet vit hors des templates Angular).
const TEINTE: Record<Gravite, string> = {
  'critique': 'bg-rose-600',
  'élevée': 'bg-orange-500',
  'modérée': 'bg-amber-400',
};
const ANNEAU: Record<Gravite, string> = {
  'critique': 'ring-rose-600',
  'élevée': 'ring-orange-500',
  'modérée': 'ring-amber-400',
};

/** Point situé à la fraction f (0 → 1) de la longueur d'un tracé. */
function pointSurTrajet(points: [number, number][], f: number): [number, number] {
  const cumul = [0];
  for (let i = 1; i < points.length; i++) {
    cumul.push(cumul[i - 1] + L.latLng(points[i - 1]).distanceTo(points[i]));
  }
  const cible = cumul[cumul.length - 1] * Math.min(1, f);
  const i = Math.max(1, cumul.findIndex(d => d >= cible));
  const [a, b] = [points[i - 1], points[i] ?? points[i - 1]];
  const t = (cible - cumul[i - 1]) / ((cumul[i] - cumul[i - 1]) || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Urgences : localisation en direct des patientes ayant déclenché une alerte de détresse.
 * Fond OpenStreetMap (gratuit) par défaut ; TomTom fournit les fonds alternatifs,
 * le trafic, l'adresse la plus proche et l'itinéraire depuis la structure.
 * Les ambulances engagées avancent sur cet itinéraire jusqu'à la patiente.
 */
@Component({
  selector: 'app-urgences',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
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
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Patientes du système ayant signalé une détresse, localisées par GPS. Sélectionnez une alerte pour tracer l’itinéraire des secours.</p>
    </div>
    <div class="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800" role="group" aria-label="Alertes affichées">
      @for (f of filtres; track f.id) {
        <button type="button" (click)="changerFiltre(f.id)" [attr.aria-pressed]="filtre === f.id"
                class="rounded-lg px-3 py-1.5 transition"
                [class]="filtre === f.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'">
          {{ f.label }}
        </button>
      }
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Liste des alertes -->
    <div class="card flex flex-col overflow-hidden lg:max-h-[38rem]">
      <div class="card-header">
        <h2 class="card-title"><i class="fa-solid fa-triangle-exclamation text-rose-500"></i> Alertes du jour</h2>
        <span class="text-xs text-slate-500 dark:text-slate-400">{{ visibles.length }}</span>
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
          } @else if (a.etat === 'prise en charge') {
            <button class="btn-primary" (click)="changerEtat(a, 'résolue')"><i class="fa-solid fa-check"></i> Marquer résolue</button>
          }
        </div>
      </div>
    </div>
  }
</div>
  `,
})
export class UrgencesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('carte', { static: true }) carteRef!: ElementRef<HTMLDivElement>;
  private zone = inject(NgZone);
  private theme = inject(ThemeService);

  alertes = ALERTES.map(a => ({ ...a }));
  private flotte = inject(FlotteService);
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
  private marqueursAmbulances = new Map<string, L.Marker>();
  private chrono?: ReturnType<typeof setInterval>;
  /** Réponses TomTom par alerte : une alerte déjà consultée s'affiche instantanément. */
  private infos = new Map<string, Promise<InfosTomTom>>();
  /** Itinéraires déjà reçus, lisibles sans attendre (déplacement des ambulances). */
  private itineraires = new Map<string, Itineraire>();

  constructor() {
    // Le fond TomTom suit le thème (plan ↔ nuit) ; le fond OSM est assombri en CSS (styles.css).
    effect(() => {
      const url = this.theme.sombre() ? TOMTOM_TUILES.nuit : TOMTOM_TUILES.plan;
      this.zone.runOutsideAngular(() => this.fondTomTom?.setUrl(url));
    });
  }

  get visibles(): AlerteUrgence[] {
    return this.filtre === 'toutes' ? this.alertes : this.alertes.filter(a => a.etat !== 'résolue');
  }

  get nouvelles(): number {
    return this.alertes.filter(a => a.etat === 'nouvelle').length;
  }

  ngAfterViewInit(): void {
    // Leaflet écoute souris et zoom en continu : on le garde hors de la détection de changements.
    this.zone.runOutsideAngular(() => {
      // Hôte unique (HTTP/2) recommandé par OSM, déjà préconnecté par ShellComponent.
      // Pas de tuiles téléchargées pendant l'animation de zoom, seulement à l'arrivée.
      const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        className: 'tuiles-osm',
        maxZoom: 19,
        updateWhenZooming: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      const tomtom = { maxZoom: 22, updateWhenZooming: false, attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>' };

      this.carte = L.map(this.carteRef.nativeElement, {
        center: [BASE_SECOURS.lat, BASE_SECOURS.lng],
        zoom: 13,
        layers: [osm, this.calqueAmbulances, this.marqueurs],
        preferCanvas: true, // tracé d'itinéraire (centaines de points) dessiné en canvas plutôt qu'en SVG
      });
      this.carte.attributionControl.setPrefix(false); // retire le lien « Leaflet » et son drapeau

      // La grille de la page peut encore bouger après l'initialisation : sans cela,
      // Leaflet garde une taille erronée et laisse des zones grises sans tuiles.
      this.redimension = new ResizeObserver(() => this.carte?.invalidateSize());
      this.redimension.observe(this.carteRef.nativeElement);

      L.control.layers(
        {
          'OpenStreetMap': osm,
          'TomTom': this.fondTomTom = L.tileLayer(this.theme.sombre() ? TOMTOM_TUILES.nuit : TOMTOM_TUILES.plan, tomtom),
        },
        {
          'Ambulances en route': this.calqueAmbulances,
          'Trafic en temps réel (TomTom)': L.tileLayer(TOMTOM_TUILES.trafic, { ...tomtom, opacity: 0.8 }),
        },
      ).addTo(this.carte);
      L.control.scale({ imperial: false }).addTo(this.carte);

      L.marker([BASE_SECOURS.lat, BASE_SECOURS.lng], {
        icon: L.divIcon({
          className: '',
          html: '<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-lg ring-2 ring-white dark:bg-brand-600 dark:ring-slate-900"><i class="fa-solid fa-hospital"></i></span>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        zIndexOffset: 1000,
      }).bindTooltip(BASE_SECOURS.nom).addTo(this.carte);
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

  changerEtat(a: AlerteUrgence, etat: EtatAlerte): void {
    a.etat = etat;
    if (etat === 'prise en charge') {
      // Première ambulance disponible (avec un chauffeur actif) envoyée vers la patiente.
      const libre = this.flotte.premiereDisponible();
      if (libre) {
        this.flotte.engager(libre.id, a.id);
        const m: AmbulanceEnRoute = {
          id: libre.id, immatriculation: libre.immatriculation, equipage: this.flotte.equipage(libre), alerteId: a.id, progression: 0,
        };
        this.ambulances.push(m);
        this.suivre(m);
      }
    } else if (etat === 'résolue') {
      const amb = this.ambulanceDe(a);
      if (amb) {
        this.flotte.engager(amb.id, null); // retour à la base : de nouveau disponible
        this.ambulances = this.ambulances.filter(m => m !== amb);
        this.marqueursAmbulances.get(amb.id)?.remove();
        this.marqueursAmbulances.delete(amb.id);
      }
    }
    if (!this.visibles.includes(a)) this.deselectionner();
    this.dessinerMarqueurs();
  }

  teinte(g: Gravite): string {
    return TEINTE[g];
  }

  badgeEtat(e: EtatAlerte): string {
    switch (e) {
      case 'nouvelle': return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
      case 'prise en charge': return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
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
      // Version réduite de images/ambulance.png (3 Ko au lieu de 211 Ko), nette sur écran haute densité.
      marqueur = L.marker(position, {
        icon: L.divIcon({
          className: '',
          html: '<img src="images/ambulance-marqueur.webp" alt="" width="26" height="13" class="drop-shadow-[0_1px_1px_rgb(0_0_0/0.5)] transition-transform duration-300">',
          iconSize: [26, 13],
          iconAnchor: [13, 11],
        }),
        zIndexOffset: 500,
      })
        .bindTooltip(infobulle, { direction: 'top', offset: [0, -11] })
        .on('click', () => this.zone.run(() => this.selectionner(alerte)))
        .addTo(this.calqueAmbulances);
      this.marqueursAmbulances.set(m.id, marqueur);
    } else {
      // L'image regarde vers la gauche : on la retourne quand l'ambulance roule vers l'est.
      const deltaLng = position[1] - marqueur.getLatLng().lng;
      const image = marqueur.getElement()?.querySelector('img');
      if (image && Math.abs(deltaLng) > 1e-6) image.style.transform = deltaLng > 0 ? 'scaleX(-1)' : '';
      marqueur.setLatLng(position).setTooltipContent(infobulle);
    }
  }

  private deselectionner(): void {
    this.selection = null;
    this.trace?.remove();
  }

  private dessinerMarqueurs(): void {
    this.marqueurs.clearLayers();
    for (const a of this.visibles) {
      const pulsation = a.etat === 'nouvelle'
        ? `<span class="absolute inline-flex h-full w-full animate-ping rounded-full ${TEINTE[a.gravite]} opacity-60"></span>`
        : '';
      // Photo du dossier entourée de la couleur de gravité ; icône si la patiente n'a pas de photo.
      const visage = a.photo
        ? `<img src="${a.photo}" alt="" class="relative h-9 w-9 rounded-full bg-white object-cover shadow-md ring-[3px] ${ANNEAU[a.gravite]}">`
        : `<span class="relative inline-flex h-9 w-9 items-center justify-center rounded-full ${TEINTE[a.gravite]} text-sm text-white shadow-md ring-2 ring-white dark:ring-slate-900"><i class="fa-solid fa-person-pregnant"></i></span>`;
      const icone = L.divIcon({
        className: '',
        html: `<span class="relative flex h-9 w-9">${pulsation}${visage}<span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${TEINTE[a.gravite]} ring-2 ring-white dark:ring-slate-900"></span></span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([a.lat, a.lng], { icon: icone })
        .bindTooltip(`<strong>${a.patiente}</strong><br>${a.motif}`, { direction: 'top', offset: [0, -18] })
        .on('click', () => this.zone.run(() => this.selectionner(a)))
        .addTo(this.marqueurs);
    }
  }
}
