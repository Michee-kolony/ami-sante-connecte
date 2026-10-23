import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../shared/api';
import type { AgeEnfant, Carnet, ResumeCarnet, SeanceVaccination, SexeEnfant } from '../admin/data/enfants.service';

const CLE = 'ami-maman';
const URL = `${API_URL}/espace-patiente`;

export interface ProfilMaman {
  id: string;
  numero: string;
  nom: string;
  postnom: string;
  prenom: string;
  age: number | null;
  email: string;
  telephone: string;
  statut: string;
  photoUrl: string | null;
  etablissement: { nom: string; province: string; telephone: string } | null;
}

export interface RdvMaman {
  id: string;
  date: string;
  motif: string;
  lieu: string;
  consignes: string;
  statut: string;
  enfant: { id: string; prenom: string } | null;
}

export interface EnfantMaman {
  photoUrl: string | null;
  id: string;
  numero: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: SexeEnfant;
  neLe: string;
  dateNaissance: string;
  rang: number;
  etatNaissance: string;
  statut: string;
  age: AgeEnfant | null;
  naissance: { poidsG: number | null; tailleCm: number | null; perimetreCranienCm: number | null; apgar: { m1: number | null; m5: number | null; m10: number | null }; vitamineK1: boolean | null };
  carnet: Carnet | null;
  croissance: { date: string; poidsG: number | null; tailleCm: number | null; perimetreCranienCm: number | null; perimetreBrachialCm: number | null; alimentation: string; observations: string; soignant: { nom: string; role: string } | null }[];
  rendezVous: RdvMaman[];
}

export interface AccueilMaman {
  patiente: ProfilMaman;
  grossesse: { numero: number; agJours: number | null; dpa: string | null } | null;
  prochainsRendezVous: RdvMaman[];
  enfants: { id: string; photoUrl: string | null; prenom: string; nom: string; sexe: SexeEnfant; dateNaissance: string; age: AgeEnfant | null; statut: string; etatNaissance: string; vaccination: (ResumeCarnet & { prochaineSeance: SeanceVaccination | null }) | null }[];
}

export interface AccouchementMaman {
  id: string;
  numero: string;
  statut: string;
  date: string;
  mode: string;
  multiple: boolean | null;
  accoucheur: string;
  enfants: { id: string; prenom: string; sexe: string; neLe: string; etatNaissance: string }[];
  sortie: { date: string; rdvCpon: string | null; observations: string } | null;
  conseils: string;
  mesuresPreventives: { mere: string[]; nouveauNe: string[] };
}

interface Session { jeton: string; patiente: ProfilMaman }

function lire(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Espace de la maman : connexion avec l'e-mail et le mot de passe choisis à l'enregistrement,
 * lecture de ses rendez-vous, de ses accouchements et du carnet de ses enfants. Jeton propre à la
 * patiente, envoyé ici explicitement (l'intercepteur des soignants ignore ces routes).
 */
@Injectable({ providedIn: 'root' })
export class EspaceMamanService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private session = signal<Session | null>(lire());

  readonly patiente = computed(() => this.session()?.patiente ?? null);
  readonly connectee = computed(() => !!this.session());

  async connecter(email: string, motDePasse: string): Promise<void> {
    const s = await firstValueFrom(this.http.post<Session>(`${URL}/connexion`, { email, motDePasse }));
    this.enregistrer(s);
  }

  deconnecter(): void {
    this.enregistrer(null);
    this.router.navigateByUrl('/maman/connexion');
  }

  private enregistrer(s: Session | null): void {
    this.session.set(s);
    try {
      s ? localStorage.setItem(CLE, JSON.stringify(s)) : localStorage.removeItem(CLE);
    } catch { /* stockage indisponible : session en mémoire */ }
  }

  /** GET authentifié ; une session expirée renvoie vers la connexion. */
  private async lireApi<T>(chemin: string): Promise<T> {
    const jeton = this.session()?.jeton ?? '';
    try {
      return await firstValueFrom(this.http.get<T>(`${URL}${chemin}`, { headers: new HttpHeaders({ Authorization: `Bearer ${jeton}` }) }));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) this.deconnecter();
      throw err;
    }
  }

  accueil(): Promise<AccueilMaman> {
    return this.lireApi('/accueil');
  }

  enfants(): Promise<EnfantMaman[]> {
    return this.lireApi('/enfants');
  }

  rendezVous(): Promise<RdvMaman[]> {
    return this.lireApi('/rendez-vous');
  }

  accouchements(): Promise<AccouchementMaman[]> {
    return this.lireApi('/accouchements');
  }

  async changerMotDePasse(actuel: string, nouveau: string): Promise<void> {
    await firstValueFrom(this.http.put(`${URL}/moi/mot-de-passe`, { actuel, nouveau }, {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.session()?.jeton ?? ''}` }),
    }));
  }
}

/** Accès réservé à la maman connectée. */
export const mamanConnectee: CanActivateFn = () =>
  inject(EspaceMamanService).connectee() ? true : inject(Router).createUrlTree(['/maman/connexion']);
