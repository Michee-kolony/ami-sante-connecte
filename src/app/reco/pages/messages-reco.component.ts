import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvatarComponent } from '../../admin/components/avatar.component';
import { messageErreur } from '../../admin/data/session.service';
import { RecoService } from '../reco.service';
import { ContactReco, DiscussionReco, MessageReco, RecoMessagesService } from '../reco-messages.service';

/** Messages rapides du terrain (sans détail médical). */
const MODELES = [
  'Je suis sur place.',
  'La personne n’a pas été trouvée à son domicile.',
  'La personne a accepté de venir à la structure.',
  'Pouvez-vous me rappeler, s’il vous plaît ?',
  'Besoin d’une ambulance : je vous envoie le lieu.',
];

/**
 * Messagerie du RECO : discussions avec les médecins, infirmier·ères, sages-femmes et chauffeurs
 * de son établissement. Liste des conversations, nouvelle conversation, fil avec accusés de lecture
 * et « en train d'écrire ».
 */
@Component({
  selector: 'app-messages-reco',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  // Blocs espacés entre eux et détachés de l'en-tête de l'application.
  host: { class: 'block space-y-4 pt-3' },
  template: `
    @if (!actif()) {
      <!-- ================= CONVERSATIONS ================= -->
      <div class="flex items-center gap-3 pb-1">
        <button type="button" class="btn-ghost px-2" (click)="retour.emit()" aria-label="Retour aux tâches"><i class="fa-solid fa-arrow-left"></i></button>
        <h1 class="flex-1 text-xl font-bold text-slate-900 dark:text-white">Messages</h1>
        <button type="button" class="btn-primary px-4 py-2 text-sm" (click)="ouvrirContacts()" [disabled]="!reco.enLigne()"><i class="fa-solid fa-pen-to-square"></i> Nouveau</button>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">Échangez avec le personnel et les chauffeurs de {{ reco.reco()?.structure?.nom ?? 'votre structure' }}. Ne donnez pas de détail médical : la personne est suivie par la structure.</p>
      @if (!reco.enLigne()) {
        <p class="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><i class="fa-solid fa-plane"></i> Hors connexion : la messagerie reprendra au retour du réseau.</p>
      }
      @if (erreur()) { <p class="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">{{ erreur() }}</p> }

      @if (contactsOuverts()) {
        <div class="card overflow-hidden">
          <div class="flex items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
            <i class="fa-solid fa-magnifying-glass text-slate-400"></i>
            <input class="min-w-0 flex-1 bg-transparent text-sm focus:outline-none dark:text-white" placeholder="Nom ou fonction (médecin, chauffeur…)" [ngModel]="rechercheContact()" (ngModelChange)="rechercheContact.set($event)" name="rc">
            <button type="button" class="btn-ghost px-2 text-xs" (click)="contactsOuverts.set(false)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
          </div>
          @if (chargementContacts()) {
            <p class="p-4 text-center text-sm text-slate-500"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</p>
          }
          @for (g of groupesContacts(); track g.nom) {
            <p class="bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">{{ g.nom }}</p>
            <ul class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (c of g.contacts; track c.id) {
                <li>
                  <button type="button" class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40" (click)="demarrer(c)">
                    <span class="relative flex-none">
                      <app-avatar [photo]="c.photo ?? undefined" [prenom]="c.prenom" [nomFamille]="c.nom" class="h-10 w-10 rounded-full text-xs" />
                      @if (service.enLigne().has(c.id)) { <span class="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900"></span> }
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ c.prenom }} {{ c.nom }}</span>
                      <span class="block truncate text-xs text-slate-500 dark:text-slate-400">{{ c.role }}</span>
                    </span>
                    @if (service.enLigne().has(c.id)) { <span class="text-[11px] font-medium text-accent-600 dark:text-accent-400">en ligne</span> }
                  </button>
                </li>
              }
            </ul>
          } @empty {
            @if (!chargementContacts()) { <p class="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Aucun contact trouvé dans votre structure.</p> }
          }
        </div>
      }

      <div class="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        @if (!service.charge() && reco.enLigne()) {
          <p class="p-6 text-center text-sm text-slate-500"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</p>
        }
        @for (d of service.discussions(); track d.id) {
          @let c = d.interlocuteur;
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40" (click)="ouvrir(d)">
            <span class="relative flex-none">
              <app-avatar [photo]="c?.photo ?? undefined" [prenom]="c?.prenom ?? '?'" [nomFamille]="c?.nom ?? ''" class="h-11 w-11 rounded-full text-sm" />
              @if (c && service.enLigne().has(c.id)) { <span class="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900"></span> }
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ c ? c.prenom + ' ' + c.nom : 'Compte supprimé' }} <span class="text-xs font-normal text-slate-400">· {{ c?.role }}</span></span>
                <span class="flex-none text-[11px] text-slate-400">{{ dateCourte(d.dernierMessageLe) }}</span>
              </span>
              <span class="flex items-center justify-between gap-2">
                <span class="truncate text-xs" [class]="d.nonLus ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'">
                  @if (service.enTrainDecrire().has(d.id)) { <em class="text-brand-600 dark:text-brand-300">écrit…</em> } @else { {{ apercu(d) }} }
                </span>
                @if (d.nonLus) { <span class="flex-none rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">{{ d.nonLus }}</span> }
              </span>
            </span>
          </button>
        } @empty {
          @if (service.charge()) {
            <p class="p-6 text-center text-sm text-slate-500 dark:text-slate-400"><i class="fa-regular fa-comments mb-2 block text-2xl text-slate-300"></i>Aucune conversation. Appuyez sur « Nouveau » pour écrire à un médecin ou à un chauffeur.</p>
          }
        }
      </div>
    } @else {
      <!-- ================= CONVERSATION ================= -->
      @let d = actif()!;
      @let c = d.interlocuteur;
      <div class="flex h-[calc(100dvh-12rem)] flex-col">
        <div class="flex items-center gap-3 pb-3">
          <button type="button" class="btn-ghost px-2" (click)="fermer()" aria-label="Retour aux conversations"><i class="fa-solid fa-arrow-left"></i></button>
          <app-avatar [photo]="c?.photo ?? undefined" [prenom]="c?.prenom ?? '?'" [nomFamille]="c?.nom ?? ''" class="h-10 w-10 rounded-full text-xs" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ c ? c.prenom + ' ' + c.nom : 'Compte supprimé' }}</p>
            <p class="truncate text-xs" [class]="service.enTrainDecrire().has(d.id) || (c && service.enLigne().has(c.id)) ? 'text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400'">
              {{ service.enTrainDecrire().has(d.id) ? 'écrit…' : c?.role + (c && service.enLigne().has(c.id) ? ' · en ligne' : '') }}
            </p>
          </div>
        </div>

        <div #fil class="card min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          @if (service.plusAnciens()[d.id]) {
            <button type="button" class="mx-auto block text-xs font-semibold text-brand-600 underline dark:text-brand-400" (click)="plusAnciens()">Messages plus anciens</button>
          }
          @if (chargementFil()) { <p class="text-center text-sm text-slate-500"><i class="fa-solid fa-spinner fa-spin"></i></p> }
          @for (g of groupes(); track g.jour) {
            <p class="text-center text-[11px] font-medium text-slate-400">{{ g.libelle }}</p>
            @for (m of g.messages; track m.id) {
              @let deMoi = m.auteurId === service.moi;
              <div class="flex" [class.justify-end]="deMoi">
                <div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm"
                     [class]="deMoi ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'">
                  <p class="whitespace-pre-wrap break-words">{{ m.texte }}</p>
                  <p class="mt-0.5 text-right text-[10px]" [class]="deMoi ? 'text-white/70' : 'text-slate-400'">
                    {{ heure(m.envoyeLe) }}
                    @if (deMoi) {
                      @switch (m.etat) {
                        @case ('envoi') { <i class="fa-regular fa-clock ml-0.5"></i> }
                        @case ('echec') { <button type="button" class="ml-1 font-semibold underline" (click)="renvoyer(m)">Échec · renvoyer</button> }
                        @default { <i class="fa-solid ml-0.5" [class]="estLu(m, d) ? 'fa-check-double text-sky-200' : 'fa-check'" [title]="estLu(m, d) ? 'Lu' : 'Envoyé'"></i> }
                      }
                    }
                  </p>
                </div>
              </div>
            }
          } @empty {
            @if (!chargementFil()) { <p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Écrivez votre premier message.</p> }
          }
        </div>

        @if (erreur()) { <p class="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">{{ erreur() }}</p> }
        @if (modeles()) {
          <div class="mt-2 flex flex-wrap gap-1.5">
            @for (t of MODELES; track t) {
              <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300" (click)="inserer(t)">{{ t }}</button>
            }
          </div>
        }
        <form class="mt-2 flex items-end gap-2" (ngSubmit)="envoyer()">
          <button type="button" class="btn-ghost flex-none px-2.5" (click)="modeles.set(!modeles())" title="Messages rapides" aria-label="Messages rapides"><i class="fa-solid fa-bolt"></i></button>
          <textarea #saisie rows="1" name="texte" class="input max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5" placeholder="Votre message" [maxlength]="TAILLE_MAX"
                    [(ngModel)]="texte" (keydown)="clavier($event)" (input)="surSaisie()" [disabled]="!reco.enLigne()"></textarea>
          <button type="submit" class="btn-primary flex-none px-3.5" [disabled]="!texte.trim() || !reco.enLigne()" aria-label="Envoyer"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
    }
  `,
})
export class MessagesRecoComponent implements AfterViewChecked, OnDestroy {
  readonly service = inject(RecoMessagesService);
  readonly reco = inject(RecoService);
  readonly MODELES = MODELES;
  readonly TAILLE_MAX = 2000;
  /** Retour à la liste des tâches. */
  retour = output<void>();

