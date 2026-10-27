import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColonneLatence, LatencePartogramme, PhaseArrivee } from '../data/accouchements.service';
import { dateHeureChiffres, heureFr, versSaisieLocale } from '../data/format';

/** Colonnes minimales, comme sur la feuille : 0 à 12 h depuis l'arrivée. */
const COLONNES = 13;
/** Lignes vides minimales du tableau des affections, comme sur la feuille. */
const LIGNES_AFFECTIONS = 3;

const heures = (h: number | null) => (h != null ? String(h).replace('.', ',') : null);

/** Lignes du tableau, dans l'ordre de la feuille papier. */
const LIGNES: { titre: string; valeur: (c: ColonneLatence) => string | number | null; anormal?: (c: ColonneLatence) => boolean }[] = [
  { titre: 'Temps depuis la rupture des membranes (en h)', valeur: c => heures(c.ruptureH) },
  { titre: 'Temps depuis le début du travail (en h)', valeur: c => heures(c.debutTravailH) },
  { titre: 'Saignement vaginal (0 - +++)', valeur: c => c.saignement },
  { titre: 'Nbre de contractions en 10 minutes', valeur: c => c.contractions10min },
  { titre: 'Durée des contractions (en secondes)', valeur: c => c.dureeContractionsSec },
  { titre: 'Bruits du cœur fœtal (battements / minute)', valeur: c => c.bcf, anormal: c => c.bcf != null && (c.bcf < 120 || c.bcf > 160) },
  { titre: 'Température (axillaire)', valeur: c => (c.temperature != null ? String(c.temperature).replace('.', ',') : null) },
  { titre: 'Pouls (battements / minute)', valeur: c => c.pouls },
  { titre: 'Tension artérielle (systolique / diastolique)', valeur: c => (c.taSystolique != null || c.taDiastolique != null ? `${c.taSystolique ?? '?'}/${c.taDiastolique ?? '?'}` : null) },
  { titre: 'Diurèse (en mL)', valeur: c => c.diurese || null },
  { titre: 'Dilatation du col (en cm)', valeur: c => c.dilatationCm },
];

/** Tableau vide (dossier ancien ou cache hors ligne) : la grille de la feuille s'affiche quand même. */
function completer(l: LatencePartogramme | null | undefined): LatencePartogramme {
  return {
    phaseArrivee: l?.phaseArrivee ?? null,
    colonnes: l?.colonnes?.length ? l.colonnes : Array.from({ length: COLONNES }, (_, heure) => ({
      heure, debut: '', mesureLe: null, ruptureH: null, debutTravailH: null, saignement: null, contractions10min: null,
      dureeContractionsSec: null, bcf: null, temperature: null, pouls: null, taSystolique: null, taDiastolique: null, diurese: null, dilatationCm: null,
    })),
    affections: l?.affections ?? [],
    evacuation: l?.evacuation ?? null,
  };
}

/**
 * Tableau « II. Surveillance de la phase de latence (< 4 cm) », comme la feuille papier : phase
 * du travail à l'arrivée, une colonne par heure écoulée depuis l'arrivée (rempli à chaque
 * surveillance), affections et traitements, puis évacuation pendant le travail (modifiable).
 */
