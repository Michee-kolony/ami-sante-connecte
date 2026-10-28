import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { messageErreur } from '../../data/session.service';
import { PatientesService, type ResumePatiente } from '../../data/patientes.service';
import {
  RelanceService, couleurPriorite, couleurStatut,
  type AlerteRelance, type FiltresTaches, type Indicateur, type Performance, type Reco, type ReferentielRelance, type TableauDeBordRelance, type TacheDetail, type TacheResume,
} from '../../data/relance.service';
import { RelanceRecosComponent } from './relance-recos.component';
import { RelanceParametrageComponent } from './relance-parametrage.component';

type Onglet = 'tableau' | 'taches' | 'alertes' | 'recos' | 'parametrage';
type Formulaire = 'attribuer' | 'confirmer' | 'cloturer' | 'rouvrir' | 'escalader' | 'controler' | 'identifier' | null;

/**
 * Relance communautaire du RECO (espace administrateur) : tableau de bord et indicateurs,
 * tâches (supervision, confirmation des prestations), alertes, comptes RECO, paramétrage.
 * Les droits sont appliqués par le serveur ; l'interface n'affiche que les actions permises.
 */
@Component({
  selector: 'app-relance',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, RelanceRecosComponent, RelanceParametrageComponent],
  templateUrl: './relance.component.html',
})
export class RelanceComponent implements OnInit {
  private service = inject(RelanceService);
  private patientes = inject(PatientesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly couleurStatut = couleurStatut;
  readonly couleurPriorite = couleurPriorite;

  onglet = signal<Onglet>('tableau');
  referentiel = signal<ReferentielRelance | null>(null);
  erreur = signal('');
  notification = signal('');

  // Tableau de bord
  tableau = signal<TableauDeBordRelance | null>(null);
  periode = { du: '', au: '', parcours: '', domaine: '' };
  chargementTableau = signal(false);

  // Tâches
  taches = signal<TacheResume[]>([]);
  total = signal(0);
  nominatif = signal(true);
  filtres: FiltresTaches = { statut: 'ouvertes' };
  chargementTaches = signal(false);
  detail = signal<TacheDetail | null>(null);
  formulaire = signal<Formulaire>(null);
  envoi = signal(false);
  saisie = { recoId: '', motif: '', echeance: '', type: '', reference: '', statut: 'Clôturée sans réintégration', resultat: '', doublonDe: '', vers: 'Professionnel habilité', conforme: true, observation: '', decision: '' };
  recos = signal<Reco[]>([]);
  recherchePatiente = '';
  resultatsPatientes = signal<ResumePatiente[]>([]);

  // Alertes
  alertes = signal<AlerteRelance[]>([]);
  alertesOuvertes = computed(() => this.alertes().filter(a => a.ouverte).length);

  readonly droits = computed(() => this.referentiel()?.droits ?? { supervision: false, parametrage: false, responsable: false });

  async ngOnInit(): Promise<void> {
    const o = this.route.snapshot.queryParamMap.get('onglet') as Onglet | null;
    try {
      this.referentiel.set(await this.service.referentiel());
    } catch (err) {
      this.erreur.set(messageErreur(err));
      return;
    }
    // Prestataires : pas de tableau de bord (données agrégées réservées à la supervision).
    this.ouvrir(o ?? (this.droits().supervision ? 'tableau' : 'taches'));
    this.chargerAlertes();
    const numero = this.route.snapshot.queryParamMap.get('tache');
    if (numero) this.voir(numero);
  }

  ouvrir(o: Onglet): void {
    this.onglet.set(o);
    this.router.navigate([], { queryParams: { onglet: o }, queryParamsHandling: 'merge', replaceUrl: true });
    if (o === 'tableau' && !this.tableau()) this.chargerTableau();
    if (o === 'taches' && !this.taches().length) this.chargerTaches();
    if (o === 'alertes') this.chargerAlertes();
  }

  private async executer<T>(action: () => Promise<T>, ok?: (r: T) => string | void): Promise<T | undefined> {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const r = await action();
      const message = ok?.(r);
      if (message) this.notification.set(message);
      return r;
    } catch (err) {
      this.erreur.set(messageErreur(err));
      return undefined;
    } finally {
      this.envoi.set(false);
    }
  }

  // --- Tableau de bord ---

  async chargerTableau(): Promise<void> {
    this.chargementTableau.set(true);
    await this.executer(async () => this.tableau.set(await this.service.tableauDeBord(this.periode)));
    this.chargementTableau.set(false);
  }

  lancerDetection(): void {
    this.executer(() => this.service.lancerDetection(), b => {
      this.chargerTableau();
      this.chargerTaches();
      return `Détection terminée : ${b.creees} tâche(s) créée(s), ${b.reliees} motif(s) relié(s), ${b.confirmees} réintégration(s) confirmée(s) par le dossier de soins (${b.regles} règle(s) active(s)).`;
    });
  }

