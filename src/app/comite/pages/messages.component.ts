import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ComiteMessagerieService, ChefAnnuaire } from '../comite-messagerie.service';
import { ComiteSessionService } from '../comite-session.service';
import { messageErreur } from '../../admin/data/session.service';
import type { Discussion } from '../../admin/data/discussions.service';
import { FilMessagesComponent, MessageFil } from '../../admin/components/fil-messages.component';
import { GroupePilotageVueComponent } from '../../admin/components/groupe-pilotage-vue.component';

/**
 * Messagerie du comité : groupe de pilotage (tous les médecins chefs et le comité) et discussions
 * privées avec chaque médecin chef.
 */
@Component({
  selector: 'app-comite-messages',
  standalone: true,
  imports: [FilMessagesComponent, GroupePilotageVueComponent],
  template: `
    <div class="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-7xl flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Messages</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Échangez avec les médecins chefs des établissements, en privé ou dans le groupe de pilotage. Messages chiffrés.</p>
        </div>
        <button type="button" class="btn-primary" (click)="ouvrirAnnuaire()"><i class="fa-solid fa-pen-to-square"></i> Nouvelle discussion</button>
      </div>

      <div class="flex min-h-0 flex-1 gap-4">
        <!-- Liste -->
        <aside class="card flex w-full min-h-0 flex-col overflow-hidden md:w-80 md:flex-none" [class.hidden]="!!selection() && petitEcran()">
          <ul class="min-h-0 flex-1 overflow-y-auto p-2">
            <!-- Groupe de pilotage, épinglé -->
            <li>
              <button type="button" class="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition" [class]="selection() === 'groupe' ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'" (click)="choisir('groupe')">
                <span class="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 text-white"><i class="fa-solid fa-landmark"></i></span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center justify-between gap-2"><span class="truncate font-semibold text-slate-900 dark:text-white">Groupe de pilotage</span>@if (service.groupe.dernier(); as d) { <span class="flex-none text-[11px] text-slate-400">{{ heure(d.envoyeLe) }}</span> }</span>
                  <span class="flex items-center justify-between gap-2">
                    <span class="truncate text-xs text-slate-500 dark:text-slate-400">{{ service.groupe.dernier()?.texte ?? 'Médecins chefs et comité' }}</span>
                    @if (service.groupe.nonLus()) { <span class="flex-none rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">{{ service.groupe.nonLus() }}</span> }
                  </span>
                </span>
              </button>
            </li>
            <li class="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Médecins chefs</li>
            @for (d of service.discussions(); track d.id) {
              <li>
                <button type="button" class="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition" [class]="selection() === d.id ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'" (click)="choisir(d.id)">
                  @if (d.interlocuteur?.photo) { <img [src]="d.interlocuteur!.photo" alt="" class="h-11 w-11 flex-none rounded-full object-cover"> }
                  @else { <span class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">{{ initiales(d) }}</span> }
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center justify-between gap-2"><span class="truncate font-medium text-slate-900 dark:text-white">Dr {{ d.interlocuteur?.prenom }} {{ d.interlocuteur?.nom }}</span>@if (d.dernierMessage) { <span class="flex-none text-[11px] text-slate-400">{{ heure(d.dernierMessage.envoyeLe) }}</span> }</span>
                    <span class="flex items-center justify-between gap-2">
                      <span class="truncate text-xs text-slate-500 dark:text-slate-400">{{ service.enTrainDecrire().has(d.id) ? 'écrit…' : (d.dernierMessage?.texte ?? 'Nouvelle discussion') }}</span>
                      @if (d.nonLus) { <span class="flex-none rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">{{ d.nonLus }}</span> }
                    </span>
                  </span>
                </button>
              </li>
            } @empty {
              @if (service.charge()) { <li class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">Aucune discussion privée. Cliquez sur « Nouvelle discussion » pour écrire à un médecin chef.</li> }
            }
          </ul>
        </aside>

        <!-- Fil -->
        <section class="min-h-0 min-w-0 flex-1" [class.hidden]="!selection() && petitEcran()">
          @if (selection() === 'groupe') {
            <app-groupe-pilotage-vue class="h-full" [groupe]="service.groupe" [moi]="moi()" />
          } @else if (discussion()) {
            @let d = discussion()!;
            <div class="card flex h-full min-h-0 flex-col overflow-hidden">
              <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-6">
                <button type="button" class="btn-ghost -ml-2 px-2 md:hidden" (click)="selection.set(null)" aria-label="Retour"><i class="fa-solid fa-arrow-left"></i></button>
                @if (d.interlocuteur?.photo) { <img [src]="d.interlocuteur!.photo" alt="" class="h-10 w-10 rounded-full object-cover"> }
                @else { <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">{{ initiales(d) }}</span> }
                <div class="min-w-0">
                  <p class="truncate font-semibold text-slate-900 dark:text-white">Dr {{ d.interlocuteur?.prenom }} {{ d.interlocuteur?.nom }}</p>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ d.interlocuteur?.role }} · <span class="font-mono">{{ d.interlocuteur?.matricule }}</span></p>
                </div>
              </header>
              <app-fil-messages class="min-h-0 flex-1"
                [messages]="fil()" [moi]="moi()" [plusAnciens]="!!service.plusAnciens()[d.id]" [chargement]="!service.messages()[d.id]"
                [ecrit]="service.enTrainDecrire().has(d.id) ? (d.interlocuteur?.prenom ?? '') + ' écrit…' : null"
                (envoyer)="envoyer(d.id, $event)" (renvoyer)="renvoyer(d.id, $event)" (chargerPlus)="service.chargerMessages(d.id, true)" (saisie)="service.signalerSaisie(d.id)" />
            </div>
          } @else {
            <div class="card hidden h-full flex-col items-center justify-center gap-3 p-8 text-center md:flex">
              <span class="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-2xl text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-regular fa-comments"></i></span>
              <p class="font-medium text-slate-900 dark:text-white">Choisissez une conversation</p>
              <p class="max-w-sm text-sm text-slate-500 dark:text-slate-400">Le groupe de pilotage réunit tous les médecins chefs et le comité. Vous pouvez aussi écrire en privé à un médecin chef.</p>
            </div>
          }
        </section>
      </div>
    </div>

    <!-- Annuaire des médecins chefs -->
    @if (annuaireOuvert) {
      <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titre-annuaire-comite">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="annuaireOuvert = false"></div>
        <div class="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
          <div class="border-b border-slate-100 p-5 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 id="titre-annuaire-comite" class="text-lg font-semibold text-slate-900 dark:text-white">Écrire à un médecin chef</h2>
              <button type="button" class="btn-ghost px-3" (click)="annuaireOuvert = false" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <input type="search" class="input mt-3" placeholder="Nom ou établissement…" [value]="rechercheAnnuaire()" (input)="rechercheAnnuaire.set($any($event.target).value)">
          </div>
          <ul class="min-h-0 flex-1 overflow-y-auto py-2">
            @if (chargementAnnuaire) { <li class="px-5 py-4"><div class="skeleton h-10"></div></li> }
            @for (c of annuaireFiltre(); track c.id) {
              <li>
                <button type="button" class="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40" (click)="demarrer(c)">
                  @if (c.photo) { <img [src]="c.photo" alt="" class="h-10 w-10 rounded-full object-cover"> }
                  @else { <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">{{ c.prenom.charAt(0) }}{{ c.nom.charAt(0) }}</span> }
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-slate-900 dark:text-white">Dr {{ c.prenom }} {{ c.nom }}</span>
                    <span class="block truncate text-xs text-slate-500 dark:text-slate-400"><i class="fa-solid fa-hospital mr-1"></i>{{ c.etablissement || 'Établissement non renseigné' }}</span>
                  </span>
                </button>
              </li>
            } @empty {
              @if (!chargementAnnuaire) { <li class="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Aucun médecin chef actif.</li> }
            }
          </ul>
          @if (erreur) { <p class="border-t border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{{ erreur }}</p> }
        </div>
      </div>
    }
  `,
})
export class ComiteMessagesComponent implements OnDestroy {
  service = inject(ComiteMessagerieService);
  private session = inject(ComiteSessionService);
  moi = computed(() => this.session.membre()?.id ?? '');
  /** 'groupe', identifiant d'une discussion privée, ou rien. */
  selection = signal<string | null>('groupe');
  petitEcran = signal(window.matchMedia('(max-width: 767px)').matches);

