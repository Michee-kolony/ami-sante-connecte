import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HorsLigneService } from '../data/hors-ligne/hors-ligne.service';
import { PROVINCES_RDC } from '../data/carte-rdc';
import { dateHeureChiffres, jourChiffres } from '../data/format';
import { Indicateur, LigneATraiter, PeriodeSynthese, SyntheseEtatService } from '../data/statistiques.service';
import { AnalyseMensuelleComponent } from './analyse-mensuelle.component';
import { ESPACE_COMITE, PERIMETRE_STATISTIQUES } from '../data/espace';

/** Classes par ton de carte (fond de l'icône). */
const TONS: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
};

/** Format d'affichage d'un indicateur (section 14) : une décimale, « N/A » si non calculable. */
export function valeurIndicateur(i: Indicateur): string {
  if (i.valeur == null) return 'N/A';
  if (i.unite === '%') return `${i.valeur.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  if (i.unite === 'heures') return `${i.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
  return i.valeur.toLocaleString('fr-FR');
}

/** Numérateur / dénominateur affiché sous un taux. */
export function fractionIndicateur(i: Indicateur): string {
  if (i.unite === '%') return i.denominateur ? `${i.numerateur} / ${i.denominateur}` : 'Dénominateur nul';
  if (i.unite === 'heures') return `${i.numerateur} tâche(s) mesurée(s)`;
  return '';
}

/**
 * Synthèse opérationnelle du tableau de bord (cahier de spécifications AMI, section 19) :
 * bandeau de filtres, six cartes prioritaires, tendance, comparaison par aire de santé,
 * entonnoir du continuum mère-enfant, flux de relance RECO et liste « À traiter maintenant ».
 */
@Component({
  selector: 'app-synthese-ami',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, AnalyseMensuelleComponent],
  templateUrl: './synthese-ami.component.html',
})
export class SyntheseAmiComponent {
  etat = inject(SyntheseEtatService);
  horsLigne = inject(HorsLigneService);
  /** Espace du comité de pilotage : pas de liens vers les pages du personnel ni de liste nominative. */
  readonly comite = inject(ESPACE_COMITE);

  readonly periodes: { code: PeriodeSynthese; libelle: string }[] = [
    { code: 'jour', libelle: 'Aujourd’hui' },
    { code: '7j', libelle: '7 jours' },
    { code: 'mois', libelle: 'Mois' },
    { code: 'trimestre', libelle: 'Trimestre' },
    { code: 'annee', libelle: 'Année' },
    { code: 'perso', libelle: 'Personnalisée' },
  ];
  readonly provinces = PROVINCES_RDC.map(p => p.nom).sort((a, b) => a.localeCompare(b, 'fr'));

  du = '';
  au = '';
  /** Filtre de la liste « À traiter » par type (vide : tous). */
  typeATraiter = signal('');

  s = computed(() => this.etat.donnees());
  attente = computed(() => !this.s() && !this.etat.erreur());

