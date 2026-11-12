import { Component, Input } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import {
  ACCESSIBILITE, CATEGORIES, CHAMPS_CHEF, COEFFICIENTS_DEFAUT, CONTRATS, EQUIPEMENTS_COURANTS, ETATS_EQUIPEMENT, FicheAmi, MODES_GESTION,
  NIVEAUX_SANITAIRES, PROFESSIONS, REGIMES, SOURCES_POPULATION, STATUTS_ACTUELS, STATUTS_AGENT, STATUTS_JURIDIQUES, MODULES_AMI,
  agentVide, equipementVide, populationVide,
} from '../data/fiche-etablissement';

/**
 * Champs propres à la fiche AMI pour les étapes 1 à 9 (les champs portés par l'établissement —
 * nom, type, province, zones, aire, adresse, téléphone, GPS — restent dans le formulaire parent).
 * Toutes les étapes sont rendues (masquées sauf l'étape courante) pour que la validation du
 * formulaire parent les couvre. Pour le médecin chef, seuls les champs facultatifs sont modifiables.
 */
@Component({
  selector: 'app-fiche-etapes',
  standalone: true,
  imports: [FormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  templateUrl: './fiche-etapes.component.html',
})
export class FicheEtapesComponent {
  @Input({ required: true }) fiche!: FicheAmi;
  /** Étape affichée (1 à 9). */
  @Input() etape = 1;
  @Input() role: 'comite' | 'chef' = 'comite';
  @Input() soumis = false;
  /** Rattachement déduit (affiché à l'étape 2). */
  @Input() bczs = '';
  @Input() dps = '';

  readonly niveaux = NIVEAUX_SANITAIRES;
  readonly categories = CATEGORIES;
  readonly statutsActuels = STATUTS_ACTUELS;
  readonly statutsJuridiques = STATUTS_JURIDIQUES;
  readonly modesGestion = MODES_GESTION;
  readonly accessibilite = ACCESSIBILITE;
  readonly etats = ETATS_EQUIPEMENT;
  readonly professions = PROFESSIONS;
  readonly contrats = CONTRATS;
  readonly statutsAgent = STATUTS_AGENT;
  readonly regimes = REGIMES;
  readonly sources = SOURCES_POPULATION;
  readonly equipementsCourants = EQUIPEMENTS_COURANTS;
  readonly modules = MODULES_AMI as readonly string[];
  readonly ouiNon = ['Oui', 'Non'];
  readonly responsablesSecondaires = [
    { cle: 'responsableMedical', libelle: 'Responsable médical' },
    { cle: 'responsableInfirmier', libelle: 'Responsable infirmier' },
    { cle: 'responsableAdministratif', libelle: 'Responsable administratif' },
    { cle: 'responsableMaternite', libelle: 'Responsable maternité / CPN / Vaccination' },
  ] as const;
  readonly salles = [
    { cle: 'consultation', libelle: 'Consultation' }, { cle: 'cpn', libelle: 'CPN' }, { cle: 'accouchement', libelle: 'Accouchement' },
    { cle: 'vaccination', libelle: 'Vaccination' }, { cle: 'observation', libelle: 'Observation' },
  ] as const;
  readonly ouvrages = [
    { cle: 'blocOperatoire', libelle: 'Bloc opératoire' }, { cle: 'laboratoire', libelle: 'Laboratoire' }, { cle: 'pharmacie', libelle: 'Pharmacie' },
    { cle: 'morgue', libelle: 'Morgue' }, { cle: 'salleAttente', libelle: 'Salle d’attente' }, { cle: 'pointEau', libelle: 'Point d’eau' },
    { cle: 'electricite', libelle: 'Électricité' }, { cle: 'groupeElectrogene', libelle: 'Groupe électrogène' }, { cle: 'chaineFroid', libelle: 'Chaîne du froid' },
  ] as const;
  readonly disponibilites = [
    { cle: 'vaccins', libelle: 'Vaccins' }, { cle: 'medicaments', libelle: 'Médicaments essentiels' }, { cle: 'personnelQualifie', libelle: 'Personnel qualifié' },
    { cle: 'electricite', libelle: 'Électricité' }, { cle: 'eau', libelle: 'Eau' }, { cle: 'transportReference', libelle: 'Transport de référence' },
    { cle: 'communication', libelle: 'Moyens de communication' },
  ] as const;
  readonly tranches = [
    { cle: 'moins1', libelle: 'Moins de 1 an' }, { cle: 'moins5', libelle: 'Moins de 5 ans' }, { cle: 'de5a14', libelle: '5 à 14 ans' },
    { cle: 'de15a49', libelle: '15 à 49 ans' }, { cle: 'plus50', libelle: '50 ans et plus' },
  ] as const;

  get comite(): boolean {
    return this.role === 'comite';
  }

  /** Le champ (ou la section entière) est-il modifiable pour ce rôle ? */
  peut(section: string, champ?: string): boolean {
    if (this.comite) return true;
    const droit = CHAMPS_CHEF[section];
    return droit === true || (!!droit && !!champ && droit.includes(champ));
  }

  /** Erreur affichée sur un champ obligatoire du comité laissé vide. */
  manque(valeur: unknown): boolean {
    return this.comite && this.soumis && (valeur == null || valeur === '');
  }

  // --- Étape 4 ----------------------------------------------------------------------
  ajouterEquipement(nom = ''): void {
    this.fiche.equipements.push(equipementVide(nom));
  }
  taux(n: number | null, total: number | null): string {
    return total ? `${Math.round(((n ?? 0) / total) * 1000) / 10} %` : '—';
  }
  incoherent(q: FicheAmi['equipements'][number]): boolean {
    return (q.fonctionnels ?? 0) + (q.enPanne ?? 0) + (q.horsService ?? 0) > (q.total ?? 0);
  }
  get tauxGlobal(): string {
    const total = this.fiche.equipements.reduce((s, q) => s + (q.total ?? 0), 0);
    return this.taux(this.fiche.equipements.reduce((s, q) => s + (q.fonctionnels ?? 0), 0), total);
  }

  // --- Étape 5 ----------------------------------------------------------------------
  ajouterAgent(): void {
    this.fiche.agents.push(agentVide());
  }
  get agentsPresents() {
    return this.fiche.agents.filter(a => a.statut !== 'Sorti');
  }
  parCle(cle: 'profession' | 'service'): { cle: string; n: number }[] {
    const c = new Map<string, number>();
    for (const a of this.agentsPresents) c.set(a[cle] || 'Non renseigné', (c.get(a[cle] || 'Non renseigné') ?? 0) + 1);
    return [...c].map(([k, n]) => ({ cle: k, n })).sort((a, b) => b.n - a.n);
  }
  get indisponibles(): number {
    return this.agentsPresents.filter(a => a.disponibilite === 'Indisponible').length;
  }
  presents(profession: string): number {
    return this.agentsPresents.filter(a => a.profession === profession).length;
  }
  ajouterNorme(): void {
    this.fiche.effectifsAttendus.push({ profession: '', nombre: null });
  }

  // --- Étape 6 ----------------------------------------------------------------------
  get modulesPrevus(): string[] {
    return this.modules.filter(m => this.fiche.services.some(s => s.service === m && s.fonctionnel === 'Oui'));
  }
  get aucunServiceFonctionnel(): boolean {
    return !this.fiche.services.some(s => s.fonctionnel === 'Oui' || s.fonctionnel === 'Partiel');
  }

  // --- Étape 7 ----------------------------------------------------------------------
  ajouterAnnee(): void {
    const max = this.fiche.populations.reduce((m, p) => Math.max(m, p.annee), new Date().getFullYear() - 1);
    this.fiche.populations.push(populationVide(max + 1));
  }
  /** Années déjà enregistrées sur le serveur : conservées, jamais supprimées. */
  retirerAnnee(i: number): void {
    if (!this.fiche.populations[i].saisiLe) this.fiche.populations.splice(i, 1);
  }
  ecart(p: FicheAmi['populations'][number]): string[] {
    const a: string[] = [];
    if (p.totale != null && p.hommes != null && p.femmes != null && p.hommes + p.femmes !== p.totale) a.push(`Hommes + femmes = ${p.hommes + p.femmes} ≠ ${p.totale}`);
    if (p.totale != null && p.urbaine != null && p.rurale != null && p.urbaine + p.rurale !== p.totale) a.push(`Urbaine + rurale = ${p.urbaine + p.rurale} ≠ ${p.totale}`);
    return a;
  }
  anneeEnDouble(annee: number): boolean {
    return this.fiche.populations.filter(p => p.annee === annee).length > 1;
  }

  // --- Étape 8 (aperçu ; le calcul officiel est fait par le serveur) -----------------
  get populationBase(): { annee: number; totale: number } | null {
    const p = [...this.fiche.populations].filter(x => x.totale != null).sort((a, b) => b.annee - a.annee)[0];
    return p ? { annee: p.annee, totale: p.totale! } : null;
  }
  get cibles() {
    const base = this.populationBase?.totale ?? null;
    return COEFFICIENTS_DEFAUT.map(c => {
      const annuelle = base != null ? Math.round(base * c.pct / 100) : null;
      return { ...c, annuelle, mensuelle: annuelle != null ? Math.round(annuelle / 12) : null };
    });
  }

  // --- Étape 9 ----------------------------------------------------------------------
  get besoinAccouchements(): number | null {
    return this.cibles.find(c => c.cible === 'NA')?.mensuelle ?? null;
  }
  get deficitAccouchements(): number | null {
    const b = this.besoinAccouchements;
    const c = this.fiche.capacites.accouchementsMois;
    return b != null && c != null ? Math.max(0, b - c) : null;
  }
}
