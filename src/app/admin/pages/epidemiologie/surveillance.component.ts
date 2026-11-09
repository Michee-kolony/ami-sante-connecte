import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { EpidemiologieService, couleurPrioriteEpi, couleurStatutDonnee, pct, type Donnee } from '../../data/epidemiologie.service';
import { EpiGraphiqueComponent } from './partage/epi-graphique.component';
import { EpiValidationComponent } from './partage/epi-validation.component';

type Onglet = 'tableau' | 'notification' | 'cas' | 'evenements' | 'cartographie';

/**
 * Sous-fenêtre 5 — Surveillance épidémiologique : tableau de surveillance, notification d'un
 * événement (formulaire A), enregistrement des cas (formulaire B), investigation (formulaire C),
 * suivi, alertes épidémiques et cartographie par territoire. Une notification n'est pas un cas
 * confirmé ; seuls les cas validés entrent dans les indicateurs consolidés.
 */
@Component({
  selector: 'app-epi-surveillance',
  standalone: true,
  imports: [DatePipe, FormsModule, EpiGraphiqueComponent, EpiValidationComponent],
  template: `
<div class="space-y-5">
  <div class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
    <i class="fa-solid fa-circle-info"></i> AMI facilite l’application et la traçabilité des circuits officiels de notification (SIMR) : il ne les remplace pas. Les événements urgents suivent les délais et circuits officiels.
  </div>
  <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
    @for (o of onglets; track o.id) { <button type="button" class="onglet" [class.onglet-actif]="onglet() === o.id" (click)="onglet.set(o.id)"><i class="fa-solid {{ o.icone }}"></i> {{ o.libelle }}</button> }
  </div>
  @if (message()) { <p class="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200">{{ message() }}</p> }
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }

  @switch (onglet()) {
    @case ('tableau') {
      @if (t(); as d) {
        <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          @for (k of kpi(d['resume']); track k.libelle) { <div class="card p-4"><p class="text-xs text-slate-500">{{ k.libelle }}</p><p class="mt-1 text-2xl font-bold tabular-nums" [class.text-rose-600]="k.alerte">{{ k.valeur ?? '—' }}</p></div> }
        </div>
        <div class="grid gap-6 xl:grid-cols-2">
          <div class="card"><div class="card-header"><h2 class="card-title">Courbe épidémique — nouveaux cas validés par semaine</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="col(d['courbe'], 'semaine')" [series]="seriesCourbe(d)" [empile]="true" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Cas et décès par maladie</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="col(d['maladies'], 'libelle')" [series]="[{ libelle: 'Cas validés', valeurs: col(d['maladies'], 'casValides') }, { libelle: 'Décès', valeurs: col(d['maladies'], 'deces'), couleur: '#dc2626' }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Événements par statut</h2></div><div class="p-4">
            <app-epi-graphique type="doughnut" [etiquettes]="col(d['parEtat'], 'etat')" [series]="[{ libelle: 'Événements', valeurs: col(d['parEtat'], 'n') }]" /></div></div>
          <div class="card"><div class="card-header"><h2 class="card-title">Délais de notification (jours)</h2></div><div class="p-4">
            <app-epi-graphique [etiquettes]="col(d['delais'], 'numero')" [series]="[{ libelle: 'Délai (jours)', valeurs: col(d['delais'], 'jours') }]" /></div></div>
        </div>
        <div class="card overflow-x-auto"><table class="w-full min-w-[900px]">
          <thead><tr><th class="table-th">Maladie</th><th class="table-th text-right">Suspects</th><th class="table-th text-right">Probables</th><th class="table-th text-right">Confirmés</th><th class="table-th text-right">Décès</th><th class="table-th text-right">Létalité</th><th class="table-th text-right">Variation</th><th class="table-th text-right">Non validés</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (m of d['maladies']; track m.maladie) {
            <tr><td class="table-td">{{ m.libelle }}</td><td class="table-td text-right">{{ m.suspects }}</td><td class="table-td text-right">{{ m.probables }}</td><td class="table-td text-right">{{ m.confirmes }}</td><td class="table-td text-right">{{ m.deces }}</td>
              <td class="table-td text-right">{{ pct(m.letalite) }}</td><td class="table-td text-right" [title]="m.variationRaison ?? ''">{{ m.variation == null ? 'Non calculable' : pct(m.variation) }}</td><td class="table-td text-right text-slate-500">{{ m.nonValides }}</td></tr>
          } @empty { <tr><td colspan="8" class="table-td text-center text-slate-500">Aucun cas sur la période.</td></tr> }</tbody></table>
          <p class="px-5 py-3 text-xs text-slate-500">{{ d['formules'].letalite }}. {{ d['formules'].variation }}.</p></div>
      }
    }

    @case ('notification') {
      <form class="card space-y-4 p-5" (ngSubmit)="notifier()">
        <h2 class="card-title"><i class="fa-solid fa-bullhorn text-brand-600"></i> Formulaire A — Notification d’un événement sanitaire</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label class="label" for="n-type">Type d’événement <span class="req">*</span></label><select id="n-type" name="type" class="input" [(ngModel)]="n['type']">@for (x of r()?.typesEvenement ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="n-mal">Maladie ou événement <span class="req">*</span></label><select id="n-mal" name="mal" class="input" [(ngModel)]="n['maladie']">@for (c of r()?.categoriesMaladie ?? []; track c) { <optgroup [label]="c">@for (m of maladiesDe(c); track m.code) { <option [value]="m.code">{{ m.libelle }}</option> }</optgroup> }</select></div>
          <div><label class="label" for="n-deb">Date de début</label><input id="n-deb" name="deb" type="date" class="input" [(ngModel)]="n['dateDebut']"></div>
          <div><label class="label" for="n-prio">Priorité initiale <span class="req">*</span></label><select id="n-prio" name="prio" class="input" [(ngModel)]="n['priorite']">@for (x of r()?.priorites ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div class="sm:col-span-2"><label class="label" for="n-ent">Localisation (zone, aire, structure) <span class="req">*</span></label><select id="n-ent" name="ent" class="input" [(ngModel)]="n['entiteCode']">@for (e of localisations(); track e.code) { <option [value]="e.code">{{ e.nom }} ({{ e.niveau }})</option> }</select></div>
          <div><label class="label" for="n-cas">Nombre de cas signalés <span class="req">*</span></label><input id="n-cas" name="cas" type="number" min="0" class="input" [(ngModel)]="n['casSignales']"></div>
          <div><label class="label" for="n-dec">Nombre de décès signalés <span class="req">*</span></label><input id="n-dec" name="dec" type="number" min="0" class="input" [(ngModel)]="n['decesSignales']"></div>
          <div class="sm:col-span-2 lg:col-span-4"><label class="label" for="n-desc">Description <span class="req">*</span></label><textarea id="n-desc" name="desc" rows="3" class="input" [(ngModel)]="n['description']"></textarea></div>
          <div class="sm:col-span-2 lg:col-span-4"><label class="label" for="n-doc">Document joint (référence du rapport ou de la preuve)</label><input id="n-doc" name="doc" class="input" [(ngModel)]="n['document']"></div>
        </div>
        <p class="hint">Déclarant : utilisateur connecté. Date de notification : automatique. Saisie possible hors connexion (envoyée à la synchronisation).</p>
        <div class="flex justify-end"><button type="submit" class="btn-primary" [disabled]="envoi()"><i class="fa-solid fa-paper-plane"></i> Notifier</button></div>
      </form>
    }

    @case ('cas') {
      <form class="card space-y-4 p-5" (ngSubmit)="enregistrerCas()">
        <h2 class="card-title"><i class="fa-solid fa-user-injured text-brand-600"></i> Formulaire B — Enregistrement d’un cas</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label class="label" for="c-evt">Événement lié</label><select id="c-evt" name="evt" class="input" [(ngModel)]="c['evenementNumero']"><option value="">Aucun</option>@for (e of evenements(); track e['numero']) { <option [value]="e['numero']">{{ e['numero'] }} — {{ e['libelleMaladie'] }}</option> }</select></div>
          <div><label class="label" for="c-pers">Dossier AMI (AC-PAT / AC-ENF)</label><input id="c-pers" name="pers" class="input" [(ngModel)]="c['personneNumero']" placeholder="Facultatif"></div>
          <div><label class="label" for="c-mal">Maladie <span class="req">*</span></label><select id="c-mal" name="mal" class="input" [(ngModel)]="c['maladie']">@for (m of r()?.maladies ?? []; track m.code) { <option [value]="m.code">{{ m.libelle }}</option> }</select></div>
          <div><label class="label" for="c-cla">Classification <span class="req">*</span></label><select id="c-cla" name="cla" class="input" [(ngModel)]="c['classification']">@for (x of r()?.classificationsCas ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="c-age">Âge (années)</label><input id="c-age" name="age" type="number" min="0" class="input" [(ngModel)]="c['ageAnnees']"></div>
          <div><label class="label" for="c-dn">ou date de naissance</label><input id="c-dn" name="dn" type="date" class="input" [(ngModel)]="c['dateNaissance']"></div>
          <div><label class="label" for="c-sexe">Sexe <span class="req">*</span></label><select id="c-sexe" name="sexe" class="input" [(ngModel)]="c['sexe']">@for (x of r()?.sexes ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="c-loc">Localisation <span class="req">*</span></label><select id="c-loc" name="loc" class="input" [(ngModel)]="c['entiteCode']">@for (e of localisations(); track e.code) { <option [value]="e.code">{{ e.nom }}</option> }</select></div>
          <div><label class="label" for="c-ds">Début des symptômes</label><input id="c-ds" name="ds" type="date" class="input" [(ngModel)]="c['dateDebutSymptomes']"></div>
          <div><label class="label" for="c-dc">Date de consultation</label><input id="c-dc" name="dc" type="date" class="input" [(ngModel)]="c['dateConsultation']"></div>
          <div><label class="label" for="c-dp">Date de prélèvement</label><input id="c-dp" name="dp" type="date" class="input" [(ngModel)]="c['datePrelevement']"></div>
          <div><label class="label" for="c-lab">Résultat laboratoire</label><select id="c-lab" name="lab" class="input" [(ngModel)]="c['resultatLabo']">@for (x of r()?.resultatsLabo ?? []; track x) { <option>{{ x }}</option> }</select></div>
          <div><label class="label" for="c-iss">Issue</label><select id="c-iss" name="iss" class="input" [(ngModel)]="c['issue']">@for (x of r()?.issuesCas ?? []; track x) { <option>{{ x }}</option> }</select></div>
        </div>
        @if (doublon()) { <p class="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"><i class="fa-solid fa-clone"></i> {{ doublon() }}
          <button type="button" class="btn-secondary ml-2 py-1 text-xs" (click)="enregistrerCas(true)">Ce n’est pas le même cas : enregistrer</button></p> }
        <div class="flex justify-end"><button type="submit" class="btn-primary" [disabled]="envoi()">Enregistrer et soumettre</button></div>
      </form>
      <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title">Suivi des cas</h2></div>
        <table class="w-full min-w-[900px]"><thead><tr><th class="table-th">Identifiant</th><th class="table-th">Maladie</th><th class="table-th">Classification</th><th class="table-th">Début</th><th class="table-th">Issue</th><th class="table-th">Territoire</th><th class="table-th">Validation</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (x of cas(); track x['id']) {
            <tr><td class="table-td font-mono text-xs">{{ x['numero'] }}@if (x['personne'] && !x['personne'].masque) { <span class="block text-slate-500">{{ x['personne'].numero }}</span> }</td><td class="table-td">{{ x['libelleMaladie'] }}</td>
              <td class="table-td">{{ x['classification'] }}<span class="block text-xs text-slate-500">Labo : {{ x['resultatLabo'] }}</span></td><td class="table-td text-xs">{{ x['dateDebutSymptomes'] ?? x['dateConsultation'] ?? '—' }} · {{ x['semaine'] }}</td>
              <td class="table-td">{{ x['issue'] }}</td><td class="table-td text-xs">{{ x['territoire'] }}</td><td class="table-td"><app-epi-validation type="cas" [donnee]="x" (change)="charger()" /></td></tr>
          } @empty { <tr><td colspan="7" class="table-td text-center text-slate-500">Aucun cas.</td></tr> }</tbody></table></div>
    }

    @case ('evenements') {
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ul class="card divide-y divide-slate-100 dark:divide-slate-800">
          @for (e of evenements(); track e['id']) {
            <li class="cursor-pointer px-5 py-3 text-sm hover:bg-slate-50/60 dark:hover:bg-slate-800/40" (click)="ouvrir(e)" [class.bg-brand-50]="detail()?.['id'] === e['id']">
              <div class="flex flex-wrap items-center gap-2"><strong class="font-mono text-xs">{{ e['numero'] }}</strong> {{ e['libelleMaladie'] }}
                <span class="badge" [class]="prio(e['priorite'])">{{ e['priorite'] }}</span><span class="badge" [class]="couleur(e['etat'])">{{ e['etat'] }}</span></div>
              <p class="text-xs text-slate-500">{{ e['territoire'] }} · notifié le {{ e['dateNotification'] | date:'dd/MM/yyyy' }} · {{ e['casSignales'] }} cas, {{ e['decesSignales'] }} décès
                @if (e['delaiNotificationJours'] != null) { · délai {{ e['delaiNotificationJours'] }} j }</p>
            </li>
          } @empty { <li class="px-5 py-6 text-center text-sm text-slate-500">Aucun événement notifié.</li> }
        </ul>
        @if (detail(); as d) {
          <div class="card space-y-4 p-5 text-sm">
            <div class="flex flex-wrap items-start justify-between gap-2"><h3 class="card-title">{{ d['numero'] }} — {{ d['libelleMaladie'] }}</h3><app-epi-validation type="evenement" [donnee]="d" [archivable]="false" (change)="ouvrir(d)" /></div>
            <p>{{ d['description'] }}</p>
            <p class="text-xs text-slate-500">Déclarant : {{ d['creePar']?.nom }} · début {{ d['dateDebut'] ?? 'inconnu' }} · {{ d['territoire'] }}</p>
            <div class="grid gap-2 sm:grid-cols-3">
              <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p class="text-xs text-slate-500">Cas enregistrés</p><p class="font-semibold">{{ d['cas'].total }}</p><p class="text-xs">@for (k of cles(d['cas'].parClassification); track k) { {{ k }} {{ d['cas'].parClassification[k] }} · }</p></div>
              <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p class="text-xs text-slate-500">Létalité</p><p class="font-semibold">{{ pct(d['letalite'].valeur) }}</p></div>
              <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p class="text-xs text-slate-500">Taux d’attaque</p><p class="font-semibold">{{ pct(d['tauxAttaque'].valeur) }}</p></div>
            </div>
            @if (epi.droits()?.planification) {
              <div class="flex flex-wrap items-end gap-2">
                <div><label class="label text-xs" for="e-etat">État</label><select id="e-etat" class="input py-1.5" [(ngModel)]="etat">@for (x of r()?.statutsEvenement ?? []; track x) { <option>{{ x }}</option> }</select></div>
                <div class="min-w-[12rem] flex-1"><label class="label text-xs" for="e-mot">Conclusion / motif</label><input id="e-mot" class="input py-1.5" [(ngModel)]="motifEtat"></div>
                <button type="button" class="btn-secondary py-1.5 text-xs" (click)="changerEtat(d)">Appliquer</button>
              </div>
            }
            <form class="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700" (ngSubmit)="investiguer(d)">
              <p class="font-semibold">Formulaire C — Investigation</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <div><label class="label text-xs" for="i-deb">Début <span class="req">*</span></label><input id="i-deb" name="deb" type="date" class="input py-1.5" [(ngModel)]="inv['debut']"></div>
                <div><label class="label text-xs" for="i-resp">Responsable <span class="req">*</span></label><input id="i-resp" name="resp" class="input py-1.5" [(ngModel)]="inv['responsable']"></div>
                <div class="sm:col-span-2"><label class="label text-xs" for="i-eq">Équipe d’investigation</label><input id="i-eq" name="eq" class="input py-1.5" [(ngModel)]="inv['equipe']"></div>
                <div><label class="label text-xs" for="i-pi">Personnes interrogées</label><input id="i-pi" name="pi" type="number" min="0" class="input py-1.5" [(ngModel)]="inv['personnesInterrogees']"></div>
                <div><label class="label text-xs" for="i-pe">Personnes exposées</label><input id="i-pe" name="pe" type="number" min="0" class="input py-1.5" [(ngModel)]="inv['personnesExposees']"></div>
                @for (ch of champsInvestigation; track ch.cle) { <div class="sm:col-span-2"><label class="label text-xs" [for]="'i-' + ch.cle">{{ ch.libelle }}</label><textarea [id]="'i-' + ch.cle" [name]="ch.cle" rows="1" class="input py-1.5" [(ngModel)]="inv[ch.cle]"></textarea></div> }
                <div><label class="label text-xs" for="i-tr">Transmission du rapport</label><input id="i-tr" name="tr" type="date" class="input py-1.5" [(ngModel)]="inv['transmissionRapport']"></div>
              </div>
              <div class="flex justify-end"><button type="submit" class="btn-primary py-1.5 text-xs" [disabled]="!epi.droits()?.planification">Enregistrer l’investigation</button></div>
            </form>
            <form class="flex flex-wrap items-end gap-2" (ngSubmit)="ajouterSuivi(d)">
              <div><label class="label text-xs" for="s-d">Suivi le</label><input id="s-d" name="d" type="date" class="input py-1.5" [(ngModel)]="sv['date']"></div>
              <div class="w-20"><label class="label text-xs" for="s-c">Cas</label><input id="s-c" name="c" type="number" min="0" class="input py-1.5" [(ngModel)]="sv['cas']"></div>
              <div class="w-20"><label class="label text-xs" for="s-x">Décès</label><input id="s-x" name="x" type="number" min="0" class="input py-1.5" [(ngModel)]="sv['deces']"></div>
              <div class="min-w-[10rem] flex-1"><label class="label text-xs" for="s-o">Observation</label><input id="s-o" name="o" class="input py-1.5" [(ngModel)]="sv['observation']"></div>
              <button type="submit" class="btn-secondary py-1.5 text-xs">Ajouter</button>
            </form>
            @if (d['suivis']?.length) { <ul class="text-xs">@for (s of d['suivis']; track $index) { <li>{{ s.date }} — {{ s.cas ?? '—' }} cas, {{ s.deces ?? '—' }} décès — {{ s.observation }} ({{ s.par?.nom }})</li> }</ul> }
          </div>
        } @else { <p class="text-sm text-slate-500">Sélectionnez un événement pour l’investigation et le suivi.</p> }
      </div>
    }

    @case ('cartographie') {
      @if (t(); as d) {
        <div class="card overflow-x-auto"><div class="card-header"><h2 class="card-title"><i class="fa-solid fa-map text-brand-600"></i> Événements sanitaires par territoire</h2></div>
          <table class="w-full min-w-[600px]"><thead><tr><th class="table-th">Territoire</th><th class="table-th text-right">Événements</th><th class="table-th text-right">Actifs</th><th class="table-th text-right">Cas signalés</th><th class="table-th text-right">Décès signalés</th></tr></thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">@for (z of d['parZone']; track z.territoire) { <tr><td class="table-td">{{ z.territoire }}<span class="block text-xs text-slate-500">{{ z.niveau }}</span></td><td class="table-td text-right">{{ z.evenements }}</td><td class="table-td text-right">{{ z.actifs }}</td><td class="table-td text-right">{{ z.cas }}</td><td class="table-td text-right">{{ z.deces }}</td></tr>
            } @empty { <tr><td colspan="5" class="table-td text-center text-slate-500">Aucun événement sur la période.</td></tr> }</tbody></table></div>
        @if (d['parZone'].length) {
          <div class="card"><div class="card-header"><h2 class="card-title">Évolution des événements par zone</h2></div><div class="p-4">
            <app-epi-graphique [horizontal]="true" [etiquettes]="col(d['parZone'], 'territoire')" [series]="[{ libelle: 'Cas signalés', valeurs: col(d['parZone'], 'cas') }, { libelle: 'Décès', valeurs: col(d['parZone'], 'deces'), couleur: '#dc2626' }]" /></div></div>
        }
      }
    }
  }
</div>`,
})
export class SurveillanceComponent {
  epi = inject(EpidemiologieService);
  r = this.epi.referentiel;
  readonly pct = pct;
  readonly couleur = couleurStatutDonnee;
  readonly prio = couleurPrioriteEpi;
  readonly onglets: { id: Onglet; libelle: string; icone: string }[] = [
    { id: 'tableau', libelle: 'Tableau de surveillance', icone: 'fa-chart-line' },
    { id: 'notification', libelle: 'Notification', icone: 'fa-bullhorn' },
    { id: 'cas', libelle: 'Cas', icone: 'fa-user-injured' },
    { id: 'evenements', libelle: 'Investigation et suivi', icone: 'fa-magnifying-glass' },
    { id: 'cartographie', libelle: 'Cartographie', icone: 'fa-map' },
  ];
  readonly champsInvestigation = [
    { cle: 'hypothese', libelle: 'Hypothèse initiale' }, { cle: 'resultatsPrelevements', libelle: 'Résultats des prélèvements' },
    { cle: 'mesuresImmediates', libelle: 'Mesures immédiates prises' }, { cle: 'besoinsMedicaments', libelle: 'Besoins en médicaments et matériels' },
    { cle: 'besoinsPersonnel', libelle: 'Besoins en personnel' }, { cle: 'recommandations', libelle: 'Recommandations' },
    { cle: 'rapport', libelle: 'Rapport d’investigation (référence)' }, { cle: 'conclusion', libelle: 'Conclusion' },
  ];
  onglet = signal<Onglet>('tableau');
  t = signal<Donnee | null>(null);
  evenements = signal<Donnee[]>([]);
  cas = signal<Donnee[]>([]);
  detail = signal<Donnee | null>(null);
  doublon = signal('');
  erreur = signal('');
  message = signal('');
  envoi = signal(false);
  n: Donnee = {};
  c: Donnee = {};
  inv: Donnee = {};
  sv: Donnee = {};
  etat = 'Vérifié';
  motifEtat = '';

