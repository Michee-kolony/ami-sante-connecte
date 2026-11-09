import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { API_URL } from '../../shared/api';
import { GroupePilotage } from './groupe-pilotage';
import { PresenceService } from './presence.service';
import { SessionService } from './session.service';

/**
 * Groupe de pilotage vu depuis l'espace professionnel : réservé au médecin chef (le serveur
 * refuse les autres soignants). Résumé chargé à chaque connexion temps réel.
 */
@Injectable({ providedIn: 'root' })
export class GroupePilotageService {
  private session = inject(SessionService);
  private presence = inject(PresenceService);
  readonly accessible = computed(() => this.session.soignant()?.role === 'Médecin chef de service');
  readonly groupe = new GroupePilotage(inject(HttpClient), `${API_URL}/discussions/groupe-pilotage`, () => this.session.soignant()?.id, this.presence);

  constructor() {
    effect(() => {
      const pret = this.accessible() && this.presence.charge();
      untracked(() => {
        if (pret) this.groupe.chargerResume().catch(() => {});
      });
    });
  }
}
