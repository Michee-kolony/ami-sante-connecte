import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, couleurStatutDonnee, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';

/** Vue générale : chiffres clés des dix sous-fenêtres et avancement du socle démographique. */
@Component({
  selector: 'app-epi-vue-generale',
  standalone: true,
  imports: [DecimalPipe, RouterLink, EpiGraphiqueComponent],
  template: `
@if (erreur()) { <p class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }
@if (t(); as d) {
  <div class="space-y-6">
    @if (d['restreint']) {
      <p class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
        <i class="fa-solid fa-circle-info"></i> Réalisations limitées à votre structure de connexion (consolidation réservée au médecin chef de service et au médecin directeur).</p>
    }
    <!-- Avancement du socle (recommandation : étapes 1 à 4) -->
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      @for (e of d['etapes']; track e.libelle) {
        <a [routerLink]="e.lien" class="card flex items-start gap-3 p-4 transition hover:-translate-y-0.5">
          <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full" [class]="e.ok ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">
            <i class="fa-solid" [class]="e.ok ? 'fa-check' : 'fa-hourglass-half'"></i></span>
          <span class="min-w-0"><span class="block text-sm font-semibold text-slate-900 dark:text-white">{{ e.libelle }}</span><span class="block truncate text-xs text-slate-500">{{ e.detail }}</span></span>
        </a>
      }
    </div>

    <!-- Chiffres clés -->
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card p-4"><p class="text-xs font-medium text-slate-500">Population de référence {{ d['annee'] }}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ d['population'] ? (d['population'].totale | number:'1.0-0':'fr') : '—' }}</p>
        @if (d['population']) { <span class="badge mt-1" [class]="couleur(d['population'].statut)">{{ d['population'].statut }} · v{{ d['population'].version }}</span> }</div>
      @for (c of d['cibles']; track c.cible) {
        <div class="card p-4"><p class="text-xs font-medium text-slate-500">{{ c.libelle }}</p><p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ c.valeur | number:'1.0-0':'fr' }}</p><p class="text-xs text-slate-400">Cible annuelle validée (estimée)</p></div>
      }
      @if (!d['cibles'].length) { <div class="card p-4 text-sm text-slate-500 sm:col-span-1 xl:col-span-3"><i class="fa-solid fa-calculator"></i> Aucune population cible validée pour ce territoire et cette année.</div> }
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-syringe text-brand-600"></i> Couvertures au {{ d['au'] }}</h2><a routerLink="couvertures" class="text-xs font-medium text-brand-700 dark:text-brand-300">Détail</a></div>
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (i of d['couvertures']; track i.code) {
            <li class="flex items-center gap-3 px-5 py-3 text-sm">
              <span class="flex-1">{{ i.nom }}<span class="block text-xs text-slate-500">{{ i.numerateur ?? '—' }} / {{ i.denominateur ?? '—' }}</span></span>
              <span class="font-semibold tabular-nums" [class.text-rose-600]="i.depassement">{{ pct(i.valeur) }}</span>
              @if (i.depassement) { <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" title="Couverture supérieure à 100 % : à vérifier">&gt; 100 %</span> }
            </li>
          }
          @for (a of d['abandons']; track a.code) {
            <li class="flex items-center gap-3 px-5 py-3 text-sm"><span class="flex-1">{{ a.libelle }}</span><span class="font-semibold tabular-nums">{{ pct(a.valeur) }}</span></li>
          }
          <li class="flex items-center gap-3 px-5 py-3 text-sm"><span class="flex-1">Enfants zéro dose</span><span class="font-semibold tabular-nums">{{ d['zeroDose'].zeroDose }}</span></li>
        </ul>
      </div>
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-chart-column text-brand-600"></i> Réalisations mensuelles (modules AMI)</h2></div>
        <div class="p-4"><app-epi-graphique [etiquettes]="mois(d['evolution'])" [series]="[
          { libelle: 'CPN1', valeurs: col(d['evolution'], 'CPN1') }, { libelle: 'Accouchements assistés', valeurs: col(d['evolution'], 'ACC') }, { libelle: 'Penta 3', valeurs: col(d['evolution'], 'PENTA3') }]" titre="Réalisations mensuelles" /></div>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <a routerLink="surveillance" class="card p-4"><p class="text-xs font-medium text-slate-500">Événements sanitaires actifs</p><p class="mt-1 text-2xl font-bold tabular-nums">{{ d['surveillance'].evenementsActifs }}</p>
        <p class="text-xs text-slate-500">{{ d['surveillance'].casValides }} cas validés · {{ d['surveillance'].casNonValides }} non validés</p></a>
      <a routerLink="morbi-mortalite" class="card p-4"><p class="text-xs font-medium text-slate-500">Décès maternels / néonatals (validés)</p><p class="mt-1 text-2xl font-bold tabular-nums">{{ d['mortalite'].maternels }} / {{ d['mortalite'].neonatals }}</p></a>
      <a routerLink="alertes" class="card p-4"><p class="text-xs font-medium text-slate-500">Alertes ouvertes</p><p class="mt-1 text-2xl font-bold tabular-nums">{{ d['alertes'].ouvertes }}</p>
        <p class="text-xs" [class.text-rose-600]="d['alertes'].critiques">{{ d['alertes'].critiques }} critique(s) · {{ d['alertes'].enRetard }} en retard</p></a>
      <a routerLink="tracabilite" class="card p-4"><p class="text-xs font-medium text-slate-500">Données en attente de validation</p><p class="mt-1 text-2xl font-bold tabular-nums">{{ d['validation'].enAttente }}</p></a>
    </div>

    @if (d['surveillance'].courbe.length) {
      <div class="card"><div class="card-header"><h2 class="card-title"><i class="fa-solid fa-wave-square text-brand-600"></i> Courbe épidémique (cas validés par semaine)</h2></div>
        <div class="p-4"><app-epi-graphique [etiquettes]="semaines(d['surveillance'].courbe)" [series]="[{ libelle: 'Nouveaux cas', valeurs: totaux(d['surveillance'].courbe) }]" /></div></div>
    }
  </div>
} @else if (!erreur()) {
  <div class="grid gap-3 sm:grid-cols-4" aria-hidden="true">@for (i of [1,2,3,4,5,6,7,8]; track i) { <div class="skeleton h-24 rounded-2xl"></div> }</div>
}`,
})
export class VueGeneraleComponent {
  private epi = inject(EpidemiologieService);
  t = signal<Donnee | null>(null);
  erreur = signal('');
  readonly couleur = couleurStatutDonnee;
  readonly pct = pct;

  constructor() {
    effect(() => {
      const entite = this.epi.entite();
      const annee = this.epi.annee();
      untracked(() => this.charger(entite, annee));
    });
  }

  async charger(entite: string, annee: number) {
    this.erreur.set('');
    try {
      this.t.set(await this.epi.get('/tableau-de-bord', { entite, annee }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  mois = (ev: Donnee[]) => ev.map(m => m['mois'].slice(5) + '/' + m['mois'].slice(2, 4));
  col = (ev: Donnee[], k: string) => ev.map(m => m[k] as number);
  semaines = (c: Donnee[]) => c.map(s => s['semaine']);
  totaux = (c: Donnee[]) => c.map(s => s['total'] as number);
}