  @ViewChild('fil') private filRef?: ElementRef<HTMLElement>;
  @ViewChild('saisie') private saisieRef?: ElementRef<HTMLTextAreaElement>;
  private defilerEnBas = false;
  private derniereSaisie = 0;

  texte = '';
  rechercheContact = signal('');
  erreur = signal('');
  modeles = signal(false);
  chargementFil = signal(false);
  contactsOuverts = signal(false);
  chargementContacts = signal(false);
  private listeContacts = signal<ContactReco[]>([]);

  actif = computed(() => this.service.discussions().find(d => d.id === this.service.ouverte()) ?? null);

  groupesContacts = computed(() => {
    const q = this.rechercheContact().trim().toLowerCase();
    const liste = this.listeContacts()
      .filter(c => !q || `${c.prenom} ${c.nom} ${c.role}`.toLowerCase().includes(q))
      .sort((a, b) => Number(this.service.enLigne().has(b.id)) - Number(this.service.enLigne().has(a.id)));
    return [
      { nom: 'Personnel soignant', contacts: liste.filter(c => c.role !== 'Chauffeur') },
      { nom: 'Chauffeurs d’ambulance', contacts: liste.filter(c => c.role === 'Chauffeur') },
    ].filter(g => g.contacts.length);
  });

  /** Messages regroupés par jour. */
  groupes = computed(() => {
    const d = this.actif();
    const groupes: { jour: string; libelle: string; messages: MessageReco[] }[] = [];
    for (const m of d ? this.service.messages()[d.id] ?? [] : []) {
      const jour = this.jour(m.envoyeLe);
      let g = groupes.at(-1);
      if (!g || g.jour !== jour) groupes.push(g = { jour, libelle: this.libelleJour(jour), messages: [] });
      g.messages.push(m);
    }
    return groupes;
  });

