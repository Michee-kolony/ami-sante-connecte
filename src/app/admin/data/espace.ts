import { InjectionToken } from '@angular/core';
import { API_URL } from '../../shared/api';

/**
 * Espace du comité de pilotage : les pages et composants partagés avec l'administration
 * (établissements, synthèse du tableau de bord) masquent alors les liens vers les pages du
 * personnel et proposent les actions réservées au comité. Fourni par les routes /comite.
 */
export const ESPACE_COMITE = new InjectionToken<boolean>('espace du comité de pilotage', { factory: () => false });

/** Adresse des indicateurs : établissement de connexion (personnel) ou tous les établissements (comité). */
export const BASE_STATISTIQUES = new InjectionToken<string>('base des statistiques', { factory: () => `${API_URL}/statistiques` });

/** Adresse des établissements : consultation (personnel) ou gestion complète (comité). */
export const BASE_ETABLISSEMENTS = new InjectionToken<string>('base des établissements', { factory: () => `${API_URL}/etablissements` });
