import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AvatarComponent } from './avatar.component';
import { Discussion, DiscussionsService } from '../data/discussions.service';
import { MessagesService } from '../data/messages.service';
import { SessionService } from '../data/session.service';
import { PATIENTES } from '../data/mock-data';

type Onglet = 'collegues' | 'patientes';

/**
 * Bouton rond flottant (en bas à droite, sur toutes les pages de l'espace administrateur) :
 * ouvre un panneau listant les discussions entre soignants (temps réel) et les conversations
 * avec les patientes (maquette statique). Un clic ouvre la conversation sur sa page.
 */
@Component({
  selector: 'app-conversations-flottantes',
  standalone: true,
  imports: [AvatarComponent, RouterLink],
  template: `
    @if (ouvert()) {
      <!-- Clic à l'extérieur : fermeture -->
      <div class="fixed inset-0 z-[55]" (click)="ouvert.set(false)"></div>

      <section class="fixed bottom-24 right-4 z-[56] flex h-[min(34rem,calc(100vh-8rem))] w-[calc(100%-2rem)] max-w-sm animate-[entree-bulle_.25s_ease-out] flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 dark:ring-white/10 sm:bottom-28 sm:right-6"
               role="dialog" aria-label="Conversations">
        <header class="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Conversations</h2>
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  (click)="ouvert.set(false)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
        </header>

        <!-- Onglets -->
        <div class="grid grid-cols-2 gap-1 border-b border-slate-200/70 p-1.5 dark:border-white/10" role="tablist">
          @for (o of onglets; track o.id) {
            <button type="button" role="tab" [attr.aria-selected]="onglet() === o.id" (click)="onglet.set(o.id)"
                    class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
                    [class]="onglet() === o.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'">
              <i class="fa-solid {{ o.icone }}"></i>{{ o.libelle }}
              @if (o.nonLus()) {
                <span class="rounded-full px-1.5 py-0.5 text-[10px] leading-none"
                      [class]="onglet() === o.id ? 'bg-white/25 text-white' : 'bg-accent-500 text-white'">{{ o.nonLus() }}</span>
              }
            </button>
          }
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          @if (onglet() === 'collegues') {
            @if (!session.connecte()) {
              <p class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                <a routerLink="/admin/connexion" (click)="ouvert.set(false)" class="font-medium text-brand-600 hover:underline dark:text-brand-300">Connectez-vous</a>
                pour voir vos discussions avec vos collègues.
              </p>
            } @else if (!discussions.charge()) {
              <p class="p-6 text-center text-sm text-slate-500 dark:text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Chargement…</p>
            } @else {
              @for (d of discussions.discussions(); track d.id) {
                @let s = d.interlocuteur;
                <button type="button" (click)="ouvrirDiscussion(d)"
                        class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <app-avatar [photo]="s?.photo ?? undefined" [prenom]="s?.prenom ?? '?'" [nomFamille]="s?.nom ?? ''" class="h-11 w-11 rounded-full text-sm" />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-baseline justify-between gap-2">
                      <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ nomCollegue(d) }}</span>
                      <span class="flex-none text-[11px] text-slate-400">{{ heure(d.dernierMessageLe) }}</span>
                    </span>
                    <span class="flex items-center justify-between gap-2">
                      <span class="truncate text-xs" [class]="d.nonLus ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'">
                        @if (discussions.enTrainDecrire().has(d.id)) { <em class="text-brand-600 dark:text-brand-300">écrit…</em> }
                        @else { {{ d.dernierMessage?.texte ?? s?.role }} }
                      </span>
                      @if (d.nonLus) { <span class="flex-none rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">{{ d.nonLus }}</span> }
                    </span>
                  </span>
                </button>
              } @empty {
                <p class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Aucune discussion pour le moment.</p>
              }
            }
          } @else {
            @for (f of fils(); track f.patienteId) {
              <button type="button" (click)="ouvrirPatiente(f.patienteId)"
                      class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <app-avatar [photo]="f.patiente.photo" [prenom]="f.patiente.prenom" [nomFamille]="f.patiente.nom" class="h-11 w-11 rounded-full text-sm" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2">
                    <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ f.patiente.prenom }} {{ f.patiente.nom }}</span>
                    <span class="flex-none text-[11px] text-slate-400">{{ heure(f.dernier?.date ?? null) }}</span>
                  </span>
                  <span class="flex items-center justify-between gap-2">
                    <span class="truncate text-xs" [class]="f.nonLus ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'">
                      {{ f.dernier?.texte ?? (f.canal ? 'Aucun message' : 'Pas de consentement de contact') }}
                    </span>
                    @if (f.nonLus) { <span class="flex-none rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">{{ f.nonLus }}</span> }
                  </span>
                </span>
              </button>
            }
          }
        </div>

        <footer class="border-t border-slate-200/70 p-2 dark:border-white/10">
          <a [routerLink]="onglet() === 'collegues' ? '/admin/discussions' : '/admin/messages'" (click)="ouvert.set(false)"
             class="block rounded-lg py-2 text-center text-xs font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
            Voir toutes les conversations <i class="fa-solid fa-arrow-right ml-1"></i>
          </a>
        </footer>
      </section>
    }

    <!-- Bouton rond flottant -->
    <button type="button" (click)="ouvert.set(!ouvert())" [attr.aria-expanded]="ouvert()"
            [attr.aria-label]="ouvert() ? 'Fermer les conversations' : 'Ouvrir les conversations'" [title]="'Conversations'"
            class="fixed bottom-5 right-4 z-[56] flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-xl text-white shadow-lg shadow-brand-900/30 ring-4 ring-white/70 transition duration-200 hover:-translate-y-0.5 hover:bg-brand-700 focus:outline-none focus-visible:ring-brand-300 dark:bg-brand-500 dark:ring-slate-900/70 dark:hover:bg-brand-400 sm:bottom-8 sm:right-6">
      <i class="fa-solid transition-transform duration-200" [class]="ouvert() ? 'fa-xmark rotate-90' : 'fa-comments'"></i>
      @if (!ouvert() && totalNonLus()) {
        <span class="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold ring-2 ring-white dark:ring-slate-900">{{ totalNonLus() }}</span>
      }
    </button>
  `,
})
export class ConversationsFlottantesComponent {
  discussions = inject(DiscussionsService);
  private messages = inject(MessagesService);
  session = inject(SessionService);
  private router = inject(Router);

