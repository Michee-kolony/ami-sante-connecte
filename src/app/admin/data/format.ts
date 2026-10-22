// Affichage des dates du suivi prénatal : stockées en UTC, affichées à l'heure de l'établissement.
export const FUSEAU = 'Africa/Kinshasa';

const formatJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDateHeure = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSEAU,
});
const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });
const formatJourChiffres = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const formatDateHeureChiffres = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSEAU,
});

/** Date clinique sans heure (« AAAA-MM-JJ ») : « 14 mars 2026 », ou « Non renseignée ». */
export function jourFr(iso: string | null | undefined): string {
  if (!iso) return 'Non renseignée';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? 'Non renseignée' : formatJour.format(d);
}

/** Instant (consultation, rendez-vous, journal) à l'heure de Kinshasa. */
export function dateHeureFr(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : formatDateHeure.format(d);
}

/** Date clinique en chiffres : « 14/03/2026 », ou « Non renseignée ». */
export function jourChiffres(iso: string | null | undefined): string {
  if (!iso) return 'Non renseignée';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? 'Non renseignée' : formatJourChiffres.format(d);
}

/** Instant en chiffres à l'heure de Kinshasa : « 14/03/2026 09:30 ». */
export function dateHeureChiffres(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : formatDateHeureChiffres.format(d).replace(',', '');
}

export function heureFr(v: string | Date): string {
  return formatHeure.format(new Date(v));
}

/** Jour (AAAA-MM-JJ) d'un instant à l'heure de Kinshasa. */
export function jourLocal(v: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date(v));
}

/** Âge gestationnel en jours → « 23 SA + 4 j ». */
export function agLisible(jours: number | null | undefined): string {
  if (jours == null) return 'À confirmer';
  if (jours < 0) return 'Avant la date de référence';
  return `${Math.floor(jours / 7)} SA + ${jours % 7} j`;
}

const JOUR_MS = 86_400_000;
const jourMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * DPA par la règle de Naegele (identique au serveur), selon le mois de la DDR : de janvier à mars,
 * mois + 9 (même année) ; d'avril à décembre, mois − 3 et année + 1. Puis jour + 7 (débordement
 * sur le mois suivant).
 */
export function dpaNaegele(ddr: string): string {
  const [annee, mois, jour] = ddr.slice(0, 10).split('-').map(Number);
  const [anneeDpa, moisDpa] = mois <= 3 ? [annee, mois + 9] : [annee + 1, mois - 3];
  return new Date(Date.UTC(anneeDpa, moisDpa - 1, jour + 7)).toISOString().slice(0, 10);
}

/**
 * Aperçu de datation pendant la saisie (le serveur recalcule et fait foi) : âge gestationnel
 * aujourd'hui (en jours) et DPA calculée, depuis la DDR ou un AG constaté à une date d'examen.
 */
export function apercuDatation(s: { ddr?: string | null; dateReference?: string | null; agSemaines?: number | null; agJours?: number | null }):
  { agJours: number; dpa: string } | null {
  let reference: number;
  let agReference: number;
  if (s.ddr) {
    reference = jourMs(s.ddr);
    agReference = 0;
  } else {
    if (!s.dateReference || s.agSemaines == null) return null;
    reference = jourMs(s.dateReference);
    agReference = s.agSemaines * 7 + (s.agJours ?? 0);
  }
  if (Number.isNaN(reference)) return null;
  const agJours = agReference + Math.round((jourMs(aujourdhui()) - reference) / JOUR_MS);
  const dpa = s.ddr ? dpaNaegele(s.ddr) : new Date(reference + (280 - agReference) * JOUR_MS).toISOString().slice(0, 10);
  return { agJours, dpa };
}

/** Valeur d'un champ <input type="datetime-local"> pour un instant donné (heure locale du poste). */
export function versSaisieLocale(v: string | Date | null): string {
  if (!v) return '';
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function aujourdhui(): string {
  return jourLocal(new Date());
}
