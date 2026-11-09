import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, couleurPrioriteEpi, couleurStatutDonnee, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';

type Onglet = 'tableau' | 'liste' | 'regles' | 'signaler';

/**
 * Sous-fenêtre 8 — Alertes et insuffisances : de la détection à la correction suivie (responsable,
 * échéance, action corrective, preuve, résultat, clôture). Les règles à seuil sont configurées puis
 * activées par un responsable avec la référence du document qui fixe le seuil.
 */
@Component({
  selector: 'app-epi-alertes',
  standalone: true,
  imports: [DatePipe, FormsModule, EpiGraphiqueComponent],
  template: `
<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
      @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
    </div>
    @if (epi.droits()?.planification) { <button type="button" class="btn-primary py-2" [disabled]="envoi()" (click)="detecter()"><i class="fa-solid fa-magnifying-glass-chart"></i> Lancer la détection</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('tableau') {
      @if (t(); as d) {
        <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div class="card p-4"><p class="text-xs text-slate-500">Alertes</p><p class="text-2xl font-bold">{{ d['total'] }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">Ouvertes</p><p class="text-2xl font-bold">{{ d['ouvertes'] }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">Critiques ouvertes</p><p class="text-2xl font-bold" [class.text-rose-600]="d['critiquesOuvertes']">{{ d['critiquesOuvertes'] }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">En retard</p><p class="text-2xl font-bold" [class.text-rose-600]="d['enRetard']">{{ d['enRetard'] }}</p></div>
          <div class="card p-4" [title]="d['tauxResolution'].formule"><p class="text-xs text-slate-500">Taux de résolution</p><p class="text-2xl font-bold">{{ pct(d['tauxResolution'].valeur) }}</p></div>
          <div class="card p-4"><p class="text-xs text-slate-500">Délai moyen de traitement</p><p class="text-2xl font-bold">{{ d['delaiMoyenTraitementJours'] ?? '—' }} j</p></div>
        </div>
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Alertes par niveau de priorité</h2></div><div class="p-4"><app-epi-graphique type="doughnut" [etiquettes]="lib(d['parPriorite'])" [series]="[{ libelle: 'Alertes', valeurs: val(d['parPriorite']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Alertes par catégorie</h2></div><div class="p-4"><app-epi-graphique [horizontal]="true" [etiquettes]="lib(d['parCategorie'])" [series]="[{ libelle: 'Alertes', valeurs: val(d['parCategorie']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Résolues et non résolues</h2></div><div class="p-4"><app-epi-graphique [etiquettes]="lib(d['parStatut'])" [series]="[{ libelle: 'Alertes', valeurs: val(d['parStatut']) }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Territoires présentant le plus d’insuffisances</h2></div><div class="p-4"><app-epi-graphique [horizontal]="true" [etiquettes]="lib(d['parZone'])" [series]="[{ libelle: 'Alertes', valeurs: val(d['parZone']), couleur: '#d97706' }]" /></div></div>
          <div class="card xl:col-span-2"><div class="card-header"><h2 class="card-title">Évolution mensuelle des alertes</h2></div><div class="p-4"><app-epi-graphique type="line" [etiquettes]="moisListe(d['parMois'])" [series]="[{ libelle: 'Alertes', valeurs: val(d['parMois']) }]" /></div></div>
        </div>
      }
    }

    @case ('liste') {
      <div class="flex flex-wrap gap-2">
        <select class="input w-auto py-1.5" [(ngModel)]="filtres.domaine" (ngModelChange)="chargerListe()" aria-label="Domaine"><option value="">Tous les domaines</option>@for (x of epi.referentiel()?.domainesAlerte ?? []; track x) { <option>{{ x }}</option> }</select>
        <select class="input w-auto py-1.5" [(ngModel)]="filtres.priorite" (ngModelChange)="chargerListe()" aria-label="Priorité"><option value="">Toutes priorités</option>@for (x of epi.referentiel()?.priorites ?? []; track x) { <option>{{ x }}</option> }</select>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="filtres.ouvertes" (ngModelChange)="chargerListe()"> Ouvertes seulement</label>
      </div>
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div class="card overflow-x-auto"><table class="w-full min-w-[720px]">
          <thead><tr><th class="table-th">N°</th><th class="table-th">Alerte</th><th class="table-th">Territoire</th><th class="table-th">Priorité</th><th class="table-th">Responsable</th><th class="table-th">Échéance</th><th class="table-th">Statut</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (a of alertes(); track a['id']) {
            <tr class="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40" (click)="ouvrir(a)" [class.bg-brand-50]="detail()?.['numero'] === a['numero']">
              <td class="table-td font-mono text-xs">{{ a['numero'] }}@if (a['occurrences'] > 1) { <span class="block text-slate-500">× {{ a['occurrences'] }}</span> }</td>
              <td class="table-td">{{ a['titre'] }}<span class="block text-xs text-slate-500">{{ a['domaine'] }}</span></td><td class="table-td text-xs">{{ a['territoire'] || '—' }}</td>
              <td class="table-td"><span class="badge" [class]="prio(a['priorite'])">{{ a['priorite'] }}</span></td><td class="table-td text-xs">{{ a['responsable']?.nom ?? '—' }}</td>
              <td class="table-td text-xs" [class.text-rose-600]="a['retardJours']">{{ a['echeance'] ?? '—' }}@if (a['retardJours']) { <span class="block">+{{ a['retardJours'] }} j</span> }</td>
              <td class="table-td"><span class="badge" [class]="couleur(a['statut'])">{{ a['statut'] }}</span></td>
            </tr>
          } @empty { <tr><td colspan="7" class="table-td text-center text-slate-500">Aucune alerte.</td></tr> }</tbody></table></div>
        @if (detail(); as a) {
          <div class="card space-y-3 p-5 text-sm">
            <div class="flex flex-wrap items-center gap-2"><h3 class="card-title">{{ a['numero'] }} — {{ a['titre'] }}</h3><span class="badge" [class]="prio(a['priorite'])">{{ a['priorite'] }}</span><span class="badge" [class]="couleur(a['statut'])">{{ a['statut'] }}</span></div>
            <p>{{ a['message'] }}</p>
            @if (a['declencheur']; as dec) { <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"><i class="fa-solid fa-bolt"></i> {{ dec.automatique ? 'Déclenchement automatique' : 'Signalement manuel' }}
              @if (dec.regleCode) { — règle {{ dec.regleCode }} v{{ dec.regleVersion }} : {{ dec.indicateur }} = {{ dec.valeur }} {{ dec.operateur }} {{ dec.seuil }} } — donnée : {{ dec.donnee }}</p> }
            @if (a['actionRecommandee']) { <p class="text-xs"><strong>Action recommandée :</strong> {{ a['actionRecommandee'] }}</p> }
            @if (a['problemeLie']) { <p class="text-xs">Problème déjà identifié : {{ a['problemeLie'] }}</p> }
            @if (['Nouvelle', 'Attribuée', 'En cours'].includes(a['statut'])) {
              <form class="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-3" (ngSubmit)="action('attribuer', a)">
                <p class="font-semibold sm:col-span-3">Affectation</p>
                <div><label class="label text-xs" for="a-resp">Responsable</label><select id="a-resp" name="resp" class="input py-1.5" [(ngModel)]="s['responsableId']">@for (r of responsables(); track r['id']) { <option [value]="r['id']">{{ r['nom'] }} — {{ r['fonction'] }}</option> }</select></div>
                <div><label class="label text-xs" for="a-ech">Échéance</label><input id="a-ech" name="ech" type="date" class="input py-1.5" [(ngModel)]="s['echeance']"></div>
                <div class="flex items-end"><button type="submit" class="btn-secondary w-full py-1.5 text-xs" [disabled]="!epi.droits()?.planification">Affecter</button></div>
              </form>
              <form class="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700" (ngSubmit)="action('traiter', a)">
                <p class="font-semibold">Diagnostic et action corrective</p>
                <textarea name="diag" rows="2" class="input" placeholder="Diagnostic du problème" [(ngModel)]="s['diagnostic']" aria-label="Diagnostic"></textarea>
                <textarea name="act" rows="2" class="input" placeholder="Action corrective" [(ngModel)]="s['actionCorrective']" aria-label="Action corrective"></textarea>
                <div class="flex items-end gap-2"><div><label class="label text-xs" for="a-prev">Date prévue</label><input id="a-prev" name="prev" type="date" class="input py-1.5" [(ngModel)]="s['datePrevue']"></div><button type="submit" class="btn-secondary py-1.5 text-xs">Enregistrer</button></div>
              </form>
              <form class="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700" (ngSubmit)="action('resoudre', a)">
                <p class="font-semibold">Résolution</p>
                <textarea name="res" rows="2" class="input" placeholder="Résultat obtenu (obligatoire)" [(ngModel)]="s['resultat']" aria-label="Résultat"></textarea>
                <div class="grid gap-2 sm:grid-cols-2"><input name="preuve" class="input py-1.5" placeholder="Preuve de réalisation (document, référence)" [(ngModel)]="s['preuve']" aria-label="Preuve"><input name="dr" type="date" class="input py-1.5" [(ngModel)]="s['dateRealisation']" aria-label="Date de réalisation"></div>
                <div class="flex justify-end"><button type="submit" class="btn-secondary py-1.5 text-xs">Marquer résolue</button></div>
              </form>
            }
            @if (a['statut'] !== 'Clôturée' && epi.droits()?.planification) {
              <form class="flex flex-wrap items-end gap-2" (ngSubmit)="action('cloturer', a)">
                <div class="min-w-[14rem] flex-1"><label class="label text-xs" for="a-eval">Évaluation / justification de clôture</label><input id="a-eval" name="eval" class="input py-1.5" [(ngModel)]="s['evaluation']"></div>
                <button type="submit" class="btn-primary py-1.5 text-xs">Clôturer</button>
              </form>
            }
            @if (a['diagnostic'] || a['actionCorrective'] || a['resultat']) {
              <dl class="grid gap-1 text-xs"><dt class="font-semibold">Diagnostic</dt><dd>{{ a['diagnostic'] || '—' }}</dd><dt class="font-semibold">Action corrective</dt><dd>{{ a['actionCorrective'] || '—' }} {{ a['datePrevue'] ? '(prévue le ' + a['datePrevue'] + ')' : '' }}</dd>
                <dt class="font-semibold">Résultat</dt><dd>{{ a['resultat'] || '—' }} {{ a['preuve'] ? '— preuve : ' + a['preuve'] : '' }}</dd></dl>
            }
            <ol class="space-y-1 border-t border-slate-100 pt-2 text-xs dark:border-slate-800">@for (h of a['historique']; track $index) { <li>{{ h.le | date:'dd/MM/yyyy HH:mm' }} — {{ h.action }}{{ h.nouveauStatut ? ' → ' + h.nouveauStatut : '' }}{{ h.par?.nom ? ' — ' + h.par.nom : '' }}{{ h.details ? ' — ' + h.details : '' }}</li> }</ol>
          </div>
        }
      </div>
    }

    @case ('regles') {
      <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        <i class="fa-solid fa-scale-balanced"></i> Les seuils ne sont pas inventés par les développeurs : une règle reste sans effet tant qu’un responsable ne l’a pas activée avec la référence du document qui fixe le seuil. Les contrôles structurels (données manquantes, non validées, expirées) sont automatiques.
      </div>
      <ul class="space-y-3">
        @for (r of regles(); track r['code']) {
          <li class="card p-4 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p><strong class="font-mono">{{ r['code'] }}</strong> — {{ r['nom'] }} <span class="text-xs text-slate-500">v{{ r['version'] }}</span> <span class="badge ml-1" [class]="couleur(r['statut'])">{{ r['statut'] }}</span></p>
              <span class="flex flex-wrap gap-1">
                @if (epi.droits()?.parametrage && r['statut'] !== 'Archivée') { <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="editerRegle(r)"><i class="fa-solid fa-pen"></i> Modifier</button> }
                @if (epi.droits()?.validation && r['statut'] !== 'Active' && r['statut'] !== 'Archivée') { <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="activation = { code: r['code'], responsableValidation: '', referenceValidation: '' }"><i class="fa-solid fa-play"></i> Activer</button> }
                @if (epi.droits()?.parametrage && r['statut'] === 'Active') { <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="statutRegle(r, 'suspendre')"><i class="fa-solid fa-pause"></i> Suspendre</button> }
                @if (epi.droits()?.parametrage && r['statut'] !== 'Archivée') { <button type="button" class="btn-ghost px-2 py-1 text-xs" (click)="statutRegle(r, 'archiver')"><i class="fa-solid fa-box-archive"></i></button> }
              </span>
            </div>
            <p class="mt-1 text-slate-600 dark:text-slate-300">{{ r['domaine'] }} · {{ libelleIndicateur(r['indicateur']) }}{{ r['parametre'] ? ' (' + r['parametre'] + ')' : '' }} {{ r['operateur'] }} <strong>{{ r['seuil'] ?? 'seuil à définir' }}</strong>
              · priorité {{ r['priorite'] }} · {{ r['entiteCode'] ? epi.nomEntite(r['entiteCode']) : 'tout le territoire de détection' }} · traitement {{ r['delaiTraitementJours'] }} j</p>
            @if (r['statut'] === 'Active') { <p class="text-xs text-slate-500">Activée par {{ r['responsableValidation'] }} — {{ r['referenceValidation'] }}</p> }
            @if (activation?.code === r['code']) {
              <form class="mt-2 grid gap-2 sm:grid-cols-3" (ngSubmit)="activer()">
                <input name="rv" class="input py-1.5" placeholder="Responsable de la validation (nom, fonction)" [(ngModel)]="activation!.responsableValidation" aria-label="Responsable">
                <input name="ref" class="input py-1.5" placeholder="Document qui fixe le seuil" [(ngModel)]="activation!.referenceValidation" aria-label="Référence">
                <div class="flex gap-2"><button type="button" class="btn-ghost py-1.5 text-xs" (click)="activation = null">Annuler</button><button type="submit" class="btn-primary py-1.5 text-xs">Activer</button></div>
              </form>
            }
          </li>
        } @empty { <li class="text-sm text-slate-500">Aucune règle configurée.</li> }
      </ul>
      @if (epi.droits()?.parametrage) {
        <form class="card space-y-3 p-5" (ngSubmit)="enregistrerRegle()">
          <h3 class="card-title">{{ rg['code'] ? 'Modifier la règle ' + rg['code'] + ' (nouvelle version, à réactiver)' : 'Configurer une alerte (formulaire A)' }}</h3>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="sm:col-span-2"><label class="label" for="r-nom">Nom de l’alerte</label><input id="r-nom" name="nom" class="input" [(ngModel)]="rg['nom']"></div>
            <div><label class="label" for="r-ind">Indicateur concerné</label><select id="r-ind" name="ind" class="input" [(ngModel)]="rg['indicateur']">@for (i of epi.referentiel()?.indicateursAlerte ?? []; track i.code) { <option [value]="i.code">{{ i.libelle }}</option> }</select></div>
            <div><label class="label" for="r-par">Paramètre</label>
              @if (rg['indicateur'] === 'COUVERTURE') { <select id="r-par" name="par" class="input" [(ngModel)]="rg['parametre']">@for (i of indicateursCouverture(); track i) { <option>{{ i }}</option> }</select> }
              @else if (['CAS_MALADIE', 'HAUSSE_CAS'].includes(rg['indicateur'])) { <select id="r-par" name="par" class="input" [(ngModel)]="rg['parametre']">@for (m of epi.referentiel()?.maladies ?? []; track m.code) { <option [value]="m.code">{{ m.libelle }}</option> }</select> }
              @else { <input id="r-par" name="par" class="input" disabled value="—"> }</div>
            <div><label class="label" for="r-op">Condition</label><select id="r-op" name="op" class="input" [(ngModel)]="rg['operateur']">@for (o of epi.referentiel()?.operateurs ?? []; track o) { <option>{{ o }}</option> }</select></div>
            <div><label class="label" for="r-seuil">Seuil (validé par les responsables)</label><input id="r-seuil" name="seuil" type="number" class="input" [(ngModel)]="rg['seuil']"></div>
            <div><label class="label" for="r-prio">Priorité</label><select id="r-prio" name="prio" class="input" [(ngModel)]="rg['priorite']">@for (p of epi.referentiel()?.priorites ?? []; track p) { <option>{{ p }}</option> }</select></div>
            <div><label class="label" for="r-delai">Délai de traitement (jours)</label><input id="r-delai" name="delai" type="number" min="1" class="input" [(ngModel)]="rg['delaiTraitementJours']"></div>
            <div class="sm:col-span-2"><label class="label" for="r-ter">Territoire (périmètre)</label><select id="r-ter" name="ter" class="input" [(ngModel)]="rg['entiteCode']"><option value="">Territoire de détection</option>@for (e of epi.territoires(); track e.code) { <option [value]="e.code">{{ e.nom }} ({{ e.niveau }})</option> }</select></div>
            <div class="sm:col-span-2"><label class="label" for="r-dest">Destinataire</label><input id="r-dest" name="dest" class="input" [(ngModel)]="rg['destinataire']"></div>
            <div class="sm:col-span-2"><label class="label" for="r-msg">Message</label><input id="r-msg" name="msg" class="input" [(ngModel)]="rg['message']"></div>
            <div class="sm:col-span-2"><label class="label" for="r-act">Action recommandée</label><input id="r-act" name="act" class="input" [(ngModel)]="rg['actionRecommandee']"></div>
          </div>
          <div class="flex justify-end gap-2"><button type="button" class="btn-ghost" (click)="nouvelleRegle()">Réinitialiser</button><button type="submit" class="btn-primary">Enregistrer</button></div>
        </form>
      }
    }

    @case ('signaler') {
      <form class="card space-y-3 p-5" (ngSubmit)="signaler()">
        <h3 class="card-title">Signaler une insuffisance (qualité des données, constat de terrain)</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="sm:col-span-2"><label class="label" for="m-tit">Titre <span class="req">*</span></label><input id="m-tit" name="tit" class="input" [(ngModel)]="m['titre']"></div>
          <div><label class="label" for="m-dom">Domaine</label><select id="m-dom" name="dom" class="input" [(ngModel)]="m['domaine']">@for (x of epi.referentiel()?.domainesAlerte ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="m-prio">Priorité</label><select id="m-prio" name="prio" class="input" [(ngModel)]="m['priorite']">@for (x of epi.referentiel()?.priorites ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div class="sm:col-span-2 lg:col-span-4"><label class="label" for="m-msg">Description</label><textarea id="m-msg" name="msg" rows="2" class="input" [(ngModel)]="m['message']"></textarea></div>
          <div><label class="label" for="m-ech">Échéance</label><input id="m-ech" name="ech" type="date" class="input" [(ngModel)]="m['echeance']"></div>
          <div class="sm:col-span-2"><label class="label" for="m-don">Donnée concernée</label><input id="m-don" name="don" class="input" [(ngModel)]="m['donnee']"></div>
        </div>
        <div class="flex justify-end"><button type="submit" class="btn-primary">Créer l’alerte</button></div>
      </form>
    }
  }
</div>`,
})
export class AlertesComponent {
  epi = inject(EpidemiologieService);
  readonly pct = pct;
  readonly couleur = couleurStatutDonnee;
  readonly prio = couleurPrioriteEpi;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'tableau', libelle: 'Tableau général', icone: 'fa-chart-pie' },
    { id: 'liste', libelle: 'Alertes et actions correctives', icone: 'fa-list-check' },
    { id: 'regles', libelle: 'Configuration des alertes', icone: 'fa-gears' },
    { id: 'signaler', libelle: 'Signaler', icone: 'fa-flag' },
  ];
  onglet = signal<Onglet>('tableau');
  t = signal<Donnee | null>(null);
  alertes = signal<Donnee[]>([]);
  regles = signal<Donnee[]>([]);
  responsables = signal<Donnee[]>([]);
  indicateursCouverture = signal<string[]>([]);
  detail = signal<Donnee | null>(null);
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  filtres = { domaine: '', priorite: '', ouvertes: true };
  s: Donnee = {};
  rg: Donnee = {};
  m: Donnee = {};
  activation: { code: string; responsableValidation: string; referenceValidation: string } | null = null;

  constructor() {
    this.nouvelleRegle();
    this.m = { titre: '', domaine: 'Qualité des données', priorite: 'Modérée', message: '', echeance: '', donnee: '' };
    effect(() => {
      this.epi.entite();
      untracked(() => this.charger());
    });
  }

  lib = (l: Donnee[]) => l.map(x => x['libelle'] ?? x['mois']);
  val = (l: Donnee[]) => l.map(x => x['n'] as number);
  moisListe = (l: Donnee[]) => l.map(x => x['mois']);
  libelleIndicateur = (c: string) => this.epi.referentiel()?.indicateursAlerte.find(i => i.code === c)?.libelle ?? c;

  nouvelleRegle() {
    this.rg = { nom: '', indicateur: 'COUVERTURE', parametre: 'COUV-CPN1', operateur: '<', seuil: null, priorite: 'Élevée', delaiTraitementJours: 7, entiteCode: '', destinataire: '', message: '', actionRecommandee: '' };
  }

  async charger() {
    this.erreur.set('');
    try {
      const [t, r, resp, ind] = await Promise.all([
        this.epi.get('/alertes/tableau', { dans: this.epi.entite() }), this.epi.get('/alertes/regles'), this.epi.get<Donnee[]>('/alertes/responsables'), this.epi.get('/indicateurs'),
      ]);
      this.t.set(t);
      this.regles.set(r['regles']);
      this.responsables.set(resp);
      this.indicateursCouverture.set([...new Set((ind['indicateurs'] as Donnee[]).map(i => i['code'] as string))]);
      await this.chargerListe();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  async chargerListe() {
    try {
      this.alertes.set(await this.epi.get<Donnee[]>('/alertes', { dans: this.epi.entite(), domaine: this.filtres.domaine, priorite: this.filtres.priorite, ouvertes: this.filtres.ouvertes ? 'oui' : '' }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  ouvrir(a: Donnee) {
    this.detail.set(a);
    this.s = { responsableId: a['responsable']?.id ?? this.responsables()[0]?.['id'] ?? '', echeance: a['echeance'] ?? '', diagnostic: a['diagnostic'], actionCorrective: a['actionCorrective'],
      datePrevue: a['datePrevue'] ?? '', resultat: a['resultat'], preuve: a['preuve'], dateRealisation: a['dateRealisation'] ?? '', evaluation: a['evaluation'] ?? '' };
  }

  private async executer(action: () => Promise<Donnee | void>, message: string) {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const r = await action();
      if (message) this.message.set(message);
      if (r && r['numero']) this.detail.set(r);
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  detecter() {
    return this.executer(async () => {
      const b = await this.epi.post('/alertes/detection');
      this.message.set(`Détection terminée : ${b['creees']} nouvelle(s), ${b['repetees']} répétée(s), ${b['resolues']} résolue(s) automatiquement, ${b['regles']} règle(s) active(s).`);
    }, '');
  }

  action(type: 'attribuer' | 'traiter' | 'resoudre' | 'cloturer', a: Donnee) {
    const libelles = { attribuer: 'Alerte affectée.', traiter: 'Action corrective enregistrée.', resoudre: 'Alerte résolue.', cloturer: 'Alerte clôturée.' };
    return this.executer(() => this.epi.post(`/alertes/${a['numero']}/${type}`, this.s), libelles[type]);
  }

  editerRegle(r: Donnee) {
    this.rg = { ...r, entiteCode: r['entiteCode'] ?? '' };
  }

  enregistrerRegle() {
    const corps = { ...this.rg, entiteCode: this.rg['entiteCode'] || null };
    return this.executer(async () => {
      if (this.rg['code']) await this.epi.put(`/alertes/regles/${this.rg['code']}`, corps); else await this.epi.post('/alertes/regles', corps);
      this.nouvelleRegle();
    }, 'Règle enregistrée : elle doit être activée par un responsable pour produire des alertes.');
  }

  activer() {
    const a = this.activation!;
    return this.executer(async () => { await this.epi.post(`/alertes/regles/${a.code}/activer`, a); this.activation = null; }, 'Règle activée.');
  }

  statutRegle(r: Donnee, action: 'suspendre' | 'archiver') {
    return this.executer(() => this.epi.post(`/alertes/regles/${r['code']}/${action}`), action === 'suspendre' ? 'Règle suspendue.' : 'Règle archivée.');
  }

  signaler() {
    return this.executer(async () => {
      const a = await this.epi.post('/alertes', { ...this.m, entiteCode: this.epi.entite() });
      this.m['titre'] = '';
      this.m['message'] = '';
      this.onglet.set('liste');
      return a;
    }, 'Alerte créée : affectez-lui un responsable.');
  }
}
