import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LangueService } from '../../../shared/i18n/langue.service';
import { LangueToggleComponent } from '../../../shared/i18n/langue-toggle.component';
import { CaptureGuide, ConfigGuide, EtapeGuide, FormatCapture, Texte } from './guide.model';

/** Libellés fixes de la page des guides. */
const UI = {
  retour: { fr: 'Retour au site', ln: 'Zonga na site' },
  langue: { fr: 'Ce guide existe en français et en lingala :', ln: 'Mokanda oyo ezali na lifalanse mpe na lingala :' },
  sommaire: { fr: 'Sommaire', ln: 'Makambo ezali na kati' },
  sommaireAria: { fr: 'Sommaire du guide', ln: 'Makambo ya mokanda' },
  etape: { fr: 'Étape', ln: 'Eteni' },
  acces: { fr: 'Accès', ln: 'Nani akoki kosalela' },
  astuce: { fr: 'Conseil', ln: 'Toli' },
  agrandir: { fr: 'Agrandir', ln: 'Komonisa monene' },
  fermer: { fr: 'Fermer', ln: 'Kokanga' },
  precedente: { fr: 'Capture précédente', ln: 'Elilingi ya liboso' },
  suivante: { fr: 'Capture suivante', ln: 'Elilingi oyo elandi' },
  captures: { fr: 'Captures', ln: 'Bililingi' },
  etapes: { fr: 'Étapes', ln: 'Biteni' },
  contact: { fr: 'Nous contacter', ln: 'Kokutana na biso' },
  touche: { fr: 'Touchez ou cliquez sur une capture pour l’agrandir.', ln: 'Simba to finá elilingi mpo na komona yango monene.' },
} satisfies Record<string, Texte>;

/**
 * Mise en page commune des guides illustrés : en-tête, sommaire par parties, étapes
 * numérotées avec captures d'écran et visionneuse plein écran. Bilingue français / lingala.
 */
@Component({
  selector: 'app-guide-vue',
  standalone: true,
  imports: [RouterLink, LangueToggleComponent],
  templateUrl: './guide-vue.component.html',
})
export class GuideVueComponent {
  config = input.required<ConfigGuide>();

  private langue = inject(LangueService);
  private titre = inject(Title);
  ui = UI;

  /** Étapes numérotées en continu à travers les parties. */
  numeros = computed(() => {
    const n = new Map<string, number>();
    let i = 0;
    for (const p of this.config().parties) for (const e of p.etapes) n.set(e.id, ++i);
    return n;
  });
  totalEtapes = computed(() => this.numeros().size);
  totalCaptures = computed(() => this.config().parties.reduce((s, p) => s + p.etapes.reduce((t, e) => t + e.captures.length, 0), 0));

  /** Capture affichée en grand (null : visionneuse fermée). */
  zoom = signal<{ etape: EtapeGuide; index: number } | null>(null);

  constructor() {
    effect(() => this.titre.setTitle(this.t(this.config().titreOnglet)));
  }

  /** Texte dans la langue choisie (français si la traduction manque). */
  t(x: Texte | undefined): string {
    if (!x) return '';
    return this.langue.langue() === 'ln' && x.ln ? x.ln : x.fr;
  }

  format(c: CaptureGuide): FormatCapture {
    return c.format ?? this.config().format;
  }

  src(c: CaptureGuide): string {
    return `${this.config().dossier}/${c.fichier}.webp`;
  }


  ouvrir(etape: EtapeGuide, index: number): void {
    this.zoom.set({ etape, index });
  }

  fermer(): void {
    this.zoom.set(null);
  }

  /** Capture précédente (-1) ou suivante (+1) dans la même étape. */
  changer(pas: number): void {
    const z = this.zoom();
    if (!z) return;
    const n = z.etape.captures.length;
    this.zoom.set({ etape: z.etape, index: (z.index + pas + n) % n });
  }

  @HostListener('document:keydown', ['$event'])
  clavier(e: KeyboardEvent): void {
    if (!this.zoom()) return;
    if (e.key === 'Escape') this.fermer();
    else if (e.key === 'ArrowRight') this.changer(1);
    else if (e.key === 'ArrowLeft') this.changer(-1);
  }

  couleurs: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  };
}
