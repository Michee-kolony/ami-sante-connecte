import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { coucheOsm, creerCarte, echapper } from '../../admin/data/carte';

/** Établissement tel que renvoyé par GET /comite/statistiques/etablissements (champs utiles à la carte). */
export interface EtablissementCarte {
  id: string; code: string; nom: string; type: string; secteur?: string; province: string;
  zoneSante?: string; zonesSante?: string[]; adresse?: string; telephone?: string; statut: 'Actif' | 'Suspendu';
  latitude?: number | null; longitude?: number | null; photo?: string | null;
}

/** Centre approximatif de la RDC : vue par défaut tant qu'aucun établissement n'est localisé. */
const CENTRE_RDC: L.LatLngTuple = [-2.88, 23.65];

const localise = (e: EtablissementCarte): boolean =>
  typeof e.latitude === 'number' && typeof e.longitude === 'number';

/**
 * Carte Leaflet de tous les établissements sanitaires du réseau, pour le comité de pilotage.
 * Consultation seulement : un clic sur un marqueur affiche la fiche résumée et les coordonnées
 * GPS exactes ; les établissements sans coordonnées sont listés sous la carte.
 */
@Component({
  selector: 'app-carte-etablissements',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="card overflow-hidden">
      <div class="card-header flex-wrap">
        <h2 class="card-title"><i class="fa-solid fa-map-location-dot text-brand-600 dark:text-brand-400"></i> Carte des établissements sanitaires</h2>
        @if (!chargement()) {
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ localises().length }} localisé{{ localises().length > 1 ? 's' : '' }} sur {{ etablissements().length }}
            <span class="ml-2 inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-rose-600"></span> Actif</span>
            <span class="ml-2 inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-slate-400"></span> Suspendu</span>
          </p>
        }
      </div>

      <div class="relative">
        @if (chargement()) {
          <div class="absolute inset-0 z-[500] flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-slate-900/60" role="status">
            <span class="text-sm text-slate-500 dark:text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Chargement de la carte…</span>
          </div>
        }
        <div #carte class="h-[28rem] w-full bg-slate-100 dark:bg-slate-800" role="region" aria-label="Carte des établissements sanitaires"></div>
      </div>

      @if (!chargement() && nonLocalises().length) {
        <div class="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p><i class="fa-solid fa-location-crosshairs mr-1 text-amber-500"></i>
            Coordonnées GPS non renseignées ({{ nonLocalises().length }}) :
            @for (e of nonLocalises(); track e.id; let dernier = $last) {
              <span class="font-medium text-slate-700 dark:text-slate-200">{{ e.nom }}</span>{{ dernier ? '.' : ', ' }}
            }
          </p>
          <p class="mt-1">Elles se renseignent dans la fiche de l’établissement (<a routerLink="/comite/etablissements" class="font-semibold text-brand-700 underline dark:text-brand-300">Établissements</a>).</p>
        </div>
      }
    </div>
  `,
})
export class CarteEtablissementsComponent implements AfterViewInit, OnDestroy {
  etablissements = input<EtablissementCarte[]>([]);
  chargement = input(false);
  /** Clé du filtre affiché (périmètre du comité) : quand elle change, la carte se recadre sur les établissements. */
  cadrage = input('');

  @ViewChild('carte', { static: true }) carteRef!: ElementRef<HTMLDivElement>;

  private zone = inject(NgZone);
  private carte?: L.Map;
  private redimension?: ResizeObserver;
  private calque = L.featureGroup();
  /** Le cadrage automatique n'a lieu qu'une fois : ensuite, l'utilisateur garde sa vue. */
  private cadree = false;
  private derniereCle = '';

  localises = computed(() => this.etablissements().filter(localise));
  nonLocalises = computed(() => this.etablissements().filter(e => !localise(e)));

  constructor() {
    effect(() => {
      const liste = this.localises();
      const cle = this.cadrage();
      untracked(() => {
        if (cle !== this.derniereCle) {
          this.derniereCle = cle;
          this.cadree = false;
        }
        this.dessiner(liste);
      });
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const osm = coucheOsm();
      ({ carte: this.carte, redimension: this.redimension } = creerCarte(this.carteRef.nativeElement, {
        center: CENTRE_RDC,
        zoom: 5,
        layers: [osm, this.calque],
      }));
      L.control.layers(
        {
          'Plan (OpenStreetMap)': osm,
          'Satellite (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            updateWhenZooming: false,
            attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics',
          }),
        },
        { 'Établissements sanitaires': this.calque },
      ).addTo(this.carte);
      L.control.scale({ imperial: false }).addTo(this.carte);
    });
    this.dessiner(this.localises());
  }

  ngOnDestroy(): void {
    this.redimension?.disconnect();
    this.carte?.remove();
  }

  private dessiner(liste: EtablissementCarte[]): void {
    if (!this.carte) return;
    this.zone.runOutsideAngular(() => {
      this.calque.clearLayers();
      for (const e of liste) {
        L.marker([e.latitude!, e.longitude!], { icon: icone(e), title: e.nom, riseOnHover: true })
          .bindPopup(fiche(e), { minWidth: 240, maxWidth: 260 })
          .addTo(this.calque);
      }
      if (!this.cadree && liste.length) {
        this.cadree = true;
        if (liste.length === 1) this.carte!.setView([liste[0].latitude!, liste[0].longitude!], 14);
        else this.carte!.fitBounds(this.calque.getBounds(), { padding: [40, 40], maxZoom: 14 });
      }
    });
  }
}

/**
 * Vignette photo de l'établissement (croix d'hôpital s'il n'a pas de photo) entourée de rouge s'il
 * est actif, de gris s'il est suspendu, avec une pointe vers sa position exacte et son nom dessous.
 */
function icone(e: EtablissementCarte): L.DivIcon {
  const actif = e.statut === 'Actif';
  const anneau = actif ? 'ring-rose-600' : 'ring-slate-400';
  const pointe = actif ? 'border-t-rose-600' : 'border-t-slate-400';
  const visuel = e.photo
    ? `<img src="${echapper(e.photo)}" alt="" class="h-11 w-11 rounded-xl bg-slate-200 object-cover shadow-lg ring-[3px] ${anneau} ${actif ? '' : 'grayscale'}">`
    : `<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg shadow-lg ring-[3px] ${anneau} ${actif ? 'text-rose-600' : 'text-slate-400'} dark:bg-slate-900"><i class="fa-solid fa-plus"></i></span>`;
  return L.divIcon({
    className: '',
    html: `<span class="relative flex h-full w-full cursor-pointer flex-col items-center">
      ${visuel}
      <span class="-mt-px h-0 w-0 border-x-[7px] border-t-[9px] border-x-transparent ${pointe}"></span>
      <span class="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 shadow ring-1 ring-slate-200 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700">${echapper(e.nom)}</span>
    </span>`,
    // Photo 44 px + pointe 9 px : l'ancre est au bout de la pointe, sur la position GPS exacte.
    iconSize: [44, 53],
    iconAnchor: [22, 53],
    popupAnchor: [0, -53],
  });
}

