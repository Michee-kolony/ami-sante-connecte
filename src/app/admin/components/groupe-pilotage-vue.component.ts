import { Component, OnDestroy, OnInit, computed, input } from '@angular/core';
import { GroupePilotage } from '../data/groupe-pilotage';
import { AuteurFil, FilMessagesComponent, MessageFil } from './fil-messages.component';

/**
 * Groupe de pilotage : conversation commune aux médecins chefs et au comité de pilotage.
 * Utilisé dans l'espace professionnel (médecin chef) et dans l'espace du comité.
 */
@Component({
  selector: 'app-groupe-pilotage-vue',
  standalone: true,
  imports: [FilMessagesComponent],
  template: `
    <div class="card flex h-full min-h-0 overflow-hidden">
      <section class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-6">
          <span class="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 text-lg text-white"><i class="fa-solid fa-landmark"></i></span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate font-semibold text-slate-900 dark:text-white">Groupe de pilotage</h2>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ nbChefs() }} médecin(s) chef(s) · {{ nbComite() }} membre(s) du comité</p>
          </div>
          <div class="hidden -space-x-2 sm:flex">
            @for (m of groupe().membres().slice(0, 6); track m.id) {
              @if (m.photo) { <img [src]="m.photo" alt="" [title]="m.prenom + ' ' + m.nom" class="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"> }
              @else { <span [title]="m.prenom + ' ' + m.nom" class="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white dark:ring-slate-900" [class]="m.type === 'comite' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'">{{ m.prenom.charAt(0) }}{{ m.nom.charAt(0) }}</span> }
            }
            @if (groupe().membres().length > 6) { <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:ring-slate-900">+{{ groupe().membres().length - 6 }}</span> }
          </div>
        </header>
        <app-fil-messages class="min-h-0 flex-1"
          [messages]="messages()" [moi]="moi()" [groupe]="true" [auteurs]="auteurs()"
          [plusAnciens]="groupe().plusAnciens()" [chargement]="!groupe().charge()" [ecrit]="ecrit()"
          vide="Aucun message dans le groupe. Lancez la conversation avec les médecins chefs et le comité."
          (envoyer)="envoyer($event)" (renvoyer)="renvoyer($event)" (chargerPlus)="groupe().chargerMessages(true)" (saisie)="groupe().emettreEcrit()" />
      </section>

      <!-- Membres -->
      <aside class="hidden w-72 flex-none flex-col border-l border-slate-100 dark:border-slate-800 xl:flex">
        <p class="px-5 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Membres ({{ groupe().membres().length }})</p>
        <ul class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          @for (m of groupe().membres(); track m.id) {
            <li class="flex items-center gap-3 rounded-xl px-2 py-2">
              @if (m.photo) { <img [src]="m.photo" alt="" class="h-9 w-9 rounded-full object-cover"> }
              @else { <span class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold" [class]="m.type === 'comite' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'">{{ m.prenom.charAt(0) }}{{ m.nom.charAt(0) }}</span> }
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ m.type === 'soignant' ? 'Dr ' : '' }}{{ m.prenom }} {{ m.nom }}@if (m.id === moi()) { <span class="text-xs font-normal text-slate-400"> (vous)</span> }</p>
                <p class="truncate text-xs" [class]="m.type === 'comite' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'">{{ m.detail }}</p>
              </div>
            </li>
          }
        </ul>
      </aside>
    </div>
  `,
  host: { class: 'block min-h-0' },
})
export class GroupePilotageVueComponent implements OnInit, OnDestroy {
  groupe = input.required<GroupePilotage>();
  moi = input.required<string>();

  nbChefs = computed(() => this.groupe().membres().filter(m => m.type === 'soignant').length);
  nbComite = computed(() => this.groupe().membres().filter(m => m.type === 'comite').length);
  auteurs = computed<Record<string, AuteurFil>>(() => this.groupe().auteurs());
  ecrit = computed(() => {
    const id = this.groupe().ecrit();
    const m = id ? this.groupe().auteurs()[id] : null;
    return m ? `${m.prenom} ${m.nom} écrit…` : null;
  });
  messages = computed<MessageFil[]>(() => this.groupe().messages().map(m => ({
    id: m.id, auteurId: m.auteurId, texte: m.texte, envoyeLe: m.envoyeLe, etat: m.etat,
    lecteurs: Math.max(0, m.lusPar.filter(l => l.id !== m.auteurId).length),
  })));

  ngOnInit(): void {
    const g = this.groupe();
    g.ouvert.set(true);
    Promise.all([g.chargerResume(), g.chargerMessages()]).then(() => g.marquerLu()).catch(() => {});
  }

  ngOnDestroy(): void {
    this.groupe().ouvert.set(false);
  }

  envoyer(texte: string): void {
    this.groupe().envoyer(texte).catch(() => {});
  }

  renvoyer(m: MessageFil): void {
    this.groupe().retirer(m.id);
    this.envoyer(m.texte);
  }
}
