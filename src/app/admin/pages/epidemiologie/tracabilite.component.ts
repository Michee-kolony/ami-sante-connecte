import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, couleurStatutDonnee, pct, type Donnee, type TypeDonnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'attente' | 'validees' | 'rejetees' | 'modifications' | 'journal' | 'calculs' | 'statistiques';

/**
 * Sous-fenêtre 10 — Historique, validation et traçabilité : qui a saisi ? qui a modifié ou validé ?
 * quelle était la valeur initiale et pourquoi a-t-elle changé ? File de validation commune à toutes
 * les données du module, journal des utilisateurs, historique des calculs et des rapports.
 */
@Component({
  selector: 'app-epi-tracabilite',
  standalone: true,
  imports: [DatePipe, FormsModule, JsonPipe, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
      @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="aller(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
    </div>
    <select class="input w-auto py-1.5" [(ngModel)]="type" (ngModelChange)="charger()" aria-label="Type de donnée">
      <option value="">Tous les types</option>@for (t of types; track t.code) { <option [value]="t.code">{{ t.libelle }}</option> }</select>
  </div>
  @if (epi.droits()?.separationSaisieValidation) { <p class="text-xs text-slate-500"><i class="fa-solid fa-user-shield"></i> Séparation des rôles : la personne qui saisit ou soumet une donnée ne peut pas la valider.</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @if (['attente', 'validees', 'rejetees'].includes(onglet())) {
    <div class="card overflow-x-auto"><table class="w-full min-w-[1000px]">
      <thead><tr><th class="table-th">Référence</th><th class="table-th">Type</th><th class="table-th">Donnée</th><th class="table-th">Territoire / période</th><th class="table-th">Auteur</th><th class="table-th">Soumission</th><th class="table-th">Contrôle</th><th class="table-th">Décision</th></tr></thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (l of lignes(); track l['type'] + l['id']) {
        <tr>
          <td class="table-td font-mono text-xs">{{ l['reference'] }}</td><td class="table-td text-xs">{{ l['libelleType'] }}</td>
          <td class="table-td text-sm">{{ l['resume'] }}</td><td class="table-td text-xs">{{ epi.nomEntite(l['territoire']) }}<span class="block text-slate-500">{{ l['periode'] }}</span></td>
          <td class="table-td text-xs">{{ l['auteur'] }}</td><td class="table-td text-xs">{{ l['soumisPar'] ?? '—' }}<span class="block text-slate-500">{{ l['soumisLe'] | date:'dd/MM/yyyy HH:mm' }}</span></td>
          <td class="table-td text-xs">@if (l['controle']; as c) {
              @if (c.conforme) { <span class="text-accent-700 dark:text-accent-300"><i class="fa-solid fa-check"></i> Conforme</span> }
              @for (b of c.bloquantes; track b) { <span class="block text-rose-700 dark:text-rose-300"><i class="fa-solid fa-ban"></i> {{ b }}</span> }
              @for (a of c.avertissements; track a) { <span class="block text-amber-700 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> {{ a }}</span> }
            } @else if (l['decision']) { {{ l['decision'].decision }} par {{ l['decision'].par?.nom }} le {{ l['decision'].le | date:'dd/MM/yyyy' }}@if (l['decision'].motif) { — {{ l['decision'].motif }} } }</td>
          <td class="table-td"><app-epi-validation [type]="l['type']" [donnee]="docDe(l)" (change)="charger()" />
            @if (l['statut'] === 'Soumis' && !l['peutValider'] && epi.droits()?.validation) { <span class="block text-xs text-slate-500">Vous avez saisi ou soumis cette donnée.</span> }</td>
        </tr>
      } @empty { <tr><td colspan="8" class="table-td text-center text-slate-500">Aucune donnée.</td></tr> }</tbody></table></div>
  }
  @if (onglet() === 'modifications') {
    <div class="card overflow-x-auto"><table class="w-full min-w-[1000px]">
      <thead><tr><th class="table-th">Date</th><th class="table-th">Utilisateur</th><th class="table-th">Donnée</th><th class="table-th">Opération</th><th class="table-th">Ancienne valeur</th><th class="table-th">Nouvelle valeur</th><th class="table-th">Motif</th></tr></thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (m of modifications(); track $index) {
        <tr><td class="table-td text-xs">{{ m['le'] | date:'dd/MM/yyyy HH:mm' }}</td><td class="table-td text-xs">{{ m['par']?.nom }}<span class="block text-slate-500">{{ m['par']?.role }}</span></td>
          <td class="table-td text-xs">{{ m['libelleType'] }} {{ m['reference'] }} (v{{ m['version'] }})</td><td class="table-td text-xs">{{ m['operation'] }}@if (m['ancienStatut'] && m['ancienStatut'] !== m['nouveauStatut']) { <span class="block text-slate-500">{{ m['ancienStatut'] }} → {{ m['nouveauStatut'] }}</span> }</td>
          <td class="table-td text-xs">@for (c of m['changements']; track c.champ) { <span class="block"><strong>{{ c.champ }}</strong> : {{ c.avant | json }}</span> }</td>
          <td class="table-td text-xs">@for (c of m['changements']; track c.champ) { <span class="block"><strong>{{ c.champ }}</strong> : {{ c.apres | json }}</span> }</td>
          <td class="table-td text-xs">{{ m['motif'] || '—' }}</td></tr>
      } @empty { <tr><td colspan="7" class="table-td text-center text-slate-500">Aucune modification sur les 90 derniers jours.</td></tr> }</tbody></table></div>
  }
  @if (onglet() === 'journal') {
    <div class="card overflow-x-auto"><table class="w-full min-w-[900px]">
      <thead><tr><th class="table-th">Date</th><th class="table-th">Utilisateur</th><th class="table-th">Opération</th><th class="table-th">Ressource</th><th class="table-th">Résultat</th></tr></thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (j of journal(); track j['id']) {
        <tr><td class="table-td text-xs">{{ j['le'] | date:'dd/MM/yyyy HH:mm:ss' }}</td><td class="table-td text-xs">{{ j['acteur']?.nom }}<span class="block text-slate-500">{{ j['acteur']?.role }} {{ j['acteur']?.matricule }}</span></td>
          <td class="table-td text-xs">{{ j['libelle'] }}</td><td class="table-td font-mono text-xs">{{ j['ressource']?.type }} {{ j['ressource']?.id }}</td>
          <td class="table-td text-xs"><span class="badge" [class]="j['resultat'] === 'refusé' ? couleur('Rejeté') : couleur('Validé')">{{ j['resultat'] }}</span></td></tr>
      }</tbody></table>
      <p class="px-5 py-3 text-xs text-slate-500">Le journal d’audit est en ajout seul : il ne peut être ni modifié ni supprimé. Sa consultation est elle-même journalisée.</p></div>
  }
  @if (onglet() === 'calculs') {
    @if (calculs(); as c) {
      <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title">Historique des calculs</h2></div><table class="w-full min-w-[900px]">
        <thead><tr><th class="table-th">Calcul</th><th class="table-th">Territoire / année</th><th class="table-th">Population</th><th class="table-th">Coefficients</th><th class="table-th">Par</th><th class="table-th">Statut</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (k of c['calculs']; track k.id) { <tr><td class="table-td font-mono text-xs">{{ k.numero }} v{{ k.version }}</td><td class="table-td text-xs">{{ epi.nomEntite(k.entiteCode) }} · {{ k.annee }}</td><td class="table-td text-xs">{{ k.population }}</td><td class="table-td text-xs">{{ k.coefficients }}</td><td class="table-td text-xs">{{ k.par }} · {{ k.le | date:'dd/MM/yyyy' }}</td><td class="table-td text-xs">{{ k.statut }}</td></tr> }</tbody></table></div>
      <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title">Traçabilité des rapports</h2></div><table class="w-full min-w-[900px]">
        <thead><tr><th class="table-th">Rapport</th><th class="table-th">Type</th><th class="table-th">Par</th><th class="table-th">Statut</th><th class="table-th">Exports</th><th class="table-th">Versions utilisées</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (r of c['rapports']; track r.numero) { <tr><td class="table-td font-mono text-xs">{{ r.numero }} v{{ r.version }}@if (r.regenereDe) { <span class="block text-slate-500">régénéré de {{ r.regenereDe }}</span> }</td><td class="table-td text-xs">{{ r.type }}</td><td class="table-td text-xs">{{ r.par }} · {{ r.le | date:'dd/MM/yyyy' }}</td>
          <td class="table-td text-xs">{{ r.statut }}{{ r.validePar ? ' — ' + r.validePar : '' }}</td><td class="table-td text-xs">{{ r.exports }}</td><td class="table-td max-w-xs truncate text-xs" [title]="r.versions | json">{{ r.versions | json }}</td></tr> }</tbody></table></div>
    }
  }
  @if (onglet() === 'statistiques') {
    @if (stats(); as s) {
      <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div class="card p-4"><p class="text-xs text-slate-500">Soumis</p><p class="text-2xl font-bold">{{ s['soumis'] }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-500">Validés</p><p class="text-2xl font-bold">{{ s['valides'] }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-500">Rejetés / à corriger</p><p class="text-2xl font-bold">{{ s['rejetes'] }}</p></div>
        <div class="card p-4" [title]="s['tauxValidation'].formule"><p class="text-xs text-slate-500">Taux de validation</p><p class="text-2xl font-bold">{{ pct(s['tauxValidation'].valeur) }}</p></div>
        <div class="card p-4" [title]="s['tauxRejet'].formule"><p class="text-xs text-slate-500">Taux de rejet</p><p class="text-2xl font-bold">{{ pct(s['tauxRejet'].valeur) }}</p></div>
        <div class="card p-4"><p class="text-xs text-slate-500">Délai moyen de validation</p><p class="text-2xl font-bold">{{ s['delaiMoyenValidationJours'] ?? '—' }} j</p></div>
      </div>
      <div class="grid gap-6 xl:grid-cols-2">
        <div class="card"><div class="card-header"><h2 class="card-title">Validations, rejets et corrections par mois</h2></div><div class="p-4">
          <app-epi-graphique [etiquettes]="col(s['parMois'], 'mois')" [series]="[{ libelle: 'Validés', valeurs: col(s['parMois'], 'valides') }, { libelle: 'Rejetés / à corriger', valeurs: col(s['parMois'], 'rejetes'), couleur: '#dc2626' }, { libelle: 'Corrections', valeurs: col(s['parMois'], 'corrections'), couleur: '#d97706' }]" /></div></div>
        <div class="card"><div class="card-header"><h2 class="card-title">Enregistrements rejetés par structure</h2></div><div class="p-4">
          <app-epi-graphique [horizontal]="true" [etiquettes]="col(s['rejetsParStructure'], 'structure')" [series]="[{ libelle: 'Rejets', valeurs: col(s['rejetsParStructure'], 'n'), couleur: '#dc2626' }]" /></div></div>
        <div class="card"><div class="card-header"><h2 class="card-title">Activité des utilisateurs autorisés</h2></div><div class="p-4">
          <app-epi-graphique [horizontal]="true" [etiquettes]="col(s['activite'], 'nom')" [series]="[{ libelle: 'Opérations', valeurs: col(s['activite'], 'n') }]" /></div></div>
        <div class="card"><div class="card-header"><h2 class="card-title">Répartition des erreurs détectées (motifs)</h2></div><div class="p-4">
          <app-epi-graphique type="doughnut" [etiquettes]="col(s['erreurs'], 'motif')" [series]="[{ libelle: 'Erreurs', valeurs: col(s['erreurs'], 'n') }]" /></div></div>
      </div>
      <div class="card overflow-x-auto"><table class="w-full"><thead><tr><th class="table-th">Type de données</th><th class="table-th text-right">Soumis</th><th class="table-th text-right">Validés</th><th class="table-th text-right">Rejetés</th><th class="table-th text-right">Taux de validation</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (t of s['parType']; track t.type) { <tr><td class="table-td">{{ t.libelle }}</td><td class="table-td text-right">{{ t.soumis }}</td><td class="table-td text-right">{{ t.valides }}</td><td class="table-td text-right">{{ t.rejetes }}</td><td class="table-td text-right">{{ pct(t.tauxValidation) }}</td></tr> }</tbody></table></div>
    }
  }
</div>`,
})
export class TracabiliteComponent implements OnInit {
  epi = inject(EpidemiologieService);
  readonly pct = pct;
  readonly couleur = couleurStatutDonnee;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'attente', libelle: 'En attente de validation', icone: 'fa-hourglass-half' },
    { id: 'validees', libelle: 'Validées', icone: 'fa-circle-check' },
    { id: 'rejetees', libelle: 'Rejetées ou à corriger', icone: 'fa-circle-xmark' },
    { id: 'modifications', libelle: 'Historique des modifications', icone: 'fa-pen-ruler' },
    { id: 'journal', libelle: 'Journal des utilisateurs', icone: 'fa-user-clock' },
    { id: 'calculs', libelle: 'Calculs et rapports', icone: 'fa-calculator' },
    { id: 'statistiques', libelle: 'Statistiques', icone: 'fa-chart-column' },
  ];
  readonly types: { code: TypeDonnee; libelle: string }[] = [
    { code: 'population', libelle: 'Populations' }, { code: 'coefficient', libelle: 'Coefficients' }, { code: 'calcul', libelle: 'Calculs des cibles' },
    { code: 'plan', libelle: 'Plans' }, { code: 'indicateur', libelle: 'Indicateurs' }, { code: 'evenement', libelle: 'Événements' },
    { code: 'cas', libelle: 'Cas de surveillance' }, { code: 'morbidite', libelle: 'Morbidité' }, { code: 'deces', libelle: 'Décès' },
  ];
  onglet = signal<Onglet>('attente');
  lignes = signal<Donnee[]>([]);
  modifications = signal<Donnee[]>([]);
  journal = signal<Donnee[]>([]);
  calculs = signal<Donnee | null>(null);
  stats = signal<Donnee | null>(null);
  erreur = signal('');
  type = '';

  ngOnInit() { this.charger(); }

  aller(o: Onglet) {
    this.onglet.set(o);
    this.charger();
  }

  col = (l: Donnee[], k: string) => (l ?? []).map(x => x[k]);
  /** Ligne de la file → objet attendu par la barre de validation (id, statut, version, décision). */
  docDe = (l: Donnee): Donnee => ({ id: l['id'], statut: l['statut'], version: l['version'], decision: l['decision'] });

  async charger() {
    this.erreur.set('');
    const f = { type: this.type };
    try {
      switch (this.onglet()) {
        case 'attente': this.lignes.set(await this.epi.get<Donnee[]>('/validation/en-attente', f)); break;
        case 'validees': this.lignes.set(await this.epi.get<Donnee[]>('/validation/validees', f)); break;
        case 'rejetees': this.lignes.set(await this.epi.get<Donnee[]>('/validation/rejetees', f)); break;
        case 'modifications': this.modifications.set(await this.epi.get<Donnee[]>('/historique/modifications', f)); break;
        case 'journal': this.journal.set(await this.epi.get<Donnee[]>('/historique/journal')); break;
        case 'calculs': this.calculs.set(await this.epi.get('/historique/calculs-rapports')); break;
        case 'statistiques': this.stats.set(await this.epi.get('/validation/statistiques', { annee: this.epi.annee() })); break;
      }
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
