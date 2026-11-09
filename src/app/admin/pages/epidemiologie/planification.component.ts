import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'plans' | 'nouveau' | 'suivi' | 'structures';
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Sous-fenêtre 4 — Planification et répartition : cible annuelle (calcul validé ou ajustement
 * justifié), répartition mensuelle et trimestrielle (somme = cible annuelle), répartition
 * géographique, suivi des réalisations (modules AMI), réajustement et validation du plan.
 */
@Component({
  selector: 'app-epi-planification',
  standalone: true,
  imports: [DecimalPipe, FormsModule, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('plans') {
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[1000px]">
          <thead><tr><th class="table-th">Plan</th><th class="table-th">Intervention</th><th class="table-th">Territoire</th><th class="table-th text-right">Cible annuelle</th><th class="table-th">T1 · T2 · T3 · T4</th><th class="table-th">Cible</th><th class="table-th">Statut</th><th class="table-th"></th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (p of plans(); track p['id']) {
              <tr>
                <td class="table-td font-mono text-xs">{{ p['numero'] }}<span class="block text-slate-500">{{ p['responsable'] }}</span></td>
                <td class="table-td">{{ p['libelleIntervention'] }}</td>
                <td class="table-td">{{ p['territoire'] }}</td>
                <td class="table-td text-right font-semibold tabular-nums">{{ p['cibleAnnuelle'] | number:'1.0-0':'fr' }}</td>
                <td class="table-td text-xs tabular-nums">{{ p['trimestriel'].join(' · ') }}</td>
                <td class="table-td text-xs">@if (p['ajustee']) { <span class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Révisée</span><span class="block text-slate-500">{{ p['justification'] }}</span> } @else { Planifiée (calcul {{ p['calcul']?.numero }}) }</td>
                <td class="table-td"><app-epi-validation type="plan" [donnee]="p" (change)="charger()" /></td>
                <td class="table-td whitespace-nowrap">
                  <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="suivre(p)"><i class="fa-solid fa-chart-line"></i> Suivi</button>
                  @if (epi.droits()?.planification && !['Soumis', 'Archivé'].includes(p['statut'])) { <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="editer(p)"><i class="fa-solid fa-pen"></i> Réajuster</button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="8" class="table-td text-center text-slate-500">Aucun plan pour ce territoire et cette année.</td></tr> }
          </tbody>
        </table>
      </div>
    }

    @case ('nouveau') {
      <form class="card space-y-4 p-5" (ngSubmit)="enregistrer()">
        <h2 class="card-title">{{ f['id'] ? 'Réajustement du plan ' + f['numero'] + (f['statut'] === 'Validé' ? ' (nouvelle version)' : '') : 'Nouveau plan — ' + epi.nomEntite(epi.entite()) + ', ' + epi.annee() }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label class="label" for="p-int">Intervention <span class="req">*</span></label>
            <select id="p-int" name="int" class="input" [(ngModel)]="f['intervention']" [disabled]="!!f['id']">@for (i of epi.referentiel()?.interventions ?? []; track i.code) { <option [value]="i.code">{{ i.libelle }} (cible {{ i.cible }})</option> }</select></div>
          <div><label class="label" for="p-cib">Cible annuelle (vide : calcul validé)</label><input id="p-cib" name="cib" type="number" min="0" class="input" [(ngModel)]="f['cibleAnnuelle']" (ngModelChange)="repartir()"></div>
          <div><label class="label" for="p-rep">Répartition</label><select id="p-rep" name="rep" class="input" [(ngModel)]="f['repartition']" (ngModelChange)="repartir()"><option>Uniforme</option><option>Personnalisée</option></select></div>
          <div><label class="label" for="p-resp">Responsable de l’exécution</label><input id="p-resp" name="resp" class="input" [(ngModel)]="f['responsable']"></div>
        </div>
        @if (f['repartition'] === 'Personnalisée') {
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            @for (m of mois; track $index) { <div><label class="label text-xs" [for]="'m' + $index">{{ m }}</label><input [id]="'m' + $index" [name]="'m' + $index" type="number" min="0" class="input px-2" [(ngModel)]="f['mensuel'][$index]"></div> }
          </div>
          <p class="hint" [class.text-rose-600]="sommeMensuelle() !== +(f['cibleAnnuelle'] ?? 0) && f['cibleAnnuelle'] != null">Somme des objectifs mensuels : {{ sommeMensuelle() }} @if (f['cibleAnnuelle'] != null) { / {{ f['cibleAnnuelle'] }} }</p>
        }
        <div><label class="label" for="p-just">Justification (cible ajustée, saisonnalité, campagnes, capacités…)</label><textarea id="p-just" name="just" rows="2" class="input" [(ngModel)]="f['justification']"></textarea></div>
        @if (f['id']) {
          <div><p class="label">Répartition géographique entre les entités du niveau inférieur</p>
            <button type="button" class="btn-secondary py-1.5 text-xs" (click)="proposer()"><i class="fa-solid fa-wand-magic-sparkles"></i> Proposer selon les cibles calculées</button>
            @if (f['geographique']?.length) {
              <div class="mt-2 grid gap-2 sm:grid-cols-3">@for (g of f['geographique']; track g.entiteCode) { <div><label class="label text-xs" [for]="'g' + g.entiteCode">{{ g.nom }}</label><input [id]="'g' + g.entiteCode" [name]="'g' + g.entiteCode" type="number" min="0" class="input" [(ngModel)]="g.cible"></div> }</div>
              <p class="hint">Somme : {{ sommeGeo() }} / {{ f['cibleAnnuelle'] }}</p>
            }
          </div>
          @if (f['statut'] === 'Validé') { <div><label class="label" for="p-mot">Motif du réajustement <span class="req">*</span></label><input id="p-mot" name="mot" class="input" [(ngModel)]="f['motif']"></div> }
        }
        <div class="flex justify-end gap-2"><button type="button" class="btn-ghost" (click)="nouveau()">Réinitialiser</button><button type="submit" class="btn-primary" [disabled]="envoi() || !epi.droits()?.planification">Enregistrer</button></div>
      </form>
    }

    @case ('suivi') {
      @if (suivi(); as s) {
        @if (s['restreint']) { <p class="text-sm text-sky-700 dark:text-sky-300"><i class="fa-solid fa-circle-info"></i> Réalisations limitées à votre structure de connexion.</p> }
        <div class="grid gap-3 sm:grid-cols-4">
          <div class="card p-4"><p class="text-xs text-slate-500">Cible annuelle</p><p class="text-2xl font-bold">{{ s['plan'].cibleAnnuelle | number:'1.0-0':'fr' }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">Réalisations cumulées</p><p class="text-2xl font-bold">{{ s['realisationsCumulees'] | number:'1.0-0':'fr' }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">Taux annuel</p><p class="text-2xl font-bold">{{ pct(s['tauxAnnuel']) }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">Cible restante</p><p class="text-2xl font-bold">{{ s['cibleRestante'] | number:'1.0-0':'fr' }}</p></div>
        </div>
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Cible / réalisation par mois — {{ s['plan'].numero }}</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="mois" [series]="[{ libelle: 'Objectif mensuel', valeurs: colonne(s['mois'], 'cible'), couleur: '#94a3b8' }, { libelle: 'Réalisations', valeurs: colonne(s['mois'], 'realisations') }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Progression annuelle cumulée</h2></div><div class="p-4">
            <app-epi-graphique type="line" [etiquettes]="mois" [series]="[{ libelle: 'Cible cumulée', valeurs: colonne(s['mois'], 'cumulCible'), couleur: '#94a3b8' }, { libelle: 'Réalisations cumulées', valeurs: colonne(s['mois'], 'cumulRealisations') }]" /></div></div>
        </div>
        <div class="card overflow-x-auto"><table class="w-full min-w-[700px]">
          <thead><tr><th class="table-th">Mois</th><th class="table-th text-right">Cible</th><th class="table-th text-right">Réalisations</th><th class="table-th text-right">Taux</th><th class="table-th text-right">Écart</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (m of s['mois']; track m.mois) { <tr><td class="table-td">{{ m.mois }}</td><td class="table-td text-right">{{ m.cible }}</td><td class="table-td text-right">{{ m.realisations ?? '—' }}</td><td class="table-td text-right">{{ m.realisations == null ? '—' : pct(m.taux) }}</td><td class="table-td text-right">{{ m.ecart ?? '—' }}</td></tr> }
            @for (t of s['trimestres']; track t.trimestre) { <tr class="bg-slate-50/60 font-medium dark:bg-slate-800/40"><td class="table-td">{{ t.trimestre }}</td><td class="table-td text-right">{{ t.cible }}</td><td class="table-td text-right">{{ t.realisations ?? '—' }}</td><td class="table-td text-right">{{ t.realisations == null ? '—' : pct(t.taux) }}</td><td class="table-td"></td></tr> }</tbody></table>
          <p class="px-5 py-3 text-xs text-slate-500">{{ s['formule'] }} Une cible n’est jamais une réalisation.</p></div>
      } @else { <p class="text-sm text-slate-500">Choisissez un plan dans l’onglet « Plans » (bouton Suivi).</p> }
    }

    @case ('structures') {
      <div class="flex flex-wrap items-end gap-3">
        <div><label class="label text-xs" for="t-int">Intervention</label><select id="t-int" class="input py-2" [(ngModel)]="intervention" (ngModelChange)="chargerTableau()">@for (i of epi.referentiel()?.interventions ?? []; track i.code) { <option [value]="i.code">{{ i.libelle }}</option> }</select></div>
        <div><label class="label text-xs" for="t-mois">Mois</label><input id="t-mois" type="month" class="input py-2" [(ngModel)]="moisTableau" (ngModelChange)="chargerTableau()"></div>
      </div>
      <div class="card overflow-x-auto"><table class="w-full min-w-[760px]">
        <thead><tr><th class="table-th">Structure / entité</th><th class="table-th text-right">Cible annuelle</th><th class="table-th text-right">Cible mensuelle</th><th class="table-th text-right">Réalisations</th><th class="table-th text-right">Taux</th><th class="table-th">Statut du plan</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (l of tableau()?.['lignes'] ?? []; track l.planId) {
          <tr><td class="table-td">{{ l.nom }}<span class="block text-xs text-slate-500">{{ l.niveau }}</span></td><td class="table-td text-right">{{ l.cibleAnnuelle }}</td><td class="table-td text-right">{{ l.cibleMensuelle }}</td><td class="table-td text-right">{{ l.realisations }}</td><td class="table-td text-right font-semibold">{{ pct(l.taux) }}</td><td class="table-td text-xs">{{ l.statut }}</td></tr>
        } @empty { <tr><td colspan="6" class="table-td text-center text-slate-500">Aucun plan pour cette intervention dans le territoire.</td></tr> }</tbody></table></div>
      @if (tableau()?.['lignes']?.length) {
        <div class="card"><div class="card-header"><h2 class="card-title">Comparaison des structures (taux de réalisation du mois)</h2></div><div class="p-4">
          <app-epi-graphique [pourcent]="true" [horizontal]="true" [etiquettes]="nomsTableau()" [series]="[{ libelle: 'Taux de réalisation', valeurs: tauxTableau() }]" /></div></div>
      }
    }
  }
</div>`,
})
export class PlanificationComponent {
  epi = inject(EpidemiologieService);
  readonly pct = pct;
  readonly mois = MOIS;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'plans', libelle: 'Plans et validation', icone: 'fa-list-check' },
    { id: 'nouveau', libelle: 'Planifier / réajuster', icone: 'fa-pen-to-square' },
    { id: 'suivi', libelle: 'Suivi des réalisations', icone: 'fa-chart-line' },
    { id: 'structures', libelle: 'Comparaison des structures', icone: 'fa-hospital' },
  ];
  onglet = signal<Onglet>('plans');
  plans = signal<Donnee[]>([]);
  suivi = signal<Donnee | null>(null);
  tableau = signal<Donnee | null>(null);
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  f: Donnee = {};
  intervention = 'CPN1';
  moisTableau = new Date().toISOString().slice(0, 7);
  nomsTableau = computed(() => (this.tableau()?.['lignes'] ?? []).map((l: Donnee) => l['nom']));
  tauxTableau = computed(() => (this.tableau()?.['lignes'] ?? []).map((l: Donnee) => l['taux']));

  constructor() {
    this.nouveau();
    effect(() => {
      this.epi.entite();
      this.epi.annee();
      untracked(() => { this.charger(); this.chargerTableau(); });
    });
  }

  colonne = (l: Donnee[], k: string) => l.map(x => x[k] as number | null);
  sommeMensuelle = () => (this.f['mensuel'] as number[]).reduce((s, x) => s + (+x || 0), 0);
  sommeGeo = () => (this.f['geographique'] as Donnee[] ?? []).reduce((s, x) => s + (+x['cible'] || 0), 0);

  nouveau() {
    this.f = { intervention: 'CPN1', cibleAnnuelle: null, repartition: 'Uniforme', mensuel: Array(12).fill(0), responsable: '', justification: '', geographique: [] };
  }

  repartir() {
    if (this.f['repartition'] !== 'Uniforme' || this.f['cibleAnnuelle'] == null) return;
    const total = +this.f['cibleAnnuelle'];
    const base = Math.floor(total / 12);
    this.f['mensuel'] = Array.from({ length: 12 }, (_, i) => base + (i < total - base * 12 ? 1 : 0));
  }

  editer(p: Donnee) {
    this.f = { ...p, mensuel: [...p['mensuel']], geographique: (p['geographique'] ?? []).map((g: Donnee) => ({ ...g })), motif: '' };
    this.onglet.set('nouveau');
  }

  async charger() {
    this.erreur.set('');
    try {
      this.plans.set(await this.epi.get<Donnee[]>('/plans', { dans: this.epi.entite(), annee: this.epi.annee() }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async chargerTableau() {
    try {
      this.tableau.set(await this.epi.get('/plans/tableau', { entite: this.epi.entite(), annee: this.epi.annee(), intervention: this.intervention, mois: this.moisTableau }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async suivre(p: Donnee) {
    try {
      this.suivi.set(await this.epi.get(`/plans/${p['id']}/suivi`));
      this.onglet.set('suivi');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async proposer() {
    try {
      const r = await this.epi.get(`/plans/${this.f['id']}/proposition-geographique`);
      this.f['geographique'] = r['lignes'].map((l: Donnee) => ({ entiteCode: l['entiteCode'], nom: l['nom'], cible: l['cible'] ?? 0 }));
      if (r['ecart']) this.message.set(`Somme des cibles calculées : ${r['somme']} (écart de ${r['ecart']} avec l’objectif) : ajustez et justifiez.`);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async enregistrer() {
    this.envoi.set(true);
    this.erreur.set('');
    const corps: Donnee = {
      cibleAnnuelle: this.f['cibleAnnuelle'] === '' ? null : this.f['cibleAnnuelle'], repartition: this.f['repartition'], responsable: this.f['responsable'], justification: this.f['justification'],
      ...(this.f['repartition'] === 'Personnalisée' ? { mensuel: (this.f['mensuel'] as number[]).map(x => +x || 0) } : {}),
    };
    try {
      let p: Donnee;
      if (this.f['id']) {
        if (this.f['cibleAnnuelle'] == null) delete corps['cibleAnnuelle'];
        p = await this.epi.patch(`/plans/${this.f['id']}`, { ...corps, geographique: (this.f['geographique'] ?? []).map((g: Donnee) => ({ entiteCode: g['entiteCode'], cible: +g['cible'] || 0 })), motif: this.f['motif'] });
      } else {
        p = await this.epi.post('/plans', { ...corps, intervention: this.f['intervention'], entiteCode: this.epi.entite(), annee: this.epi.annee() });
      }
      this.message.set(`Plan ${p['numero']} v${p['version']} enregistré (${p['statut']}) : cible ${p['cibleAnnuelle']}.`);
      this.nouveau();
      this.onglet.set('plans');
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
