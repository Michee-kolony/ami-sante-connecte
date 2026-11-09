import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, couleurStatutDonnee, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';

type Onglet = 'bibliotheque' | 'generation' | 'apercu';

/**
 * Sous-fenêtre 9 — Rapports et exportation : génération à partir des données validées (par
 * défaut), rapports périodiques et personnalisés, export PDF / Excel / CSV, historique. Un rapport
 * publié est figé ; la régénération crée une nouvelle version intégrant les corrections validées.
 */
@Component({
  selector: 'app-epi-rapports',
  standalone: true,
  imports: [DatePipe, FormsModule, EpiGraphiqueComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('bibliotheque') {
      @if (stats(); as s) {
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Rapports générés par catégorie</h2><span class="text-xs text-slate-500">{{ s['total'] }} rapport(s), {{ s['valides'] }} validé(s)</span></div><div class="p-4">
            <app-epi-graphique [horizontal]="true" [etiquettes]="col(s['parType'], 'libelle')" [series]="[{ libelle: 'Rapports', valeurs: col(s['parType'], 'n') }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Rapports générés par période</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="col(s['parMois'], 'mois')" [series]="[{ libelle: 'Rapports', valeurs: col(s['parMois'], 'n') }]" /></div></div>
        </div>
      }
      <div class="card overflow-x-auto"><table class="w-full min-w-[960px]">
        <thead><tr><th class="table-th">Rapport</th><th class="table-th">Période</th><th class="table-th">Territoire</th><th class="table-th">Généré par</th><th class="table-th">Date</th><th class="table-th">Statut</th><th class="table-th">Export</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (r of rapports(); track r['id']) {
          <tr>
            <td class="table-td"><button type="button" class="text-left font-medium text-brand-700 hover:underline dark:text-brand-300" (click)="voir(r)">{{ r['titre'] }}</button><span class="block font-mono text-xs text-slate-500">{{ r['numero'] }} v{{ r['version'] }} · {{ r['statutDonnees'] }}</span></td>
            <td class="table-td text-xs">{{ r['parametres'].du }} → {{ r['parametres'].au }}<span class="block text-slate-500">{{ r['parametres'].periodicite }}</span></td>
            <td class="table-td text-xs">{{ r['parametres'].territoire }}</td>
            <td class="table-td text-xs">{{ r['generePar']?.nom }}</td>
            <td class="table-td text-xs">{{ r['createdAt'] | date:'dd/MM/yyyy HH:mm' }}</td>
            <td class="table-td"><span class="badge" [class]="couleur(r['statut'] === 'Disponible' ? 'Soumis' : r['statut'] === 'Remplacé' ? 'Archivé' : r['statut'])">{{ r['statut'] }}</span>@if (r['remplacePar']) { <span class="block text-xs text-slate-500">→ {{ r['remplacePar'] }}</span> }</td>
            <td class="table-td whitespace-nowrap">
              @for (f of formats; track f.code) { <button type="button" class="btn-ghost px-2 py-1 text-xs" [title]="'Exporter en ' + f.libelle" (click)="exporter(r, f.code)"><i class="fa-solid {{ f.icone }}"></i></button> }
            </td>
          </tr>
        } @empty { <tr><td colspan="7" class="table-td text-center text-slate-500">Aucun rapport généré.</td></tr> }</tbody></table></div>
    }

    @case ('generation') {
      <form class="card space-y-4 p-5" (ngSubmit)="generer()">
        <h2 class="card-title"><i class="fa-solid fa-file-circle-plus text-brand-600"></i> Génération d’un rapport — {{ epi.nomEntite(epi.entite()) }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="sm:col-span-2"><label class="label" for="r-type">Type de rapport</label><select id="r-type" name="type" class="input" [(ngModel)]="f['type']">@for (k of cles(epi.referentiel()?.typesRapport); track k) { <option [value]="k">{{ epi.referentiel()?.typesRapport?.[k] }}</option> }</select></div>
          <div class="sm:col-span-2"><label class="label" for="r-titre">Titre (facultatif)</label><input id="r-titre" name="titre" class="input" [(ngModel)]="f['titre']"></div>
          <div><label class="label" for="r-per">Périodicité</label><select id="r-per" name="per" class="input" [(ngModel)]="f['periodicite']"><option>Mensuel</option><option>Trimestriel</option><option>Annuel</option><option>Personnalisé</option></select></div>
          @switch (f['periodicite']) {
            @case ('Mensuel') { <div><label class="label" for="r-mois">Mois</label><input id="r-mois" name="mois" type="month" class="input" [(ngModel)]="f['mois']"></div> }
            @case ('Trimestriel') { <div><label class="label" for="r-tri">Trimestre</label><select id="r-tri" name="tri" class="input" [(ngModel)]="f['trimestre']">@for (t of [1,2,3,4]; track t) { <option [value]="epi.annee() + '-T' + t">T{{ t }} {{ epi.annee() }}</option> }</select></div> }
            @case ('Annuel') { <div><label class="label" for="r-an">Année</label><input id="r-an" name="an" type="number" class="input" [(ngModel)]="f['annee']"></div> }
            @default {
              <div><label class="label" for="r-du">Période de début</label><input id="r-du" name="du" type="date" class="input" [(ngModel)]="f['du']"></div>
              <div><label class="label" for="r-au">Période de fin</label><input id="r-au" name="au" type="date" class="input" [(ngModel)]="f['au']"></div>
            }
          }
          <div class="sm:col-span-2"><label class="label">Désagrégation</label><div class="flex flex-wrap gap-3 text-sm">@for (d of epi.referentiel()?.desagregations ?? []; track d) { <label class="flex items-center gap-1.5"><input type="checkbox" [checked]="f['desagregation'].includes(d)" (change)="basculer(d)"> {{ d }}</label> }</div></div>
          <div class="sm:col-span-2"><label class="flex items-center gap-2 text-sm"><input type="checkbox" name="nv" [(ngModel)]="f['inclureNonValidees']"> Inclure les données non validées (rapport non officiel)</label></div>
          <div class="sm:col-span-2 lg:col-span-4"><label class="label" for="r-com">Commentaire</label><textarea id="r-com" name="com" rows="2" class="input" [(ngModel)]="f['commentaire']"></textarea></div>
        </div>
        <p class="hint">Contenu obligatoire : logo, titre, niveau géographique, période, date de génération, source, statut de validation, tableaux, définitions, méthodes de calcul, commentaires et limites, responsable de validation. Aucune donnée nominative.</p>
        <div class="flex justify-end"><button type="submit" class="btn-primary" [disabled]="envoi() || !epi.droits()?.planification"><i class="fa-solid fa-gears"></i> Générer</button></div>
      </form>
    }

    @case ('apercu') {
      @if (r(); as rap) {
        <div class="card space-y-4 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-3"><img src="images/logo-full.webp" alt="AMI Santé Connect" class="h-10 w-auto rounded bg-white p-1">
              <div><h2 class="text-lg font-bold">{{ rap['titre'] }}</h2>
                <p class="text-xs text-slate-500">{{ rap['numero'] }} v{{ rap['version'] }} · {{ rap['parametres'].territoire }} ({{ rap['parametres'].niveau }}) · du {{ rap['parametres'].du }} au {{ rap['parametres'].au }} · généré le {{ rap['createdAt'] | date:'dd/MM/yyyy HH:mm' }} par {{ rap['generePar']?.nom }}</p>
                <p class="text-xs text-slate-500">Source : {{ rap['sourceDonnees'] }} · Données : {{ rap['statutDonnees'] }} · Statut : {{ rap['statut'] }}@if (rap['validation']) { — validé par {{ rap['validation'].responsable }}, {{ rap['validation'].fonction }} }</p></div></div>
            <div class="flex flex-wrap gap-1">
              @for (f of formats; track f.code) { <button type="button" class="btn-secondary py-1.5 text-xs" (click)="exporter(rap, f.code)"><i class="fa-solid {{ f.icone }}"></i> {{ f.libelle }}</button> }
              @if (rap['statut'] !== 'Remplacé' && epi.droits()?.planification) { <button type="button" class="btn-secondary py-1.5 text-xs" (click)="regenerer(rap)"><i class="fa-solid fa-rotate"></i> Régénérer</button> }
              @if (rap['statut'] === 'Disponible' && epi.droits()?.validation) { <button type="button" class="btn-primary py-1.5 text-xs" (click)="valider(rap)"><i class="fa-solid fa-stamp"></i> Valider</button> }
            </div>
          </div>
          @for (s of rap['contenu'].sections; track $index) {
            <div><h3 class="mb-1 font-semibold text-brand-800 dark:text-brand-200">{{ s.titre }}</h3>
              <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr>@for (c of s.colonnes; track $index) { <th class="table-th bg-slate-50 dark:bg-slate-800/60">{{ c }}</th> }</tr></thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (l of s.lignes; track $index) { <tr>@for (v of l; track $index) { <td class="table-td py-2">{{ v ?? '—' }}</td> }</tr> } @empty { <tr><td class="table-td text-slate-500" [attr.colspan]="s.colonnes.length">Aucune donnée.</td></tr> }</tbody></table></div>
              @for (n of s.notes ?? []; track $index) { <p class="mt-1 text-xs italic text-slate-500">Note : {{ n }}</p> }</div>
          }
          @if (rap['contenu'].definitions.length) {
            <div><h3 class="mb-1 font-semibold">Définitions des indicateurs et méthodes de calcul</h3><ul class="space-y-0.5 text-xs">@for (d of rap['contenu'].definitions; track $index) { <li><strong>{{ d.code }}</strong> — {{ d.libelle }} : {{ d.formule }}</li> }</ul></div>
          }
          <div><h3 class="mb-1 font-semibold">Commentaires et limites des données</h3><ul class="list-disc pl-5 text-xs">@for (l of rap['contenu'].limites; track $index) { <li>{{ l }}</li> } @if (rap['commentaire']) { <li>{{ rap['commentaire'] }}</li> }</ul></div>
          <details class="text-xs"><summary class="cursor-pointer text-slate-500">Versions des paramètres et calculs utilisés</summary><pre class="mt-1 whitespace-pre-wrap">{{ versions(rap) }}</pre></details>
        </div>
      } @else { <p class="text-sm text-slate-500">Ouvrez un rapport depuis la bibliothèque.</p> }
    }
  }
</div>`,
})
export class RapportsComponent implements OnInit {
  epi = inject(EpidemiologieService);
  readonly couleur = couleurStatutDonnee;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'bibliotheque', libelle: 'Bibliothèque et historique', icone: 'fa-book' },
    { id: 'generation', libelle: 'Génération', icone: 'fa-file-circle-plus' },
    { id: 'apercu', libelle: 'Aperçu', icone: 'fa-eye' },
  ];
  readonly formats: { code: 'pdf' | 'excel' | 'csv'; libelle: string; icone: string }[] = [
    { code: 'pdf', libelle: 'PDF', icone: 'fa-file-pdf' }, { code: 'excel', libelle: 'Excel', icone: 'fa-file-excel' }, { code: 'csv', libelle: 'CSV', icone: 'fa-file-csv' },
  ];
  onglet = signal<Onglet>('bibliotheque');
  rapports = signal<Donnee[]>([]);
  stats = signal<Donnee | null>(null);
  r = signal<Donnee | null>(null);
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  f: Donnee = {};

  ngOnInit() {
    this.f = { type: 'couvertures', titre: '', periodicite: 'Annuel', annee: this.epi.annee(), mois: new Date().toISOString().slice(0, 7), trimestre: `${this.epi.annee()}-T1`,
      du: `${this.epi.annee()}-01-01`, au: new Date().toISOString().slice(0, 10), desagregation: ['Territoire'], inclureNonValidees: false, commentaire: '' };
    this.charger();
  }

  cles = (o: Record<string, string> | undefined) => Object.keys(o ?? {});
  col = (l: Donnee[], k: string) => l.map(x => x[k]);
  versions = (r: Donnee) => JSON.stringify(r['versions'] ?? {}, null, 2);
  basculer(d: string) {
    const l: string[] = this.f['desagregation'];
    this.f['desagregation'] = l.includes(d) ? l.filter(x => x !== d) : [...l, d];
  }

  async charger() {
    try {
      const [l, s] = await Promise.all([this.epi.get<Donnee[]>('/rapports'), this.epi.get('/rapports/statistiques')]);
      this.rapports.set(l);
      this.stats.set(s);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async voir(r: Donnee) {
    try {
      this.r.set(await this.epi.get(`/rapports/${r['numero']}`));
      this.onglet.set('apercu');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  private async executer(action: () => Promise<Donnee>, message: string) {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const r = await action();
      this.message.set(message);
      this.r.set(r);
      this.onglet.set('apercu');
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  generer() {
    const p = this.f['periodicite'];
    const periode = p === 'Mensuel' ? { mois: this.f['mois'] } : p === 'Trimestriel' ? { trimestre: this.f['trimestre'] } : p === 'Annuel' ? { annee: this.f['annee'] } : { du: this.f['du'], au: this.f['au'] };
    return this.executer(() => this.epi.post('/rapports', { type: this.f['type'], titre: this.f['titre'], periodicite: p, ...periode, entiteCode: this.epi.entite(),
      desagregation: this.f['desagregation'], inclureNonValidees: this.f['inclureNonValidees'], commentaire: this.f['commentaire'] }), 'Rapport généré.');
  }
  regenerer(r: Donnee) { return this.executer(() => this.epi.post(`/rapports/${r['numero']}/regenerer`), 'Nouvelle version générée ; l’ancienne est conservée (« Remplacé »).'); }
  valider(r: Donnee) { return this.executer(() => this.epi.post(`/rapports/${r['numero']}/valider`, {}), 'Rapport validé.'); }

  async exporter(r: Donnee, format: 'pdf' | 'excel' | 'csv') {
    try {
      await this.epi.exporter(r['numero'], format);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
