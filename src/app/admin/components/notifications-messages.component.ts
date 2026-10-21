import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AvatarComponent } from './avatar.component';
import { Discussion, DiscussionsService, MessageDiscussion } from '../data/discussions.service';

interface Bulle {
  cle: number;
  discussion: Discussion;
  message: MessageDiscussion;
  /** Messages regroupés du même expéditeur tant que la bulle est visible. */
  nombre: number;
  minuteur?: ReturnType<typeof setTimeout>;
  sortie: boolean;
}

const DUREE_MS = 7000;
const MAX_BULLES = 3;

/**
 * Popups flottants de nouveaux messages, visibles sur toutes les pages de l'espace administrateur :
 * photo de l'expéditeur, aperçu, son de notification ; un clic ouvre la conversation.
 * Onglet en arrière-plan : notification du système si l'utilisateur l'a autorisée.
 */
@Component({
  selector: 'app-notifications-messages',
  standalone: true,
  imports: [AvatarComponent],
  host: { class: 'pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col items-end gap-3 sm:bottom-6 sm:right-6' },
  template: `
    @for (b of bulles; track b.cle) {
      @let s = b.discussion.interlocuteur;
      <div class="pointer-events-auto w-full transition-all duration-300"
           [class]="b.sortie ? 'translate-x-8 opacity-0' : 'animate-[entree-bulle_.35s_cubic-bezier(.2,.9,.3,1.2)]'"
           role="status" aria-live="polite" (mouseenter)="suspendre(b)" (mouseleave)="relancer(b)">
        <div class="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-3 pr-9 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-xl
                    transition hover:-translate-y-0.5 hover:shadow-brand-500/20 dark:border-white/10 dark:bg-slate-900/95 dark:ring-white/10"
             tabindex="0" (click)="ouvrir(b)" (keydown.enter)="ouvrir(b)" [attr.aria-label]="'Nouveau message de ' + nom(b) + ' : ouvrir la conversation'">
          <!-- Photo de l'expéditeur, avec halo animé -->
          <span class="relative flex-none">
            <span class="absolute -inset-1 animate-ping rounded-full bg-brand-400/40"></span>
            <app-avatar [photo]="s?.photo ?? undefined" [prenom]="s?.prenom ?? '?'" [nomFamille]="s?.nom ?? ''"
                        class="relative h-14 w-14 rounded-full text-sm shadow-lg ring-[3px] ring-white dark:ring-slate-900" />
            <span class="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white ring-2 ring-white dark:ring-slate-900">
              @if (b.nombre > 1) { {{ b.nombre }} } @else { <i class="fa-solid fa-comment-medical"></i> }
            </span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ nom(b) }}</span>
              <span class="flex-none text-[11px] text-slate-400">à l’instant</span>
            </span>
            <span class="block truncate text-xs text-slate-500 dark:text-slate-400">{{ s?.role }}</span>
            <span class="mt-0.5 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{{ b.message.texte }}</span>
          </span>
          <!-- Durée d'affichage restante -->
          <span class="absolute bottom-0 left-0 h-0.5 bg-brand-500/70" [style.animation]="'barre-bulle ' + duree + 'ms linear forwards'" [style.animation-play-state]="b.minuteur ? 'running' : 'paused'"></span>
        </div>
        <button type="button" class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                (click)="fermer(b); $event.stopPropagation()" aria-label="Fermer la notification"><i class="fa-solid fa-xmark text-xs"></i></button>
      </div>
    }
  `,
  // Animations « entree-bulle » et « barre-bulle » : définies dans styles.css (noms non renommés).
  styles: [`
    :host > div { position: relative; }
    @media (prefers-reduced-motion: reduce) { :host * { animation: none !important; } }
  `],
})
export class NotificationsMessagesComponent {
  private service = inject(DiscussionsService);
  private router = inject(Router);
  readonly duree = DUREE_MS;
  bulles: Bulle[] = [];
  private cle = 0;
  private audio?: AudioContext;

  constructor() {
    this.service.arrivees.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(({ message, discussion }) => this.afficher(message, discussion));
    // Les navigateurs n'autorisent le son qu'après une interaction : contexte audio préparé au premier clic.
    const preparer = () => {
      this.contexteAudio();
      document.removeEventListener('pointerdown', preparer);
      document.removeEventListener('keydown', preparer);
    };
    document.addEventListener('pointerdown', preparer);
    document.addEventListener('keydown', preparer);
  }

  nom(b: Bulle): string {
    const s = b.discussion.interlocuteur;
    if (!s) return 'Un collègue';
    return `${s.role.startsWith('Médecin') ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  }

  private afficher(message: MessageDiscussion, discussion: Discussion): void {
    this.jouerSon();
    this.notifierSysteme(message, discussion);
    // Même expéditeur déjà affiché : la bulle est mise à jour au lieu d'en empiler une autre.
    const existante = this.bulles.find(b => b.discussion.id === discussion.id && !b.sortie);
    if (existante) {
      existante.message = message;
      existante.nombre++;
      this.relancer(existante);
      return;
    }
    const b: Bulle = { cle: ++this.cle, discussion, message, nombre: 1, sortie: false };
    this.bulles = [...this.bulles, b];
    while (this.bulles.filter(x => !x.sortie).length > MAX_BULLES) this.fermer(this.bulles.find(x => !x.sortie)!);
    this.relancer(b);
  }

  ouvrir(b: Bulle): void {
    this.service.aOuvrir.set(b.discussion.id);
    this.fermer(b);
    this.router.navigate(['/admin/discussions']);
  }

  fermer(b: Bulle): void {
    clearTimeout(b.minuteur);
    b.minuteur = undefined;
    b.sortie = true;
    setTimeout(() => (this.bulles = this.bulles.filter(x => x !== b)), 300);
  }

  /** Survol : la bulle reste affichée. */
  suspendre(b: Bulle): void {
    clearTimeout(b.minuteur);
    b.minuteur = undefined;
  }

  relancer(b: Bulle): void {
    clearTimeout(b.minuteur);
    b.minuteur = setTimeout(() => this.fermer(b), DUREE_MS);
  }

  // --- Son : deux notes douces générées par le navigateur (aucun fichier à charger) ----------
  private contexteAudio(): AudioContext | undefined {
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === 'suspended') this.audio.resume().catch(() => {});
    } catch { /* audio indisponible */ }
    return this.audio;
  }

  private jouerSon(): void {
    const ctx = this.contexteAudio();
    if (!ctx || ctx.state !== 'running') return;
    const debut = ctx.currentTime;
    [[880, 0], [1318.5, 0.12]].forEach(([frequence, decalage]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequence;
      gain.gain.setValueAtTime(0.0001, debut + decalage);
      gain.gain.exponentialRampToValueAtTime(0.18, debut + decalage + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, debut + decalage + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(debut + decalage);
      osc.stop(debut + decalage + 0.5);
    });
  }

  /** Onglet caché : notification du système (si autorisée), sans contenu du message. */
  private notifierSysteme(message: MessageDiscussion, discussion: Discussion): void {
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const s = discussion.interlocuteur;
    const n = new Notification(`Nouveau message de ${s ? `${s.prenom} ${s.nom}` : 'un collègue'}`, {
      body: 'Ouvrez AMI Santé Connect pour le lire.',
      icon: s?.photo || '/images/logo-icon.png',
      tag: `discussion-${discussion.id}`,
    });
    n.onclick = () => {
      window.focus();
      this.service.aOuvrir.set(discussion.id);
      this.router.navigate(['/admin/discussions']);
      n.close();
    };
  }
}