  readonly ouvert = signal(false);
  readonly onglet = signal<Onglet>('collegues');

  readonly onglets = [
    { id: 'collegues' as const, libelle: 'Collègues', icone: 'fa-user-doctor', nonLus: this.discussions.totalNonLus },
    { id: 'patientes' as const, libelle: 'Patientes', icone: 'fa-person-pregnant', nonLus: this.messages.totalNonLus },
  ];

  readonly totalNonLus = computed(() => this.discussions.totalNonLus() + this.messages.totalNonLus());

  /** Conversations avec les patientes (maquette statique), les plus récentes en premier. */
  readonly fils = computed(() =>
    this.messages.conversations()
      .map(c => ({ ...c, patiente: PATIENTES.find(p => p.id === c.patienteId)!, dernier: c.messages.at(-1) }))
      .filter(f => f.patiente)
      .sort((a, b) => (b.dernier?.date ?? '').localeCompare(a.dernier?.date ?? '')));

  @HostListener('document:keydown.escape')
  fermer(): void {
    this.ouvert.set(false);
  }

  nomCollegue(d: Discussion): string {
    const s = d.interlocuteur;
    if (!s) return 'Un collègue';
    return `${s.role.startsWith('Médecin') ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  }

  /** Heure si c'est aujourd'hui, sinon date courte. Accepte l'ISO et « AAAA-MM-JJ HH:MM ». */
  heure(date: string | null): string {
    if (!date) return '';
    const d = new Date(date.includes('T') ? date : date.replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  ouvrirDiscussion(d: Discussion): void {
    this.discussions.aOuvrir.set(d.id);
    this.ouvert.set(false);
    this.router.navigate(['/admin/discussions']);
  }

  ouvrirPatiente(id: string): void {
    this.ouvert.set(false);
    this.router.navigate(['/admin/messages'], { queryParams: { patiente: id } });
  }
}
