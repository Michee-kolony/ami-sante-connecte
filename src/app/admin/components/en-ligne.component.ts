import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from './avatar.component';
import { PresenceService, SoignantEnLigne } from '../data/presence.service';
import { SessionService } from '../data/session.service';
import { categorieDuRole } from '../data/soignants.service';

/** « Soignants en ligne maintenant » : photos des médecins et infirmiers connectés, avec un point vert (soi compris). */
@Component({
  selector: 'app-en-ligne',
  standalone: true,
  // Bloc (et non inline) pour que l'espacement vertical des pages (space-y-*) s'applique.
  host: { class: 'block' },
  imports: [RouterLink, AvatarComponent],
  template: `
<div class="relative flex flex-col gap-4 rounded-2xl border border-accent-200/70 bg-gradient-to-r from-accent-50 via-white/70 to-brand-50/70 px-4 py-4 shadow-sm sm:px-5
            dark:border-accent-500/20 dark:from-accent-500/10 dark:via-slate-900/60 dark:to-brand-500/10">
  <!-- Libellé -->
  <div class="flex items-center gap-3">
    <span class="relative flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-accent-600 shadow-sm ring-1 ring-accent-100 dark:bg-slate-900 dark:text-accent-400 dark:ring-accent-500/20">
      <i class="fa-solid fa-user-doctor"></i>
      <span class="absolute -right-0.5 -top-0.5 flex h-3 w-3">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-60"></span>
        <span class="relative inline-flex h-3 w-3 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900"></span>
      </span>
    </span>
    <div class="leading-tight">
      <p class="text-sm font-semibold text-slate-900 dark:text-white">Soignants en ligne maintenant</p>
      <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        @if (!session.connecte()) {
          Connectez-vous au serveur pour les voir
        } @else if (!presence.charge()) {
          Recherche des connexions…
        } @else if (liste().length) {
          <span class="font-semibold text-accent-700 dark:text-accent-300">{{ liste().length }}</span> connecté{{ liste().length > 1 ? 's' : '' }} · en direct
        } @else {
          Personne n’est connecté pour l’instant
        }
      </p>
    </div>
  </div>

  <!-- Photos -->
  @if (session.connecte()) {
    <div class="border-t border-accent-200/60 pt-3 dark:border-accent-500/20">
      @if (!presence.charge()) {
        <div class="flex -space-x-2.5" aria-hidden="true">
          @for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-11 w-11 rounded-full ring-[3px] ring-white dark:ring-slate-900"></div> }
        </div>
      } @else if (liste().length) {
        <ul class="flex items-center -space-x-2.5 pt-1">
          @for (s of visibles(); track s.id) {
            @let moi = s.id === idMoi();
            <li class="group relative transition duration-200 hover:z-20 hover:-translate-y-1 focus-within:z-20" [style.z-index]="moi ? 10 : null">
              <a [routerLink]="['/admin/soignants', s.id]" class="relative block rounded-full focus:outline-none" [attr.aria-label]="nom(s) + ' en ligne'">
                <app-avatar [photo]="s.photo ?? undefined" [prenom]="s.prenom" [nomFamille]="s.nom"
                            class="h-11 w-11 rounded-full text-xs shadow-md ring-[3px] transition group-hover:shadow-lg"
                            [class]="moi ? 'ring-brand-500 dark:ring-brand-400' : 'ring-white dark:ring-slate-900'" />
                <span class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900"></span>
              </a>
              <!-- Info-bulle -->
              <span class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-left opacity-0 shadow-xl transition duration-150
                           group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:bg-slate-700">
                <span class="flex items-center gap-1.5 text-xs font-semibold text-white">
                  {{ nom(s) }}
                  @if (moi) { <span class="rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold">Vous</span> }
                </span>
                <span class="block text-[11px] text-slate-300">{{ s.role }}</span>
                @if (s.etablissement) { <span class="block text-[11px] text-slate-400"><i class="fa-solid fa-hospital mr-1"></i>{{ s.etablissement }}</span> }
                <span class="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-slate-900 dark:border-t-slate-700"></span>
              </span>
            </li>
          }
          @if (reste().length) {
            <li class="relative" [title]="nomsReste()">
              <span class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-md ring-[3px] ring-white dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-900">+{{ reste().length }}</span>
            </li>
          }
        </ul>
      }
    </div>
  }
</div>
  `,
})
export class EnLigneComponent {
  presence = inject(PresenceService);
  session = inject(SessionService);
  idMoi = computed(() => this.session.soignant()?.id);

  /** Soi-même en premier, puis les médecins, puis les infirmiers. */
  liste = computed(() => [...this.presence.enLigne()].sort((a, b) =>
    Number(b.id === this.idMoi()) - Number(a.id === this.idMoi())
    || Number(this.estMedecin(b)) - Number(this.estMedecin(a))
    || a.prenom.localeCompare(b.prenom)));

  /** Au-delà, les autres sont résumés par une pastille « +N ». */
  private readonly MAX_VISIBLES = 8;
  visibles = computed(() => this.liste().slice(0, this.MAX_VISIBLES));
  reste = computed(() => this.liste().slice(this.MAX_VISIBLES));
  nomsReste = computed(() => this.reste().map(s => this.nom(s)).join(', '));

  estMedecin(s: SoignantEnLigne): boolean {
    return categorieDuRole(s.role) === 'Médecin';
  }

  nom(s: SoignantEnLigne): string {
    return `${this.estMedecin(s) ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  }
}
