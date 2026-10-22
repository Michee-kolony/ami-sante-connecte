import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { dateHeureFr } from '../../data/format';
import {
  Article, ArticlesService, CIBLES_ARTICLE, CibleArticle, PHOTOS_MAX, PHOTO_TAILLE_MAX, VIDEO_TAILLE_MAX,
} from '../../data/articles.service';
import { SessionService, messageErreur } from '../../data/session.service';

interface Apercu {
  fichier: File;
  url: string;
  video: boolean;
}

/**
 * Conseils publiés par les médecins pour les femmes en CPN ou ayant accouché.
 * Tous les médecins voient toutes les publications, aiment et commentent ; l'auteur répond aux
 * commentaires ; chacun supprime ce qu'il a publié, le médecin chef peut tout supprimer.
 */
@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './articles.component.html',
})
export class ArticlesComponent implements OnDestroy {
  private service = inject(ArticlesService);
  session = inject(SessionService);
  dateHeure = dateHeureFr;
  readonly cibles = CIBLES_ARTICLE;
  readonly filtres: (CibleArticle | '')[] = ['', ...CIBLES_ARTICLE];
  readonly photosMax = PHOTOS_MAX;

  articles: Article[] = [];
  total = 0;
  page = 1;
  filtre: CibleArticle | '' = '';
  chargement = true;
  chargementSuite = false;
  erreur = '';
  notification = '';

  // --- Nouvelle publication ---------------------------------------------------------
  form = { titre: '', contenu: '', cible: 'Grossesse (CPN)' as CibleArticle };
  apercus: Apercu[] = [];
  erreurMedia = '';
  envoi = false;
  erreurEnvoi = '';

  /** Saisie des commentaires et réponses, par article / commentaire. */
  commentaires: Record<string, string> = {};
  reponses: Record<string, string> = {};
  reponseOuverte: string | null = null;
  commentairesOuverts = new Set<string>();
  /** Article ou commentaire en attente de confirmation de suppression. */
  confirmation: { type: 'article' | 'commentaire' | 'reponse'; article: Article; cid?: string; rid?: string } | null = null;
  photoAgrandie: string | null = null;

  constructor() {
    this.charger();
  }

  ngOnDestroy(): void {
    this.apercus.forEach(a => URL.revokeObjectURL(a.url));
  }

