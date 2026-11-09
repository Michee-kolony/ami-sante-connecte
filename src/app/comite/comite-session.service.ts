import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { API_URL } from '../shared/api';

const CLE_STOCKAGE = 'ami-comite-session';
export const API_COMITE = `${API_URL}/comite`;

/** Membre du comité de pilotage (propriétaire du projet). */
export interface MembreComite {
  id: string;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M' | '';
  fonction: string;
  /** Institution représentée au comité. */
  organisation: string;
  telephone: string;
  email: string;
  photo: string | null;
  statut: 'Actif' | 'Suspendu';
  /** Président du comité : seul à pouvoir retirer un membre. */
  estPresident?: boolean;
  derniereConnexion: string | null;
  doitChangerMotDePasse: boolean;
  ajoutePar?: { nom: string } | null;
  creeLe?: string | null;
}

/** Champs du profil qu'un membre renseigne lui-même. */
export type ProfilComite = Pick<MembreComite, 'prenom' | 'nom' | 'sexe' | 'fonction' | 'organisation' | 'telephone'>;

interface SessionComite {
  jeton: string;
  membre: MembreComite;
}

function lire(): SessionComite | null {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Session du comité de pilotage, distincte de celle du personnel soignant : un même navigateur
 * peut être connecté aux deux espaces, chacun avec son propre jeton.
 */
@Injectable({ providedIn: 'root' })
export class ComiteSessionService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private session = signal<SessionComite | null>(lire());

  readonly membre = computed(() => this.session()?.membre ?? null);
  readonly connecte = computed(() => !!this.session());

  get jeton(): string | null {
    return this.session()?.jeton ?? null;
  }

  async connecter(email: string, motDePasse: string): Promise<void> {
    this.enregistrer(await firstValueFrom(this.http.post<SessionComite>(`${API_COMITE}/connexion`, { email, motDePasse })));
  }

  async changerMotDePasse(actuel: string, nouveau: string): Promise<void> {
    this.majMembre(await firstValueFrom(this.http.put<MembreComite>(`${API_COMITE}/moi/mot-de-passe`, { actuel, nouveau })));
  }

  /** Enregistre le profil ; `photo` remplace la photo actuelle, `retirerPhoto` la supprime. */
  async modifierProfil(profil: ProfilComite, photo: File | null, retirerPhoto = false): Promise<void> {
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(profil)) corps.append(cle, valeur ?? '');
    if (photo) corps.append('photo', photo);
    else if (retirerPhoto) corps.append('retirerPhoto', 'true');
    this.majMembre(await firstValueFrom(this.http.patch<MembreComite>(`${API_COMITE}/moi`, corps)));
  }

  /** Relit le compte sur le serveur (rôle de président, profil modifié ailleurs). */
  async rafraichir(): Promise<void> {
    if (!this.connecte()) return;
    this.majMembre(await firstValueFrom(this.http.get<MembreComite>(`${API_COMITE}/moi`)));
  }

  private majMembre(membre: MembreComite): void {
    const s = this.session();
    if (s) this.enregistrer({ ...s, membre });
  }

  deconnecter(): void {
    this.enregistrer(null);
    this.router.navigateByUrl('/comite/connexion');
  }

  private enregistrer(session: SessionComite | null): void {
    this.session.set(session);
    try {
      session ? localStorage.setItem(CLE_STOCKAGE, JSON.stringify(session)) : localStorage.removeItem(CLE_STOCKAGE);
    } catch { /* stockage indisponible : la session reste en mémoire */ }
  }
}

/** Ajoute le jeton du comité aux appels /api/comite et renvoie vers la connexion s'il a expiré. */
export const comiteInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${API_COMITE}/`) || req.url === `${API_COMITE}/connexion`) return next(req);
  const session = inject(ComiteSessionService);
  const jeton = session.jeton;
  const requete = jeton ? req.clone({ setHeaders: { Authorization: `Bearer ${jeton}` } }) : req;
  return next(requete).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status === 401 && jeton) session.deconnecter();
    return throwError(() => err);
  }));
};