/** Bulle au clic : photo, identité, adresse et coordonnées GPS exactes. */
function fiche(e: EtablissementCarte): string {
  const lat = e.latitude!.toFixed(6);
  const lng = e.longitude!.toFixed(6);
  const ligne = (icone: string, texte?: string | null) => texte
    ? `<p class="mt-1 flex gap-2"><i class="fa-solid ${icone} mt-0.5 w-3.5 text-slate-400"></i><span>${echapper(texte)}</span></p>`
    : '';
  const statut = e.statut === 'Actif'
    ? '<span class="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">Actif</span>'
    : '<span class="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">Suspendu</span>';
  const lieu = [e.zonesSante?.length ? e.zonesSante.join(', ') : e.zoneSante, e.province].filter(Boolean).join(' · ');
  return `<div class="text-xs text-slate-700 dark:text-slate-200">
    ${e.photo ? `<img src="${echapper(e.photo)}" alt="" class="mb-2 h-28 w-full rounded-lg bg-slate-200 object-cover">` : ''}
    <p class="text-sm font-semibold text-slate-900">${echapper(e.nom)}</p>
    <p class="mt-0.5 text-slate-500"><span class="font-mono">${echapper(e.code)}</span> · ${statut}</p>
    ${ligne('fa-hospital', [e.type, e.secteur].filter(Boolean).join(' · '))}
    ${ligne('fa-location-dot', e.adresse)}
    ${ligne('fa-map', lieu)}
    ${ligne('fa-phone', e.telephone)}
    <p class="mt-1 flex gap-2"><i class="fa-solid fa-crosshairs mt-0.5 w-3.5 text-slate-400"></i><span class="font-mono">${lat}, ${lng}</span></p>
    <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}" target="_blank" rel="noopener"
       class="mt-2 inline-block font-semibold text-brand-700 underline">Ouvrir dans OpenStreetMap</a>
  </div>`;
}