  async charger(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      const r = await this.service.lister(1, this.filtre);
      this.articles = r.articles;
      this.total = r.total;
      this.page = 1;
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  async chargerSuite(): Promise<void> {
    this.chargementSuite = true;
    try {
      const r = await this.service.lister(this.page + 1, this.filtre);
      this.articles = [...this.articles, ...r.articles.filter(a => !this.articles.some(x => x.id === a.id))];
      this.total = r.total;
      this.page = r.page;
    } catch (err) {
      this.notification = messageErreur(err);
    } finally {
      this.chargementSuite = false;
    }
  }

  filtrer(c: CibleArticle | ''): void {
    this.filtre = c;
    this.charger();
  }

  // --- Médias -----------------------------------------------------------------------
  get aVideo(): boolean {
    return this.apercus.some(a => a.video);
  }

  /** 4 photos au maximum, ou une seule vidéo (règle vérifiée aussi par le serveur). */
  choisirMedias(e: Event): void {
    const input = e.target as HTMLInputElement;
    const fichiers = Array.from(input.files ?? []);
    input.value = '';
    this.erreurMedia = '';
    for (const f of fichiers) {
      const video = f.type.startsWith('video/');
      if (!video && !/^image\/(jpeg|png|webp)$/.test(f.type)) { this.erreurMedia = 'Formats acceptés : photos JPG, PNG ou WebP, vidéo MP4, WebM ou MOV.'; continue; }
      if (video && !/^video\/(mp4|webm|quicktime)$/.test(f.type)) { this.erreurMedia = 'Vidéo acceptée : MP4, WebM ou MOV.'; continue; }
      if (video && f.size > VIDEO_TAILLE_MAX) { this.erreurMedia = 'La vidéo doit faire 50 Mo au maximum.'; continue; }
      if (!video && f.size > PHOTO_TAILLE_MAX) { this.erreurMedia = 'Chaque photo doit faire 5 Mo au maximum.'; continue; }
      if (video && this.apercus.length) { this.erreurMedia = 'Une vidéo se publie seule : retirez d’abord les photos.'; continue; }
      if (!video && this.aVideo) { this.erreurMedia = 'Une vidéo se publie seule : retirez-la pour ajouter des photos.'; continue; }
      if (!video && this.apercus.length >= PHOTOS_MAX) { this.erreurMedia = `${PHOTOS_MAX} photos au maximum.`; continue; }
      this.apercus = [...this.apercus, { fichier: f, url: URL.createObjectURL(f), video }];
    }
  }

  retirerMedia(a: Apercu): void {
    URL.revokeObjectURL(a.url);
    this.apercus = this.apercus.filter(x => x !== a);
    this.erreurMedia = '';
  }

  get peutPublier(): boolean {
    return !!this.form.titre.trim() && !!this.form.contenu.trim() && !this.envoi;
  }

  async publier(): Promise<void> {
    if (!this.peutPublier) return;
    this.envoi = true;
    this.erreurEnvoi = '';
    try {
      const a = await this.service.publier(this.form, this.apercus.map(x => x.fichier));
      this.apercus.forEach(x => URL.revokeObjectURL(x.url));
      this.apercus = [];
      this.form = { titre: '', contenu: '', cible: this.form.cible };
      if (!this.filtre || this.filtre === a.cible) {
        this.articles = [a, ...this.articles];
        this.total++;
      }
      this.notification = 'Article publié. Il est visible par tous les médecins.';
    } catch (err) {
      this.erreurEnvoi = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }

  // --- Interactions -----------------------------------------------------------------
  private remplacer(a: Article): void {
    this.articles = this.articles.map(x => (x.id === a.id ? a : x));
  }

  private async agir(action: () => Promise<Article | void>, apres?: () => void): Promise<void> {
    try {
      const a = await action();
      if (a) this.remplacer(a);
      apres?.();
    } catch (err) {
      this.notification = messageErreur(err);
    }
  }

  aimer(a: Article): void {
    this.agir(() => this.service.aimer(a.id));
  }

  basculerCommentaires(a: Article): void {
    if (this.commentairesOuverts.has(a.id)) this.commentairesOuverts.delete(a.id);
    else this.commentairesOuverts.add(a.id);
  }

  commenter(a: Article): void {
    const t = (this.commentaires[a.id] ?? '').trim();
    if (!t) return;
    this.agir(() => this.service.commenter(a.id, t), () => {
      this.commentaires[a.id] = '';
      this.commentairesOuverts.add(a.id);
    });
  }

  repondre(a: Article, cid: string): void {
    const t = (this.reponses[cid] ?? '').trim();
    if (!t) return;
    this.agir(() => this.service.repondre(a.id, cid, t), () => {
      this.reponses[cid] = '';
      this.reponseOuverte = null;
    });
  }

  async confirmerSuppression(): Promise<void> {
    const c = this.confirmation;
    if (!c) return;
    this.confirmation = null;
    if (c.type === 'article') {
      await this.agir(() => this.service.supprimer(c.article.id), () => {
        this.articles = this.articles.filter(x => x.id !== c.article.id);
        this.total--;
        this.notification = 'Article supprimé.';
      });
    } else if (c.type === 'commentaire') {
      await this.agir(() => this.service.supprimerCommentaire(c.article.id, c.cid!));
    } else {
      await this.agir(() => this.service.supprimerReponse(c.article.id, c.cid!, c.rid!));
    }
  }

  /** Suppression d'une publication d'un autre médecin : seulement possible pour le médecin chef. */
  estAutre(id: string): boolean {
    return id !== this.session.soignant()?.id;
  }

  initiales(nom: string): string {
    return nom.split(/\s+/).filter(Boolean).slice(0, 2).map(m => m.charAt(0)).join('').toUpperCase();
  }

  dr(nom: string, role: string): string {
    return role.startsWith('Médecin') ? `Dr ${nom}` : nom;
  }

  nbCommentaires(a: Article): number {
    return a.commentaires.reduce((n, c) => n + 1 + c.reponses.length, 0);
  }
}