  /** Cartes affichées avant la réponse du serveur. */
  readonly LIGNES_CPN = ['CPN1', 'CPN2', 'CPN3', 'CPN4'].map(code => ({ code, libelle: code }));
  readonly LIGNES_PREVENTIONS = [
    ...[1, 2, 3, 4, 5].map(n => ({ code: `vat${n}`, libelle: `VAT ${n}`, groupe: 'VAT' })),
    ...[1, 2, 3].map(n => ({ code: `sp${n}`, libelle: `SP ${n}`, groupe: 'SP (TPI)' })),
  ];
  readonly LIGNES_PREVENTION = [
    { code: 'mild', libelle: 'Dort sous MILD', groupe: 'Prévention' },
    { code: 'micronutriments', libelle: 'Supplémentation en micronutriments', groupe: 'Prévention' },
    { code: 'mebendazole', libelle: 'Vermifuge : mébendazole (2e trimestre)', groupe: 'Prévention' },
    { code: 'dcip', libelle: 'DCIP de la femme : conseil', groupe: 'PTME' },
  ];
  readonly LIGNES_ECHO = [1, 2, 3].map(n => ({ code: `echo${n}`, libelle: `Écho ${n}` }));
  readonly LIGNES_TDR = [
    { code: 'tdrPalu', libelle: 'TDR palu réalisé', groupe: 'Laboratoire' },
    { code: 'tdrPaluPositif', libelle: 'TDR palu positif', groupe: 'Laboratoire' },
  ];
  /** Module Accouchement : 20 indicateurs (nombres et taux) du mois. */
  readonly LIGNES_ACCOUCHEMENT = [
    ...[['accTotal', 'Accouchements enregistrés'], ['accAssistes', 'Assistés par un personnel qualifié'], ['accVoieBasse', 'Par voie basse'],
      ['accCesarienne', 'Par césarienne'], ['accDomicile', 'À domicile (déclarés)'], ['accStructure', 'En structure sanitaire'],
      ['accPrematures', 'Accouchements prématurés']].map(([code, libelle]) => ({ code, libelle, groupe: 'Accouchements' })),
    ...[['naisVivantes', 'Naissances vivantes'], ['naisMortNes', 'Mort-nés']].map(([code, libelle]) => ({ code, libelle, groupe: 'Naissances' })),
    ...[['compMaternelles', 'Complications maternelles'], ['compHpp', 'Hémorragies du postpartum'], ['compEclampsie', 'Éclampsie / prééclampsie sévère'],
      ['compReferences', 'Références obstétricales'], ['compContreReferences', 'Contre-références obstétricales'], ['compDeces', 'Décès maternels']]
      .map(([code, libelle]) => ({ code, libelle, groupe: 'Complications et références' })),
    ...[['tauxAssistes', 'Taux d’accouchements assistés'], ['tauxCesariennes', 'Taux de césariennes'], ['tauxComplications', 'Taux de complications obstétricales'],
      ['tauxMortinatalite', 'Taux de mortinatalité'], ['tauxMortaliteMaternelle', 'Taux de mortalité maternelle']].map(([code, libelle]) => ({ code, libelle, groupe: 'Taux' })),
  ];
  /** Module Nouveau-né et suivi postnatal : 14 indicateurs (nombres et taux) des enfants nés dans le mois. */
  readonly LIGNES_NOUVEAU_NES = [
    ...[['nnTotal', 'Nouveau-nés enregistrés'], ['nnMasculin', 'Sexe masculin'], ['nnFeminin', 'Sexe féminin'], ['nnFaiblePoids', 'Faible poids de naissance'],
      ['nnPrematures', 'Prématurés'], ['nnSoinsEssentiels', 'Soins essentiels reçus']].map(([code, libelle]) => ({ code, libelle, groupe: 'Nouveau-nés' })),
    ...[['cponNouveauNes', 'Nouveau-nés vus en CPoN'], ['cponAttendues', 'CPoN attendues'], ['cponRealisees', 'CPoN réalisées']]
      .map(([code, libelle]) => ({ code, libelle, groupe: 'Suivi postnatal' })),
    ...[['nnReferes', 'Nouveau-nés référés'], ['nnDeces', 'Décès néonatals']].map(([code, libelle]) => ({ code, libelle, groupe: 'Références et décès' })),
    ...[['tauxCpon', 'Taux de réalisation des CPoN'], ['tauxFaiblePoids', 'Taux de faible poids de naissance'], ['tauxSuiviComplet', 'Taux de suivi postnatal complet']]
      .map(([code, libelle]) => ({ code, libelle, groupe: 'Taux' })),
  ];
  /** Module Vaccination : 28 indicateurs (couverture détaillée par antigène). */
  readonly LIGNES_VACCINATION = [
    ...[['vacEnfants', 'Enfants enregistrés en vaccination'], ['vacAJour', 'À jour pour leur âge'], ['vacZeroDose', 'Enfants zéro dose'],
      ['vacSousVaccines', 'Enfants sous-vaccinés'], ['vacAbandons', 'Abandons de la vaccination']].map(([code, libelle]) => ({ code, libelle, groupe: 'Statut vaccinal (fin du mois)' })),
    ...[['bcg', 'BCG'], ['vpo0', 'VPO 0 (polio oral)'], ['penta1', 'DTC-HepB-Hib 1'], ['penta2', 'DTC-HepB-Hib 2'], ['penta3', 'DTC-HepB-Hib 3'], ['vpo1', 'VPO 1'],
      ['vpo2', 'VPO 2'], ['vpo3', 'VPO 3'], ['pcv1', 'PCV13 - 1'], ['pcv2', 'PCV13 - 2'], ['pcv3', 'PCV13 - 3']]
      .map(([code, libelle]) => ({ code: `vac_${code}`, libelle: `Ont reçu le ${libelle}`, groupe: 'Enfants vaccinés dans le mois' })),
    ...[['vacRota', 'Antirotavirus selon le calendrier'], ['vacRougeole', 'Rougeole selon le calendrier']].map(([code, libelle]) => ({ code, libelle, groupe: 'Enfants vaccinés dans le mois' })),
    ...[['vacRetrouves', 'Retrouvés par les RECO'], ['vacReintegres', 'Réintégrés dans le calendrier'], ['vacTermines', 'Calendrier vaccinal terminé'],
      ['vacDoses', 'Doses administrées'], ['vacDosesManquees', 'Doses manquées'], ['vacRdvManques', 'Rendez-vous vaccinaux manqués']].map(([code, libelle]) => ({ code, libelle, groupe: 'Relance et suivi' })),
    ...[['bcg', 'BCG'], ['penta1', 'DTC-HepB-Hib 1'], ['penta3', 'DTC-HepB-Hib 3'], ['vpo3', 'VPO 3'], ['pcv3', 'PCV13 - 3'], ['rota3', 'Rota 3'], ['var1', 'VAR (RR1)'], ['vaa', 'VAA']]
      .map(([code, libelle]) => ({ code: `couv_${code}`, libelle: `Couverture ${libelle}`, groupe: 'Couverture par antigène' })),
    ...[['tauxAbandonPenta', 'Taux d’abandon Penta1-Penta3'], ['tauxReintegration', 'Taux de réintégration vaccinale'], ['tauxAchevement', 'Taux d’achèvement du calendrier']]
      .map(([code, libelle]) => ({ code, libelle, groupe: 'Taux' })),
  ];
  /** Module communautaire RECO — A. indicateurs transversaux (12). */
  readonly LIGNES_RECO = [
    ...[['recoEnregistres', 'RECO enregistrés'], ['recoActifs', 'RECO actifs'], ['recoMenages', 'Ménages suivis'], ['recoBeneficiaires', 'Bénéficiaires suivis']]
      .map(([code, libelle]) => ({ code, libelle, groupe: 'RECO et bénéficiaires' })),
    ...[['recoVisitesRealisees', 'Visites réalisées'], ['recoVisitesPlanifiees', 'Visites planifiées'], ['recoVisitesNonRealisees', 'Visites non réalisées'],
      ['recoAbsents', 'Bénéficiaires absents lors des visites']].map(([code, libelle]) => ({ code, libelle, groupe: 'Visites à domicile' })),
    ...[['recoRetrouves', 'Bénéficiaires retrouvés'], ['recoReferences', 'Références communautaires'], ['recoReferesRecus', 'Référés effectivement reçus']]
      .map(([code, libelle]) => ({ code, libelle, groupe: 'Retrouvés et références' })),
    { code: 'recoTauxVisites', libelle: 'Taux de réalisation des visites', groupe: 'Taux' },
  ];
  /** Parcours de relance B à F (RAC, ARC, RPC, IRC, TCC) : encarts mensuels et leurs lignes attendues. */
  private static lignes(groupes: [string, [string, string][]][]) {
    return groupes.flatMap(([groupe, lignes]) => lignes.map(([code, libelle]) => ({ code, libelle, groupe })));
  }
  readonly PARCOURS = [
    {
      route: 'rac-mensuel' as const, titre: 'RAC du mois — relance des abandons de CPN', icone: 'fa-person-pregnant',
      description: 'Femmes relancées dans le parcours RAC (abandon de CPN ou CPN jamais commencée)',
      lignes: SyntheseAmiComponent.lignes([
        ['Identification', [['racAbandons', 'Femmes identifiées en abandon de CPN'], ['racJamaisCpn', 'Jamais commencé la CPN, identifiées par les RECO'], ['racARelancer', 'Femmes à relancer']]],
        ['Relance', [['racContactees', 'Femmes contactées'], ['racRetrouvees', 'Femmes retrouvées'], ['racSensibilisees', 'Femmes sensibilisées'], ['racOrientees', 'Orientées vers une structure']]],
        ['Issue', [['racRevenues', 'Femmes revenues en CPN'], ['racPerdues', 'Femmes toujours perdues de vue']]],
        ['Taux', [['racTauxRelance', 'Taux de relance'], ['racTauxReintegration', 'Taux de réintégration CPN'], ['racTauxAbandon', 'Taux d’abandon CPN']]],
      ]),
    },
    {
      route: 'arc-mensuel' as const, titre: 'ARC du mois', icone: 'fa-route', description: 'Cas du parcours ARC (définition opérationnelle de la fiche du parcours)',
      lignes: SyntheseAmiComponent.lignes([
        ['Cas', [['arcIdentifies', 'Cas identifiés (définition ARC)'], ['arcAContacter', 'Cas à contacter']]],
        ['Suivi', [['arcContactes', 'Cas contactés'], ['arcRetrouves', 'Cas retrouvés'], ['arcOrientes', 'Cas orientés'], ['arcIntervention', 'Cas ayant bénéficié d’une intervention']]],
        ['Issue', [['arcResolus', 'Cas résolus'], ['arcNonResolus', 'Cas non résolus']]],
        ['Taux', [['arcTauxResolution', 'Taux de résolution'], ['arcTauxSuivi', 'Taux de suivi des cas']]],
      ]),
    },
    {
      route: 'rpc-mensuel' as const, titre: 'RPC du mois', icone: 'fa-hand-holding-medical', description: 'Cas du parcours RPC (définition opérationnelle de la fiche du parcours)',
      lignes: SyntheseAmiComponent.lignes([
        ['Cas', [['rpcIdentifies', 'Cas identifiés (définition RPC)'], ['rpcConcernes', 'Bénéficiaires concernés']]],
        ['Suivi', [['rpcContactes', 'Bénéficiaires contactés'], ['rpcVisites', 'Visites réalisées'], ['rpcReferences', 'Références effectuées']]],
        ['Issue', [['rpcPrisEnCharge', 'Bénéficiaires pris en charge'], ['rpcClotures', 'Cas clôturés'], ['rpcEnAttente', 'Cas en attente']]],
        ['Taux', [['rpcTauxPriseEnCharge', 'Taux de prise en charge'], ['rpcTauxCloture', 'Taux de clôture des cas']]],
      ]),
    },
    {
      route: 'irc-mensuel' as const, titre: 'IRC du mois', icone: 'fa-arrows-rotate', description: 'Cas du parcours IRC (définition opérationnelle de la fiche du parcours)',
      lignes: SyntheseAmiComponent.lignes([
        ['Cas', [['ircIdentifies', 'Cas identifiés (définition IRC)'], ['ircConcernes', 'Bénéficiaires concernés']]],
        ['Suivi', [['ircContactes', 'Bénéficiaires contactés'], ['ircRetrouves', 'Bénéficiaires retrouvés'], ['ircOrientes', 'Bénéficiaires orientés']]],
        ['Issue', [['ircReintegres', 'Bénéficiaires réintégrés'], ['ircSuivis', 'Cas suivis'], ['ircClotures', 'Cas clôturés']]],
        ['Taux', [['ircTauxReintegration', 'Taux de réintégration'], ['ircTauxSuivi', 'Taux de suivi des cas']]],
      ]),
    },
    {
      route: 'tcc-mensuel' as const, titre: 'TCC du mois', icone: 'fa-comments', description: 'Cas du parcours TCC (définition opérationnelle de la fiche du parcours)',
      lignes: SyntheseAmiComponent.lignes([
        ['Cas', [['tccIdentifies', 'Cas identifiés (définition TCC)'], ['tccConcernes', 'Bénéficiaires concernés']]],
        ['Suivi', [['tccContactes', 'Bénéficiaires contactés'], ['tccVisites', 'Visites effectuées'], ['tccOrientes', 'Bénéficiaires orientés'], ['tccSuivis', 'Bénéficiaires ayant bénéficié d’un suivi']]],
        ['Issue', [['tccResolus', 'Cas résolus'], ['tccEnAttente', 'Cas en attente']]],
        ['Taux', [['tccTauxResolution', 'Taux de résolution'], ['tccTauxSuivi', 'Taux de suivi']]],
      ]),
    },
  ];

