import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { AvatarComponent } from '../../../admin/components/avatar.component';
import { FlotteService } from '../../../admin/data/flotte.service';
import { AlerteUrgence, BASE_SECOURS, PROGRESSION_INITIALE } from '../../../admin/data/urgences';
import { UrgencesService } from '../../../admin/data/urgences.service';
import { Itineraire, adresseDe, calculerItineraire } from '../../../admin/data/tomtom';
import {
  SIMULATION, TEINTE, coucheOsm, coucheTomTom, coucheTrafic, creerCarte, deplacerAmbulance, ecartAuTrajet,
  fractionSurTrajet, iconeAmbulance, iconePatiente, marqueurHopital, pointSurTrajet, urlTomTom,
} from '../../../admin/data/carte';
import { ThemeService } from '../../../shared/theme.service';
import { ThemeToggleComponent } from '../../../shared/theme-toggle.component';
import { SessionChauffeurService } from '../../session.service';

type Etape = 'vers-patiente' | 'sur-place' | 'vers-hopital';

const BASE: [number, number] = [BASE_SECOURS.lat, BASE_SECOURS.lng];
/** Au-delà, la position GPS n'est pas prise en compte (appareil hors de Kinshasa, ex. en test). */
const RAYON_GPS_M = 60_000;
/** Écart à l'itinéraire qui déclenche un nouveau calcul (m), et délai minimal entre deux calculs (ms). */
const ECART_MAX_M = 120;
const DELAI_RECALCUL_MS = 15_000;

/**
 * Application ambulance : le chauffeur connecté voit sa mission, la patiente à secourir
 * et l'itinéraire TomTom (patiente, puis retour à l'hôpital). Position GPS de l'appareil
 * quand elle est disponible, sinon déplacement simulé le long de l'itinéraire.
 */
