// Éléments de carte Leaflet partagés par la page Urgences de l'espace administrateur.
import * as L from 'leaflet';
import { AlerteUrgence, BASE_SECOURS, Gravite } from './urgences';
import { TOMTOM_TUILES } from './tomtom';

// Couleurs des marqueurs (classes Tailwind, la carte Leaflet vit hors des templates Angular).
export const TEINTE: Record<Gravite, string> = {
  'critique': 'bg-rose-600',
  'élevée': 'bg-orange-500',
  'modérée': 'bg-amber-400',
};
const ANNEAU: Record<Gravite, string> = {
  'critique': 'ring-rose-600',
  'élevée': 'ring-orange-500',
  'modérée': 'ring-amber-400',
};

/**
 * Fond OpenStreetMap (gratuit, assombri en CSS en mode sombre — voir styles.css).
 * Hôte unique (HTTP/2) recommandé par OSM ; pas de tuiles pendant l'animation de zoom.
 */
export function coucheOsm(): L.TileLayer {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    className: 'tuiles-osm',
    maxZoom: 19,
    updateWhenZooming: false,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}

const OPTIONS_TOMTOM = { maxZoom: 22, updateWhenZooming: false, attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>' };

/** Fond TomTom ; appeler setUrl(urlTomTom(sombre)) quand le thème change. */
export function coucheTomTom(sombre: boolean): L.TileLayer {
  return L.tileLayer(urlTomTom(sombre), OPTIONS_TOMTOM);
}

export function urlTomTom(sombre: boolean): string {
  return sombre ? TOMTOM_TUILES.nuit : TOMTOM_TUILES.plan;
}

export function coucheTrafic(): L.TileLayer {
  return L.tileLayer(TOMTOM_TUILES.trafic, { ...OPTIONS_TOMTOM, opacity: 0.8 });
}

/** Carte sans lien « Leaflet » qui se recale quand son conteneur change de taille. */
export function creerCarte(el: HTMLElement, options: L.MapOptions): { carte: L.Map; redimension: ResizeObserver } {
  const carte = L.map(el, { preferCanvas: true, ...options }); // tracés d'itinéraire en canvas plutôt qu'en SVG
  carte.attributionControl.setPrefix(false);
  // Mentions OpenStreetMap / TomTom obligatoires (licence ODbL, conditions TomTom) :
  // réduites à un bouton « i » qui les déplie au clic (styles.css).
  const mentions = carte.attributionControl.getContainer();
  if (mentions) {
    mentions.classList.add('attribution-compacte');
    mentions.title = 'Sources de la carte';
    mentions.addEventListener('click', () => mentions.classList.toggle('ouverte'));
  }
  // Sans cela, Leaflet garde une taille erronée si la mise en page bouge et laisse des zones grises.
  const redimension = new ResizeObserver(() => carte.invalidateSize());
  redimension.observe(el);
  return { carte, redimension };
}

export function marqueurHopital(): L.Marker {
  return marqueurEtablissement(BASE_SECOURS.lat, BASE_SECOURS.lng, BASE_SECOURS.nom, true);
}

/** Croix d'hôpital avec le nom dessous ; la photo de couverture (si fournie) s'ouvre au clic. */
export function marqueurEtablissement(lat: number, lng: number, nom: string, principal = false, photo?: string | null): L.Marker {
  const marqueur = L.marker([lat, lng], {
    icon: iconeEtablissement(nom, principal),
    zIndexOffset: principal ? 1000 : 400,
    title: nom,
  });
  lierPhotoEtablissement(marqueur, nom, photo);
  return marqueur;
}

/** Bulle affichée au clic sur le marqueur : photo de l'établissement et son nom. */
export function lierPhotoEtablissement(marqueur: L.Marker, nom: string, photo?: string | null): void {
  marqueur.unbindPopup();
  if (!photo) return;
  marqueur.bindPopup(
    `<figure class="w-56">
      <img src="${echapper(photo)}" alt="${echapper(nom)}" class="h-32 w-full rounded-lg bg-slate-200 object-cover dark:bg-slate-700">
      <figcaption class="mt-2 text-sm font-semibold">${echapper(nom)}</figcaption>
    </figure>`,
    { offset: [0, -14], minWidth: 224, maxWidth: 224 },
  );
}

export function iconeEtablissement(nom: string, principal = false): L.DivIcon {
  const croix = principal
    ? 'h-9 w-9 bg-rose-600 text-white text-lg ring-2 ring-white dark:ring-slate-900'
    : 'h-7 w-7 bg-white text-rose-600 ring-2 ring-rose-600 dark:bg-slate-900';
  const taille = principal ? 36 : 28;
  return L.divIcon({
    className: '',
    html: `<span class="relative flex h-full w-full items-center justify-center">
      <span class="flex shrink-0 cursor-pointer items-center justify-center rounded-lg shadow-lg ${croix}"><i class="fa-solid fa-plus"></i></span>
      <span class="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 shadow ring-1 ring-slate-200 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700">${echapper(nom)}</span>
    </span>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
}

function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Photo du dossier entourée de la couleur de gravité ; icône si la patiente n'a pas de photo. */
export function iconePatiente(a: AlerteUrgence, pulsation: boolean): L.DivIcon {
  const halo = pulsation
    ? `<span class="absolute inline-flex h-full w-full animate-ping rounded-full ${TEINTE[a.gravite]} opacity-60"></span>`
    : '';
  const visage = a.photo
    ? `<img src="${a.photo}" alt="" class="relative h-9 w-9 rounded-full bg-white object-cover shadow-md ring-[3px] ${ANNEAU[a.gravite]}">`
    : `<span class="relative inline-flex h-9 w-9 items-center justify-center rounded-full ${TEINTE[a.gravite]} text-sm text-white shadow-md ring-2 ring-white dark:ring-slate-900"><i class="fa-solid fa-person-pregnant"></i></span>`;
  return L.divIcon({
    className: '',
    html: `<span class="relative flex h-9 w-9">${halo}${visage}<span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${TEINTE[a.gravite]} ring-2 ring-white dark:ring-slate-900"></span></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/** Version réduite de images/ambulance.png (3 Ko au lieu de 211 Ko), nette sur écran haute densité. */
export function iconeAmbulance(largeur = 26): L.DivIcon {
  const hauteur = Math.round(largeur / 2);
  return L.divIcon({
    className: '',
    html: `<img src="images/ambulance-marqueur.webp" alt="" width="${largeur}" height="${hauteur}" class="drop-shadow-[0_1px_1px_rgb(0_0_0/0.5)] transition-transform duration-300">`,
    iconSize: [largeur, hauteur],
    iconAnchor: [largeur / 2, hauteur - 2],
  });
}

/** Déplace le marqueur ; l'image regarde vers la gauche et se retourne quand on roule vers l'est. */
export function deplacerAmbulance(marqueur: L.Marker, position: L.LatLngExpression): void {
  const deltaLng = L.latLng(position).lng - marqueur.getLatLng().lng;
  const image = marqueur.getElement()?.querySelector('img');
  if (image && Math.abs(deltaLng) > 1e-6) image.style.transform = deltaLng > 0 ? 'scaleX(-1)' : '';
  marqueur.setLatLng(position);
}

/** Point situé à la fraction f (0 → 1) de la longueur d'un tracé. */
export function pointSurTrajet(points: [number, number][], f: number): [number, number] {
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

/** Part du tracé (0 → 1) déjà parcourue, d'après le sommet le plus proche de la position. */
export function fractionSurTrajet(points: [number, number][], p: L.LatLngExpression): number {
  const ll = L.latLng(p);
  let proche = 0;
  points.forEach((q, i) => {
    if (ll.distanceTo(q) < ll.distanceTo(points[proche])) proche = i;
  });
  let total = 0;
  let parcouru = 0;
  for (let i = 1; i < points.length; i++) {
    const d = L.latLng(points[i - 1]).distanceTo(points[i]);
    total += d;
    if (i <= proche) parcouru += d;
  }
  return total ? parcouru / total : 1;
}

/** Distance (m) entre un point et le sommet le plus proche d'un tracé. */
export function ecartAuTrajet(points: [number, number][], p: L.LatLngExpression): number {
  const ll = L.latLng(p);
  return points.reduce((min, q) => Math.min(min, ll.distanceTo(q)), Infinity);
}
