import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'tableau' | 'saisie' | 'graphiques' | 'territoires';

/**
 * Sous-fenêtre 1 — Référentiel démographique : identification géographique, population totale,
 * répartition par sexe et par âge, sources et années, historique et validation. Les incohérences
 * (sexe, âge) sont signalées ; une population validée modifiée devient une nouvelle version.
 */
@Component({
  selector: 'app-epi-demographie',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) {
      <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button>
    }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('tableau') {
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-table text-brand-600"></i> Populations de référence — {{ epi.nomEntite(epi.entite()) }} et niveaux inférieurs</h2>
          <label class="flex items-center gap-2 text-xs"><input type="checkbox" [(ngModel)]="archives" (ngModelChange)="charger()"> Versions archivées</label></div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px]">
            <thead><tr><th class="table-th">Code territorial</th><th class="table-th">Territoire</th><th class="table-th text-right">Population totale</th><th class="table-th text-right">Hommes</th><th class="table-th text-right">Femmes</th><th class="table-th">Année</th><th class="table-th">Nature / source</th><th class="table-th">Statut et validation</th></tr></thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (p of populations(); track p['id']) {
                <tr>
                  <td class="table-td font-mono text-xs">{{ p['entiteCode'] }}</td>
                  <td class="table-td">{{ p['territoire'] }}<span class="block text-xs text-slate-500">{{ p['niveau'] }}</span>
                    @for (a of p['anomalies']; track a) { <span class="block text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> {{ a }}</span> }</td>
                  <td class="table-td text-right tabular-nums">{{ p['totale'] | number:'1.0-0':'fr' }}</td>
                  <td class="table-td text-right tabular-nums">{{ p['hommes'] | number:'1.0-0':'fr' }}<span class="block text-xs text-slate-500">{{ p['proportionHommes'] }} %</span></td>
                  <td class="table-td text-right tabular-nums">{{ p['femmes'] | number:'1.0-0':'fr' }}<span class="block text-xs text-slate-500">{{ p['proportionFemmes'] }} %</span></td>
                  <td class="table-td">{{ p['annee'] }}</td>
                  <td class="table-td text-xs">{{ p['nature'] }} · {{ p['source'] }}<span class="block text-slate-500">{{ p['methode'] }} — {{ p['dateDisponibilite'] }}</span></td>
                  <td class="table-td">
                    <app-epi-validation type="population" [donnee]="p" (change)="charger()" />
                    @if (epi.droits()?.planification && p['statut'] !== 'Archivé' && p['statut'] !== 'Soumis') {
                      <button type="button" class="btn-ghost mt-1 px-2 py-1 text-xs" (click)="editer(p)"><i class="fa-solid fa-pen"></i> {{ p['statut'] === 'Validé' ? 'Nouvelle version' : 'Modifier' }}</button>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="8" class="table-td text-center text-slate-500">Aucune population enregistrée pour ce territoire et cette année.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    }

    @case ('saisie') {
      @if (!epi.droits()?.planification) { <p class="text-sm text-slate-500"><i class="fa-solid fa-lock"></i> Saisie réservée aux médecins et responsables (titulaires, superviseurs).</p> }
      <form class="card space-y-5 p-5" (ngSubmit)="enregistrer()">
        <h2 class="card-title">{{ f.id ? (f.statut === 'Validé' ? 'Nouvelle version de la population v' + f.version : 'Modifier la population') : 'Nouvelle population de référence' }}</h2>
        <div>
          <p class="section-titre"><i class="fa-solid fa-map-location-dot"></i> A. Identification géographique</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="sm:col-span-2"><label class="label" for="d-ent">Entité (province, zone, aire, structure) <span class="req">*</span></label>
              <select id="d-ent" name="ent" class="input" [(ngModel)]="f.entiteCode" [disabled]="!!f.id" required>
                @for (e of epi.territoires(); track e.code) { <option [value]="e.code">{{ e.code }} — {{ e.nom }} ({{ e.niveau }})</option> }</select></div>
            <div><label class="label" for="d-an">Année de référence <span class="req">*</span></label><input id="d-an" name="an" type="number" class="input" [(ngModel)]="f.annee" [disabled]="!!f.id" required></div>
          </div>
        </div>
        <div>
          <p class="section-titre"><i class="fa-solid fa-people-group"></i> B. Population générale</p>
          <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div><label class="label" for="d-tot">Population totale <span class="req">*</span></label><input id="d-tot" name="tot" type="number" min="0" class="input" [(ngModel)]="f.totale" required></div>
            <div><label class="label" for="d-h">Population masculine <span class="req">*</span></label><input id="d-h" name="h" type="number" min="0" class="input" [(ngModel)]="f.hommes" required></div>
            <div><label class="label" for="d-f">Population féminine <span class="req">*</span></label><input id="d-f" name="f" type="number" min="0" class="input" [(ngModel)]="f.femmes" required></div>
            <div><label class="label" for="d-u">Urbaine</label><input id="d-u" name="u" type="number" min="0" class="input" [(ngModel)]="f.urbaine"></div>
            <div><label class="label" for="d-r">Rurale</label><input id="d-r" name="r" type="number" min="0" class="input" [(ngModel)]="f.rurale"></div>
          </div>
          @if (ecartSexe() !== 0) { <p class="hint text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> Hommes + femmes ≠ population totale (écart {{ ecartSexe() }}) : la validation sera refusée.</p> }
        </div>
        <div>
          <p class="section-titre"><i class="fa-solid fa-chart-bar"></i> C. Répartition par âge</p>
          <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            @for (t of f.tranches; track t.code) {
              <div><label class="label text-xs" [for]="'t-' + t.code">{{ t.libelle }}</label><input [id]="'t-' + t.code" [name]="'t-' + t.code" type="number" min="0" class="input" [(ngModel)]="t.effectif"></div>
            }
          </div>
          <p class="hint">Somme des tranches : {{ sommeAges() | number:'1.0-0':'fr' }} @if (sommeAges() && sommeAges() !== +f.totale) { — <span class="text-amber-700 dark:text-amber-300">groupes manquants ou âges non renseignés (écart {{ +f.totale - sommeAges() }})</span> }</p>
        </div>
        <div>
          <p class="section-titre"><i class="fa-solid fa-book"></i> Sources et année de référence</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label class="label" for="d-src">Source démographique <span class="req">*</span></label><select id="d-src" name="src" class="input" [(ngModel)]="f.source" required>@for (s of r()?.sourcesDemographiques ?? []; track s) { <option>{{ s }}</option> }</select></div>
            <div><label class="label" for="d-met">Méthode utilisée <span class="req">*</span></label><select id="d-met" name="met" class="input" [(ngModel)]="f.methode" required>@for (s of r()?.methodes ?? []; track s) { <option>{{ s }}</option> }</select></div>
            <div><label class="label" for="d-nat">Nature</label><select id="d-nat" name="nat" class="input" [(ngModel)]="f.nature">@for (s of r()?.natures ?? []; track s) { <option>{{ s }}</option> }</select></div>
            <div><label class="label" for="d-dd">Date de disponibilité <span class="req">*</span></label><input id="d-dd" name="dd" type="date" class="input" [(ngModel)]="f.dateDisponibilite" required></div>
            <div class="sm:col-span-2"><label class="label" for="d-doc">Document justificatif (titre, référence, lien)</label><input id="d-doc" name="doc" class="input" [(ngModel)]="f.document"></div>
            @if (f.id) { <div class="sm:col-span-2"><label class="label" for="d-mot">Motif de la modification @if (f.statut === 'Validé') { <span class="req">*</span> }</label><input id="d-mot" name="mot" class="input" [(ngModel)]="f.motif"></div> }
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" (click)="nouveau()">Réinitialiser</button>
          <button type="submit" class="btn-primary" [disabled]="envoi() || !epi.droits()?.planification"><i class="fa-solid fa-floppy-disk"></i> Enregistrer (brouillon)</button>
        </div>
      </form>
    }

    @case ('graphiques') {
      @if (s(); as sy) {
        @if (sy['controleNiveaux']?.message) { <p class="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"><i class="fa-solid fa-triangle-exclamation"></i> {{ sy['controleNiveaux'].message }}</p> }
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Répartition hommes / femmes</h2></div><div class="p-4">
            <app-epi-graphique type="doughnut" [etiquettes]="libelles(sy['sexe'])" [series]="[{ libelle: 'Population', valeurs: valeurs(sy['sexe']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Répartition par tranche d’âge</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="libelles(sy['ages'])" [series]="[{ libelle: 'Effectif', valeurs: valeurs(sy['ages']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Évolution de la population (validée)</h2></div><div class="p-4">
            <app-epi-graphique type="line" [etiquettes]="annees(sy['evolution'])" [series]="[{ libelle: 'Population totale', valeurs: totaux(sy['evolution']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Distribution par entité du niveau inférieur</h2></div><div class="p-4">
            <app-epi-graphique [horizontal]="true" [hauteur]="Math.max(220, sy['distribution'].length * 28)" [etiquettes]="noms(sy['distribution'])" [series]="[{ libelle: 'Population', valeurs: totalesDist(sy['distribution']) }]" /></div></div>
        </div>
      }
    }

    @case ('territoires') {
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-sitemap text-brand-600"></i> Référentiel géographique commun</h2>
          @if (epi.droits()?.parametrage) { <button type="button" class="btn-secondary py-1.5 text-xs" [disabled]="envoi()" (click)="synchroniser()"><i class="fa-solid fa-arrows-rotate"></i> Importer depuis les établissements</button> }</div>
        @if (epi.droits()?.parametrage) {
          <form class="grid gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:grid-cols-5" (ngSubmit)="creerEntite()">
            <div><label class="label text-xs" for="g-niv">Niveau</label><select id="g-niv" name="niv" class="input py-2" [(ngModel)]="g.niveau">@for (n of (r()?.niveaux ?? []).slice(1); track n) { <option>{{ n }}</option> }</select></div>
            <div class="sm:col-span-2"><label class="label text-xs" for="g-par">Entité parente</label><select id="g-par" name="par" class="input py-2" [(ngModel)]="g.parentCode">@for (e of epi.territoires(); track e.code) { <option [value]="e.code">{{ e.nom }} ({{ e.niveau }})</option> }</select></div>
            <div><label class="label text-xs" for="g-nom">Nom</label><input id="g-nom" name="nom" class="input py-2" [(ngModel)]="g.nom"></div>
            <div><label class="label text-xs" for="g-off">Code officiel</label><div class="flex gap-2"><input id="g-off" name="off" class="input py-2" [(ngModel)]="g.codeOfficiel"><button type="submit" class="btn-primary py-2" [disabled]="!g.nom"><i class="fa-solid fa-plus"></i></button></div></div>
          </form>
        }
        <ul class="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
          @for (e of epi.territoires(); track e.code) {
            <li class="flex items-center gap-3 py-2 pr-5" [style.padding-left.rem]="1.25 + e.profondeur * 1.25">
              <span class="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ e.niveau }}</span><span class="flex-1">{{ e.nom }}</span><span class="font-mono text-xs text-slate-500">{{ e.code }}</span>
            </li>
          }
        </ul>
      </div>
    }
  }
</div>`,
})
export class DemographieComponent {
  epi = inject(EpidemiologieService);
  readonly Math = Math;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'tableau', libelle: 'Populations et validation', icone: 'fa-table' },
    { id: 'saisie', libelle: 'Saisie', icone: 'fa-pen-to-square' },
    { id: 'graphiques', libelle: 'Graphiques', icone: 'fa-chart-pie' },
    { id: 'territoires', libelle: 'Référentiel géographique', icone: 'fa-sitemap' },
  ];
  onglet = signal<Onglet>('tableau');
  populations = signal<Donnee[]>([]);
  s = signal<Donnee | null>(null);
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  archives = false;
  r = this.epi.referentiel;
  f: Donnee = {};
  g = { niveau: 'Communauté', parentCode: '', nom: '', codeOfficiel: '' };

  constructor() {
    this.nouveau();
    effect(() => {
      this.epi.entite();
      this.epi.annee();
      untracked(() => { this.charger(); if (!this.f['id']) this.nouveau(); });
    });
  }

  nouveau() {
    this.f = {
      entiteCode: this.epi.entite(), annee: this.epi.annee(), totale: null, hommes: null, femmes: null, urbaine: null, rurale: null,
      source: 'Projection', methode: 'Projection', nature: 'Projetée', dateDisponibilite: new Date().toISOString().slice(0, 10), document: '', motif: '',
      tranches: (this.r()?.tranchesAge ?? []).map(t => ({ code: t.code, libelle: t.libelle, effectif: null })),
    };
  }

  editer(p: Donnee) {
    this.f = {
      ...p, motif: '',
      tranches: (this.r()?.tranchesAge ?? []).map(t => ({ code: t.code, libelle: t.libelle, effectif: p['tranchesAge'].find((x: Donnee) => x['code'] === t.code)?.effectif ?? null })),
    };
    this.onglet.set('saisie');
  }

  ecartSexe = () => (this.f['totale'] == null || this.f['hommes'] == null || this.f['femmes'] == null ? 0 : +this.f['totale'] - (+this.f['hommes'] + +this.f['femmes']));
  sommeAges = () => (this.f['tranches'] as Donnee[] ?? []).reduce((s, t) => s + (t['effectif'] == null || t['effectif'] === '' ? 0 : +t['effectif']), 0);

  async charger() {
    this.erreur.set('');
    try {
      const [liste, synthese] = await Promise.all([
        this.epi.get<Donnee[]>('/populations', { dans: this.epi.entite(), annee: this.epi.annee(), archives: this.archives ? 'oui' : '' }),
        this.epi.get('/populations/synthese', { entite: this.epi.entite(), annee: this.epi.annee() }),
      ]);
      this.populations.set(liste);
      this.s.set(synthese);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async enregistrer() {
    this.envoi.set(true);
    this.erreur.set('');
    this.message.set('');
    const corps = {
      entiteCode: this.f['entiteCode'], annee: this.f['annee'], totale: this.f['totale'], hommes: this.f['hommes'], femmes: this.f['femmes'],
      urbaine: this.f['urbaine'], rurale: this.f['rurale'], source: this.f['source'], methode: this.f['methode'], nature: this.f['nature'],
      dateDisponibilite: this.f['dateDisponibilite'], document: this.f['document'], motif: this.f['motif'],
      tranchesAge: (this.f['tranches'] as Donnee[]).filter(t => t['effectif'] !== null && t['effectif'] !== '').map(t => ({ code: t['code'], effectif: t['effectif'] })),
    };
    try {
      const p = this.f['id'] ? await this.epi.patch(`/populations/${this.f['id']}`, corps) : await this.epi.post('/populations', corps);
      this.message.set(`Population enregistrée (v${p['version']}, ${p['statut']}). Soumettez-la pour validation.${p['anomalies']?.length ? ' Anomalies : ' + p['anomalies'].join(' ') : ''}`);
      this.nouveau();
      this.onglet.set('tableau');
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  async synchroniser() {
    this.envoi.set(true);
    try {
      const r = await this.epi.post('/territoires/synchroniser');
      this.message.set(`${r['creees']} entité(s) créée(s) à partir de ${r['etablissements']} établissement(s).`);
      await this.epi.rechargerTerritoires();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  async creerEntite() {
    try {
      await this.epi.post('/territoires', { ...this.g, parentCode: this.g.parentCode || this.epi.entite() });
      this.g.nom = '';
      this.g.codeOfficiel = '';
      await this.epi.rechargerTerritoires();
      this.message.set('Entité ajoutée au référentiel.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  libelles = (l: Donnee[]) => l.map(x => x['libelle']);
  valeurs = (l: Donnee[]) => l.map(x => x['n'] as number);
  annees = (l: Donnee[]) => l.map(x => String(x['annee']));
  totaux = (l: Donnee[]) => l.map(x => x['totale'] as number);
  noms = (l: Donnee[]) => l.map(x => x['nom']);
  totalesDist = (l: Donnee[]) => l.map(x => x['totale'] as number | null);
}
