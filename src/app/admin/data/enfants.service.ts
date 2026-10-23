import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import type { Auteur, RendezVous, StatutRdv, CanalRappel } from './patientes.service';

// --- Types renvoyés par backend-ami-connecte (dossier de l'enfant, carnet PEV) ------------

export type StatutDose = 'Faite' | 'À venir' | 'À faire' | 'En retard' | 'Hors délai';
export type TypeDose = 'Vaccin' | 'Supplémentation' | 'Déparasitage';
export type SexeEnfant = 'Féminin' | 'Masculin' | 'Indéterminé';
export type StatutEnfant = 'Suivi' | 'Décédé' | 'Transféré';
export const STATUTS_ENFANT: StatutEnfant[] = ['Suivi', 'Décédé', 'Transféré'];
export const ALIMENTATIONS = ['Allaitement exclusif', 'Allaitement mixte', 'Alimentation de complément', 'Alimentation familiale'];

/** Une dose du calendrier (PEV RDC, vitamine A, mébendazole), avec son statut pour cet enfant. */
export interface DoseCarnet {
  code: string;
  libelle: string;
  type: TypeDose;
  antigene: string;
  maladies: string;
  voie: string;
  seance: string;
  datePrevue: string;
  dateLimite: string | null;
  statut: StatutDose;
  administration: { date: string; lot: string; site: string; lieu: string } | null;
}

export interface SeanceVaccination {
  date: string;
  doses: { code: string; libelle: string; type: TypeDose; statut: StatutDose }[];
}

export interface ResumeCarnet {
  vaccinsFaits: number;
  vaccinsTotal: number;
  enRetard: number;
  completementVaccine: boolean;
}

export interface Carnet {
  doses: DoseCarnet[];
  prochaineSeance: SeanceVaccination | null;
  resume: ResumeCarnet;
}

export interface AgeEnfant {
  jours: number;
  mois: number;
  libelle: string;
}

export interface ResumeEnfant {
  id: string;
  numero: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: SexeEnfant;
  neLe: string;
  dateNaissance: string;
  rang: number;
  etatNaissance: 'Vivant' | 'Mort-né';
  statut: StatutEnfant;
  age: AgeEnfant | null;
  mereId: string;
  accouchementId: string | null;
  vaccination: (ResumeCarnet & { prochaineSeance: SeanceVaccination | null }) | null;
  mere?: { id: string; numero: string; nom: string; prenom: string } | null;
}

export interface Apgar {
  respiration: number | null;
  fc: number | null;
  coloration: number | null;
  reflexes: number | null;
  tonus: number | null;
  total?: number | null;
}

/** Module 5 — données de naissance. */
export interface Naissance {
  senn: { maintienTemperature: boolean | null; temperatureAxillaire: number | null; crede: boolean | null };
  soinsCordon: { lameSterile: boolean | null; filSterile: boolean | null };
  miseAuSeinMoins1h: boolean | null;
  poidsG: number | null;
  tailleCm: number | null;
  perimetreCranienCm: number | null;
  malformations: { presentes: boolean | null; description: string };
  apgar: { m1: Apgar; m5: Apgar; m10: Apgar };
  reanimation: { faite: boolean | null; stimulation: boolean | null; aspiration: boolean | null; ventilation: boolean | null };
  traitement: { vitamineK1: boolean | null; antibiotique: boolean | null; antibiotiquePrecision: string; arv: boolean | null; arvPrecision: string };
}

export function apgarVide(): Apgar {
  return { respiration: null, fc: null, coloration: null, reflexes: null, tonus: null };
}

export function naissanceVide(): Naissance {
  return {
    senn: { maintienTemperature: null, temperatureAxillaire: null, crede: null },
    soinsCordon: { lameSterile: null, filSterile: null },
    miseAuSeinMoins1h: null, poidsG: null, tailleCm: null, perimetreCranienCm: null,
    malformations: { presentes: null, description: '' },
    apgar: { m1: apgarVide(), m5: apgarVide(), m10: apgarVide() },
    reanimation: { faite: null, stimulation: null, aspiration: null, ventilation: null },
    traitement: { vitamineK1: null, antibiotique: null, antibiotiquePrecision: '', arv: null, arvPrecision: '' },
  };
}

/** Total APGAR affiché pendant la saisie (le serveur le recalcule). */
export function totalApgar(a: Apgar): number | null {
  const notes = [a.respiration, a.fc, a.coloration, a.reflexes, a.tonus];
  return notes.every(n => n == null) ? null : notes.reduce<number>((s, n) => s + (n ?? 0), 0);
}

export interface Administration {
  id: string;
  code: string;
  date: string;
  lot: string;
  site: string;
  lieu: string;
  observations: string;
  administreePar: Auteur;
  le: string;
  annulation?: { motif: string; par: Auteur; le: string };
}

export interface SuiviEnfant {
  id: string;
  date: string;
  poidsG: number | null;
  tailleCm: number | null;
  perimetreCranienCm: number | null;
  perimetreBrachialCm: number | null;
  temperature: number | null;
  alimentation: string;
  developpement: string;
  observations: string;
  auteur: Auteur;
  le: string;
}

