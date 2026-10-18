import { inject, Pipe, PipeTransform } from '@angular/core';
import { LangueService } from './langue.service';

/**
 * Traduit un texte français dans la langue choisie : {{ 'Accueil' | t }}.
 * Impur pour se mettre à jour dès que la langue change.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TraduirePipe implements PipeTransform {
  private langue = inject(LangueService);

  transform(texte: string): string {
    return this.langue.traduire(texte);
  }
}
