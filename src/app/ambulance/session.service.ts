import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FlotteService } from '../admin/data/flotte.service';

const CLE = 'ami-chauffeur';

/**
 * Chauffeur connecté à l'application ambulance.
 * ⚠️ Maquette : l'identifiant est gardé dans sessionStorage. En production, le serveur
 * délivre un jeton de session (cookie HttpOnly) après vérification du mot de passe.
 */
@Injectable({ providedIn: 'root' })
export class SessionChauffeurService {
  private flotte = inject(FlotteService);
  private readonly id = signal<string | null>(lire());

  readonly chauffeur = computed(() => this.flotte.chauffeur(this.id()));
  readonly ambulance = computed(() => {
    const id = this.id();
    return id ? this.flotte.affectations().get(id) : undefined;
  });

  ouvrir(chauffeurId: string): void {
    this.id.set(chauffeurId);
    try {
      sessionStorage.setItem(CLE, chauffeurId);
    } catch {
      // stockage indisponible : la session vaut jusqu'au rechargement
    }
  }

  fermer(): void {
    this.id.set(null);
    try {
      sessionStorage.removeItem(CLE);
    } catch {
      // ignore
    }
  }
}

function lire(): string | null {
  try {
    return sessionStorage.getItem(CLE);
  } catch {
    return null;
  }
}

/** Accès réservé aux chauffeurs connectés et actifs. */
export const chauffeurConnecte: CanActivateFn = () => {
  const c = inject(SessionChauffeurService).chauffeur();
  return c?.statut === 'Actif' ? true : inject(Router).createUrlTree(['/ambulance/connexion']);
};
