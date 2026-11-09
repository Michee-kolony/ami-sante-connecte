import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';

type Onglet = 'cpn' | 'accouchement' | 'vaccination' | 'zeroDose' | 'abandons' | 'continuite' | 'comparaison';

/**
 * Sous-fenêtre 7 — Analyse des couvertures sanitaires : réalisations des modules AMI ÷ populations
 * cibles validées. Numérateur et dénominateur toujours affichés ; « non calculable » sans
 * dénominateur ; couverture > 100 % signalée pour vérification (jamais ramenée à 100 %).
 */
@Component({
  selector: 'app-epi-couvertures',
  standalone: true,
  imports: [DecimalPipe, FormsModule, EpiGraphiqueComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
      @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
    </div>
    <div class="flex items-end gap-2">
      <div><label class="label text-xs" for="cv-per">Période</label>
        <select id="cv-per" class="input py-2" [(ngModel)]="periode" (ngModelChange)="charger()"><option value="annee">Année {{ epi.annee() }}</option><option value="mois">Un mois</option><option value="trimestre">Un trimestre</option></select></div>
      @if (periode === 'mois') { <input type="month" class="input py-2" [(ngModel)]="mois" (ngModelChange)="charger()" aria-label="Mois"> }
      @if (periode === 'trimestre') { <select class="input py-2" [(ngModel)]="trimestre" (ngModelChange)="charger()" aria-label="Trimestre">@for (t of [1,2,3,4]; track t) { <option [value]="epi.annee() + '-T' + t">T{{ t }} {{ epi.annee() }}</option> }</select> }
    </div>
  </div>
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @if (c(); as d) {
    <p class="text-xs text-slate-500">
      Dénominateur : @if (d['calcul']) { calcul validé {{ d['calcul'].numero }} v{{ d['calcul'].version }} (population cible estimée), proratisé à la période. } @else { <span class="text-amber-700 dark:text-amber-300">aucune population cible validée : couvertures non calculables.</span> }
      Numérateur : prestations observées dans les modules AMI ({{ d['etablissements'] }} structure(s)@if (d['restreint']) {, périmètre limité à votre structure}).</p>
    @if (['cpn', 'accouchement', 'vaccination'].includes(onglet())) {
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[820px]">
          <thead><tr><th class="table-th">Indicateur</th><th class="table-th text-right">Réalisations</th><th class="table-th text-right">Population cible</th><th class="table-th text-right">Couverture</th><th class="table-th">Vérification</th><th class="table-th">Fiche</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (i of indicateursOnglet(d); track i.code) {
            <tr>
              <td class="table-td">{{ i.nom }}<span class="block text-xs text-slate-500" [title]="i.formule">{{ i.code }} · {{ i.libelleCible }}</span></td>
              <td class="table-td text-right tabular-nums">{{ i.numerateur | number:'1.0-0':'fr' }}</td>
              <td class="table-td text-right tabular-nums">{{ i.denominateur == null ? '—' : (i.denominateur | number:'1.0-2':'fr') }}</td>
              <td class="table-td text-right text-base font-semibold tabular-nums" [class.text-rose-600]="i.depassement || i.sousSeuil" [title]="i.raison ?? ''">{{ pct(i.valeur) }}</td>
              <td class="table-td text-xs">@if (i.depassement) { <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">&gt; 100 % : à vérifier</span> }
                @if (i.sousSeuil) { <span class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Sous le seuil ({{ i.seuilReference }} %)</span> }
                @if (i.nonCalculable) { <span class="text-slate-500">{{ i.raison }}</span> }</td>
              <td class="table-td text-xs">{{ i.ficheValidee ? 'Validée v' + i.ficheVersion : 'Non validée' }}</td>
            </tr>
          }</tbody>
        </table>
      </div>
      <div class="grid gap-6 xl:grid-cols-2">
        <div class="card"><div class="card-header"><h2 class="card-title">Cibles et réalisations</h2></div><div class="p-4">
          <app-epi-graphique [etiquettes]="noms(indicateursOnglet(d))" [series]="[{ libelle: 'Population cible (période)', valeurs: champ(indicateursOnglet(d), 'denominateur'), couleur: '#94a3b8' }, { libelle: 'Réalisations', valeurs: champ(indicateursOnglet(d), 'numerateur') }]" /></div></div>
        <div class="card"><div class="card-header"><h2 class="card-title">Évolution mensuelle de la couverture</h2></div><div class="p-4">
          <app-epi-graphique type="line" [pourcent]="true" [etiquettes]="moisEv(d)" [series]="seriesEvolution(d, indicateursOnglet(d))" /></div></div>
      </div>
    }
    @if (onglet() === 'zeroDose') {
      <div class="grid gap-3 sm:grid-cols-4">
        <div class="card p-4"><p class="text-xs text-slate-500">Enfants suivis</p><p class="text-2xl font-bold">{{ d['zeroDose'].enfantsSuivis }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-500">Enfants zéro dose</p><p class="text-2xl font-bold text-rose-600">{{ d['zeroDose'].zeroDose }}</p><p class="text-xs">{{ pct(d['zeroDose'].proportionZeroDose) }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-500">Enfants sous-vaccinés</p><p class="text-2xl font-bold text-amber-600">{{ d['zeroDose'].sousVaccines }}</p><p class="text-xs">{{ pct(d['zeroDose'].proportionSousVaccines) }}</p></div>
        <div class="card p-4"><app-epi-graphique type="doughnut" [hauteur]="140" [etiquettes]="['Zéro dose', 'Sous-vaccinés (autres)', 'À jour']"
          [series]="[{ libelle: 'Enfants', valeurs: [d['zeroDose'].zeroDose, d['zeroDose'].sousVaccines - d['zeroDose'].zeroDose, d['zeroDose'].enfantsSuivis - d['zeroDose'].sousVaccines] }]" /></div>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ d['zeroDose'].definition }} La définition officielle retenue doit être validée par le PEV.</p>
    }
    @if (onglet() === 'abandons' || onglet() === 'continuite') {
      <div class="card overflow-x-auto"><table class="w-full min-w-[700px]">
        <thead><tr><th class="table-th">Indicateur</th><th class="table-th text-right">Numérateur</th><th class="table-th text-right">Dénominateur</th><th class="table-th text-right">Valeur</th><th class="table-th">Méthode</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (a of (onglet() === 'abandons' ? d['abandons'] : d['continuite']); track a.code) {
          <tr><td class="table-td">{{ a.libelle }}</td><td class="table-td text-right">{{ a.numerateur ?? '—' }}</td><td class="table-td text-right">{{ a.denominateur ?? '—' }}</td><td class="table-td text-right font-semibold">{{ pct(a.valeur) }}</td><td class="table-td text-xs text-slate-500">{{ a.formule }}</td></tr>
        }</tbody></table></div>
      <div class="card"><div class="card-header"><h2 class="card-title">{{ onglet() === 'abandons' ? 'Abandons des interventions' : 'Continuité des soins mère-enfant' }}</h2></div><div class="p-4">
        <app-epi-graphique [pourcent]="true" [etiquettes]="libelles(onglet() === 'abandons' ? d['abandons'] : d['continuite'])" [series]="[{ libelle: 'Valeur (%)', valeurs: champ(onglet() === 'abandons' ? d['abandons'] : d['continuite'], 'valeur') }]" /></div></div>
    }
    @if (onglet() === 'comparaison') {
      <div class="flex items-center gap-2 text-sm"><label for="cmp-niv">Comparer :</label>
        <select id="cmp-niv" class="input w-auto py-1.5" [(ngModel)]="niveau" (ngModelChange)="chargerStructures()"><option value="">Formations sanitaires</option><option value="enfants">Entités du niveau inférieur</option></select></div>
      <div class="card overflow-x-auto"><table class="w-full min-w-[820px]">
        <thead><tr><th class="table-th">Structure</th><th class="table-th text-right">CPN1</th><th class="table-th text-right">Penta1</th><th class="table-th text-right">Penta3</th><th class="table-th text-right">Abandon Penta1-Penta3</th><th class="table-th text-right">Zéro dose</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (l of structures(); track l['code']) {
          <tr><td class="table-td">{{ l['nom'] }}@if (!l['calcul']) { <span class="block text-xs text-amber-700 dark:text-amber-300">Population cible non validée</span> }</td>
            <td class="table-td text-right">{{ pct(l['cpn1']) }}</td><td class="table-td text-right">{{ pct(l['penta1']) }}</td><td class="table-td text-right">{{ pct(l['penta3']) }}</td><td class="table-td text-right">{{ pct(l['abandonPenta']) }}</td><td class="table-td text-right">{{ l['zeroDose'] }}</td></tr>
        } @empty { <tr><td colspan="6" class="table-td text-center text-slate-500">Aucune structure dans le périmètre.</td></tr> }</tbody></table></div>
      @if (structures().length) {
        <div class="card"><div class="card-header"><h2 class="card-title">Comparaison des structures sanitaires</h2></div><div class="p-4">
          <app-epi-graphique [pourcent]="true" [etiquettes]="nomsStructures()" [series]="[{ libelle: 'CPN1', valeurs: colStructures('cpn1') }, { libelle: 'Penta1', valeurs: colStructures('penta1') }, { libelle: 'Penta3', valeurs: colStructures('penta3') }]" /></div></div>
      }
    }
  } @else if (!erreur()) { <div class="skeleton h-64 rounded-2xl" aria-hidden="true"></div> }
</div>`,
})
export class CouverturesComponent {
  epi = inject(EpidemiologieService);
  readonly pct = pct;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'cpn', libelle: 'CPN', icone: 'fa-person-pregnant' },
    { id: 'accouchement', libelle: 'Accouchements et postnatal', icone: 'fa-baby' },
    { id: 'vaccination', libelle: 'Vaccination', icone: 'fa-syringe' },
    { id: 'zeroDose', libelle: 'Zéro dose', icone: 'fa-circle-exclamation' },
    { id: 'abandons', libelle: 'Abandons', icone: 'fa-person-walking-arrow-right' },
    { id: 'continuite', libelle: 'Continuité mère-enfant', icone: 'fa-link' },
    { id: 'comparaison', libelle: 'Comparaison', icone: 'fa-hospital' },
  ];
  onglet = signal<Onglet>('cpn');
  c = signal<Donnee | null>(null);
  structures = signal<Donnee[]>([]);
  erreur = signal('');
  periode = 'annee';
  mois = new Date().toISOString().slice(0, 7);
  trimestre = `${new Date().getFullYear()}-T1`;
  niveau = '';

  constructor() {
    effect(() => {
      this.epi.entite();
      this.epi.annee();
      untracked(() => { this.charger(); });
    });
  }

  private filtre(): Donnee {
    const base: Donnee = { entite: this.epi.entite() };
    if (this.periode === 'mois') return { ...base, mois: this.mois };
    if (this.periode === 'trimestre') return { ...base, trimestre: this.trimestre };
    return { ...base, annee: this.epi.annee() };
  }

  async charger() {
    this.erreur.set('');
    try {
      this.c.set(await this.epi.get('/couvertures', this.filtre()));
      await this.chargerStructures();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async chargerStructures() {
    try {
      this.structures.set((await this.epi.get('/couvertures/structures', { ...this.filtre(), niveau: this.niveau }))['lignes']);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  indicateursOnglet(d: Donnee): Donnee[] {
    const groupes: Record<string, string[]> = { cpn: ['CPN1', 'CPN4'], accouchement: ['ACC', 'CPON'], vaccination: ['BCG', 'PENTA1', 'PENTA3', 'VPO3', 'PCV3', 'ROTA3', 'VAR1', 'VAA'] };
    const garder = groupes[this.onglet()] ?? [];
    return (d['indicateurs'] as Donnee[]).filter(i => garder.includes(i['intervention']));
  }
  noms = (l: Donnee[]) => l.map(i => i['nom'].replace('Couverture ', ''));
  libelles = (l: Donnee[]) => l.map(i => i['libelle']);
  champ = (l: Donnee[], k: string) => l.map(i => i[k] as number | null);
  moisEv = (d: Donnee) => (d['evolution'] ?? []).map((m: Donnee) => m['mois']);
  seriesEvolution = (d: Donnee, inds: Donnee[]) => inds.map(i => ({ libelle: i['nom'].replace('Couverture ', ''), valeurs: (d['evolution'] ?? []).map((m: Donnee) => m[i['code']]?.couverture ?? null) }));
  nomsStructures = () => this.structures().map(s => s['nom']);
  colStructures = (k: string) => this.structures().map(s => s[k] as number | null);
}
