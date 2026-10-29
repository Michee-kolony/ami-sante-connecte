import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';
import { Auteur } from './patientes.service';

export const CIBLES_ARTICLE = ['Grossesse (CPN)', 'Après l’accouchement', 'Tous publics'] as const;
export type CibleArticle = typeof CIBLES_ARTICLE[number];
export const PHOTOS_MAX = 4;
export const PHOTO_TAILLE_MAX = 5 * 1024 * 1024;
export const VIDEO_TAILLE_MAX = 50 * 1024 * 1024;

export interface MediaArticle {
  type: 'image' | 'video';
  url: string;
}

export interface ReponseArticle {
  id: string;
  auteur: Auteur;
  texte: string;
  le: string;
  peutSupprimer: boolean;
}

export interface CommentaireArticle extends ReponseArticle {
  reponses: ReponseArticle[];
}

/** Article vu par le médecin connecté (droits calculés par le serveur). */
export interface Article {
  id: string;
  titre: string;
  contenu: string;
  cible: CibleArticle;
  medias: MediaArticle[];
  /** photoUrl : photo de profil du médecin auteur (lien signé), null s'il n'en a pas. */
  auteur: Auteur & { photoUrl?: string | null };
  /** « En attente » jusqu'à l'approbation du médecin chef (visible de l'auteur et du chef seulement). */
  statut: 'En attente' | 'Approuvé';
  approbation?: { par: Auteur; le: string };
  nbJaimes: number;
  jAime: boolean;
  /** Médecin chef seulement (l'article et ses médias sont supprimés). */
  peutSupprimer: boolean;
  peutApprouver: boolean;
  /** Seul l'auteur de l'article répond aux commentaires. */
  peutRepondre: boolean;
  commentaires: CommentaireArticle[];
  createdAt: string;
  updatedAt: string;
}

export interface PageArticles {
  total: number;
  page: number;
  parPage: number;
  /** Articles en attente d'approbation (médecin chef ; null pour les autres). */
  enAttente: number | null;
  articles: Article[];
}

/**
 * Articles de conseils (backend-ami-connecte) : médecins seulement. Un article attend
 * l'approbation du médecin chef avant d'être visible de tous ; seul le médecin chef approuve ou
 * supprime un article. Le serveur applique ces règles.
 */
@Injectable({ providedIn: 'root' })
export class ArticlesService {
  private http = inject(HttpClient);
  private url = `${API_URL}/articles`;

  lister(page = 1, cible = '', enAttente = false): Promise<PageArticles> {
    const params: Record<string, string> = { page: String(page) };
    if (cible) params['cible'] = cible;
    if (enAttente) params['statut'] = 'En attente';
    return firstValueFrom(this.http.get<PageArticles>(this.url, { params }));
  }

  /** Multipart : texte + 4 photos au maximum ou une seule vidéo (champ « medias »). */
  publier(corps: { titre: string; contenu: string; cible: CibleArticle }, medias: File[]): Promise<Article> {
    const f = new FormData();
    f.append('titre', corps.titre);
    f.append('contenu', corps.contenu);
    f.append('cible', corps.cible);
    for (const m of medias) f.append('medias', m);
    return firstValueFrom(this.http.post<Article>(this.url, f));
  }

  /** Médecin chef : rend l'article visible de tous. */
  approuver(id: string): Promise<Article> {
    return firstValueFrom(this.http.post<Article>(`${this.url}/${id}/approuver`, {}));
  }

  supprimer(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.url}/${id}`));
  }

  aimer(id: string): Promise<Article> {
    return firstValueFrom(this.http.post<Article>(`${this.url}/${id}/jaime`, {}));
  }

  commenter(id: string, texte: string): Promise<Article> {
    return firstValueFrom(this.http.post<Article>(`${this.url}/${id}/commentaires`, { texte }));
  }

  supprimerCommentaire(id: string, cid: string): Promise<Article> {
    return firstValueFrom(this.http.delete<Article>(`${this.url}/${id}/commentaires/${cid}`));
  }

  repondre(id: string, cid: string, texte: string): Promise<Article> {
    return firstValueFrom(this.http.post<Article>(`${this.url}/${id}/commentaires/${cid}/reponses`, { texte }));
  }

  supprimerReponse(id: string, cid: string, rid: string): Promise<Article> {
    return firstValueFrom(this.http.delete<Article>(`${this.url}/${id}/commentaires/${cid}/reponses/${rid}`));
  }
}