  constructor() {
    this.reinitialiser();
    effect(() => {
      this.epi.entite();
      this.epi.annee();
      untracked(() => { this.reinitialiser(); this.charger(); });
    });
  }

  localisations = () => this.epi.territoires().filter(e => !['Pays', 'Province'].includes(e.niveau) && (e.code === this.epi.entite() || this.dans(e.code)));
  private dans(code: string): boolean {
    let e = this.epi.territoires().find(x => x.code === code);
    while (e) { if (e.parentCode === this.epi.entite()) return true; e = this.epi.territoires().find(x => x.code === e!.parentCode); }
    return false;
  }
  maladiesDe = (cat: string) => (this.r()?.maladies ?? []).filter(m => m.categorie === cat);
  col = (l: Donnee[], k: string) => l.map(x => x[k]);
  cles = (o: Donnee) => Object.keys(o ?? {});
  kpi = (r: Donnee) => [
    { libelle: 'Événements', valeur: r['evenements'] }, { libelle: 'Événements actifs', valeur: r['evenementsActifs'] },
    { libelle: 'Cas validés', valeur: r['casValides'] }, { libelle: 'Confirmés', valeur: r['confirmes'] },
    { libelle: 'Décès', valeur: r['deces'], alerte: r['deces'] > 0 }, { libelle: 'Prioritaires sans investigation', valeur: r['sansInvestigation'], alerte: r['sansInvestigation'] > 0 },
  ];
  seriesCourbe(d: Donnee) {
    const maladies = [...new Set((d['courbe'] as Donnee[]).flatMap(s => Object.keys(s['parMaladie'])))];
    return maladies.map(m => ({ libelle: this.epi.libelleMaladie(m), valeurs: (d['courbe'] as Donnee[]).map(s => s['parMaladie'][m] ?? 0) }));
  }

