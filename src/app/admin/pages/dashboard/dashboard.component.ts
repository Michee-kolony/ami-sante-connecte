import { Component, computed, inject, signal } from '@angular/core';
import { EtablissementsService } from '../../data/etablissements.service';
import { SessionService } from '../../data/session.service';
import { SoignantsService, categorieDuRole } from '../../data/soignants.service';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { CarteRdcComponent } from '../../components/carte-rdc.component';
import { EnLigneComponent } from '../../components/en-ligne.component';
import { RepartitionSexeComponent } from '../../components/repartition-sexe.component';
import { formatDate, UTILISATEUR } from '../../data/mock-data';
import { agLisible, heureFr, jourLocal } from '../../data/format';
import { StatistiquesPatientes, StatistiquesService } from '../../data/statistiques.service';
import { ageLisible, couverture, dosesDuMois, ENFANTS, prochaineDose, statutVaccinal } from '../../data/vaccination';

const MOIS_COURTS = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, AvatarComponent, CarteRdcComponent, EnLigneComponent, RepartitionSexeComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  // --- Chiffres du système (soignants et établissements enregistrés sur le serveur) ---
  session = inject(SessionService);
  soignantsService = inject(SoignantsService);
  private etablissementsService = inject(EtablissementsService);
  private statistiquesService = inject(StatistiquesService);
  private systemeRecu = signal(false);
  systemeErreur = signal(false);
  /** Squelette tant que rien n'est reçu (une liste déjà chargée ailleurs s'affiche aussitôt). */
  systemeEnChargement = computed(() => !this.systemeRecu() && !this.soignantsService.soignants().length);

  tuilesSysteme = computed(() => {
    const soignants = this.soignantsService.soignants();
    const etablissements = this.etablissementsService.etablissements();
    const medecins = soignants.filter(s => categorieDuRole(s.role) === 'Médecin').length;
    const infirmiers = soignants.filter(s => categorieDuRole(s.role) === 'Infirmier').length;
    const sagesFemmes = soignants.filter(s => categorieDuRole(s.role) === 'Sage-femme').length;
    const actifs = etablissements.filter(e => e.statut === 'Actif').length;
    const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    return [
      {
        label: 'Soignants ajoutés', valeur: soignants.length, lien: '/admin/soignants', icone: 'fa-users',
        detail: `${pluriel(medecins, 'médecin')} · ${pluriel(infirmiers, 'infirmier')} · ${sagesFemmes} sage${sagesFemmes > 1 ? 's' : ''}-femme${sagesFemmes > 1 ? 's' : ''}`,
        couleur: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
      },
      {
        label: 'Médecins', valeur: medecins, lien: '/admin/soignants', icone: 'fa-user-doctor',
        detail: `${soignants.filter(s => categorieDuRole(s.role) === 'Médecin' && s.statut === 'Actif').length} avec un accès actif`,
        couleur: 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400',
      },
      {
        label: 'Établissements sanitaires', valeur: etablissements.length, lien: '/admin/etablissements', icone: 'fa-hospital',
        detail: `${pluriel(actifs, 'actif')} · ${pluriel(etablissements.length - actifs, 'suspendu')}`,
        couleur: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
      },
    ];
  });

  // --- Suivi prénatal : indicateurs calculés par le serveur ---------------------------
  stats = signal<StatistiquesPatientes | null>(null);
  statsChargement = signal(false);
  statsErreur = signal(false);

  constructor() {
    if (this.session.connecte()) {
      Promise.all([this.soignantsService.charger(), this.etablissementsService.charger(true)])
        .then(() => this.systemeRecu.set(true))
        .catch(() => this.systemeErreur.set(true));
      this.chargerStatistiques();
    }
  }

  chargerStatistiques(): void {
    this.statsChargement.set(true);
    this.statsErreur.set(false);
    this.statistiquesService.patientes()
      .then(s => this.stats.set(s))
      .catch(() => this.statsErreur.set(true))
      .finally(() => this.statsChargement.set(false));
  }

  /** Squelettes au premier chargement seulement. */
  statsAttente = computed(() => this.session.connecte() && !this.stats() && !this.statsErreur());

  /** « Mardi 21 octobre 2026 », à l'heure de Kinshasa. */
  readonly dateDuJour = (() => {
    const t = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kinshasa' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  /** Prénom et nom du soignant connecté (maquette sinon). */
  get nomUtilisateur(): string {
    const s = this.session.soignant();
    if (!s) return UTILISATEUR.nom;
    return `${categorieDuRole(s.role) === 'Médecin' ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  }

  get structure(): string {
    return this.session.etablissement()?.nom ?? 'votre structure';
  }

  kpis = computed(() => {
    const t = this.stats()?.totaux;
    const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    const ecart = t ? t.nouvellesCeMois - t.nouvellesMoisPrecedent : 0;
    return [
      {
        label: 'Patientes suivies', valeur: t?.patientes ?? 0, lien: '/admin/patientes',
        sous: t ? `${pluriel(t.nouvellesCeMois, 'nouvelle')} ce mois` : '',
        tendance: t ? `${ecart >= 0 ? '+' : '−'}${Math.abs(ecart)} vs mois dernier` : null, hausse: ecart >= 0,
        icone: 'fa-person-pregnant', couleur: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
      },
      {
        label: 'Grossesses en cours', valeur: t?.grossessesEnCours ?? 0, lien: '/admin/patientes',
        sous: t?.grossessesARisque != null ? `dont ${t.grossessesARisque} avec facteur(s) de risque` : 'suivies dans la plateforme',
        tendance: null, hausse: true,
        icone: 'fa-baby-carriage', couleur: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400',
      },
      {
        label: 'Rendez-vous aujourd’hui', valeur: t?.rdvAujourdhui ?? 0, lien: '/admin/rendez-vous',
        sous: t ? `${t.rdv7Jours} rendez-vous dans les 7 jours` : '',
        tendance: null, hausse: true,
        icone: 'fa-calendar-check', couleur: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400',
      },
      {
        label: 'Absences (30 jours)', valeur: t?.absences30Jours ?? 0, lien: '/admin/rendez-vous',
        sous: 'rendez-vous manqués à reprogrammer',
        tendance: null, hausse: false,
        icone: 'fa-calendar-xmark', couleur: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
      },
    ];
  });

  semaines = computed(() => this.stats()?.semaines ?? []);
  maxSemaine = computed(() => Math.max(1, ...this.semaines().map(w => w.inscriptions)));

  /** Répartition des grossesses en cours par trimestre (part des grossesses datées). */
  trimestres = computed(() => {
    const t = this.stats()?.trimestres;
    const datees = t ? t.t1 + t.t2 + t.t3 : 0;
    const pct = (n: number) => (datees ? Math.round((n / datees) * 100) : 0);
    return [
      { label: '1er trimestre', sous: '< 14 SA', n: t?.t1 ?? 0, pct: pct(t?.t1 ?? 0), couleur: 'bg-brand-300 dark:bg-brand-400' },
      { label: '2e trimestre', sous: '14–27 SA', n: t?.t2 ?? 0, pct: pct(t?.t2 ?? 0), couleur: 'bg-brand-700 dark:bg-brand-600' },
      { label: '3e trimestre', sous: '≥ 28 SA', n: t?.t3 ?? 0, pct: pct(t?.t3 ?? 0), couleur: 'bg-accent-600' },
    ];
  });

  ag = agLisible;
  heure = heureFr;
  jourRdv = (iso: string) => jourLocal(iso).slice(8);
  moisRdv = (iso: string) => MOIS_COURTS[+jourLocal(iso).slice(5, 7)];

  // --- Vaccination des enfants (données de démonstration, module à venir côté serveur) ----
  fmt = formatDate;
  ageEnfant = ageLisible;
  prochaine = prochaineDose;
  vacc = {
    enfants: ENFANTS.length,
    complets: ENFANTS.filter(e => statutVaccinal(e) === 'Complet').length,
    retard: ENFANTS.filter(e => statutVaccinal(e) === 'En retard').length,
    dosesMois: dosesDuMois(ENFANTS),
  };
  couvertures = [
    { code: 'BCG', nom: 'BCG', age: 'Naissance' },
    { code: 'PENTA1', nom: 'Penta 1', age: '6 sem.' },
    { code: 'PENTA3', nom: 'Penta 3', age: '14 sem.' },
    { code: 'VPI', nom: 'VPI', age: '14 sem.' },
    { code: 'VAR', nom: 'Rougeole (VAR)', age: '9 mois' },
    { code: 'VAA', nom: 'Fièvre jaune (VAA)', age: '9 mois' },
  ].map(c => ({ ...c, ...couverture(ENFANTS, c.code) }));
  enfantsEnRetard = ENFANTS.filter(e => statutVaccinal(e) === 'En retard');

  telLien(tel: string): string {
    return 'tel:' + tel.replace(/\s/g, '');
  }

  statutClass(s: string): string {
    return {
      'Suivi prénatal': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
      'Suivi postnatal': 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
      'Grossesse terminée': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      'Archivé': 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    }[s] ?? '';
  }

  rdvClass(s: string): string {
    return {
      'Planifié': 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
      'Confirmé': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300',
      'Reporté': 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    }[s] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  }
}
