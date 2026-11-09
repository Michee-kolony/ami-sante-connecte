import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'calcul' | 'resultats' | 'simulation' | 'graphiques';

/**
 * Sous-fenêtre 3 — Calcul des populations cibles : population de référence validée × coefficient
 * validé applicable. Formule, valeurs et versions affichées ; comparaison avec l'année
 * précédente ; simulation sans enregistrement ; validation des cibles.
 */
@Component({
  selector: 'app-epi-cibles',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('calcul') {
      <div class="card space-y-4 p-5">
        <h2 class="card-title"><i class="fa-solid fa-calculator text-brand-600"></i> Lancer le calcul automatique — {{ epi.nomEntite(epi.entite()) }}, {{ epi.annee() }}</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">Le calcul utilise la population de référence <strong>validée</strong> de chaque entité et les coefficients <strong>validés</strong> applicables à son territoire et à l’année
          (le plus précis : entité, puis province, puis national). Arrondi : {{ epi.referentiel()?.arrondi }}.</p>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="descendants"> Calculer aussi toutes les entités du niveau inférieur</label>
        <button type="button" class="btn-primary" [disabled]="envoi() || !epi.droits()?.planification" (click)="lancer()"><i class="fa-solid fa-play"></i> Calculer</button>
        @if (bilan(); as b) {
          <p class="text-sm">{{ b['calcules'] }} calcul(s) créé(s), {{ b['reutilises'] }} réutilisé(s) (mêmes données et paramètres).</p>
          <ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            @for (x of b['resultats']; track x.entiteCode) {
              <li class="py-2">{{ x.nom }} — @if (x.erreur) { <span class="text-amber-700 dark:text-amber-300">{{ x.erreur }}</span> } @else { {{ x.calcul.numero }} v{{ x.calcul.version }} : @for (r of x.calcul.resultats; track r.cible) { <span class="mr-2">{{ r.cible }} {{ r.valeur | number:'1.0-0':'fr' }}</span> } }</li>
            }
          </ul>
        }
      </div>
    }

    @case ('resultats') {
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[1000px]">
          <thead><tr><th class="table-th">Calcul</th><th class="table-th">Territoire</th><th class="table-th text-right">Population totale</th>
            @for (k of cles(); track k) { <th class="table-th text-right">{{ epi.referentiel()?.cibles?.[k] }}</th> }<th class="table-th">Statut</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (c of calculs(); track c['id']) {
              <tr class="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40" (click)="ouvrir(c)">
                <td class="table-td font-mono text-xs">{{ c['numero'] }}<span class="block text-slate-500">{{ c['createdAt'] | date:'dd/MM/yyyy HH:mm' }} · {{ c['creePar']?.nom }}</span></td>
                <td class="table-td">{{ c['territoire'] }}<span class="block text-xs text-slate-500">{{ c['niveau'] }} · population v{{ c['population']?.version }} ({{ c['population']?.nature }})</span></td>
                <td class="table-td text-right tabular-nums">{{ c['population']?.totale | number:'1.0-0':'fr' }}</td>
                @for (k of cles(); track k) { <td class="table-td text-right tabular-nums">{{ valeur(c, k) | number:'1.0-0':'fr' }}</td> }
                <td class="table-td" (click)="$event.stopPropagation()"><app-epi-validation type="calcul" [donnee]="c" (change)="charger()" /></td>
              </tr>
            } @empty { <tr><td colspan="7" class="table-td text-center text-slate-500">Aucun calcul pour ce territoire et cette année.</td></tr> }
          </tbody>
        </table>
      </div>
      @if (detail(); as d) {
        <div class="card p-5 text-sm">
          <div class="mb-3 flex items-center justify-between"><h3 class="card-title">{{ d['numero'] }} — v{{ d['version'] }} — {{ epi.nomEntite(d['entiteCode']) }} {{ d['annee'] }}</h3><button type="button" class="btn-ghost px-2" (click)="detail.set(null)"><i class="fa-solid fa-xmark"></i></button></div>
          <ul class="space-y-1">@for (r of d['resultats']; track r.cible) { <li><strong>{{ r.libelle }}</strong> : {{ r.formule }} = <strong>{{ r.valeur | number:'1.0-0':'fr' }}</strong> <span class="text-xs text-slate-500">(brut {{ r.valeurBrute }}, coefficient {{ r.coefficientCode }} v{{ r.coefficientVersion }})</span></li> }</ul>
          @if (d['manquantes'].length) { <p class="mt-2 text-amber-700 dark:text-amber-300">Cibles non calculées (coefficient validé absent) : {{ d['manquantes'].join(', ') }}</p> }
          <h4 class="mt-4 font-semibold">Comparaison avec l’année précédente</h4>
          <table class="mt-1 w-full"><thead><tr><th class="table-th">Cible</th><th class="table-th text-right">{{ d['annee'] - 1 }}</th><th class="table-th text-right">{{ d['annee'] }}</th><th class="table-th text-right">Écart</th><th class="table-th text-right">Variation</th></tr></thead>
            <tbody>@for (x of d['comparaison']; track x.cible) { <tr><td class="table-td">{{ x.cible }}</td><td class="table-td text-right">{{ x.precedente ?? '—' }}</td><td class="table-td text-right">{{ x.actuelle ?? '—' }}</td><td class="table-td text-right">{{ x.ecart ?? '—' }}</td><td class="table-td text-right">{{ x.variation == null ? 'Non calculable' : pct(x.variation) }}</td></tr> }</tbody></table>
          @if (d['parAge']?.length) { <h4 class="mt-4 font-semibold">Populations par âge et par sexe (référentiel)</h4>
            <p class="text-xs text-slate-600 dark:text-slate-300">@for (a of d['parAge']; track a.code) { <span class="mr-3">{{ a.libelle }} : {{ a.effectif | number:'1.0-0':'fr' }}</span> }</p> }
          <h4 class="mt-4 font-semibold">Versions du calcul</h4>
          <ul class="text-xs">@for (v of d['versions']; track v.id) { <li>v{{ v.version }} — {{ v.statut }} — {{ v.le | date:'dd/MM/yyyy HH:mm' }} — {{ v.par }} — population v{{ v.population?.version }}</li> }</ul>
        </div>
      }
    }

    @case ('simulation') {
      <form class="card space-y-4 p-5" (ngSubmit)="simuler()">
        <h2 class="card-title"><i class="fa-solid fa-flask text-brand-600"></i> Simulation et recalcul (aucun enregistrement)</h2>
        <div class="grid gap-3 sm:grid-cols-4">
          <div><label class="label" for="s-pop">Population totale</label><input id="s-pop" name="pop" type="number" min="0" class="input" [(ngModel)]="sim['populationTotale']" required></div>
          @for (k of cles(); track k) { <div><label class="label" [for]="'s-' + k">{{ k }} (%) — vide : coefficient validé</label><input [id]="'s-' + k" [name]="'s-' + k" type="number" step="0.01" class="input" [(ngModel)]="sim['coefficients'][k]"></div> }
        </div>
        <button type="submit" class="btn-primary"><i class="fa-solid fa-calculator"></i> Simuler</button>
        @if (simulation(); as s) {
          <table class="w-full"><thead><tr><th class="table-th">Population cible</th><th class="table-th">Formule</th><th class="table-th text-right">Résultat</th></tr></thead>
            <tbody>@for (r of s['resultats']; track r.cible) { <tr><td class="table-td">{{ r.libelle }}</td><td class="table-td text-xs">{{ r.formule }}</td><td class="table-td text-right font-semibold">{{ r.valeur | number:'1.0-0':'fr' }}</td></tr> }</tbody></table>
          @if (s['manquantes'].length) { <p class="text-sm text-amber-700 dark:text-amber-300">Sans coefficient : {{ s['manquantes'].join(', ') }}</p> }
        }
      </form>
    }

    @case ('graphiques') {
      @if (synthese(); as sy) {
        <p class="text-sm text-slate-500"><i class="fa-solid fa-circle-info"></i> {{ sy['note'] }}</p>
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Comparaison des cibles par entité ({{ sy['entite'].nom }})</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="noms(sy['parEntite'])" [series]="seriesEntites(sy['parEntite'])" [hauteur]="300" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Évolution des cibles sur plusieurs années</h2></div><div class="p-4">
            <app-epi-graphique type="line" [etiquettes]="anneesEv(sy['evolution'])" [series]="seriesEvolution(sy['evolution'])" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Répartition des populations cibles par catégorie</h2></div><div class="p-4">
            <app-epi-graphique type="pie" [etiquettes]="libellesCourant(sy['courant'])" [series]="[{ libelle: 'Cible', valeurs: valeursCourant(sy['courant']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Écart avec la cible de l’année précédente</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="cibleComp(sy['courant'])" [series]="[{ libelle: 'Année précédente', valeurs: comp(sy['courant'], 'precedente') }, { libelle: 'Année en cours', valeurs: comp(sy['courant'], 'actuelle') }]" /></div></div>
        </div>
      }
    }
  }
</div>`,
})
export class CiblesComponent {
  epi = inject(EpidemiologieService);
  readonly pct = pct;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'calcul', libelle: 'Calcul automatique', icone: 'fa-play' },
    { id: 'resultats', libelle: 'Résultats, comparaison et validation', icone: 'fa-table' },
    { id: 'simulation', libelle: 'Simulation', icone: 'fa-flask' },
    { id: 'graphiques', libelle: 'Graphiques', icone: 'fa-chart-column' },
  ];
  onglet = signal<Onglet>('resultats');
  calculs = signal<Donnee[]>([]);
  detail = signal<Donnee | null>(null);
  bilan = signal<Donnee | null>(null);
  simulation = signal<Donnee | null>(null);
  synthese = signal<Donnee | null>(null);
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  descendants = false;
  sim: Donnee = { populationTotale: 100000, coefficients: {} };

  constructor() {
    effect(() => {
      this.epi.entite();
      this.epi.annee();
      untracked(() => this.charger());
    });
  }

  cles = () => Object.keys(this.epi.referentiel()?.cibles ?? {});
  valeur = (c: Donnee, k: string) => c['resultats'].find((r: Donnee) => r['cible'] === k)?.valeur ?? null;

  async charger() {
    this.erreur.set('');
    try {
      const [l, s] = await Promise.all([
        this.epi.get<Donnee[]>('/cibles', { dans: this.epi.entite(), annee: this.epi.annee() }),
        this.epi.get('/cibles/synthese', { entite: this.epi.entite(), annee: this.epi.annee() }),
      ]);
      this.calculs.set(l);
      this.synthese.set(s);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async ouvrir(c: Donnee) {
    try { this.detail.set(await this.epi.get(`/cibles/${c['id']}`)); } catch (e) { this.erreur.set(messageErreur(e)); }
  }

  async lancer() {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      this.bilan.set(await this.epi.post('/cibles/calcul', { entiteCode: this.epi.entite(), annee: this.epi.annee(), inclureDescendants: this.descendants }));
      this.message.set('Calcul terminé : soumettez les résultats pour validation (onglet Résultats).');
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  async simuler() {
    try {
      this.simulation.set(await this.epi.post('/cibles/simulation', { ...this.sim, entiteCode: this.epi.entite(), annee: this.epi.annee() }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  noms = (l: Donnee[]) => l.map(x => x['nom']);
  seriesEntites = (l: Donnee[]) => this.cles().map(k => ({ libelle: k, valeurs: l.map(x => x[k] as number | null) }));
  anneesEv = (l: Donnee[]) => l.map(x => String(x['annee']));
  seriesEvolution = (l: Donnee[]) => this.cles().map(k => ({ libelle: k, valeurs: l.map(x => x[k] as number | null) }));
  libellesCourant = (c: Donnee | null) => (c?.['resultats'] ?? []).map((r: Donnee) => r['libelle']);
  valeursCourant = (c: Donnee | null) => (c?.['resultats'] ?? []).map((r: Donnee) => r['valeur'] as number);
  cibleComp = (c: Donnee | null) => (c?.['comparaison'] ?? []).map((r: Donnee) => r['cible']);
  comp = (c: Donnee | null, k: string) => (c?.['comparaison'] ?? []).map((r: Donnee) => r[k] as number | null);
}