@Component({
  selector: 'app-partogramme-latence',
  standalone: true,
  imports: [FormsModule],
  template: `
<div class="card">
  <div class="card-header flex-wrap gap-2">
    <h3 class="card-title"><i class="fa-solid fa-hourglass-half text-brand-600 dark:text-brand-400"></i> II. Surveillance de la phase de latence (&lt; 4 cm)</h3>
  </div>
  <div class="overflow-x-auto">
    <div class="min-w-[720px] p-4 text-[11px] text-slate-700 dark:text-slate-300">
      <table class="w-full table-fixed border-collapse">
        <caption class="sr-only">Surveillance de la phase de latence : une colonne par heure écoulée depuis l’arrivée</caption>
        <colgroup><col class="w-56"></colgroup>
        <thead>
          <tr>
            <th scope="row" class="border border-slate-400 px-1.5 py-1 text-left font-bold dark:border-slate-600">Phase de travail à l’arrivée :</th>
            <td [attr.colspan]="l.colonnes.length" class="border border-slate-400 px-2 py-1 dark:border-slate-600">
              <div class="flex flex-wrap gap-x-6 gap-y-1">
                @for (ph of phases; track ph.code) {
                  <span class="flex items-center gap-1.5" [class.font-bold]="l.phaseArrivee === ph.code">
                    {{ ph.libelle }}
                    <span class="inline-flex h-3.5 w-3.5 items-center justify-center border border-slate-500 dark:border-slate-400" [attr.aria-label]="l.phaseArrivee === ph.code ? 'coché' : 'non coché'">
                      @if (l.phaseArrivee === ph.code) { <i class="fa-solid fa-xmark text-[10px] text-brand-700 dark:text-brand-300"></i> }
                    </span>
                  </span>
                }
              </div>
            </td>
          </tr>
          <tr>
            <th scope="row" class="border border-slate-400 px-1.5 py-1 text-left font-bold dark:border-slate-600">Temps écoulé depuis l’arrivée (en heures)</th>
            @for (c of l.colonnes; track c.heure) {
              <th scope="col" class="border border-slate-400 px-0.5 py-1 text-center font-bold dark:border-slate-600" [attr.title]="c.debut ? 'À partir de ' + heure(c.debut) : null">
                {{ c.heure }}
                @if (c.debut) { <span class="block text-[10px] font-normal text-slate-500 dark:text-slate-400">{{ heure(c.debut) }}</span> }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (ligne of lignes; track ligne.titre) {
            <tr>
              <th scope="row" class="border border-slate-400 px-1.5 py-1 text-left font-medium leading-tight dark:border-slate-600">{{ ligne.titre }}</th>
              @for (c of l.colonnes; track c.heure) {
                <td class="break-words border border-slate-400 px-0.5 py-1 text-center align-middle font-semibold dark:border-slate-600"
                    [attr.title]="c.mesureLe && ligne.valeur(c) != null ? 'Mesure du ' + dateHeure(c.mesureLe) : null">
                  <span [class]="ligne.anormal?.(c) ? 'text-rose-600 dark:text-rose-400' : ''">{{ ligne.valeur(c) ?? '' }}</span>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>

      <!-- Affections de la phase de latence (saisies avec la surveillance) -->
      <table class="mt-4 w-full table-fixed border-collapse">
        <caption class="sr-only">Affections survenues pendant la phase de latence et traitements</caption>
        <colgroup><col class="w-56"><col class="w-40"><col></colgroup>
        <thead>
          <tr>
            <th scope="col" class="border border-slate-400 px-1.5 py-1 text-left font-bold dark:border-slate-600">Affection</th>
            <th scope="col" class="border border-slate-400 px-1.5 py-1 text-left font-bold dark:border-slate-600">Heure d’apparition</th>
            <th scope="col" class="border border-slate-400 px-1.5 py-1 text-left font-bold dark:border-slate-600">Traitements et soins autres que la surveillance</th>
          </tr>
        </thead>
        <tbody>
          @for (x of l.affections; track x.id) {
            <tr>
              <td class="border border-slate-400 px-1.5 py-1 font-semibold dark:border-slate-600">{{ x.affection || '—' }}</td>
              <td class="border border-slate-400 px-1.5 py-1 dark:border-slate-600">{{ dateHeure(x.le) }}</td>
              <td class="border border-slate-400 px-1.5 py-1 dark:border-slate-600">{{ x.traitements || '—' }}</td>
            </tr>
          }
          @for (v of lignesVides; track $index) {
            <tr class="h-6">
              <td class="border border-slate-400 dark:border-slate-600"></td>
              <td class="border border-slate-400 dark:border-slate-600"></td>
              <td class="border border-slate-400 dark:border-slate-600"></td>
            </tr>
          }
        </tbody>
      </table>

      <!-- Évacuation pendant le travail ou l'accouchement -->
      <div class="mt-4 border border-slate-400 px-2 py-2 dark:border-slate-600">
        <p class="font-medium">Si la femme est évacuée pendant le travail ou l’accouchement, noter l’heure et expliquer pourquoi :</p>
        @if (!edition) {
          <div class="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            @if (l.evacuation; as e) {
              <p class="text-xs"><strong class="text-rose-600 dark:text-rose-400">Évacuée le {{ dateHeure(e.le) }}</strong> — {{ e.motif }}
                @if (e.par) { <span class="text-slate-500 dark:text-slate-400"> · noté par {{ e.par.nom }}</span> }</p>
            } @else {
              <p class="text-xs text-slate-500 dark:text-slate-400">Aucune évacuation.</p>
            }
            @if (modifiable) {
              <button type="button" class="btn-secondary !px-2.5 !py-1 text-xs" (click)="ouvrir()">
                <i class="fa-solid fa-pen"></i> {{ l.evacuation ? 'Modifier' : 'Noter une évacuation' }}
              </button>
            }
          </div>
        } @else {
          <div class="mt-2 grid gap-3 sm:grid-cols-[auto_1fr]">
            <div><label class="label">Heure *</label><input type="datetime-local" class="input" [(ngModel)]="formLe"></div>
            <div><label class="label">Motif *</label><input class="input" [(ngModel)]="formMotif" maxlength="1000"></div>
          </div>
          <div class="mt-3 flex flex-wrap justify-end gap-2">
            @if (l.evacuation) { <button type="button" class="btn-secondary text-rose-600" (click)="retirer()"><i class="fa-solid fa-trash"></i> Retirer</button> }
            <button type="button" class="btn-secondary" (click)="edition = false">Annuler</button>
            <button type="button" class="btn-primary" [disabled]="!formLe || !formMotif.trim()" (click)="valider()"><i class="fa-solid fa-check"></i> Enregistrer</button>
          </div>
        }
      </div>
    </div>
  </div>
</div>
  `,
})
export class PartogrammeLatenceComponent implements OnChanges {
  @Input({ required: true }) l!: LatencePartogramme;
  /** Dossier ouvert : l'évacuation peut être notée. */
  @Input() modifiable = false;
  /** Heure (ISO, null pour retirer) et motif de l'évacuation, enregistrés par la page. */
  @Output() evacuer = new EventEmitter<{ le: string | null; motif: string }>();

  lignes = LIGNES;
  phases: { code: PhaseArrivee; libelle: string }[] = [
    { code: 'Latence', libelle: 'Phase de latence' },
    { code: 'Active', libelle: 'Phase active' },
    { code: 'Dilatation complète', libelle: 'Dilatation complète' },
  ];
  heure = heureFr;
  dateHeure = dateHeureChiffres;
  edition = false;
  formLe = '';
  formMotif = '';

  get lignesVides(): null[] {
    return Array(Math.max(0, LIGNES_AFFECTIONS - this.l.affections.length)).fill(null);
  }

  ngOnChanges(): void {
    this.l = completer(this.l);
    this.edition = false;
  }

  ouvrir(): void {
    this.formLe = versSaisieLocale(this.l.evacuation?.le ?? new Date());
    this.formMotif = this.l.evacuation?.motif ?? '';
    this.edition = true;
  }

  valider(): void {
    this.evacuer.emit({ le: new Date(this.formLe).toISOString(), motif: this.formMotif.trim() });
  }

  retirer(): void {
    this.evacuer.emit({ le: null, motif: '' });
  }
}
