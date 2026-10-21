// Affichage des dates du suivi prénatal : stockées en UTC, affichées à l'heure de l'établissement.
export const FUSEAU = 'Africa/Kinshasa';

const formatJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDateHeure = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSEAU,
});
const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });

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