  /** Périmètre du comité (établissement, province, zone de santé) ; vide pour le personnel. */
  private perimetre = inject(PERIMETRE_STATISTIQUES);

  constructor() {
    // Recalcul à chaque ouverture, avec les derniers filtres choisis (l'affichage précédent reste visible
    // entre-temps), puis à chaque changement de périmètre dans l'espace du comité.
    effect(() => {
      this.perimetre();
      untracked(() => this.etat.charger());
    });
  }

  choisirPeriode(code: PeriodeSynthese): void {
    if (code === 'perso') {
      this.etat.filtres.update(f => ({ ...f, periode: 'perso' }));
      return;
    }
    this.etat.charger({ periode: code });
  }

  appliquerPerso(): void {
    if (this.du && this.au) this.etat.charger({ periode: 'perso', du: this.du, au: this.au });
  }

  changerProvince(province: string): void {
    this.etat.charger({ province, aire: '' });
  }

  changerAire(aire: string): void {
    this.etat.charger({ aire });
  }

  actualiser(): void {
    this.etat.charger();
  }

  valeur = valeurIndicateur;
  fraction = fractionIndicateur;
  jour = jourChiffres;
  dateHeure = dateHeureChiffres;
  ton = (t?: string) => TONS[t ?? 'brand'] ?? TONS['brand'];

