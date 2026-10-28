import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../data/session.service';
import { LIBELLES_PARAMETRES, RelanceService, type ParametresRegle, type Parametrage, type ParcoursRelance, type RegleRelance } from '../../data/relance.service';

type Champ = keyof typeof LIBELLES_PARAMETRES;

/**
 * Paramétrage de la relance : fiches des parcours RAC, ARC, RPC, IRC, TCC et règles de
 * déclenchement. Toute modification crée une version et doit être validée de nouveau ; une
 * règle ne s'active qu'avec un parcours validé, un responsable et un protocole de référence.
 */
@Component({
  selector: 'app-relance-parametrage',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
<div class="space-y-6">
  <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
    <i class="fa-solid fa-scale-balanced"></i>
    Les définitions officielles de RAC, ARC, RPC, IRC et TCC, les délais de tolérance et les calendriers doivent être <strong>validés par le projet et les autorités sanitaires</strong>
    (protocoles RDC/PEV) avant activation. Les valeurs proposées par défaut ne sont que des points de départ : aucune relance n’est générée tant qu’une règle n’est pas activée.
  </div>
  @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{{ erreur() }}</p> }
  @if (p(); as prm) {
    @if (!prm.modifiable) { <p class="text-sm text-slate-500"><i class="fa-solid fa-lock"></i> Lecture seule : le paramétrage est réservé au médecin chef de service et au médecin directeur.</p> }

    <!-- Parcours -->
    <div class="card">
      <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-route text-brand-600"></i> Parcours (fiches de paramétrage)</h2></div>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (c of prm.parcours; track c.code) {
          <li class="px-5 py-4 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p><strong class="font-mono">{{ c.code }}</strong> — {{ c.libelle }} <span class="text-xs text-slate-500">v{{ c.version }}</span>
                <span class="badge ml-1" [class]="c.statut === 'Validé' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'">{{ c.statut }}</span></p>
              @if (prm.modifiable) {
                <span class="flex gap-1">
                  <button type="button" class="btn-ghost px-2 text-xs" (click)="editerParcours(c)"><i class="fa-solid fa-pen"></i> Modifier</button>
                  @if (c.statut !== 'Validé') { <button type="button" class="btn-ghost px-2 text-xs" (click)="validation.set({ type: 'parcours', code: c.code, responsable: '', reference: '', dateEffet: '' })"><i class="fa-solid fa-stamp"></i> Valider</button> }
                  @else { <button type="button" class="btn-ghost px-2 text-xs" (click)="suspendreParcours(c)"><i class="fa-solid fa-pause"></i> Suspendre</button> }
                </span>
              }
            </div>
            @if (c.definition) { <p class="mt-1 text-slate-600 dark:text-slate-300">{{ c.definition }}</p> } @else { <p class="mt-1 italic text-slate-400">Définition à saisir et valider.</p> }
            @if (c.statut === 'Validé') { <p class="mt-1 text-xs text-slate-500">Validé par {{ c.responsableValidation }} — {{ c.referenceValidation }}{{ c.dateEffet ? ', en vigueur le ' + c.dateEffet : '' }}</p> }
            <p class="text-xs text-slate-400">Modifié par {{ c.modifiePar.nom }} le {{ c.modifieLe | date:'dd/MM/yyyy HH:mm' }} · {{ c.historique.length }} version(s) antérieure(s)</p>
          </li>
        }
      </ul>
    </div>

    <!-- Règles -->
    <div class="card">
      <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-bolt text-brand-600"></i> Règles de déclenchement</h2></div>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (r of prm.regles; track r.code) {
          <li class="px-5 py-4 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p><span class="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ r.domaine }}</span> <strong>{{ r.libelle }}</strong> <span class="text-xs text-slate-500">v{{ r.version }}</span>
                <span class="badge ml-1" [class]="r.statut === 'Active' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'">{{ r.statut }}</span></p>
              @if (prm.modifiable) {
                <span class="flex gap-1">
                  <button type="button" class="btn-ghost px-2 text-xs" (click)="editerRegle(r)"><i class="fa-solid fa-pen"></i> Modifier</button>
                  @if (r.statut !== 'Active') { <button type="button" class="btn-ghost px-2 text-xs" (click)="validation.set({ type: 'regle', code: r.code, responsable: '', reference: '', dateEffet: '' })"><i class="fa-solid fa-play"></i> Activer</button> }
                  @else { <button type="button" class="btn-ghost px-2 text-xs" (click)="suspendreRegle(r)"><i class="fa-solid fa-pause"></i> Suspendre</button> }
                </span>
              }
            </div>
            <p class="mt-1 text-slate-600 dark:text-slate-300">{{ r.description }}</p>
            <p class="mt-1 text-xs text-slate-500">Parcours : <strong>{{ r.parcoursCode ?? 'non rattaché' }}</strong> · tolérance {{ r.parametres.toleranceJours }} j · échéance {{ r.parametres.delaiTraitementJours }} j ·
              {{ r.parametres.tentativesMax }} tentatives · priorité {{ r.parametres.priorite }}</p>
            @if (r.statut === 'Active') { <p class="text-xs text-slate-500">Activée par {{ r.responsableValidation }} — {{ r.referenceProtocole }}</p> }
          </li>
        }
      </ul>
    </div>
  }

  <!-- Validation / activation -->
  @if (validation(); as v) {
    <form class="card space-y-3 p-5" (ngSubmit)="valider()">
      <h3 class="card-title">{{ v.type === 'parcours' ? 'Valider la fiche ' + v.code : 'Activer la règle ' + v.code }}</h3>
      <div><label class="label" for="vr">Responsable de la validation (nom et fonction) <span class="req">*</span></label><input id="vr" name="vr" class="input" [(ngModel)]="v.responsable" required></div>
      <div><label class="label" for="vf">{{ v.type === 'parcours' ? 'Référence du document validé (PV, note…)' : 'Protocole RDC/PEV de référence' }} <span class="req">*</span></label><input id="vf" name="vf" class="input" [(ngModel)]="v.reference" required></div>
      <div><label class="label" for="vd">Date d’effet</label><input id="vd" name="vd" type="date" class="input" [(ngModel)]="v.dateEffet"></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn-ghost" (click)="validation.set(null)">Annuler</button><button type="submit" class="btn-primary" [disabled]="envoi()">Confirmer</button></div>
    </form>
  }

  <!-- Édition d'un parcours -->
  @if (parcours(); as c) {
    <form class="card space-y-3 p-5" (ngSubmit)="enregistrerParcours(c)">
      <h3 class="card-title">Fiche {{ c.code }} (nouvelle version v{{ c.version + 1 }}, à valider de nouveau)</h3>
      <div><label class="label" for="pl">Libellé</label><input id="pl" name="pl" class="input" [(ngModel)]="c.libelle"></div>
      @for (champ of champsParcours; track champ.cle) {
        <div><label class="label" [for]="champ.cle">{{ champ.libelle }}</label><textarea [id]="champ.cle" [name]="champ.cle" class="input" rows="2" [(ngModel)]="c[champ.cle]"></textarea></div>
      }
      <div><label class="label" for="pa">Actions autorisées (une par ligne)</label><textarea id="pa" name="pa" class="input" rows="3" [(ngModel)]="actions"></textarea></div>
      <div><label class="label" for="pd">Délai (jours)</label><input id="pd" name="pd" type="number" min="1" class="input" [(ngModel)]="c.delaiJours"></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn-ghost" (click)="parcours.set(null)">Annuler</button><button type="submit" class="btn-primary" [disabled]="envoi()">Enregistrer la version</button></div>
    </form>
  }

  <!-- Édition d'une règle -->
  @if (regle(); as r) {
    <form class="card space-y-3 p-5" (ngSubmit)="enregistrerRegle(r)">
      <h3 class="card-title">{{ r.code }} (nouvelle version v{{ r.version + 1 }}, à réactiver ensuite)</h3>
      <div><label class="label" for="rl">Libellé</label><input id="rl" name="rl" class="input" [(ngModel)]="r.libelle"></div>
      <div><label class="label" for="rd">Description</label><textarea id="rd" name="rd" class="input" rows="2" [(ngModel)]="r.description"></textarea></div>
      <div><label class="label" for="rpc">Parcours</label>
        <select id="rpc" name="rpc" class="input" [(ngModel)]="r.parcoursCode"><option [ngValue]="null">Non rattaché</option>
          @for (c of p()?.parcours ?? []; track c.code) { <option [ngValue]="c.code">{{ c.code }} — {{ c.libelle }}</option> }</select></div>
      <div class="grid gap-3 sm:grid-cols-2">
        @for (k of champsRegle; track k) {
          <div><label class="label" [for]="k">{{ libelles[k] }}</label><input [id]="k" [name]="k" type="number" class="input" [(ngModel)]="r.parametres[k]"
            [min]="p()?.referentiel?.bornes?.[k]?.[0] ?? 0" [max]="p()?.referentiel?.bornes?.[k]?.[1] ?? 9999"></div>
        }
        <div><label class="label" for="rpr">Priorité</label>
          <select id="rpr" name="rpr" class="input" [(ngModel)]="r.parametres.priorite">@for (x of p()?.referentiel?.priorites ?? []; track x) { <option [value]="x">{{ x }}</option> }</select></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn-ghost" (click)="regle.set(null)">Annuler</button><button type="submit" class="btn-primary" [disabled]="envoi()">Enregistrer la version</button></div>
    </form>
  }
