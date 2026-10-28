// Calculs faits sur l'appareil pour les dossiers créés hors connexion, copies fidèles des règles du
// serveur (backend-ami-connecte/config/partogramme.js et config/vaccination.js) : la sage-femme voit
// la zone du partogramme et les alertes, le vaccinateur les doses dues, sans réseau. Le serveur
// recalcule tout à la synchronisation : en cas d'écart, c'est son calcul qui fait foi.

const HEURE = 3_600_000;
const JOUR = 86_400_000;

// --- Partogramme (config/partogramme.js) -------------------------------------------------------

export const BCF = { min: 120, max: 160 };
export const PHASE_ACTIVE_CM = 4;
const DILATATION_COMPLETE_CM = 10;
const VITESSE_CM_H = 1;
const DECALAGE_ACTION_H = 4;
const STAGNATION_H = 2;

export type Zone = 'Verte' | 'Jaune' | 'Rouge';

/** Zone d'un point : verte jusqu'à la ligne d'alerte, jaune jusqu'à la ligne d'action, rouge au-delà. */
export function zoneDilatation(heures: number, cm: number): Zone {
  const alerte = Math.min(DILATATION_COMPLETE_CM, PHASE_ACTIVE_CM + VITESSE_CM_H * heures);
  if (cm >= alerte) return 'Verte';
  const action = Math.min(DILATATION_COMPLETE_CM, PHASE_ACTIVE_CM + VITESSE_CM_H * (heures - DECALAGE_ACTION_H));
  return cm >= action ? 'Jaune' : 'Rouge';
}

export const bcfAnormal = (bcf: number | null | undefined) => bcf != null && (bcf < BCF.min || bcf > BCF.max);

export interface SurveillanceLocale { le: string; dilatationCm?: number | null; bcf?: number | null; [cle: string]: unknown }
export interface PointLocal { le: string; heures: number; cm: number; zone: Zone }
export interface AlerteLocale { code: string; niveau: 'Critique' | 'Avertissement'; message: string; le: string }

/** Début de la phase active : première dilatation ≥ 4 cm. */
export function debutPhaseActive(surveillances: SurveillanceLocale[]): string | null {
  const s = [...surveillances].sort((a, b) => a.le.localeCompare(b.le)).find(x => x.dilatationCm != null && x.dilatationCm >= PHASE_ACTIVE_CM);
  return s?.le ?? null;
}

/** Points de dilatation de la phase active, avec leur zone. */
export function pointsDilatation(surveillances: SurveillanceLocale[]): PointLocal[] {
  const debut = debutPhaseActive(surveillances);
  if (!debut) return [];
  const t0 = Date.parse(debut);
  return surveillances
    .filter(s => s.dilatationCm != null && Date.parse(s.le) >= t0)
    .sort((a, b) => a.le.localeCompare(b.le))
    .map(s => {
      const heures = Math.round(((Date.parse(s.le) - t0) / HEURE) * 100) / 100;
      return { le: s.le, heures, cm: s.dilatationCm!, zone: zoneDilatation(heures, s.dilatationCm!) };
    });
}