@Component({
  selector: 'app-mission',
  standalone: true,
  imports: [AvatarComponent, ThemeToggleComponent],
  templateUrl: './mission.component.html',
})
export class MissionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('carte', { static: true }) carteRef!: ElementRef<HTMLDivElement>;
  private zone = inject(NgZone);
  private theme = inject(ThemeService);
  private router = inject(Router);
  private flotte = inject(FlotteService);
  private session = inject(SessionChauffeurService);

  chauffeur = this.session.chauffeur;
  ambulance = this.session.ambulance;
  private urgences = inject(UrgencesService);
  alerte = computed(() => this.urgences.alerte(this.ambulance()?.alerteId));

  etape = signal<Etape>('vers-patiente');
  source = signal<'gps' | 'simulation'>('simulation');
  gpsHorsZone = signal(false);
  position = signal<[number, number]>(BASE);
  itineraire = signal<Itineraire | null>(null);
  progression = signal(0);
  adresse = signal<string | null>(null);
  calcul = signal(false);
  suivi = signal(true);

  restantS = computed(() => {
    const it = this.itineraire();
    return it ? (1 - this.progression()) * it.dureeS : null;
  });
  restantKm = computed(() => {
    const it = this.itineraire();
    return it ? ((1 - this.progression()) * it.distanceM) / 1000 : null;
  });
  heureArrivee = computed(() => {
    const s = this.restantS();
    return s === null ? null : new Date(Date.now() + s * 1000).toTimeString().slice(0, 5);
  });

  private carte?: L.Map;
  private redimension?: ResizeObserver;
  private fondTomTom?: L.TileLayer;
  private marqueurAmbulance?: L.Marker;
  private marqueurPatiente?: L.Marker;
  private clePatiente = '';
  private trace?: L.Polyline;
  private traceDe?: Itineraire;
  private chrono?: ReturnType<typeof setInterval>;
  private gpsId?: number;
  private dernierCalcul = 0;
  private premiereMission = true;

  constructor() {
    effect(() => {
      const url = urlTomTom(this.theme.sombre());
      this.zone.runOutsideAngular(() => this.fondTomTom?.setUrl(url));
    });
    // Nouvelle mission attribuée (ou mission terminée) : on repart de zéro.
    effect(() => {
      const a = this.alerte();
      untracked(() => this.nouvelleMission(a));
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const osm = coucheOsm();
      ({ carte: this.carte, redimension: this.redimension } = creerCarte(this.carteRef.nativeElement, {
        center: this.position(),
        zoom: 14,
        layers: [osm],
        zoomControl: false,
      }));
      L.control.zoom({ position: 'bottomright' }).addTo(this.carte);
      L.control.layers(
        { 'OpenStreetMap': osm, 'TomTom': this.fondTomTom = coucheTomTom(this.theme.sombre()) },
        { 'Trafic en temps réel (TomTom)': coucheTrafic() },
        { position: 'topright' },
      ).addTo(this.carte);
      marqueurHopital().addTo(this.carte);
      // Le chauffeur déplace la carte : on arrête de la recentrer sur l'ambulance.
      this.carte.on('dragstart', () => this.zone.run(() => this.suivi.set(false)));
    });
    this.rafraichirCarte();

    this.chrono = setInterval(() => this.avancerSimulation(), 1000);
    if ('geolocation' in navigator) {
      this.gpsId = navigator.geolocation.watchPosition(p => this.positionGps(p), () => this.source.set('simulation'), {
        enableHighAccuracy: true,
        maximumAge: 5000,
      });
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.chrono);
    if (this.gpsId !== undefined) navigator.geolocation.clearWatch(this.gpsId);
    this.redimension?.disconnect();
    this.carte?.remove();
  }

  // --- Étapes de la mission ------------------------------------------------------

  // Chaque étape est inscrite dans l'historique de l'urgence, visible côté régulation.
  private get nomChauffeur(): string {
    const c = this.chauffeur();
    return c ? `${c.prenom.charAt(0)}. ${c.nom}` : 'Chauffeur';
  }

  arriveSurPlace(): void {
    const a = this.alerte();
    if (!a) return;
    this.urgences.etapeChauffeur(a, 'Arrivée sur place', this.nomChauffeur);
    this.etape.set('sur-place');
    this.itineraire.set(null);
    if (this.source() === 'simulation') this.position.set([a.lat, a.lng]);
    this.rafraichirCarte();
  }

  patienteABord(): void {
    const a = this.alerte();
    if (a) this.urgences.etapeChauffeur(a, 'Patiente à bord', this.nomChauffeur);
    this.etape.set('vers-hopital');
    this.progression.set(0);
    this.calculer();
  }

  terminer(): void {
    const a = this.alerte();
    if (a) {
      this.urgences.etapeChauffeur(a, 'Arrivée à l’hôpital', this.nomChauffeur);
      this.urgences.cloturer(a, this.nomChauffeur, 'Patiente remise au service des urgences');
    }
    const amb = this.ambulance();
    if (amb) this.flotte.engager(amb.id, null); // l'ambulance redevient disponible
  }

  recentrer(): void {
    this.suivi.set(true);
    this.carte?.setView(this.position(), Math.max(this.carte.getZoom(), 15));
  }

  voirTrajet(): void {
    if (!this.trace || !this.carte) return;
    this.suivi.set(false);
    this.carte.fitBounds(this.trace.getBounds(), { padding: [40, 40] });
  }

  deconnecter(): void {
    this.session.fermer();
    this.router.navigateByUrl('/ambulance/connexion');
  }

  lienTel(a: AlerteUrgence): string {
    return 'tel:' + a.telephone.replace(/\s/g, '');
  }

  teinte(a: AlerteUrgence): string {
    return TEINTE[a.gravite];
  }

  minutes(s: number): number {
    return Math.max(1, Math.round(s / 60));
  }

  // --- Mécanique -------------------------------------------------------------------

  private nouvelleMission(a: AlerteUrgence | undefined): void {
    this.etape.set('vers-patiente');
    this.itineraire.set(null);
    this.adresse.set(null);
    const amb = this.ambulance();
    // Mission déjà en cours à l'ouverture : même avancement que sur la carte des urgences.
    this.progression.set(this.premiereMission && amb ? PROGRESSION_INITIALE[amb.id] ?? 0 : 0);
    if (a && !this.premiereMission) navigator.vibrate?.([300, 150, 300]);
    this.premiereMission = false;

    if (a) {
      adresseDe(a.lat, a.lng).then(ad => this.alerte() === a && this.adresse.set(ad));
      // En simulation, l'ambulance part de l'hôpital.
      if (this.source() === 'simulation') this.position.set(BASE);
      this.calculer();
    }
    this.rafraichirCarte();
  }

  private cible(): [number, number] | null {
    const a = this.alerte();
    if (!a) return null;
    return this.etape() === 'vers-hopital' ? BASE : this.etape() === 'vers-patiente' ? [a.lat, a.lng] : null;
  }

  private async calculer(): Promise<void> {
    const cible = this.cible();
    if (!cible || this.calcul()) return;
    this.calcul.set(true);
    this.dernierCalcul = Date.now();
    const etape = this.etape();
    try {
      const it = await calculerItineraire(this.position(), cible);
      if (this.etape() !== etape) return; // étape changée pendant le calcul
      this.itineraire.set(it);
      if (this.source() === 'gps') this.progression.set(0);
      this.suivi.set(true);
      this.carte?.setView(this.source() === 'simulation' ? pointSurTrajet(it.points, this.progression()) : this.position(), 15);
    } catch {
      this.itineraire.set(null);
    } finally {
      this.calcul.set(false);
      this.rafraichirCarte();
    }
  }

  private avancerSimulation(): void {
    const it = this.itineraire();
    if (this.source() !== 'simulation' || !it || this.progression() >= 1) return;
    this.progression.set(Math.min(1, this.progression() + SIMULATION / it.dureeS));
    this.position.set(pointSurTrajet(it.points, this.progression()));
    this.rafraichirCarte();
  }

  private positionGps(p: GeolocationPosition): void {
    const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
    if (L.latLng(pos).distanceTo(BASE) > RAYON_GPS_M) {
      this.gpsHorsZone.set(true); // appareil loin de Kinshasa : on garde la simulation
      return;
    }
    this.gpsHorsZone.set(false);
    const passageAuGps = this.source() === 'simulation';
    this.source.set('gps');
    this.position.set(pos);

    const it = this.itineraire();
    if (passageAuGps || (it && ecartAuTrajet(it.points, pos) > ECART_MAX_M && Date.now() - this.dernierCalcul > DELAI_RECALCUL_MS)) {
      this.calculer(); // hors de l'itinéraire : TomTom recalcule depuis la position réelle
    } else if (it) {
      this.progression.set(fractionSurTrajet(it.points, pos));
    }
    this.rafraichirCarte();
  }

  /** Met la carte à jour d'après l'état courant (ambulance, patiente, itinéraire). */
  private rafraichirCarte(): void {
    const carte = this.carte;
    if (!carte) return;
    this.zone.runOutsideAngular(() => {
      const pos = this.position();
      if (!this.marqueurAmbulance) {
        this.marqueurAmbulance = L.marker(pos, { icon: iconeAmbulance(40), zIndexOffset: 1500 }).addTo(carte);
      } else {
        deplacerAmbulance(this.marqueurAmbulance, pos);
      }

      // Marqueur de la patiente recréé seulement quand la mission ou l'étape change.
      const a = this.alerte();
      const cle = a && this.etape() !== 'vers-hopital' ? `${a.id}:${this.etape()}` : '';
      if (cle !== this.clePatiente) {
        this.clePatiente = cle;
        this.marqueurPatiente?.remove();
        this.marqueurPatiente = a && cle
          ? L.marker([a.lat, a.lng], { icon: iconePatiente(a, this.etape() === 'vers-patiente') })
            .bindTooltip(`<strong>${a.patiente}</strong><br>${a.motif}`, { direction: 'top', offset: [0, -18] })
            .addTo(carte)
          : undefined;
      }

      const it = this.itineraire();
      if (it !== this.traceDe) {
        this.trace?.remove();
        this.trace = it ? L.polyline(it.points, { color: '#e11d48', weight: 6, opacity: 0.85 }).addTo(carte) : undefined;
        this.traceDe = it ?? undefined;
      }

      if (this.suivi()) carte.panTo(pos, { animate: true, duration: 0.5 });
    });
  }
}