export interface DossierEnfant extends Omit<ResumeEnfant, 'vaccination' | 'mere'> {
  grossesseId: string | null;
  etablissementId: string | null;
  naissance: Naissance;
  vaccinations: Administration[];
  suivis: SuiviEnfant[];
  carnet: Carnet | null;
  mere: { id: string; numero: string; nom: string; postnom: string; prenom: string; telephone: string } | null;
  rendezVous: RendezVous[];
  creePar: Auteur;
  createdAt: string;
}

/** Ligne du calendrier vaccinal servi par /referentiels/vaccination. */
export interface DoseCalendrier {
  code: string;
  libelle: string;
  type: TypeDose;
  antigene: string;
  maladies: string;
  voie: string;
  seance: string;
}

export interface SaisieDose {
  code: string;
  date?: string;
  lot?: string;
  site?: string;
  lieu?: string;
  observations?: string;
}

/** Classes des pastilles de statut d'une dose. */
export function classeStatutDose(s: StatutDose): string {
  return {
    'Faite': 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/30',
    'À faire': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    'En retard': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
    'Hors délai': 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    'À venir': 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700',
  }[s];
}

export function iconeStatutDose(s: StatutDose): string {
  return { 'Faite': 'fa-check', 'À faire': 'fa-clock', 'En retard': 'fa-exclamation', 'Hors délai': 'fa-ban', 'À venir': 'fa-minus' }[s];
}

/** Séances du calendrier dans l'ordre (Naissance, 6 semaines…), avec leurs doses. */
export function parSeance<T extends { seance: string }>(doses: T[]): { seance: string; doses: T[] }[] {
  const r: { seance: string; doses: T[] }[] = [];
  for (const d of doses) {
    const s = r.find(x => x.seance === d.seance);
    if (s) s.doses.push(d);
    else r.push({ seance: d.seance, doses: [d] });
  }
  return r;
}

/**
 * Dossier de l'enfant (backend-ami-connecte) : carnet vaccinal, croissance et rendez-vous ouverts
 * à tout le personnel ; les données de naissance sont modifiables par les médecins et sages-femmes.
 */
@Injectable({ providedIn: 'root' })
export class EnfantsService {
  private http = inject(HttpClient);
  private url = `${API_URL}/enfants`;

  /** Calendrier PEV (chargé une fois). */
  readonly calendrier = signal<DoseCalendrier[]>([]);

  async chargerCalendrier(): Promise<DoseCalendrier[]> {
    if (this.calendrier().length) return this.calendrier();
    const r = await firstValueFrom(this.http.get<{ calendrier: DoseCalendrier[] }>(`${API_URL}/referentiels/vaccination`));
    this.calendrier.set(r.calendrier);
    return r.calendrier;
  }

  rechercher(criteres: { q?: string; mereId?: string; retard?: boolean } = {}): Promise<ResumeEnfant[]> {
    const params: Record<string, string> = {};
    if (criteres.q?.trim()) params['q'] = criteres.q.trim();
    if (criteres.mereId) params['mereId'] = criteres.mereId;
    if (criteres.retard) params['retard'] = 'true';
    return firstValueFrom(this.http.get<ResumeEnfant[]>(this.url, { params }));
  }

  obtenir(id: string): Promise<DossierEnfant> {
    return firstValueFrom(this.http.get<DossierEnfant>(`${this.url}/${encodeURIComponent(id)}`));
  }

  modifier(id: string, corps: Partial<{ nom: string; postnom: string; prenom: string; sexe: SexeEnfant; statut: StatutEnfant; neLe: string; etatNaissance: string; naissance: Naissance }>): Promise<DossierEnfant> {
    return firstValueFrom(this.http.patch<DossierEnfant>(`${this.url}/${encodeURIComponent(id)}`, corps));
  }

  vacciner(id: string, doses: SaisieDose[]): Promise<DossierEnfant> {
    return firstValueFrom(this.http.post<DossierEnfant>(`${this.url}/${encodeURIComponent(id)}/vaccinations`, { doses }));
  }

  annulerVaccination(id: string, vaccinationId: string, motif: string): Promise<DossierEnfant> {
    return firstValueFrom(this.http.post<DossierEnfant>(`${this.url}/${encodeURIComponent(id)}/vaccinations/${vaccinationId}/annuler`, { motif }));
  }

  ajouterSuivi(id: string, corps: Partial<Omit<SuiviEnfant, 'id' | 'auteur' | 'le'>>): Promise<DossierEnfant> {
    return firstValueFrom(this.http.post<DossierEnfant>(`${this.url}/${encodeURIComponent(id)}/suivis`, corps));
  }

  creerRendezVous(id: string, corps: { date: string; motif: string; lieu?: string; consignes?: string; canalRappel?: CanalRappel }): Promise<RendezVous> {
    return firstValueFrom(this.http.post<RendezVous>(`${this.url}/${encodeURIComponent(id)}/rendez-vous`, corps));
  }

  /** Confirmer, reporter (date + motif), effectué, absent, annuler (motif) : ouvert à tout le personnel. */
  modifierRendezVous(enfantId: string, rdvId: string, action: 'confirmer' | 'reporter' | 'effectue' | 'absent' | 'annuler', extra: { date?: string; motif?: string } = {}): Promise<RendezVous> {
    return firstValueFrom(this.http.patch<RendezVous>(`${this.url}/${encodeURIComponent(enfantId)}/rendez-vous/${rdvId}`, { action, ...extra }));
  }
}

export type { StatutRdv };