  ngAfterViewChecked(): void {
    if (this.defilerEnBas && this.filRef) {
      this.filRef.nativeElement.scrollTop = this.filRef.nativeElement.scrollHeight;
      this.defilerEnBas = false;
    }
  }

  ngOnDestroy(): void {
    this.service.ouverte.set(null);
  }

  async ouvrirContacts(): Promise<void> {
    this.contactsOuverts.set(true);
    this.rechercheContact.set('');
    this.chargementContacts.set(true);
    this.erreur.set('');
    try {
      this.listeContacts.set(await this.service.contacts());
    } catch (err) {
      this.erreur.set(messageErreur(err));
    } finally {
      this.chargementContacts.set(false);
    }
  }

  async demarrer(c: ContactReco): Promise<void> {
    this.contactsOuverts.set(false);
    try {
      await this.ouvrir(await this.service.ouvrirAvec(c));
    } catch (err) {
      this.erreur.set(messageErreur(err));
    }
  }

  async ouvrir(d: DiscussionReco): Promise<void> {
    this.service.ouverte.set(d.id);
    this.erreur.set('');
    this.texte = '';
    this.modeles.set(false);
    this.defilerEnBas = true;
    if (!this.service.messages()[d.id]) {
      this.chargementFil.set(true);
      try {
        await this.service.chargerMessages(d.id);
      } catch (err) {
        this.erreur.set(messageErreur(err));
      } finally {
        this.chargementFil.set(false);
      }
    }
    this.defilerEnBas = true;
    this.service.marquerLu(d.id);
  }

