// Accès aux services TomTom (tuiles, trafic, géocodage inverse, itinéraires).
// La clé est visible côté navigateur : la restreindre aux domaines du site
// depuis le tableau de bord développeur TomTom.
export const TOMTOM_KEY = 'JuhuALSLTDH1gJxn9gA3oFd0VZEUALr9';

const API = 'https://api.tomtom.com';

export const TOMTOM_TUILES = {
  plan: `${API}/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&language=fr-FR`,
  nuit: `${API}/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&language=fr-FR`,
  trafic: `${API}/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`,
};

export interface Itineraire {
  points: [number, number][];
  distanceM: number;
  dureeS: number;
  retardS: number;
}

/** Itinéraire voiture tenant compte du trafic en temps réel. */
export async function calculerItineraire(depart: [number, number], arrivee: [number, number]): Promise<Itineraire> {
  const trajet = `${depart[0]},${depart[1]}:${arrivee[0]},${arrivee[1]}`;
  // avoid=borderCrossings : l'itinéraire ne passe jamais par Brazzaville (autre rive du fleuve).
  const rep = await fetch(`${API}/routing/1/calculateRoute/${trajet}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=car&routeType=fastest&avoid=borderCrossings`);
  if (!rep.ok) throw new Error(`TomTom Routing : ${rep.status}`);
  const json = await rep.json();
  const route = json.routes[0];
  return {
    points: route.legs.flatMap((l: any) => l.points.map((p: any) => [p.latitude, p.longitude] as [number, number])),
    distanceM: route.summary.lengthInMeters,
    dureeS: route.summary.travelTimeInSeconds,
    retardS: route.summary.trafficDelayInSeconds ?? 0,
  };
}

/** Adresse la plus proche d'un point GPS (null si TomTom ne trouve rien). */
export async function adresseDe(lat: number, lng: number): Promise<string | null> {
  const rep = await fetch(`${API}/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_KEY}&language=fr-FR`);
  if (!rep.ok) return null;
  const json = await rep.json();
  return json.addresses?.[0]?.address?.freeformAddress ?? null;
}
