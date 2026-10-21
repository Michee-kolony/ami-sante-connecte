import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class StatistiquesService {
  private http = inject(HttpClient);

  patientes(): Promise<StatistiquesPatientes> {
    return firstValueFrom(this.http.get<StatistiquesPatientes>(`${API_URL}/statistiques/patientes`));
  }
}
