import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HorsLigneService } from '../data/hors-ligne/hors-ligne.service';
import { PROVINCES_RDC } from '../data/carte-rdc';
import { dateHeureChiffres, jourChiffres } from '../data/format';
import { CpnMensuel, Indicateur, LigneATraiter, PeriodeSynthese, StatistiquesService, SyntheseEtatService } from '../data/statistiques.service';

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
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './synthese-ami.component.html',
})
export class SyntheseAmiComponent {
  etat = inject(SyntheseEtatService);
  private stats = inject(StatistiquesService);
  horsLigne = inject(HorsLigneService);

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

  constructor() {
    // Recalcul à chaque ouverture, avec les derniers filtres choisis (l'affichage précédent reste visible entre-temps).
    this.etat.charger();
    // Chiffres CPN du mois : rechargés quand la province ou l'aire de santé change (le mois choisi est gardé).
    const lieu = computed(() => `${this.etat.filtres().province ?? ''}|${this.etat.filtres().aire ?? ''}`);
    effect(() => {
      lieu();
      untracked(() => this.chargerCpn());
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

  // --- CPN1 à CPN4 d'un mois (en cours par défaut, mois passés consultables) ---------------
  readonly moisLongs = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  /** Mois affiché (AAAA-MM) ; vide : mois en cours. */
  moisCpn = signal('');
  cpnDonnees = signal<CpnMensuel | null>(null);
  cpnChargement = signal(false);
  cpnErreur = signal<string | null>(null);

  libelleMois = (cle: string) => (cle ? `${this.moisLongs[+cle.slice(5) - 1]} ${cle.slice(0, 4)}` : '');

  decalerMois(cle: string, n: number): string {
    const [a, m] = cle.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
  }

  chargerCpn(mois = this.moisCpn()): void {
    this.moisCpn.set(mois);
    const f = this.etat.filtres();
    this.cpnChargement.set(true);
    this.cpnErreur.set(null);
    this.stats.cpnMensuel(mois, f.province, f.aire)
      .then(d => { this.cpnDonnees.set(d); this.moisCpn.set(d.mois); })
      .catch(e => this.cpnErreur.set(e?.error?.message ?? 'Chiffres CPN indisponibles pour le moment.'))
      .finally(() => this.cpnChargement.set(false));
  }

  moisPrecedentCpn(): void {
    if (this.moisCpn()) this.chargerCpn(this.decalerMois(this.moisCpn(), -1));
  }

  moisSuivantCpn(): void {
    const d = this.cpnDonnees();
    if (d && d.mois < d.moisCourant) this.chargerCpn(this.decalerMois(d.mois, 1));
  }

  cpnMois = computed(() => {
    const d = this.cpnDonnees();
    const cartes = ['CPN1', 'CPN2', 'CPN3', 'CPN4'].map(rang => {
      const r = d?.rangs.find(x => x.rang === rang);
      return { rang, n: r?.n ?? null, precedent: r?.precedent ?? null, valeurs: r?.valeurs ?? [] };
    });
    const cpn1 = cartes[0].n ?? 0;
    return {
      enCours: !!d && d.mois === d.moisCourant,
      mois: d?.historique.mois ?? [],
      cartes: cartes.map(c => ({
        ...c,
        ecart: c.n != null && c.precedent != null ? `${c.n - c.precedent >= 0 ? '+' : '−'}${Math.abs(c.n - c.precedent)} vs mois préc.` : null,
        largeur: cpn1 && c.n != null ? Math.min(100, (c.n / cpn1) * 100) : 0,
        partCpn1: c.rang !== 'CPN1' && cpn1 && c.n != null ? Math.round((c.n / cpn1) * 100) : null,
      })),
    };
  });

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