</div>
  `,
})
export class RelanceParametrageComponent implements OnInit {
  private service = inject(RelanceService);

  readonly libelles = LIBELLES_PARAMETRES;
  readonly champsRegle = Object.keys(LIBELLES_PARAMETRES) as Champ[];
  readonly champsParcours: { cle: 'definition' | 'criteresEntree' | 'criteresSortie' | 'formuleIndicateur'; libelle: string }[] = [
    { cle: 'definition', libelle: 'Définition validée' },
    { cle: 'criteresEntree', libelle: 'Critères d’entrée (éligibilité)' },
    { cle: 'criteresSortie', libelle: 'Critères de sortie' },
    { cle: 'formuleIndicateur', libelle: 'Formule de l’indicateur (numérateur, dénominateur, période, population)' },
  ];

  p = signal<Parametrage | null>(null);
  parcours = signal<ParcoursRelance | null>(null);
  regle = signal<RegleRelance | null>(null);
  validation = signal<{ type: 'parcours' | 'regle'; code: string; responsable: string; reference: string; dateEffet: string } | null>(null);
  actions = '';
  erreur = signal('');
  envoi = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  private async faire<T>(action: () => Promise<T>): Promise<T | undefined> {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      return await action();
    } catch (err) {
      this.erreur.set(messageErreur(err));
      return undefined;
    } finally {
      this.envoi.set(false);
    }
  }

  async charger(): Promise<void> {
    const r = await this.faire(() => this.service.parametrage());
    if (r) this.p.set(r);
  }

  editerParcours(c: ParcoursRelance): void {
    this.regle.set(null);
    this.actions = c.actionsAutorisees.join('\n');
    this.parcours.set(structuredClone(c));
  }

  editerRegle(r: RegleRelance): void {
    this.parcours.set(null);
    this.regle.set(structuredClone(r));
  }

  async enregistrerParcours(c: ParcoursRelance): Promise<void> {
    const ok = await this.faire(() => this.service.modifierParcours(c.code, {
      libelle: c.libelle, definition: c.definition, criteresEntree: c.criteresEntree, criteresSortie: c.criteresSortie,
      formuleIndicateur: c.formuleIndicateur, delaiJours: c.delaiJours, actionsAutorisees: this.actions.split('\n').map(a => a.trim()).filter(Boolean),
    }));
    if (ok) { this.parcours.set(null); this.charger(); }
  }

  async enregistrerRegle(r: RegleRelance): Promise<void> {
    const parametres: Partial<ParametresRegle> = { ...r.parametres };
    for (const k of this.champsRegle) parametres[k] = Number(r.parametres[k]);
    const ok = await this.faire(() => this.service.modifierRegle(r.code, { libelle: r.libelle, description: r.description, parcoursCode: r.parcoursCode, parametres }));
    if (ok) { this.regle.set(null); this.charger(); }
  }

  async valider(): Promise<void> {
    const v = this.validation();
    if (!v) return;
    const ok = v.type === 'parcours'
      ? await this.faire(() => this.service.validerParcours(v.code, { responsableValidation: v.responsable, referenceValidation: v.reference, dateEffet: v.dateEffet }))
      : await this.faire(() => this.service.activerRegle(v.code, { responsableValidation: v.responsable, referenceProtocole: v.reference, dateEffet: v.dateEffet }));
    if (ok) { this.validation.set(null); this.charger(); }
  }

  async suspendreParcours(c: ParcoursRelance): Promise<void> {
    if (!confirm(`Suspendre le parcours ${c.code} ? Ses règles cesseront de créer des tâches.`)) return;
    if (await this.faire(() => this.service.suspendreParcours(c.code))) this.charger();
  }

  async suspendreRegle(r: RegleRelance): Promise<void> {
    if (!confirm(`Suspendre la règle « ${r.libelle} » ?`)) return;
    if (await this.faire(() => this.service.suspendreRegle(r.code))) this.charger();
  }
}
