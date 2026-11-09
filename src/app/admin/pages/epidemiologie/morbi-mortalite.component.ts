import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'morbidite' | 'mortalite' | 'saisieMorbidite' | 'saisieDeces' | 'registres';

/**
 * Sous-fenêtre 6 — Morbidité et mortalité : analyses (morbidité générale, maternelle, néonatale et
 * infantile ; mortalité générale, maternelle, néonatale et infantile ; tendances), enregistrement
 * des cas et des décès, signalements AMI à classifier. Indicateurs sur données validées seulement.
 */
@Component({
  selector: 'app-epi-morbi-mortalite',
  standalone: true,
  imports: [DecimalPipe, FormsModule, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @if (a(); as d) {
    @if (['morbidite', 'mortalite'].includes(onglet())) {
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span>Unité des fréquences :</span>
        <select class="input w-auto py-1.5" [(ngModel)]="unite" (ngModelChange)="charger()">@for (u of epi.referentiel()?.unitesFrequence ?? []; track u) { <option [ngValue]="u">pour {{ u | number:'1.0-0':'fr' }} habitants</option> }</select>
        @if (d['incompletes']; as inc) {
          <span class="text-xs text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> Exclus (non validés) : {{ inc.morbiditeNonValidee }} cas, {{ inc.decesNonValides }} décès · cause indéterminée : {{ inc.causeIndeterminee }}
            @if (inc.populationAbsente) { · population de référence validée absente } </span>
        }
      </div>
    }
    @switch (onglet()) {
      @case ('morbidite') {
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Dix principales causes de morbidité</h2><span class="text-xs text-slate-500">{{ d['morbidite'].total }} cas validés</span></div><div class="p-4">
            <app-epi-graphique [horizontal]="true" [hauteur]="300" [etiquettes]="libelles(d['morbidite'].principales)" [series]="[{ libelle: 'Cas', valeurs: valeurs(d['morbidite'].principales) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Courbe mensuelle des cas</h2></div><div class="p-4">
            <app-epi-graphique type="line" [etiquettes]="mois(d['morbidite'].parMois)" [series]="[{ libelle: 'Cas', valeurs: valeurs(d['morbidite'].parMois) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Cas par tranche d’âge</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="libelles(d['morbidite'].parAge)" [series]="[{ libelle: 'Cas', valeurs: valeurs(d['morbidite'].parAge) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Cas par sexe et par catégorie</h2></div><div class="grid grid-cols-2 gap-2 p-4">
            <app-epi-graphique type="doughnut" [hauteur]="220" [etiquettes]="libelles(d['morbidite'].parSexe)" [series]="[{ libelle: 'Cas', valeurs: valeurs(d['morbidite'].parSexe) }]" />
            <app-epi-graphique type="doughnut" [hauteur]="220" [etiquettes]="libelles(d['morbidite'].parCategorie)" [series]="[{ libelle: 'Cas', valeurs: valeurs(d['morbidite'].parCategorie) }]" /></div></div>
        </div>
        <div class="card overflow-x-auto"><table class="w-full min-w-[640px]"><thead><tr><th class="table-th">Indicateur</th><th class="table-th text-right">Cas</th><th class="table-th text-right">Population</th><th class="table-th text-right">Fréquence</th><th class="table-th">Formule</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (f of d['morbidite'].frequences; track f.code) {
            <tr><td class="table-td">{{ f.libelle }}</td><td class="table-td text-right">{{ f.numerateur }}</td><td class="table-td text-right">{{ f.denominateur ?? '—' }}</td><td class="table-td text-right font-semibold">{{ f.valeur == null ? 'Non calculable' : (f.valeur | number:'1.0-2':'fr') }}</td><td class="table-td text-xs text-slate-500">{{ f.formule }}</td></tr>
          } @empty { <tr><td colspan="5" class="table-td text-center text-slate-500">Aucun cas validé sur la période.</td></tr> }</tbody></table></div>
      }
      @case ('mortalite') {
        <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title">Indicateurs de mortalité ({{ d['mortalite'].total }} décès validés · naissances vivantes AMI : {{ d['naissancesVivantes'] }})</h2></div>
          <table class="w-full min-w-[760px]"><thead><tr><th class="table-th">Indicateur</th><th class="table-th text-right">Numérateur</th><th class="table-th text-right">Dénominateur</th><th class="table-th text-right">Valeur</th><th class="table-th">Méthode</th></tr></thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (i of d['mortalite'].indicateurs; track i.code) {
              <tr><td class="table-td">{{ i.libelle }}</td><td class="table-td text-right">{{ i.numerateur }}</td><td class="table-td text-right">{{ i.denominateur ?? '—' }}</td>
                <td class="table-td text-right font-semibold" [title]="i.raison ?? ''">{{ i.valeur == null ? 'Non calculable' : (i.valeur | number:'1.0-1':'fr') }}</td><td class="table-td text-xs text-slate-500">{{ i.formule }}</td></tr>
            }</tbody></table>
          <p class="px-5 py-3 text-xs text-slate-500">Une saisie dans AMI ne certifie pas la cause du décès : les décès maternels et néonatals suivent les définitions et procédures nationales (audit, SDMPR).</p></div>
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Décès par cause</h2></div><div class="p-4">
            <app-epi-graphique [horizontal]="true" [hauteur]="300" [etiquettes]="libelles(d['mortalite'].parCause)" [series]="[{ libelle: 'Décès', valeurs: valeurs(d['mortalite'].parCause), couleur: '#dc2626' }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Décès maternels et néonatals par mois</h2></div><div class="p-4">
            <app-epi-graphique type="line" [etiquettes]="mois(d['mortalite'].parMois)" [series]="[{ libelle: 'Tous décès', valeurs: valeurs(d['mortalite'].parMois), couleur: '#64748b' }, { libelle: 'Maternels', valeurs: valeurs(d['mortalite'].maternelsParMois), couleur: '#c2417a' }, { libelle: 'Néonatals', valeurs: valeurs(d['mortalite'].neonatalsParMois), couleur: '#0a5fb5' }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Décès maternels par structure</h2></div><ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">@for (x of d['mortalite'].maternelsParStructure; track x.libelle) { <li class="flex justify-between px-5 py-2"><span>{{ x.libelle }}</span><strong>{{ x.n }}</strong></li> } @empty { <li class="px-5 py-3 text-slate-500">Aucun.</li> }</ul></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Décès néonatals par zone</h2></div><ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">@for (x of d['mortalite'].neonatalsParZone; track x.libelle) { <li class="flex justify-between px-5 py-2"><span>{{ x.libelle }}</span><strong>{{ x.n }}</strong></li> } @empty { <li class="px-5 py-3 text-slate-500">Aucun.</li> }</ul></div>
        </div>
        <p class="text-sm">Comparaison avec la période précédente : {{ d['mortalite'].precedent }} décès validés — variation {{ d['mortalite'].variation == null ? 'non calculable' : pct(d['mortalite'].variation) }}.
          Signalements AMI à classifier : {{ d['mortalite'].signalementsAmi.decesEnfants }} enfant(s) décédé(s), {{ d['mortalite'].signalementsAmi.mortNes }} mort-né(s), {{ d['mortalite'].signalementsAmi.decesMaternelsMentionnes }} mention(s) de décès maternel dans les dossiers d’accouchement.</p>
      }
    }
  }

  @switch (onglet()) {
    @case ('saisieMorbidite') {
      <form class="card space-y-4 p-5" (ngSubmit)="enregistrerMorbidite()">
        <h2 class="card-title">Formulaire A — Cas de morbidité</h2>
        <p class="text-xs text-slate-500">Les données doivent prioritairement provenir des modules opérationnels d’AMI : ce formulaire complète les sources autorisées.</p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label class="label" for="m-pers">Dossier AMI</label><input id="m-pers" name="pers" class="input" [(ngModel)]="m['personneNumero']" placeholder="AC-PAT-… / AC-ENF-…"></div>
          <div><label class="label" for="m-date">Date de consultation <span class="req">*</span></label><input id="m-date" name="date" type="date" class="input" [(ngModel)]="m['dateConsultation']"></div>
          <div><label class="label" for="m-loc">Structure / territoire <span class="req">*</span></label><select id="m-loc" name="loc" class="input" [(ngModel)]="m['entiteCode']">@for (e of epi.territoires(); track e.code) { <option [value]="e.code">{{ e.nom }} ({{ e.niveau }})</option> }</select></div>
          <div><label class="label" for="m-serv">Service <span class="req">*</span></label><select id="m-serv" name="serv" class="input" [(ngModel)]="m['service']">@for (x of epi.referentiel()?.services ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="m-age">Âge (années) <span class="req">*</span></label><input id="m-age" name="age" type="number" min="0" class="input" [(ngModel)]="m['ageAnnees']"></div>
          <div><label class="label" for="m-sexe">Sexe <span class="req">*</span></label><select id="m-sexe" name="sexe" class="input" [(ngModel)]="m['sexe']">@for (x of epi.referentiel()?.sexes ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="m-diag">Diagnostic <span class="req">*</span></label><select id="m-diag" name="diag" class="input" [(ngModel)]="m['diagnostic']">@for (x of epi.referentiel()?.maladies ?? []; track x.code) { <option [value]="x.code">{{ x.libelle }}</option> }</select></div>
          <div><label class="label" for="m-cla">Classification <span class="req">*</span></label><select id="m-cla" name="cla" class="input" [(ngModel)]="m['classification']">@for (x of epi.referentiel()?.classificationsMorbidite ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="m-cat">Catégorie</label><select id="m-cat" name="cat" class="input" [(ngModel)]="m['categorie']"><option>Générale</option><option>Maternelle</option><option>Néonatale</option><option>Infantile</option></select></div>
          <div><label class="label" for="m-comp">Complication</label><input id="m-comp" name="comp" class="input" [(ngModel)]="m['complication']"></div>
          <div><label class="label" for="m-iss">Issue</label><select id="m-iss" name="iss" class="input" [(ngModel)]="m['issue']">@for (x of epi.referentiel()?.issuesMorbidite ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="m-sor">Date de sortie</label><input id="m-sor" name="sor" type="date" class="input" [(ngModel)]="m['dateSortie']"></div>
          <div class="sm:col-span-2"><label class="label" for="m-tr">Transfert depuis (structure)</label><input id="m-tr" name="tr" class="input" [(ngModel)]="m['transfertDe']" placeholder="Un transfert n’est pas un nouveau cas"></div>
        </div>
        @if (doublon()) { <p class="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{{ doublon() }} <button type="button" class="btn-secondary ml-2 py-1 text-xs" (click)="enregistrerMorbidite(true)">Nouvel épisode : enregistrer</button></p> }
        <div class="flex justify-end"><button type="submit" class="btn-primary" [disabled]="envoi()">Enregistrer et soumettre</button></div>
      </form>
    }
    @case ('saisieDeces') {
      @if (signalements().length) {
        <div class="card"><div class="card-header"><h2 class="card-title"><i class="fa-solid fa-link text-brand-600"></i> Signalements des modules AMI à classifier</h2></div>
          <ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">@for (s of signalements(); track s['origineAmi']) {
            <li class="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5"><span>{{ s['origineAmi'] }} — {{ s['origine'] }} — signalé le {{ s['dateSignalement'] }} (≈ {{ s['ageJoursApprox'] }} jours)<span class="block text-xs text-slate-500">{{ s['note'] }}</span></span>
              <button type="button" class="btn-secondary py-1 text-xs" (click)="preremplir(s)">Préremplir le formulaire</button></li>
          }</ul></div>
      }
      <form class="card space-y-4 p-5" (ngSubmit)="enregistrerDeces()">
        <h2 class="card-title">Formulaire B — Décès</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label class="label" for="x-pers">Dossier AMI</label><input id="x-pers" name="pers" class="input" [(ngModel)]="x['personneNumero']"></div>
          <div><label class="label" for="x-date">Date du décès <span class="req">*</span></label><input id="x-date" name="date" type="date" class="input" [(ngModel)]="x['dateDeces']"></div>
          <div><label class="label" for="x-age">Âge (années)</label><input id="x-age" name="age" type="number" min="0" class="input" [(ngModel)]="x['ageAnnees']"></div>
          <div><label class="label" for="x-agej">ou âge (jours)</label><input id="x-agej" name="agej" type="number" min="0" class="input" [(ngModel)]="x['ageJours']"></div>
          <div><label class="label" for="x-sexe">Sexe <span class="req">*</span></label><select id="x-sexe" name="sexe" class="input" [(ngModel)]="x['sexe']">@for (s of epi.referentiel()?.sexes ?? []; track s) { <option>{{ s }}</option> }</select></div>
          <div><label class="label" for="x-lieu">Lieu du décès <span class="req">*</span></label><select id="x-lieu" name="lieu" class="input" [(ngModel)]="x['lieu']">@for (s of epi.referentiel()?.lieuxDeces ?? []; track s) { <option>{{ s }}</option> }</select></div>
          <div><label class="label" for="x-loc">Territoire <span class="req">*</span></label><select id="x-loc" name="loc" class="input" [(ngModel)]="x['entiteCode']">@for (e of epi.territoires(); track e.code) { <option [value]="e.code">{{ e.nom }} ({{ e.niveau }})</option> }</select></div>
          <div><label class="label" for="x-src">Source <span class="req">*</span></label><select id="x-src" name="src" class="input" [(ngModel)]="x['source']">@for (s of epi.referentiel()?.sourcesDeces ?? []; track s) { <option>{{ s }}</option> }</select></div>
          <div class="sm:col-span-2"><label class="label" for="x-cause">Cause initiale <span class="req">*</span></label><select id="x-cause" name="cause" class="input" [(ngModel)]="x['causeInitiale']">@for (s of epi.referentiel()?.causesDeces ?? []; track s) { <option>{{ s }}</option> }</select></div>
          @for (k of ['maternel', 'neonatal', 'infantile']; track k) {
            <div><label class="label" [for]="'x-' + k">Décès {{ k === 'neonatal' ? 'néonatal' : k }}</label><select [id]="'x-' + k" [name]="k" class="input" [(ngModel)]="x[k]">@for (s of epi.referentiel()?.ouiNonNd ?? []; track s) { <option>{{ s }}</option> }</select></div>
          }
        </div>
        <div class="flex justify-end"><button type="submit" class="btn-primary" [disabled]="envoi()">Enregistrer et soumettre</button></div>
      </form>
    }
    @case ('registres') {
      <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title">Cas de morbidité</h2></div>
        <table class="w-full min-w-[800px]"><thead><tr><th class="table-th">N°</th><th class="table-th">Diagnostic</th><th class="table-th">Service</th><th class="table-th">Âge / sexe</th><th class="table-th">Issue</th><th class="table-th">Validation</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (c of morbidites(); track c['id']) {
            <tr><td class="table-td font-mono text-xs">{{ c['numero'] }}<span class="block text-slate-500">{{ c['dateConsultation'] }}</span></td><td class="table-td">{{ c['libelleDiagnostic'] }}<span class="block text-xs text-slate-500">{{ c['categorie'] }}{{ c['transfertDe'] ? ' · transfert' : '' }}</span></td>
              <td class="table-td text-xs">{{ c['service'] }}</td><td class="table-td text-xs">{{ c['ageAnnees'] }} ans · {{ c['sexe'] }}</td><td class="table-td text-xs">{{ c['issue'] }}</td><td class="table-td"><app-epi-validation type="morbidite" [donnee]="c" (change)="chargerRegistres()" /></td></tr>
          } @empty { <tr><td colspan="6" class="table-td text-center text-slate-500">Aucun cas.</td></tr> }</tbody></table></div>
      <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title">Registre des décès</h2></div>
        <table class="w-full min-w-[800px]"><thead><tr><th class="table-th">N°</th><th class="table-th">Cause initiale</th><th class="table-th">Classification</th><th class="table-th">Âge / sexe</th><th class="table-th">Source</th><th class="table-th">Validation</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (c of deces(); track c['id']) {
            <tr><td class="table-td font-mono text-xs">{{ c['numero'] }}<span class="block text-slate-500">{{ c['dateDeces'] }}</span></td><td class="table-td">{{ c['causeInitiale'] }}</td>
              <td class="table-td text-xs">Maternel : {{ c['maternel'] }} · néonatal : {{ c['neonatal'] }} · infantile : {{ c['infantile'] }}</td><td class="table-td text-xs">{{ c['ageAnnees'] ?? (c['ageJours'] + ' j') }} · {{ c['sexe'] }}</td>
              <td class="table-td text-xs">{{ c['source'] }}</td><td class="table-td"><app-epi-validation type="deces" [donnee]="c" (change)="chargerRegistres()" /></td></tr>
          } @empty { <tr><td colspan="6" class="table-td text-center text-slate-500">Aucun décès enregistré.</td></tr> }</tbody></table></div>
    }
  }
</div>`,
})
export class MorbiMortaliteComponent {
  epi = inject(EpidemiologieService);
  readonly pct = pct;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'morbidite', libelle: 'Analyse de la morbidité', icone: 'fa-disease' },
    { id: 'mortalite', libelle: 'Analyse de la mortalité', icone: 'fa-cross' },
    { id: 'saisieMorbidite', libelle: 'Saisir un cas', icone: 'fa-notes-medical' },
    { id: 'saisieDeces', libelle: 'Saisir un décès', icone: 'fa-file-medical' },
    { id: 'registres', libelle: 'Registres et validation', icone: 'fa-list' },
  ];
  onglet = signal<Onglet>('morbidite');
  a = signal<Donnee | null>(null);
  morbidites = signal<Donnee[]>([]);
  deces = signal<Donnee[]>([]);
  signalements = signal<Donnee[]>([]);
  doublon = signal('');
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  unite = 1000;
  m: Donnee = {};
  x: Donnee = {};

  constructor() {
    effect(() => {
      this.epi.entite();
      this.epi.annee();
      untracked(() => { this.reinitialiser(); this.charger(); this.chargerRegistres(); });
    });
  }

  libelles = (l: Donnee[]) => l.map(v => v['libelle']);
  valeurs = (l: Donnee[]) => l.map(v => v['n'] as number);
  mois = (l: Donnee[]) => l.map(v => v['mois']);

  reinitialiser() {
    const auj = new Date().toISOString().slice(0, 10);
    const ent = this.epi.entite();
    this.m = { personneNumero: '', dateConsultation: auj, entiteCode: ent, service: 'Consultation externe', ageAnnees: null, sexe: 'Féminin', diagnostic: 'PALUDISME', classification: 'Confirmé', categorie: 'Générale', complication: '', issue: 'En cours', dateSortie: '', transfertDe: '' };
    this.x = { personneNumero: '', dateDeces: auj, ageAnnees: null, ageJours: null, sexe: 'Féminin', lieu: 'Structure sanitaire', entiteCode: ent, source: 'Registre', causeInitiale: 'Cause indéterminée', maternel: 'Non déterminé', neonatal: 'Non déterminé', infantile: 'Non déterminé', origineAmi: '' };
  }

  async charger() {
    this.erreur.set('');
    try {
      this.a.set(await this.epi.get('/morbi-mortalite/analyse', { dans: this.epi.entite(), annee: this.epi.annee(), unite: this.unite }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async chargerRegistres() {
    try {
      const filtre = { dans: this.epi.entite(), annee: this.epi.annee() };
      const [m, d, s] = await Promise.all([this.epi.get<Donnee[]>('/morbidite', filtre), this.epi.get<Donnee[]>('/deces', filtre), this.epi.get<Donnee[]>('/deces/signalements')]);
      this.morbidites.set(m);
      this.deces.set(d);
      this.signalements.set(s);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  preremplir(s: Donnee) {
    this.x = { ...this.x, personneNumero: s['personneNumero'], origineAmi: s['origineAmi'], sexe: s['sexe'], ageJours: s['ageJoursApprox'], ageAnnees: null,
      neonatal: s['neonatal'], infantile: s['infantile'], maternel: 'Non', entiteCode: s['entiteCode'] ?? this.x['entiteCode'], dateDeces: s['dateSignalement'], source: 'Notification' };
  }

  private nettoyer(o: Donnee): Donnee {
    const c: Donnee = {};
    for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) c[k] = v;
    return c;
  }

  private async envoyer(chemin: string, corps: Donnee, libelle: string) {
    this.envoi.set(true);
    this.erreur.set('');
    this.doublon.set('');
    try {
      const r = await this.epi.post(chemin, corps);
      this.message.set(`${libelle} ${r['numero']} enregistré et soumis pour validation.`);
      this.reinitialiser();
      await Promise.all([this.charger(), this.chargerRegistres()]);
    } catch (e) {
      const err = e as { status?: number; error?: { horsLigne?: boolean } };
      if (err.status === 409 && chemin === '/morbidite') this.doublon.set(messageErreur(e));
      else if (err.error?.horsLigne) this.message.set(messageErreur(e));
      else this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  enregistrerMorbidite(forcer = false) { return this.envoyer('/morbidite', { ...this.nettoyer(this.m), forcer }, 'Cas'); }
  enregistrerDeces() { return this.envoyer('/deces', this.nettoyer(this.x), 'Décès'); }
}