  indicateur(p: Performance, code: string): Indicateur | undefined {
    return p.indicateurs.find(i => i.code === code);
  }

  /** Largeur (en %) d'une barre de taux. */
  largeur(v: number | null): number {
    return v == null ? 0 : Math.max(2, Math.min(100, v));
  }

  // --- Tâches ---

  async chargerTaches(): Promise<void> {
    this.chargementTaches.set(true);
    await this.executer(async () => {
      const r = await this.service.taches(this.filtres);
      this.taches.set(r.taches);
      this.total.set(r.total);
      this.nominatif.set(r.nominatif);
    });
    this.chargementTaches.set(false);
  }

  async voir(numero: string): Promise<void> {
    this.formulaire.set(null);
    const t = await this.executer(() => this.service.tache(numero));
    if (t) this.detail.set(t);
  }

  fermerDetail(): void {
    this.detail.set(null);
    this.formulaire.set(null);
  }

  async preparer(f: Formulaire): Promise<void> {
    this.saisie = { ...this.saisie, motif: '', reference: '', observation: '', decision: '', resultat: '', doublonDe: '', echeance: '', recoId: '' };
    this.resultatsPatientes.set([]);
    this.recherchePatiente = '';
    this.formulaire.set(f);
    if (f === 'attribuer' && !this.recos().length) {
      const r = await this.executer(() => this.service.recos());
      if (r) this.recos.set(r.filter(x => x.statut === 'Actif'));
    }
  }

  /** Recos de la structure de la tâche. */
  recosDe(t: TacheDetail): Reco[] {
    return this.recos().filter(r => !t.etablissementId || r.etablissementId === t.etablissementId);
  }

  private async apresAction(p: Promise<TacheDetail>, message: string): Promise<void> {
    const t = await this.executer(() => p, () => message);
    if (!t) return;
    this.detail.set(t);
    this.formulaire.set(null);
    this.taches.update(l => l.map(x => (x.numero === t.numero ? { ...x, ...t } : x)));
  }

  envoyer(): void {
    const t = this.detail();
    if (!t) return;
    const s = this.saisie;
    switch (this.formulaire()) {
      case 'attribuer': this.apresAction(this.service.attribuer(t.numero, s.recoId, s.motif, s.echeance), 'Tâche attribuée : le RECO est alerté.'); break;
      case 'confirmer': this.apresAction(this.service.confirmer(t.numero, s.type, s.reference), 'Prestation confirmée : réintégration comptée.'); break;
      case 'cloturer': this.apresAction(this.service.cloturer(t.numero, { statut: s.statut, resultat: s.resultat, motif: s.motif, doublonDe: s.doublonDe }), 'Tâche clôturée.'); break;
      case 'rouvrir': this.apresAction(this.service.rouvrir(t.numero, s.motif), 'Tâche rouverte.'); break;
      case 'escalader': this.apresAction(this.service.escalader(t.numero, s.motif, s.vers), 'Tâche escaladée.'); break;
      case 'controler': this.apresAction(this.service.controler(t.numero, s.conforme, s.observation), 'Contrôle enregistré.'); break;
    }
  }

  resoudre(conflitId: string): void {
    const t = this.detail();
    if (t) this.apresAction(this.service.resoudreConflit(t.numero, conflitId, this.saisie.decision), 'Conflit arbitré.');
  }

  async chercherPatiente(): Promise<void> {
    const q = this.recherchePatiente.trim();
    if (q.length < 2) return;
    const r = await this.executer(() => this.patientes.rechercher(q, '', 1, 8));
    if (r) this.resultatsPatientes.set(r.resultats);
  }

  identifier(patienteId: string): void {
    const t = this.detail();
    if (t) this.apresAction(this.service.identifier(t.numero, { patienteId }), 'Signalement rattaché au dossier.');
  }

  estOuverte(t: TacheResume): boolean {
    return !(this.referentiel()?.statutsFinaux ?? []).includes(t.statut);
  }

  libelleAction(type: string): string {
    return ({
      accepter: 'Prise en charge', tentative: 'Tentative de contact', visite_planifiee: 'Visite planifiée', visite_realisee: 'Visite réalisée',
      orientation: 'Orientation', refus_report: 'Refus / report', demande_appui: 'Demande d’appui', urgence: 'Urgence signalée',
    } as Record<string, string>)[type] ?? type;
  }

  // --- Alertes ---

  async chargerAlertes(): Promise<void> {
    const r = await this.service.alertes().catch(() => null);
    if (r) this.alertes.set(r);
  }

  accuser(a: AlerteRelance): void {
    this.executer(() => this.service.accuserAlerte(a.id), r => {
      this.alertes.update(l => l.map(x => (x.id === r.id ? r : x)));
    });
  }

  ouvrirTache(numero: string): void {
    this.ouvrir('taches');
    this.voir(numero);
  }
}
