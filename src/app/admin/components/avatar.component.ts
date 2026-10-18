import { Component, Input, OnChanges } from '@angular/core';

/**
 * Photo de profil d'une patiente. Affiche les initiales tant qu'il n'y a pas de photo
 * (ou si le fichier est introuvable).
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (photo && !erreur) {
      <img [src]="photo" [alt]="nom" loading="lazy" (error)="erreur = true"
           class="h-full w-full object-cover">
    } @else {
      <span class="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-accent-50 font-semibold text-brand-700 dark:from-brand-500/20 dark:to-accent-500/10 dark:text-brand-300">
        {{ initiales }}
      </span>
    }
  `,
  host: { class: 'block flex-none overflow-hidden' },
})
export class AvatarComponent implements OnChanges {
  @Input() photo?: string;
  @Input() prenom = '';
  @Input() nomFamille = '';
  erreur = false;

  ngOnChanges(): void {
    this.erreur = false;
  }

  get initiales(): string {
    return `${this.prenom.charAt(0)}${this.nomFamille.charAt(0)}`.toUpperCase();
  }

  get nom(): string {
    return `${this.prenom} ${this.nomFamille}`.trim();
  }
}