  discussion = computed<Discussion | null>(() => {
    const s = this.selection();
    return s && s !== 'groupe' ? this.service.discussions().find(d => d.id === s) ?? null : null;
  });
  fil = computed<MessageFil[]>(() => {
    const d = this.discussion();
    if (!d) return [];
    const autre = d.interlocuteur?.id;
    return (this.service.messages()[d.id] ?? []).map(m => ({ id: m.id, auteurId: m.auteurId, texte: m.texte, envoyeLe: m.envoyeLe, etat: m.etat, lu: !!autre && m.lusPar.some(l => l.soignantId === autre) }));
  });

  constructor() {
    if (this.petitEcran()) this.selection.set(null);
    this.service.charger().catch(() => {});
  }

  ngOnDestroy(): void {
    this.service.ouverte.set(null);
  }

  choisir(id: string): void {
    this.selection.set(id);
    if (id === 'groupe') {
      this.service.ouverte.set(null);
      return;
    }
    this.service.ouverte.set(id);
    this.service.chargerMessages(id).then(() => this.service.marquerLu(id)).catch(() => {});
  }

  envoyer(id: string, texte: string): void {
    this.service.envoyer(id, texte).catch(() => {});
  }

  renvoyer(id: string, m: MessageFil): void {
    this.service.retirer(id, m.id);
    this.envoyer(id, m.texte);
  }

  // --- Annuaire ------------------------------------------------------------------------
  annuaireOuvert = false;
  chargementAnnuaire = false;
  erreur = '';
  annuaire = signal<ChefAnnuaire[]>([]);
  rechercheAnnuaire = signal('');
  annuaireFiltre = computed(() => {
    const q = this.rechercheAnnuaire().trim().toLowerCase();
    return this.annuaire().filter(c => !q || `${c.prenom} ${c.nom} ${c.etablissement}`.toLowerCase().includes(q));
  });

  async ouvrirAnnuaire(): Promise<void> {
    this.annuaireOuvert = true;
    this.erreur = '';
    this.chargementAnnuaire = true;
    try {
      this.annuaire.set(await this.service.annuaire());
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargementAnnuaire = false;
    }
  }

  async demarrer(c: ChefAnnuaire): Promise<void> {
    try {
      const d = await this.service.ouvrirAvec(c.id);
      this.annuaireOuvert = false;
      this.choisir(d.id);
    } catch (err) {
      this.erreur = messageErreur(err);
    }
  }

  initiales = (d: Discussion) => `${d.interlocuteur?.prenom?.charAt(0) ?? ''}${d.interlocuteur?.nom?.charAt(0) ?? ''}`;
  heure(iso: string): string {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
}