/** Alertes de la série (mêmes règles que le serveur : BCF, zone jaune, stagnation, zone rouge). */
export function alertesLocales(surveillances: SurveillanceLocale[]): AlerteLocale[] {
  const alertes: AlerteLocale[] = [];
  for (const s of surveillances) {
    if (bcfAnormal(s.bcf)) alertes.push({ code: 'BCF', niveau: 'Critique', le: s.le, message: `BCF à ${s.bcf} bpm : hors de la plage normale (${BCF.min}–${BCF.max} bpm).` });
  }
  const points = pointsDilatation(surveillances);
  points.forEach((p, i) => {
    const precedent = points[i - 1];
    if (p.zone === 'Rouge' && precedent?.zone !== 'Rouge') {
      alertes.push({ code: 'Zone rouge', niveau: 'Critique', le: p.le, message: `Dilatation à ${p.cm} cm après ${p.heures} h de phase active : la courbe a franchi la ligne d’action (zone rouge). Appelez le médecin.` });
    }
    if (p.zone === 'Jaune') {
      if (precedent?.zone !== 'Jaune') alertes.push({ code: 'Zone jaune', niveau: 'Avertissement', le: p.le, message: `Dilatation à ${p.cm} cm après ${p.heures} h de phase active : la courbe a franchi la ligne d’alerte (zone jaune).` });
      let debutEpisode = i;
      while (debutEpisode > 0 && points[debutEpisode - 1].zone === 'Jaune') debutEpisode -= 1;
      const reference = points.slice(debutEpisode, i).reverse().find(r => Date.parse(p.le) - Date.parse(r.le) >= STAGNATION_H * HEURE);
      const dejaSignalee = alertes.some(a => a.code === 'Stagnation' && a.le >= points[debutEpisode].le);
      if (reference && p.cm <= reference.cm && !dejaSignalee) {
        alertes.push({ code: 'Stagnation', niveau: 'Critique', le: p.le, message: `Dilatation stationnaire à ${p.cm} cm depuis plus de ${STAGNATION_H} h en zone jaune.` });
      }
    }
  });
  return alertes.sort((a, b) => b.le.localeCompare(a.le));
}

// --- Calendrier vaccinal (config/vaccination.js, référentiel /referentiels/vaccination) ----------

export interface DoseReferentiel {
  code: string; libelle: string; type: string; seance: string;
  age: { jours?: number; semaines?: number; mois?: number };
  apres?: string; intervalleJours?: number; limiteJours?: number;
}
export interface DoseLocale { code: string; libelle: string; type: string; seance: string; datePrevue: string; statut: 'Faite' | 'À venir' | 'À faire' | 'En retard' | 'Hors délai'; faiteLe: string | null }

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const jourMs = (j: string) => Date.parse(`${j}T00:00:00Z`);
/** Jour civil à Kinshasa (UTC+1). */
export const jourKinshasa = (d = new Date()) => iso(d.getTime() + HEURE);

function dateAge(naissance: string, { jours = 0, semaines = 0, mois = 0 }: DoseReferentiel['age']): string {
  const [a, m, j] = naissance.split('-').map(Number);
  const finMois = new Date(Date.UTC(a, m - 1 + mois + 1, 0)).getUTCDate();
  return iso(Date.UTC(a, m - 1 + mois, Math.min(j, finMois)) + (jours + semaines * 7) * JOUR);
}

/** Carnet calculé sur l'appareil : statut de chaque dose (Faite, À venir, À faire, En retard, Hors délai). */
export function carnetLocal(naissance: string, calendrier: DoseReferentiel[], faites: { code: string; date: string }[], tolerance = 14, aujourdhui = jourKinshasa()): DoseLocale[] {
  const parCode = new Map(faites.map(f => [f.code, f.date]));
  const prevues = new Map<string, string>();
  return calendrier.map(d => {
    let prevue = dateAge(naissance, d.age);
    if (d.apres) {
      const avant = parCode.get(d.apres) ?? prevues.get(d.apres);
      if (avant) prevue = iso(Math.max(jourMs(prevue), jourMs(avant) + (d.intervalleJours ?? 28) * JOUR));
    }
    prevues.set(d.code, prevue);
    const limite = d.limiteJours != null ? iso(jourMs(naissance) + d.limiteJours * JOUR) : null;
    const faite = parCode.get(d.code) ?? null;
    const statut: DoseLocale['statut'] = faite ? 'Faite'
      : limite && aujourdhui > limite ? 'Hors délai'
      : aujourdhui < prevue ? 'À venir'
      : jourMs(aujourdhui) - jourMs(prevue) <= tolerance * JOUR ? 'À faire'
      : 'En retard';
    return { code: d.code, libelle: d.libelle, type: d.type, seance: d.seance, datePrevue: prevue, statut, faiteLe: faite };
  });
}
