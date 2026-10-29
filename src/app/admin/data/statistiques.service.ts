import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import type { StatutPatiente, StatutRdv } from './patientes.service';

/** Patientes et grossesses en cours d'une province (libellé identique à la carte). */
export interface EffectifProvincePatientes {
  province: string;
  patientes: number;
  grossessesEnCours: number;
}

/** Indicateurs du tableau de bord, calculés par le serveur sur les dossiers réels. */
export interface StatistiquesPatientes {
  genereLe: string;
  totaux: {
    patientes: number;
    nouvellesCeMois: number;
    nouvellesMoisPrecedent: number;
    grossessesEnCours: number;
    /** Médecins uniquement. */
    grossessesARisque?: number;
    rdvAujourdhui: number;
    rdv7Jours: number;
    absences30Jours: number;
  };
  trimestres: { t1: number; t2: number; t3: number; nonDatees: number };
  semaines: { debut: string; label: string; inscriptions: number }[];
  provinces: EffectifProvincePatientes[];
  sansProvince: number;
  qualite: { grossessesNonDatees: number; sansTelephone: number; completude: number | null };
  recentes: {
    id: string; numero: string; nom: string; prenom: string; postnom: string; photoUrl: string | null;
    statut: StatutPatiente; creeLe: string; agJours: number | null; aRisque?: boolean;
  }[];
  prochainsRdv: {
    id: string; date: string; motif: string; statut: StatutRdv;
    patiente: { numero: string; nom: string; prenom: string; postnom: string } | null;
  }[];
}

/** Bébés pris en charge et vaccination (PEV), calculés par le serveur sur les dossiers des enfants. */
export interface StatistiquesEnfants {
  genereLe: string;
  totaux: {
    /** Tous les dossiers d'enfants (bébés pris en charge). */
    enfants: number;
    /** Nés vivants, ni décédés ni transférés. */
    suivis: number;
    filles: number;
    garcons: number;
    nesCeMois: number;
    nesMoisPrecedent: number;
    complets: number;
    enRetard: number;
    dosesCeMois: number;
    seancesAujourdhui: number;
  };
  couverture: { code: string; libelle: string; age: string; eligibles: number; recus: number; pct: number }[];
  aRattraper: {
    id: string; numero: string; nom: string; prenom: string; sexe: 'Féminin' | 'Masculin' | 'Indéterminé';
    age: string; doses: string[]; depuis: string; telephone: string;
  }[];
}

/** Indicateur du cahier de spécifications : valeur, numérateur, dénominateur, formule et source. */
export interface Indicateur {
  code: string;
  module: string;
  libelle: string;
  unite: 'nombre' | '%' | 'heures';
  /** null : non calculable (dénominateur nul ou donnée absente) — affiché « N/A », jamais 0 %. */
  valeur: number | null;
  numerateur: number;
  denominateur: number | null;
  formule: string;
  reference: string;
  source: string;
  /** Règle proposée, à valider par les responsables métier avant usage officiel. */
  aValider?: boolean;
  /** Compteur à l'instant présent, indépendant de la période. */
  instantane?: boolean;
  lien?: string | null;
  detail?: string;
  /** Valeur de la période précédente de même durée (variation). */
  precedent?: number;
  icone?: string;
  ton?: string;
}

export type PeriodeSynthese = 'jour' | '7j' | 'mois' | 'trimestre' | 'annee' | 'perso';

export interface FiltresSynthese {
  periode: PeriodeSynthese;
  du?: string;
  au?: string;
  province?: string;
  aire?: string;
}

export interface LigneATraiter {
  type: string;
  priorite: 'Urgente' | 'Prioritaire' | 'Normale';
  motif: string;
  personne: { nom: string; numero: string } | null;
  detecteLe: string;
  echeance: string | null;
  responsable: string;
  statut: string;
  lien: string[];
  requete?: Record<string, string>;
  action: string;
}

export type ModuleSynthese = 'dossier' | 'cpn' | 'accouchement' | 'vaccination' | 'relance' | 'alertes';

/** Synthèse opérationnelle (GET /api/statistiques/synthese). */
export interface SyntheseTableauBord {
  genereLe: string;
  versionRegles: string;
  parametres: Record<string, number>;
  periode: { code: PeriodeSynthese; libelle: string; du: string; au: string };
  filtres: { province: string; aire: string; aires: string[] };
  prioritaires: Indicateur[];
  modules: Record<ModuleSynthese, Indicateur[]>;
  references: {
    cpnEmises: number; evacuationsObstetricales: number; communautairesEmises: number; communautairesAbouties: number;
    tauxAboutissement: number | null; delaiMedianJours: number | null;
  };
  alertesParType: { type: string; libelle: string; ouvertes: number }[];
  tendance: { mois: string[]; series: { code: string; libelle: string; valeurs: number[] }[] };
  comparaisonAires: { aire: string; grossessesEnCours: number; cpnEnRetard: number; enfantsEnRetard: number; tachesOuvertes: number }[];
  continuum: { etape: string; n: number }[];
  fluxReco: { etape: string; n: number }[];
  issuesReco: { reintegrees: number; orientees: number; clotureesSansReintegration: number; nonRetrouvees: number };
  aTraiter: { total: number; parType: Record<string, number>; lignes: LigneATraiter[] };
  qualite: {
    dossiersIncomplets: number; doublonsPresumes: number; dosesIncoherentes: number; accouchementsSansNouveauNe: number;
    consultationsIncompletes: number; conflitsRelance: number;
  };
  donneesManquantes: string[];
}

@Injectable({ providedIn: 'root' })
export class StatistiquesService {
  private http = inject(HttpClient);

  /** Synthèse du tableau de bord selon les filtres du bandeau (période, province, aire de santé). */
  synthese(f: FiltresSynthese): Promise<SyntheseTableauBord> {
    const params: Record<string, string> = { periode: f.periode };
    if (f.periode === 'perso') {
      if (f.du) params['du'] = f.du;
      if (f.au) params['au'] = f.au;
    }
    if (f.province) params['province'] = f.province;
    if (f.aire) params['aire'] = f.aire;
    return firstValueFrom(this.http.get<SyntheseTableauBord>(`${API_URL}/statistiques/synthese`, { params }));
  }

  patientes(): Promise<StatistiquesPatientes> {
    return firstValueFrom(this.http.get<StatistiquesPatientes>(`${API_URL}/statistiques/patientes`));
  }

  enfants(): Promise<StatistiquesEnfants> {
    return firstValueFrom(this.http.get<StatistiquesEnfants>(`${API_URL}/statistiques/enfants`));
  }
}

/**
 * État partagé de la synthèse : le bandeau de filtres (haut du tableau de bord) et les
 * indicateurs par module (bas) lisent la même réponse, calculée avec les mêmes filtres.
 */
@Injectable({ providedIn: 'root' })
export class SyntheseEtatService {
  private api = inject(StatistiquesService);
  readonly filtres = signal<FiltresSynthese>({ periode: 'mois' });
  readonly donnees = signal<SyntheseTableauBord | null>(null);
  readonly chargement = signal(false);
  readonly erreur = signal<string | null>(null);

  charger(filtres: Partial<FiltresSynthese> = {}): void {
    const f = { ...this.filtres(), ...filtres };
    this.filtres.set(f);
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.synthese(f)
      .then(d => this.donnees.set(d))
      .catch(e => this.erreur.set(e?.error?.message ?? 'Synthèse indisponible pour le moment.'))
      .finally(() => this.chargement.set(false));
  }
}
