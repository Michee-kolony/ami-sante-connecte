import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { API_URL } from '../../shared/api';
import type { RoleSoignant, Soignant } from './soignants.service';

const CLE_STOCKAGE = 'ami-session';

/** Rôles autorisés à ajouter et gérer le personnel (le serveur applique la même règle). */
export const ROLES_GESTION: RoleSoignant[] = ['Médecin chef de service'];

/** Établissement dans lequel le soignant travaille pendant cette session. */
export interface EtablissementSession {
  id: string;
  code: string;
  nom: string;
  type: string;
  province: string;
  districtSanitaire?: string;
  zoneSante: string;
  aireSante: string;
  adresse: string;
  photo: string | null;
}

interface Session {
  jeton: string;
  soignant: Soignant;
  etablissement: EtablissementSession | null;
}

/** Réponse du serveur quand le soignant doit d'abord choisir son établissement. */
interface ChoixEtablissement {
  choixEtablissement: true;
  etablissements: EtablissementSession[];
}

function lireSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE) ?? 'null');
  } catch {
    return null;
  }
}

/** Soignant connecté à l'espace administrateur et son jeton d'accès. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private session = signal<Session | null>(lireSession());

  readonly soignant = computed(() => this.session()?.soignant ?? null);
  readonly etablissement = computed(() => this.session()?.etablissement ?? null);
  readonly connecte = computed(() => !!this.session());
  readonly peutGererSoignants = computed(() => {
    const s = this.soignant();
    return !!s && ROLES_GESTION.includes(s.role);
  });
  /** Dossier médical numérique : médecins uniquement (règle appliquée aussi par le serveur). */
  readonly estMedecin = computed(() => !!this.soignant()?.role.startsWith('Médecin'));
  readonly estInfirmier = computed(() => !!this.soignant() && !this.estMedecin());
  /** Salle de travail et dossier d'accouchement : médecins et sages-femmes (règle du serveur). */
  readonly estMaternite = computed(() => this.estMedecin() || !!this.soignant()?.role.startsWith('Sage-femme'));

  get jeton(): string | null {
    return this.session()?.jeton ?? null;
  }

  /**
   * Connexion. Si le soignant exerce dans plusieurs établissements et n'en a pas encore choisi,
   * renvoie la liste à proposer (aucune session n'est ouverte) ; sinon renvoie null.
   */
  async connecter(email: string, motDePasse: string, etablissementId?: string): Promise<EtablissementSession[] | null> {
    const r = await firstValueFrom(this.http.post<Session | ChoixEtablissement>(
      `${API_URL}/auth/connexion`, { email, motDePasse, etablissementId }));
    if ('choixEtablissement' in r) return r.etablissements;
    this.enregistrer(r);
    return null;
  }

  /** Enregistre le profil du soignant connecté ; la photo est facultative. */
  async modifierProfil(donnees: Record<string, string>, photo: File | null): Promise<Soignant> {
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(donnees)) corps.append(cle, valeur);
    if (photo) corps.append('photo', photo);
    const soignant = await firstValueFrom(this.http.patch<Soignant>(`${API_URL}/auth/moi`, corps));
    this.majSoignant(soignant);
    return soignant;
  }

  async changerMotDePasse(actuel: string, nouveau: string): Promise<void> {
    this.majSoignant(await firstValueFrom(this.http.put<Soignant>(`${API_URL}/auth/moi/mot-de-passe`, { actuel, nouveau })));
  }

  private majSoignant(soignant: Soignant): void {
    const session = this.session();
    if (session) this.enregistrer({ ...session, soignant });
  }

  deconnecter(): void {
    // PresenceService ferme alors sa connexion temps réel : le serveur retire aussitôt le soignant des « en ligne ».
    this.enregistrer(null);
    this.router.navigateByUrl('/admin/connexion');
  }

  private enregistrer(session: Session | null): void {
    this.session.set(session);
    try {
      session ? localStorage.setItem(CLE_STOCKAGE, JSON.stringify(session)) : localStorage.removeItem(CLE_STOCKAGE);
    } catch { /* stockage indisponible : la session reste en mémoire */ }
  }
}

/** Ajoute le jeton aux appels de l'API et renvoie vers la connexion s'il a expiré. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Espace patiente : jeton de la patiente, ajouté par EspaceMamanService (jamais celui d'un soignant).
  if (!req.url.startsWith(API_URL) || req.url.startsWith(`${API_URL}/espace-patiente`)) return next(req);
  const session = inject(SessionService);
  const jeton = session.jeton;
  const requete = jeton ? req.clone({ setHeaders: { Authorization: `Bearer ${jeton}` } }) : req;
  return next(requete).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status === 401 && jeton) session.deconnecter();
    return throwError(() => err);
  }));
};

/** Message en français selon le code HTTP, quand le serveur n'en donne pas (proxy, page HTML…). */
const MESSAGES_HTTP: Record<number, string> = {
  400: 'Requête invalide. Vérifiez les informations saisies.',
  401: 'Session expirée, reconnectez-vous.',
  403: 'Vous n’avez pas accès à cette action.',
  404: 'Élément introuvable.',
  408: 'Le serveur a mis trop de temps à répondre, réessayez.',
  409: 'Conflit avec des données existantes.',
  413: 'Fichier ou données trop volumineux.',
  415: 'Format de fichier non pris en charge.',
  429: 'Trop de demandes, patientez un instant puis réessayez.',
  500: 'Erreur interne du serveur. Réessayez dans un instant.',
  502: 'Serveur momentanément indisponible, réessayez dans un instant.',
  503: 'Serveur momentanément indisponible, réessayez dans un instant.',
  504: 'Le serveur a mis trop de temps à répondre, réessayez.',
};

/** Tournures anglaises connues (bibliothèques, proxy) : jamais montrées telles quelles. */
const ANGLAIS = /\b(Path|is required|Cast to|failed|Unexpected|is not a valid|allowed|Cannot|Not Found|Bad Request|Internal Server Error|Gateway|Timeout|Unauthorized|Forbidden|Too Many Requests|Payload Too Large)\b/;

/** Message d'erreur lisible, toujours en français. */
export function messageErreur(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      if (typeof err.error?.message === 'string') return err.error.message;
      return navigator.onLine === false
        ? 'Pas de connexion internet. Vérifiez votre réseau puis réessayez.'
        : 'Serveur injoignable. Vérifiez votre connexion ou réessayez dans un instant.';
    }
    const message = typeof err.error?.message === 'string' ? err.error.message : '';
    if (message && !ANGLAIS.test(message)) return message;
    return MESSAGES_HTTP[err.status] ?? (err.status >= 500 ? MESSAGES_HTTP[500] : `Erreur ${err.status}.`);
  }
  return 'Erreur inattendue. Réessayez.';
}