  /** Variation par rapport à la période précédente de même durée. */
  variation(i: Indicateur): string | null {
    if (i.precedent == null || i.valeur == null) return null;
    const e = i.valeur - i.precedent;
    return `${e >= 0 ? '+' : '−'}${Math.abs(e)} vs période préc.`;
  }

  portee(i: Indicateur): string {
    return i.instantane ? 'Instantané' : this.s()?.periode.libelle ?? '';
  }

  infobulle(i: Indicateur): string {
    return `${i.formule}\nDate de référence : ${i.reference} · Source : ${i.source}${i.aValider ? '\nRègle proposée, à valider avant usage officiel.' : ''}`;
  }

  // --- Tendance : petits multiples (une échelle par série, jamais deux axes) -------------
  maxSerie = (valeurs: number[]) => Math.max(1, ...valeurs);
  dernier = (valeurs: number[]) => valeurs[valeurs.length - 1] ?? 0;
  ecartMois(valeurs: number[]): string {
    const n = valeurs.length;
    if (n < 2) return '';
    const e = valeurs[n - 1] - valeurs[n - 2];
    return `${e >= 0 ? '+' : '−'}${Math.abs(e)} vs mois préc.`;
  }

  // --- Comparaison par aire --------------------------------------------------------------
  maxAire = computed(() => Math.max(1, ...(this.s()?.comparaisonAires ?? []).map(a => a.cpnEnRetard + a.enfantsEnRetard + a.tachesOuvertes)));