  reinitialiser() {
    const loc = this.localisations()[0]?.code ?? this.epi.entite();
    const auj = new Date().toISOString().slice(0, 10);
    this.n = { type: 'Maladie', maladie: 'CHOLERA', dateDebut: auj, priorite: 'Élevée', entiteCode: loc, casSignales: 1, decesSignales: 0, description: '', document: '' };
    this.c = { evenementNumero: '', personneNumero: '', maladie: 'CHOLERA', classification: 'Suspect', ageAnnees: null, dateNaissance: '', sexe: 'Inconnu', entiteCode: loc,
      dateDebutSymptomes: auj, dateConsultation: auj, datePrelevement: '', resultatLabo: 'Non réalisé', issue: 'En cours' };
    this.sv = { date: auj, cas: null, deces: null, observation: '' };
  }

  async charger() {
    this.erreur.set('');
    const filtre = { dans: this.epi.entite(), annee: this.epi.annee() };
    try {
      const [t, ev, cas] = await Promise.all([
        this.epi.get('/surveillance/tableau', filtre), this.epi.get<Donnee[]>('/evenements', { dans: this.epi.entite() }), this.epi.get<Donnee[]>('/cas', filtre),
      ]);
      this.t.set(t);
      this.evenements.set(ev);
      this.cas.set(cas);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  private async executer(action: () => Promise<unknown>, message: string) {
    this.envoi.set(true);
    this.erreur.set('');
    this.message.set('');
    try {
      await action();
      this.message.set(message);
      await this.charger();
    } catch (e) {
      const err = e as { error?: { horsLigne?: boolean } };
      if (err.error?.horsLigne) this.message.set(messageErreur(e)); else this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  notifier() {
    return this.executer(async () => {
      const ev = await this.epi.post('/evenements', this.n);
      this.message.set(`Événement ${ev['numero']} notifié.`);
      this.reinitialiser();
    }, 'Événement notifié et transmis pour vérification.');
  }

  async enregistrerCas(forcer = false) {
    this.doublon.set('');
    const corps = { ...this.c, forcer, ageAnnees: this.c['ageAnnees'] === '' ? null : this.c['ageAnnees'] };
    for (const k of ['dateNaissance', 'datePrelevement', 'personneNumero', 'evenementNumero']) if (!corps[k]) delete corps[k];
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const x = await this.epi.post('/cas', corps);
      this.message.set(`Cas ${x['numero']} enregistré et soumis pour validation.`);
      this.reinitialiser();
      await this.charger();
    } catch (e) {
      const err = e as { status?: number; error?: { horsLigne?: boolean } };
      if (err.status === 409) this.doublon.set(messageErreur(e));
      else if (err.error?.horsLigne) this.message.set(messageErreur(e));
      else this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  async ouvrir(e: Donnee) {
    try {
      const d = await this.epi.get(`/evenements/${e['id']}`);
      this.detail.set(d);
      this.etat = d['etat'];
      this.inv = { debut: new Date().toISOString().slice(0, 10), ...(d['investigation'] ?? {}) };
    } catch (err) {
      this.erreur.set(messageErreur(err));
    }
  }

  investiguer(d: Donnee) {
    const { par: _p, le: _l, ...corps } = this.inv;
    void _p; void _l;
    return this.executer(async () => { await this.epi.put(`/evenements/${d['id']}/investigation`, corps); await this.ouvrir(d); }, 'Investigation enregistrée.');
  }
  ajouterSuivi(d: Donnee) {
    return this.executer(async () => { await this.epi.post(`/evenements/${d['id']}/suivi`, this.sv); await this.ouvrir(d); }, 'Point de suivi ajouté.');
  }
  changerEtat(d: Donnee) {
    return this.executer(async () => { await this.epi.post(`/evenements/${d['id']}/etat`, { etat: this.etat, motif: this.motifEtat }); this.motifEtat = ''; await this.ouvrir(d); }, 'État de l’événement mis à jour.');
  }
}
