import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PatientesService, type RecoAttitre, type RecoPossible } from '../data/patientes.service';
import { messageErreur } from '../data/session.service';

/**
 * Relais communautaire (RECO) attitré de la patiente : affiché dans son dossier et sa fiche de
 * suivi. Choisi automatiquement à l'enregistrement selon son quartier (sinon sa commune, sinon son
 * aire de santé) ; le personnel peut en désigner un autre ou revenir au choix automatique.
 */
@Component({
  selector: 'app-reco-attitre',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card p-5">
      <p class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <i class="fa-solid fa-people-arrows text-brand-600 dark:text-brand-400"></i> Relais communautaire (RECO)
      </p>
      @if (reco; as r) {
        <div class="mt-3 flex items-center gap-3">
          @if (r.photo) {
            <img [src]="r.photo" alt="" class="h-11 w-11 shrink-0 rounded-full object-cover">
          } @else {
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{{ r.prenom.charAt(0) }}{{ r.nom.charAt(0) }}</span>
          }
          <div class="min-w-0">
            <p class="truncate font-medium text-slate-900 dark:text-white">{{ r.prenom }} {{ r.nom }} <span class="font-mono text-xs text-slate-500">{{ r.matricule }}</span></p>
            <p class="text-xs text-slate-500">
              @if (r.telephone) { <a class="text-brand-700 hover:underline dark:text-brand-300" [href]="'tel:' + r.telephone"><i class="fa-solid fa-phone"></i> {{ r.telephone }}</a> · }
              {{ r.zones.length ? r.zones.join(', ') : (r.aireSante || 'Aire de santé') }}
            </p>
          </div>
        </div>
        <p class="mt-2 text-[11px] text-slate-500">
          {{ r.mode === 'Manuelle' ? 'Désigné par le personnel.' : 'Choisi automatiquement selon le quartier de la patiente.' }}
          Il la suit à domicile et reçoit ses alertes.
        </p>
      } @else {
        <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <i class="fa-solid fa-triangle-exclamation"></i> Aucun RECO actif ne couvre encore son quartier. Désignez-en un, ou ajoutez ce quartier aux zones d’un RECO.
        </p>
      }

      @if (edition) {
        <div class="mt-3 space-y-2">
          <select class="input py-2 text-sm" [(ngModel)]="choix" aria-label="RECO attitré">
            <option value="">Choix automatique (selon le quartier)</option>
            @for (x of possibles; track x.id) {
              <option [value]="x.id">{{ x.nom }} ({{ x.matricule }}){{ x.zones.length ? ' · ' + x.zones.join(', ') : '' }}{{ x.conseille ? ' — conseillé' : '' }}</option>
            }
          </select>
          @if (erreur) { <p class="text-xs text-rose-600" role="alert">{{ erreur }}</p> }
          <div class="flex gap-2">
            <button type="button" class="btn-primary flex-1 py-2 text-xs" (click)="enregistrer()" [disabled]="envoi">Enregistrer</button>
            <button type="button" class="btn-secondary py-2 text-xs" (click)="edition = false" [disabled]="envoi">Annuler</button>
          </div>
        </div>
      } @else {
        <button type="button" class="btn-secondary mt-3 w-full py-2 text-xs" (click)="ouvrir()" [disabled]="chargement">
          <i class="fa-solid" [class]="chargement ? 'fa-spinner fa-spin' : 'fa-pen'"></i> {{ reco ? 'Changer de RECO' : 'Désigner un RECO' }}
        </button>
        @if (erreur) { <p class="mt-2 text-xs text-rose-600" role="alert">{{ erreur }}</p> }
      }
    </div>
  `,
})
export class RecoAttitreComponent {
  private service = inject(PatientesService);

  @Input({ required: true }) patienteId!: string;
  @Input() reco: RecoAttitre | null | undefined = null;
  @Output() recoChange = new EventEmitter<RecoAttitre | null>();

  edition = false;
  chargement = false;
  envoi = false;
  erreur = '';
  possibles: RecoPossible[] = [];
  choix = '';

  async ouvrir(): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      this.possibles = await this.service.recosPossibles(this.patienteId);
      this.choix = this.reco?.mode === 'Manuelle' ? this.reco.id : '';
      this.edition = true;
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  async enregistrer(): Promise<void> {
    this.envoi = true;
    this.erreur = '';
    try {
      const { reco } = await this.service.changerReco(this.patienteId, this.choix || null);
      this.reco = reco;
      this.recoChange.emit(reco);
      this.edition = false;
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.envoi = false;
    }
  }
}
