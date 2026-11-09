import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Message affiché dans un fil (discussion à deux ou groupe). */
export interface MessageFil {
  id: string;
  auteurId: string;
  texte: string;
  envoyeLe: string;
  etat?: 'envoi' | 'echec';
  /** Discussion à deux : lu par l'interlocuteur. Groupe : nombre de membres qui l'ont lu. */
  lu?: boolean;
  lecteurs?: number;
}

/** Auteur d'un message de groupe (nom, photo, fonction). */
export interface AuteurFil {
  prenom: string;
  nom: string;
  photo: string | null;
  detail?: string;
  type?: 'soignant' | 'comite';
}

/**
 * Fil de messages : bulles regroupées par jour, mes messages à droite, état d'envoi et de lecture,
 * « en train d'écrire », saisie (Entrée pour envoyer, Maj + Entrée pour aller à la ligne).
 */
@Component({
  selector: 'app-fil-messages',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex h-full min-h-0 flex-col">
      <div #defilement class="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4 sm:px-6">
        @if (plusAnciens) {
          <div class="pb-2 text-center"><button type="button" class="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300" (click)="chargerPlus.emit()">Messages plus anciens</button></div>
        }
        @if (chargement) {
          @for (i of [1, 2, 3]; track i) { <div class="skeleton h-10 rounded-2xl" [class]="i % 2 ? 'w-2/3' : 'ml-auto w-1/2'"></div> }
        } @else if (!messages.length) {
          <div class="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            <i class="fa-regular fa-comments text-3xl text-slate-300 dark:text-slate-600"></i>
            {{ vide }}
          </div>
        }
        @for (m of messages; track m.id; let i = $index) {
          @if (nouveauJour(i)) {
            <div class="flex justify-center py-2"><span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ jour(m.envoyeLe) }}</span></div>
          }
          @let mien = m.auteurId === moi;
          @let suite = !nouveauJour(i) && i > 0 && messages[i - 1].auteurId === m.auteurId;
          <div class="flex items-end gap-2" [class.justify-end]="mien" [class.mt-3]="!suite">
            @if (groupe && !mien) {
              @if (!suite) {
                @if (auteur(m)?.photo) { <img [src]="auteur(m)!.photo" alt="" class="h-8 w-8 flex-none rounded-full object-cover"> }
                @else { <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-semibold" [class]="auteur(m)?.type === 'comite' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'">{{ initiales(m) }}</span> }
              } @else { <span class="w-8 flex-none"></span> }
            }
            <div class="max-w-[78%]">
              @if (groupe && !mien && !suite) {
                <p class="mb-0.5 px-1 text-[11px] font-semibold" [class]="auteur(m)?.type === 'comite' ? 'text-amber-700 dark:text-amber-300' : 'text-brand-700 dark:text-brand-300'">
                  {{ nomAuteur(m) }} <span class="font-normal text-slate-400">· {{ auteur(m)?.detail }}</span>
                </p>
              }
              <div class="whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm"
                   [class]="mien ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'"
                   [class.opacity-60]="m.etat === 'envoi'">{{ m.texte }}</div>
              <p class="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-400" [class.justify-end]="mien">
                {{ heure(m.envoyeLe) }}
                @if (mien) {
                  @if (m.etat === 'envoi') { <i class="fa-regular fa-clock"></i> }
                  @else if (m.etat === 'echec') { <span class="text-rose-600">Non envoyé ·</span> <button type="button" class="font-semibold text-rose-600 underline" (click)="renvoyer.emit(m)">Réessayer</button> }
                  @else if (groupe) { @if (m.lecteurs) { <span title="Lu par">· lu par {{ m.lecteurs }}</span> } }
                  @else { <i class="fa-solid fa-check-double" [class]="m.lu ? 'text-sky-500' : ''" [title]="m.lu ? 'Lu' : 'Envoyé'"></i> }
                }
              </p>
            </div>
          </div>
        }
        @if (ecrit) {
          <p class="mt-2 flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400"><span class="flex gap-0.5"><span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></span><span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]"></span><span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]"></span></span>{{ ecrit }}</p>
        }
      </div>

      <form class="flex items-end gap-2 border-t border-slate-100 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/70" (ngSubmit)="soumettre()">
        <textarea name="texte" rows="1" class="input max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5" placeholder="Écrire un message…" maxlength="2000"
                  [(ngModel)]="texte" (keydown.enter)="entree($event)" (input)="saisie.emit()" [attr.aria-label]="'Message'"></textarea>
        <button type="submit" class="btn-primary h-11 w-11 flex-none rounded-full p-0" [disabled]="!texte.trim()" aria-label="Envoyer"><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>
  `,
  host: { class: 'block min-h-0' },
})
export class FilMessagesComponent implements AfterViewChecked {
  @Input() messages: MessageFil[] = [];
  @Input() moi = '';
  @Input() groupe = false;
  @Input() auteurs: Record<string, AuteurFil> = {};
  @Input() plusAnciens = false;
  @Input() chargement = false;
  @Input() ecrit: string | null = null;
  @Input() vide = 'Aucun message pour l’instant. Écrivez le premier.';
  @Output() envoyer = new EventEmitter<string>();
  @Output() renvoyer = new EventEmitter<MessageFil>();
  @Output() chargerPlus = new EventEmitter<void>();
  @Output() saisie = new EventEmitter<void>();
  @ViewChild('defilement') defilement?: ElementRef<HTMLDivElement>;

  texte = '';
  private dernierCompte = 0;
  private dernierId = '';

  ngAfterViewChecked(): void {
    // Nouveau message en bas du fil : défilement automatique (pas quand on charge les plus anciens).
    const dernier = this.messages.at(-1)?.id ?? '';
    if (this.messages.length !== this.dernierCompte && dernier !== this.dernierId) {
      const el = this.defilement?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }
    this.dernierCompte = this.messages.length;
    this.dernierId = dernier;
  }

  entree(e: Event): void {
    if ((e as KeyboardEvent).shiftKey) return;
    e.preventDefault();
    this.soumettre();
  }

  soumettre(): void {
    const t = this.texte.trim();
    if (!t) return;
    this.texte = '';
    this.envoyer.emit(t);
  }

  /** Auteur d'un message (absent si son compte a été retiré depuis). */
  auteur = (m: MessageFil): AuteurFil | undefined => this.auteurs[m.auteurId];
  nomAuteur(m: MessageFil): string {
    const a = this.auteur(m);
    if (!a) return 'Ancien membre';
    return `${a.type === 'soignant' ? 'Dr ' : ''}${a.prenom} ${a.nom}`;
  }
  initiales(m: MessageFil): string {
    const a = this.auteur(m);
    return a ? `${a.prenom.charAt(0)}${a.nom.charAt(0)}` : '?';
  }

  nouveauJour(i: number): boolean {
    // Jour local (et non UTC) : un message de 0 h 30 à Kinshasa reste sur le bon jour.
    return i === 0 || new Date(this.messages[i].envoyeLe).toDateString() !== new Date(this.messages[i - 1].envoyeLe).toDateString();
  }
  jour(iso: string): string {
    const d = new Date(iso);
    const auj = new Date();
    const hier = new Date(Date.now() - 86_400_000);
    if (d.toDateString() === auj.toDateString()) return 'Aujourd’hui';
    if (d.toDateString() === hier.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  heure(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