  fermer(): void {
    this.service.ouverte.set(null);
    this.erreur.set('');
  }

  async plusAnciens(): Promise<void> {
    const d = this.actif();
    if (!d || !this.filRef) return;
    const el = this.filRef.nativeElement;
    const hauteurAvant = el.scrollHeight;
    await this.service.chargerMessages(d.id, true).catch(err => this.erreur.set(messageErreur(err)));
    setTimeout(() => (el.scrollTop = el.scrollHeight - hauteurAvant));
  }

  clavier(e: KeyboardEvent): void {
    // Entrée : envoyer (clavier physique) ; Maj + Entrée : nouvelle ligne.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !('ontouchstart' in window)) {
      e.preventDefault();
      this.envoyer();
    }
  }

  surSaisie(): void {
    const d = this.actif();
    if (!d || Date.now() - this.derniereSaisie < 2000) return;
    this.derniereSaisie = Date.now();
    this.service.signalerSaisie(d.id);
  }

  async envoyer(): Promise<void> {
    const d = this.actif();
    const texte = this.texte.trim();
    if (!d || !texte || texte.length > this.TAILLE_MAX) return;
    this.texte = '';
    this.erreur.set('');
    this.modeles.set(false);
    this.defilerEnBas = true;
    try {
      await this.service.envoyer(d.id, texte);
    } catch (err) {
      this.erreur.set(messageErreur(err));
    }
    this.defilerEnBas = true;
  }

  async renvoyer(m: MessageReco): Promise<void> {
    this.service.retirer(m.discussionId, m.id);
    this.texte = m.texte;
    await this.envoyer();
  }

  inserer(t: string): void {
    this.texte = this.texte ? `${this.texte} ${t}` : t;
    this.modeles.set(false);
    this.saisieRef?.nativeElement.focus();
  }

  estLu(m: MessageReco, d: DiscussionReco): boolean {
    return !!d.interlocuteur && m.lusPar.some(l => l.soignantId === d.interlocuteur!.id);
  }

  apercu(d: DiscussionReco): string {
    const m = d.dernierMessage;
    if (!m) return 'Nouvelle conversation';
    return `${m.auteurId === this.service.moi ? 'Vous : ' : ''}${m.texte}`;
  }

  heure(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  dateCourte(iso: string | null): string {
    if (!iso) return '';
    const jour = this.jour(iso);
    return jour === this.jour(new Date().toISOString()) ? this.heure(iso) : this.libelleJour(jour, true);
  }

  private jour(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private libelleJour(jour: string, court = false): string {
    const auj = this.jour(new Date().toISOString());
    const hier = this.jour(new Date(Date.now() - 86400000).toISOString());
    if (jour === auj) return 'Aujourd’hui';
    if (jour === hier) return 'Hier';
    return new Intl.DateTimeFormat('fr-FR', court ? { day: '2-digit', month: '2-digit' } : { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${jour}T12:00:00`));
  }
}