  // --- Entonnoir et flux : part de la première étape et de l'étape précédente -------------
  etapes(liste: { etape: string; n: number }[]) {
    const premier = liste[0]?.n ?? 0;
    return liste.map((x, i) => ({
      ...x,
      largeur: premier ? (x.n / premier) * 100 : 0,
      partPrecedente: i === 0 ? null : liste[i - 1].n ? Math.round((x.n / liste[i - 1].n) * 1000) / 10 : null,
      perte: i === 0 ? 0 : Math.max(0, liste[i - 1].n - x.n),
    }));
  }
  continuum = computed(() => this.etapes(this.s()?.continuum ?? []));
  flux = computed(() => this.etapes(this.s()?.fluxReco ?? []));

  // --- À traiter maintenant ----------------------------------------------------------------
  typesATraiter = computed(() => Object.entries(this.s()?.aTraiter.parType ?? {}).map(([type, n]) => ({ type, n })));
  lignesATraiter = computed(() => {
    const t = this.typeATraiter();
    return (this.s()?.aTraiter.lignes ?? []).filter(l => !t || l.type === t);
  });

  prioriteClass(p: LigneATraiter['priorite']): string {
    return {
      Urgente: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
      Prioritaire: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      Normale: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    }[p];
  }

  prioriteIcone(p: LigneATraiter['priorite']): string {
    return { Urgente: 'fa-circle-exclamation', Prioritaire: 'fa-triangle-exclamation', Normale: 'fa-circle-info' }[p];
  }

  enRetard(l: LigneATraiter): boolean {
    return !!l.echeance && new Date(l.echeance).getTime() < Date.now();
  }

  /** Export agrégé (CSV) : indicateurs seulement, aucune donnée nominative. */
  exporterCsv(): void {
    const s = this.s();
    if (!s) return;
    const echapper = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lignes = [
      ['Code', 'Module', 'Indicateur', 'Valeur', 'Numérateur', 'Dénominateur', 'Unité', 'Période', 'Date de référence', 'Source', 'Formule', 'Statut de la règle'],
      ...Object.values(s.modules).flat().map(i => [
        i.code, i.module, i.libelle, i.valeur ?? 'N/A', i.numerateur, i.denominateur ?? '', i.unite,
        i.instantane ? 'Instantané' : `${s.periode.du} au ${s.periode.au}`, i.reference, i.source, i.formule, i.aValider ? 'À valider' : 'Proposée',
      ]),
    ];
    const entete = `# AMI Santé Connect — synthèse générée le ${dateHeureChiffres(s.genereLe)} — règles ${s.versionRegles}${s.filtres.province ? ' — ' + s.filtres.province : ''}${s.filtres.aire ? ' — ' + s.filtres.aire : ''}\n`;
    const csv = '﻿' + entete + lignes.map(l => l.map(echapper).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ami-indicateurs-${s.periode.du}_${s.periode.au}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
