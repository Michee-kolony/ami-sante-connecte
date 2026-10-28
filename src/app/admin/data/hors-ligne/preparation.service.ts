import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../../shared/api';
import { AccouchementsService } from '../accouchements.service';
import { EnfantsService } from '../enfants.service';
import { PageRecherche, PatientesService, ResumePatiente } from '../patientes.service';
import { SessionService } from '../session.service';
import { HorsLigneService } from './hors-ligne.service';
import { CLE_INDEX_PATIENTES } from './hors-ligne.interceptor';
import { applicationEnCache, ecrire, lire } from './stockage';
const CLE_PREPARATION = 'meta:preparation';
/** Nouvelle préparation automatique au plus toutes les 30 minutes. */
const INTERVALLE_MS = 30 * 60_000;
const MAX_DOSSIERS = 400;
const SIMULTANES = 3;
const EN_TETE = new HttpHeaders({ 'X-Preparation-Hors-Ligne': 'oui' });

export interface BilanPreparation {
  le: string;
  patientes: number;
  accouchements: number;
  enfants: number;
  echecs: number;
}

/**
 * Prépare le travail hors connexion : tant que le réseau est là, les dossiers actifs (patientes en
 * suivi prénatal ou postnatal, accouchements en cours, enfants) sont téléchargés sur l'appareil.
 * Ils s'ouvrent ensuite sans réseau, même s'ils n'ont jamais été consultés sur cet appareil.
 * Chaque copie est tracée dans le journal d'audit (« copie hors connexion »).
 */
@Injectable({ providedIn: 'root' })
export class PreparationHorsLigneService {
  private http = inject(HttpClient);
  private session = inject(SessionService);
  private horsLigne = inject(HorsLigneService);
  private patientes = inject(PatientesService);
  private accouchements = inject(AccouchementsService);
  private enfants = inject(EnfantsService);

  readonly enCours = signal(false);
  readonly progression = signal({ fait: 0, total: 0 });
  readonly bilan = signal<BilanPreparation | null>(null);
  readonly erreur = signal<string | null>(null);
  /** Application entièrement en cache (ouverture sans réseau possible). */
  readonly applicationPrete = signal(false);
  /** Appareil prêt pour le hors connexion : application en cache et dossiers copiés. */
  readonly appareilPret = computed(() => this.applicationPrete() && !!this.bilan());
  /** Date de la dernière copie lue (pas de nouvelle copie avant). */
  private pret = false;

  constructor() {
    effect(() => {
      const s = this.session.soignant();
      untracked(() => {
        this.pret = false;
        if (s) this.chargerBilan().then(() => (this.pret = true) && this.preparerSiNecessaire());
        else this.bilan.set(null);
      });
    });
    effect(() => {
      if (this.horsLigne.enLigne()) untracked(() => this.preparerSiNecessaire());
    });
    // Après l'envoi des saisies : télécharger les mises à jour du serveur (numéros définitifs, alertes recalculées).
    effect(() => {
      if (this.horsLigne.fileVidee() > 0) untracked(() => this.pret && this.preparer());
    });
    setInterval(() => this.preparerSiNecessaire(), INTERVALLE_MS);
    this.surveillerCache();
  }

  /** Vérifie la copie de l'application dans le cache jusqu'à ce qu'elle soit complète (première visite). */
  private async surveillerCache(): Promise<void> {
    if (await applicationEnCache()) {
      this.applicationPrete.set(true);
      return;
    }
    setTimeout(() => this.surveillerCache(), 3000);
  }

  private async chargerBilan(): Promise<void> {
    const b = await lire<{ corps: BilanPreparation }>('lectures', CLE_PREPARATION).catch(() => undefined);
    this.bilan.set(b?.corps ?? null);
  }

  private preparerSiNecessaire(): void {
    if (!this.pret) return;
    const b = this.bilan();
    if (!b || Date.now() - new Date(b.le).getTime() > INTERVALLE_MS) this.preparer();
  }

  /** Télécharge sur l'appareil les listes, référentiels et dossiers actifs. */
  async preparer(): Promise<void> {
    if (this.enCours() || !this.session.soignant() || !navigator.onLine || !this.horsLigne.enLigne()) return;
    this.enCours.set(true);
    this.erreur.set(null);
    this.progression.set({ fait: 0, total: 0 });
    let echecs = 0;
    const essayer = <T>(p: Promise<T>) => p.catch(() => {
      echecs++;
      return null;
    });
    try {
      const maternite = this.session.estMaternite();
      const infirmier = this.session.estInfirmier();

      // Pages de liste telles qu'elles s'ouvrent, et référentiels des formulaires.
      await Promise.all([
        essayer(this.patientes.rechercher('', 'Tous', 1)),
        // Établissements : liste du formulaire d'enregistrement CPN, utilisable sans réseau.
        essayer(this.lire('etablissements')),
        ...['cpn', 'provinces', 'vaccination', ...(maternite ? ['accouchement'] : [])].map(r => essayer(this.lire(`referentiels/${r}`))),
      ]);

      // Patientes suivies : liste complète (recherche sans réseau) puis dossiers.
      const suivies: ResumePatiente[] = [];
      for (const statut of ['Suivi prénatal', 'Suivi postnatal']) {
        for (let page = 1; suivies.length < MAX_DOSSIERS; page++) {
          const r = await this.lire<PageRecherche>('patientes', { statut, page: String(page), parPage: '50' });
          suivies.push(...r.resultats);
          if (page * r.parPage >= r.total) break;
        }
      }
      await ecrire('lectures', { corps: suivies, le: new Date().toISOString() }, CLE_INDEX_PATIENTES);

      const accouchements = maternite ? (await essayer(this.accouchements.lister())) ?? [] : [];
      const enfants = (await essayer(this.enfants.rechercher())) ?? [];

      const taches: (() => Promise<unknown>)[] = [
        ...accouchements.map(a => () => this.lire(`accouchements/${encodeURIComponent(a.numero)}`)),
        ...suivies.slice(0, MAX_DOSSIERS).map(p => () => this.lire(`patientes/${encodeURIComponent(p.numero)}${infirmier ? '/suivi' : ''}`)),
        ...enfants.map(e => () => this.lire(`enfants/${encodeURIComponent(e.numero)}`)),
      ];
      this.progression.set({ fait: 0, total: taches.length });
      let suivante = 0;
      await Promise.all(Array.from({ length: SIMULTANES }, async () => {
        while (suivante < taches.length && this.horsLigne.enLigne()) {
          const tache = taches[suivante++];
          await essayer(tache());
          this.progression.update(p => ({ ...p, fait: p.fait + 1 }));
        }
      }));
      if (!this.horsLigne.enLigne()) throw new Error('Réseau perdu pendant la préparation : elle reprendra au retour de la connexion.');

      const bilan: BilanPreparation = {
        le: new Date().toISOString(),
        patientes: Math.min(suivies.length, MAX_DOSSIERS),
        accouchements: accouchements.length,
        enfants: enfants.length,
        echecs,
      };
      await ecrire('lectures', { corps: bilan, le: bilan.le }, CLE_PREPARATION);
      this.bilan.set(bilan);
    } catch (err) {
      this.erreur.set(err instanceof Error ? err.message : 'Préparation interrompue.');
    } finally {
      this.enCours.set(false);
    }
  }

  /** Lecture marquée « préparation » : la réponse est gardée sur l'appareil par l'intercepteur. */
  private lire<T>(chemin: string, params: Record<string, string> = {}): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${API_URL}/${chemin}`, { params, headers: EN_TETE }));
  }
}
