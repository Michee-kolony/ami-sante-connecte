import { Injectable, computed, signal } from '@angular/core';
import { PROVINCES_RDC } from '../admin/data/carte-rdc';
import { zonesDeProvince } from '../admin/data/zones-sante';

/** Établissement tel que le filtre en a besoin (GET /comite/etablissements). */
export interface EtablissementPerimetre {
  id: string; code: string; nom: string; province: string; statut: 'Actif' | 'Suspendu';
  zoneSante?: string; zonesSante?: string[];
}

/** Choix du filtre : vide = tout le système. Une zone est toujours celle d'une province choisie. */
export interface Perimetre {
  province: string;
  zone: string;
  etablissement: string;
}

const VIDE: Perimetre = { province: '', zone: '', etablissement: '' };
const PROVINCES = new Set(PROVINCES_RDC.map(p => p.nom));

/** Zones de santé d'un établissement (les plus anciens n'ont qu'une zone, `zoneSante`). */
export const zonesDe = (e: Pick<EtablissementPerimetre, 'zoneSante' | 'zonesSante'>): string[] =>
  e.zonesSante?.length ? e.zonesSante : e.zoneSante ? [e.zoneSante] : [];

/**
 * Périmètre des indicateurs du comité de pilotage : tout le système, une province, une zone de
 * santé ou un établissement. Fourni par les routes /comite : le choix est gardé d'une page à
 * l'autre, envoyé avec chaque requête de statistiques (PERIMETRE_STATISTIQUES) et appliqué aux
 * listes chargées en entier (carte, personnel) avec `retient`.
 */
@Injectable()
export class PerimetreComiteService {
  readonly choix = signal<Perimetre>(VIDE);
  /** Tous les établissements du réseau (options du filtre et filtrage local). */
  readonly etablissements = signal<EtablissementPerimetre[]>([]);

  readonly actif = computed(() => !!(this.choix().province || this.choix().etablissement));

  /** Paramètres de requête des statistiques du comité (voir lirePerimetre côté serveur). */
  readonly params = computed<Record<string, string>>(() => {
    const c = this.choix();
    const p: Record<string, string> = {};
    if (c.etablissement) p['etablissement'] = c.etablissement;
    if (c.province) p['provinceEtablissement'] = c.province;
    if (c.zone) p['zoneSante'] = c.zone;
    return p;
  }, { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });

  /** Établissement choisi (null : aucun, ou pas encore chargé). */
  readonly etablissementChoisi = computed(() => this.etablissements().find(e => e.id === this.choix().etablissement) ?? null);

  /** Établissements retenus par le périmètre, dans l'ordre alphabétique. */
  readonly retenus = computed(() => this.etablissements().filter(e => this.retient(e.id))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));

  private readonly idsRetenus = computed(() => {
    const c = this.choix();
    if (!c.province && !c.etablissement) return null;
    return new Set(this.etablissements()
      .filter(e => (!c.etablissement || e.id === c.etablissement)
        && (!c.province || e.province === c.province)
        && (!c.zone || zonesDe(e).includes(c.zone)))
      .map(e => e.id));
  });

  /** Vrai si l'établissement fait partie du périmètre (toujours vrai sans filtre). */
  retient(id: string): boolean {
    const ids = this.idsRetenus();
    return !ids || ids.has(id);
  }

  /** Fil d'Ariane du périmètre, du plus large au plus précis. */
  readonly chemin = computed(() => {
    const c = this.choix();
    const etapes: { niveau: 'province' | 'zone' | 'etablissement'; libelle: string }[] = [];
    if (c.province) etapes.push({ niveau: 'province', libelle: c.province });
    if (c.zone) etapes.push({ niveau: 'zone', libelle: `ZS ${c.zone}` });
    if (c.etablissement) etapes.push({ niveau: 'etablissement', libelle: this.etablissementChoisi()?.nom ?? 'Établissement' });
    return etapes;
  });

  /** Libellé court : « tout le système », « Kinshasa », « ZS Limete (Kinshasa) », nom de l'établissement. */
  readonly libelle = computed(() => {
    const c = this.choix();
    if (c.etablissement) return this.etablissementChoisi()?.nom ?? 'l’établissement choisi';
    if (c.zone) return `la zone de santé ${c.zone} (${c.province})`;
    if (c.province) return `la province ${c.province}`;
    return 'tout le système';
  });

  /** Applique un choix en le rendant cohérent (zone de la province, établissement du périmètre). */
  definir(choix: Partial<Perimetre>): void {
    const c = { ...this.choix(), ...choix };
    if (!PROVINCES.has(c.province)) c.province = '';
    if (!c.province || !zonesDeProvince(c.province).includes(c.zone)) c.zone = '';
    const e = this.etablissements().find(x => x.id === c.etablissement);
    // Établissement hors de la province ou de la zone choisies : retiré (sauf liste pas encore chargée).
    if (e && ((c.province && e.province !== c.province) || (c.zone && !zonesDe(e).includes(c.zone)))) c.etablissement = '';
    this.choix.set(c);
  }

  /** Choisir une province repart de la province entière. */
  choisirProvince(province: string): void {
    this.definir({ province, zone: '', etablissement: '' });
  }

  /** Choisir une zone garde l'établissement s'il la couvre. */
  choisirZone(zone: string): void {
    this.definir({ zone });
  }

  /** Choisir un établissement place aussi le filtre sur sa province (fil d'Ariane cohérent). */
  choisirEtablissement(id: string): void {
    const e = this.etablissements().find(x => x.id === id);
    if (!id || !e) {
      this.definir({ etablissement: '' });
      return;
    }
    const zone = zonesDe(e).includes(this.choix().zone) ? this.choix().zone : '';
    this.definir({ province: e.province, zone, etablissement: id });
  }

  reinitialiser(): void {
    this.choix.set(VIDE);
  }
}
