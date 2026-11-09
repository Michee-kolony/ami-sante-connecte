import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'coefficients' | 'saisie' | 'historique' | 'indicateurs';

/**
 * Sous-fenêtre 2 — Paramètres et coefficients démographiques : jamais inscrits dans le code,
 * administrables, documentés (source), versionnés (période d'application) et validés avant
 * activation. Catalogue des fiches d'indicateurs de couverture (sous-fenêtre 7) en dernier onglet.
 */
@Component({
  selector: 'app-epi-parametres',
  standalone: true,
  imports: [FormsModule, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
    <i class="fa-solid fa-scale-balanced"></i> Les coefficients proposés (4 %, 4 %, 3,49 %) sont des <strong>hypothèses à confirmer</strong> par les documents de référence nationaux
    et les programmes (Ministère de la Santé, PEV) avant leur activation. Aucun calcul n’utilise un coefficient non validé.
  </div>
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('coefficients') {
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[980px]">
          <thead><tr><th class="table-th">Code</th><th class="table-th">Paramètre</th><th class="table-th">Valeur</th><th class="table-th">Application</th><th class="table-th">Période</th><th class="table-th">Source</th><th class="table-th">Statut</th><th class="table-th"></th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            @for (c of coefficients(); track c['id']) {
              <tr>
                <td class="table-td font-mono text-xs">{{ c['code'] }}</td>
                <td class="table-td">{{ c['nom'] }}<span class="block text-xs text-slate-500">{{ c['cible'] }} — {{ r()?.cibles?.[c['cible']] }} · {{ c['programme'] }}</span></td>
                <td class="table-td tabular-nums"><strong>{{ virgule(c['valeurPct']) }} %</strong><span class="block text-xs text-slate-500">× {{ virgule(c['valeurDecimale']) }}</span></td>
                <td class="table-td text-sm">{{ c['territoire'] }}</td>
                <td class="table-td text-xs">{{ c['dateDebut'] }} → {{ c['dateFin'] ?? '…' }}</td>
                <td class="table-td max-w-[14rem] text-xs">{{ c['source'] || '—' }}@if (!c['source']) { <span class="block text-amber-700 dark:text-amber-300">Source obligatoire avant activation</span> }</td>
                <td class="table-td"><app-epi-validation type="coefficient" [donnee]="c" (change)="charger()" /></td>
                <td class="table-td">@if (modifiable() && !['Soumis', 'Archivé'].includes(c['statut'])) { <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="editer(c)"><i class="fa-solid fa-pen"></i> {{ c['statut'] === 'Validé' ? 'Nouvelle version' : 'Modifier' }}</button> }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="card"><div class="card-header"><h2 class="card-title">Comparaison des coefficients par population cible</h2></div>
        <div class="p-4"><app-epi-graphique [pourcent]="true" [etiquettes]="nomsCoef()" [series]="[{ libelle: 'Coefficient (%)', valeurs: valeursCoef() }]" /></div></div>
    }

    @case ('saisie') {
      @if (!modifiable()) { <p class="text-sm text-slate-500"><i class="fa-solid fa-lock"></i> Proposition réservée aux épidémiologistes et responsables autorisés.</p> }
      <form class="card space-y-4 p-5" (ngSubmit)="enregistrer()">
        <h2 class="card-title">{{ f['id'] ? (f['statut'] === 'Validé' ? 'Nouvelle version de ' + f['code'] : 'Modifier ' + f['code']) : 'Nouveau paramètre' }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="sm:col-span-2"><label class="label" for="c-nom">Nom du paramètre <span class="req">*</span></label><input id="c-nom" name="nom" class="input" [(ngModel)]="f['nom']" required></div>
          <div><label class="label" for="c-cib">Population cible produite <span class="req">*</span></label><select id="c-cib" name="cib" class="input" [(ngModel)]="f['cible']">@for (k of cles(r()?.cibles); track k) { <option [value]="k">{{ k }} — {{ r()?.cibles?.[k] }}</option> }</select></div>
          <div><label class="label" for="c-val">Coefficient (%) <span class="req">*</span></label><input id="c-val" name="val" type="number" step="0.01" min="0" max="100" class="input" [(ngModel)]="f['valeurPct']" required>
            @if (f['valeurPct'] != null) { <p class="hint">Valeur décimale : {{ virgule(+f['valeurPct'] / 100) }}</p> }</div>
          <div><label class="label" for="c-ref">Population de référence</label><input id="c-ref" name="ref" class="input" [(ngModel)]="f['populationReference']"></div>
          <div><label class="label" for="c-ter">Territoire d’application</label><select id="c-ter" name="ter" class="input" [(ngModel)]="f['entiteCode']">@for (e of epi.territoires(); track e.code) { <option [value]="e.code">{{ e.nom }} ({{ e.niveau }})</option> }</select></div>
          <div><label class="label" for="c-prg">Programme concerné</label><select id="c-prg" name="prg" class="input" [(ngModel)]="f['programme']">@for (p of r()?.programmes ?? []; track p) { <option>{{ p }}</option> }</select></div>
          <div><label class="label" for="c-dd">Date de début <span class="req">*</span></label><input id="c-dd" name="dd" type="date" class="input" [(ngModel)]="f['dateDebut']" required></div>
          <div><label class="label" for="c-df">Date de fin</label><input id="c-df" name="df" type="date" class="input" [(ngModel)]="f['dateFin']"></div>
          <div class="sm:col-span-2 lg:col-span-3"><label class="label" for="c-src">Source officielle (texte, lien, document) <span class="req">*</span></label><input id="c-src" name="src" class="input" [(ngModel)]="f['source']"></div>
          <div class="sm:col-span-2 lg:col-span-4"><label class="label" for="c-com">Commentaire / justification</label><textarea id="c-com" name="com" rows="2" class="input" [(ngModel)]="f['commentaire']"></textarea></div>
          @if (f['id'] && f['statut'] === 'Validé') { <div class="sm:col-span-2 lg:col-span-4"><label class="label" for="c-mot">Motif de la nouvelle version <span class="req">*</span></label><input id="c-mot" name="mot" class="input" [(ngModel)]="f['motif']" required></div> }
        </div>
        <div class="flex justify-end gap-2"><button type="button" class="btn-ghost" (click)="nouveau()">Réinitialiser</button><button type="submit" class="btn-primary" [disabled]="envoi() || !modifiable()">Enregistrer (brouillon)</button></div>
      </form>
    }

    @case ('historique') {
      <div class="card"><div class="card-header"><h2 class="card-title">Évolution historique des coefficients (toutes versions)</h2></div>
        <div class="p-4"><app-epi-graphique type="line" [pourcent]="true" [etiquettes]="etiquettesVersions()" [series]="seriesVersions()" /></div></div>
      <div class="card overflow-x-auto"><table class="w-full min-w-[700px]">
        <thead><tr><th class="table-th">Code</th><th class="table-th">Version</th><th class="table-th">Valeur</th><th class="table-th">Territoire</th><th class="table-th">Période d’application</th><th class="table-th">Statut</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (v of versions(); track v['code'] + v['version']) {
            <tr><td class="table-td font-mono text-xs">{{ v['code'] }}</td><td class="table-td">v{{ v['version'] }}</td><td class="table-td">{{ virgule(v['valeurPct']) }} %</td><td class="table-td text-xs">{{ epi.nomEntite(v['entiteCode']) }}</td>
              <td class="table-td text-xs">{{ v['dateDebut'] }} → {{ v['dateFin'] ?? '…' }}</td><td class="table-td text-xs">{{ v['statut'] }}</td></tr>
          }
        </tbody></table></div>
    }

    @case ('indicateurs') {
      <p class="text-sm text-slate-600 dark:text-slate-300">Catalogue central des indicateurs de couverture : numérateur et dénominateur définis séparément. Toute modification crée une nouvelle version soumise à validation ; la version validée reste appliquée jusque-là.</p>
      <ul class="space-y-3">
        @for (i of indicateurs(); track i['id']) {
          <li class="card p-4 text-sm">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p><strong class="font-mono">{{ i['code'] }}</strong> — {{ i['nom'] }}</p>
              <app-epi-validation type="indicateur" [donnee]="i" (change)="charger()" />
            </div>
            <p class="mt-1"><span class="text-slate-500">Numérateur :</span> {{ i['numerateur'] }}</p>
            <p><span class="text-slate-500">Dénominateur :</span> {{ r()?.cibles?.[i['cible']] }} (sous-fenêtre 3) · {{ i['unite'] }} · {{ i['periodicite'] }} · source {{ i['source'] }}</p>
            @if (i['parametres']?.contactsRequis) { <p><span class="text-slate-500">Contacts CPN requis :</span> {{ i['parametres'].contactsRequis }}</p> }
            <p class="text-xs text-slate-500">Seuil de référence : {{ i['seuilReference'] ?? 'non défini' }} · Référence de validation : {{ i['referenceValidation'] || 'à renseigner' }}</p>
            @if (droits()?.parametrage && !['Soumis', 'Archivé'].includes(i['statut'])) {
              @if (fi['id'] === i['id']) {
                <form class="mt-3 grid gap-2 sm:grid-cols-4" (ngSubmit)="enregistrerIndicateur()">
                  <div class="sm:col-span-4"><label class="label text-xs" for="i-num">Numérateur</label><textarea id="i-num" name="num" rows="2" class="input" [(ngModel)]="fi['numerateur']"></textarea></div>
                  <div><label class="label text-xs" for="i-seuil">Seuil (%)</label><input id="i-seuil" name="seuil" type="number" class="input" [(ngModel)]="fi['seuilReference']"></div>
                  @if (i['intervention'] === 'CPN4') { <div><label class="label text-xs" for="i-ct">Contacts requis</label><input id="i-ct" name="ct" type="number" min="1" max="12" class="input" [(ngModel)]="fi['contactsRequis']"></div> }
                  <div class="sm:col-span-2"><label class="label text-xs" for="i-ref">Référence de la fiche validée</label><input id="i-ref" name="ref" class="input" [(ngModel)]="fi['referenceValidation']"></div>
                  @if (i['statut'] === 'Validé') { <div class="sm:col-span-4"><label class="label text-xs" for="i-mot">Motif <span class="req">*</span></label><input id="i-mot" name="mot" class="input" [(ngModel)]="fi['motif']"></div> }
                  <div class="flex justify-end gap-2 sm:col-span-4"><button type="button" class="btn-ghost py-1.5 text-xs" (click)="fi = {}">Annuler</button><button type="submit" class="btn-primary py-1.5 text-xs">Enregistrer la version</button></div>
                </form>
              } @else {
                <button type="button" class="btn-ghost mt-2 px-2 py-1 text-xs" (click)="editerIndicateur(i)"><i class="fa-solid fa-pen"></i> {{ i['statut'] === 'Validé' ? 'Nouvelle version' : 'Modifier' }}</button>
              }
            }
          </li>
        }
      </ul>
    }
  }
</div>`,
})
export class ParametresComponent implements OnInit {
  epi = inject(EpidemiologieService);
  r = this.epi.referentiel;
  droits = this.epi.droits;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'coefficients', libelle: 'Paramètres par population cible', icone: 'fa-sliders' },
    { id: 'saisie', libelle: 'Proposer / modifier', icone: 'fa-pen-to-square' },
    { id: 'historique', libelle: 'Périodes et historique', icone: 'fa-clock-rotate-left' },
    { id: 'indicateurs', libelle: 'Fiches des indicateurs', icone: 'fa-book-medical' },
  ];
  onglet = signal<Onglet>('coefficients');
  coefficients = signal<Donnee[]>([]);
  versions = signal<Donnee[]>([]);
  indicateurs = signal<Donnee[]>([]);
  modifiable = signal(false);
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  f: Donnee = {};
  fi: Donnee = {};

  ngOnInit() {
    this.nouveau();
    this.charger();
  }

  virgule = (v: number | null | undefined) => (v == null ? '—' : String(v).replace('.', ','));
  cles = (o: Record<string, string> | undefined) => Object.keys(o ?? {});
  nomsCoef = () => this.coefficients().filter(c => c['statut'] !== 'Archivé').map(c => `${c['code']} ${c['nom']} (v${c['version']}, ${c['statut']})`);
  valeursCoef = () => this.coefficients().filter(c => c['statut'] !== 'Archivé').map(c => c['valeurPct'] as number);
  etiquettesVersions = () => [...new Set(this.versions().map(v => `v${v['version']}`))];
  seriesVersions = () => {
    const codes = [...new Set(this.versions().map(v => v['code']))];
    return codes.map(code => ({ libelle: code, valeurs: this.etiquettesVersions().map(et => this.versions().find(v => v['code'] === code && `v${v['version']}` === et)?.['valeurPct'] ?? null) }));
  };

  nouveau() {
    this.f = { nom: '', cible: 'FE', valeurPct: null, populationReference: 'Population totale', entiteCode: 'CD', programme: 'CPN', dateDebut: `${this.epi.annee()}-01-01`, dateFin: '', source: '', commentaire: '' };
  }

  editer(c: Donnee) {
    this.f = { ...c, motif: '' };
    this.onglet.set('saisie');
  }

  editerIndicateur(i: Donnee) {
    this.fi = { id: i['id'], statut: i['statut'], numerateur: i['numerateur'], seuilReference: i['seuilReference'], referenceValidation: i['referenceValidation'], contactsRequis: i['parametres']?.contactsRequis, motif: '' };
  }

  async charger() {
    try {
      const [c, i] = await Promise.all([this.epi.get('/coefficients'), this.epi.get('/indicateurs')]);
      this.coefficients.set(c['coefficients']);
      this.versions.set(c['versions']);
      this.modifiable.set(c['modifiable']);
      this.indicateurs.set(i['indicateurs']);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async enregistrer() {
    this.envoi.set(true);
    this.erreur.set('');
    const corps = { nom: this.f['nom'], cible: this.f['cible'], valeurPct: this.f['valeurPct'], populationReference: this.f['populationReference'], entiteCode: this.f['entiteCode'],
      programme: this.f['programme'], dateDebut: this.f['dateDebut'], dateFin: this.f['dateFin'] || null, source: this.f['source'], commentaire: this.f['commentaire'], motif: this.f['motif'] };
    try {
      const c = this.f['id'] ? await this.epi.patch(`/coefficients/${this.f['id']}`, corps) : await this.epi.post('/coefficients', corps);
      this.message.set(`${c['code']} v${c['version']} enregistré en ${c['statut'].toLowerCase()} : soumettez-le pour validation.`);
      this.nouveau();
      this.onglet.set('coefficients');
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  async enregistrerIndicateur() {
    this.erreur.set('');
    const corps: Donnee = { ...this.fi };
    const id = corps['id'];
    delete corps['id'];
    delete corps['statut'];
    if (corps['contactsRequis'] == null) delete corps['contactsRequis'];
    try {
      const i = await this.epi.patch(`/indicateurs/${id}`, corps);
      this.message.set(`${i['code']} v${i['version']} enregistré (${i['statut']}).`);
      this.fi = {};
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
