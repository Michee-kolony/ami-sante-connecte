import { Injectable, computed, signal } from '@angular/core';
import { ALERTES, AlerteUrgence, EtatAlerte, EvenementUrgence, TypeEvenement, jour } from './urgences';

/** AAAA-MM-JJ HH:mm (heure locale). */
function maintenant(): string {
  const d = new Date();
  return `${jour(0)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Minutes entre deux dates « AAAA-MM-JJ HH:mm ». */
function minutesEntre(debut: string, fin: string): number {
  return Math.round((new Date(fin.replace(' ', 'T')).getTime() - new Date(debut.replace(' ', 'T')).getTime()) / 60_000);
}

/**
 * Toutes les urgences (en cours et passées) avec leur chronologie, gardées en mémoire
 * pendant la session (maquette sans serveur). Rien n'est jamais supprimé : une urgence
 * terminée reste consultable dans l'historique. Partagé par la page Urgences et l'application ambulance.
 */
@Injectable({ providedIn: 'root' })
export class UrgencesService {
  readonly alertes = signal<AlerteUrgence[]>(ALERTES.map(a => ({ ...a, evenements: [...a.evenements] })));

  readonly nouvelles = computed(() => this.alertes().filter(a => a.etat === 'nouvelle').length);

  alerte(id: string | null | undefined): AlerteUrgence | undefined {
    return id ? this.alertes().find(a => a.id === id) : undefined;
  }

  // Les objets AlerteUrgence restent les mêmes (la page garde une référence à l'alerte
  // sélectionnée) ; la liste est recréée pour prévenir les lecteurs du signal.
  private journaliser(a: AlerteUrgence, type: TypeEvenement, auteur: string, detail?: string, etat?: EtatAlerte): void {
    a.evenements.push({ date: maintenant(), type, auteur, detail });
    if (etat) a.etat = etat;
    this.alertes.update(liste => [...liste]);
  }

  prendreEnCharge(a: AlerteUrgence, auteur: string): void {
    this.journaliser(a, 'Prise en charge', auteur, undefined, 'prise en charge');
  }

  ambulanceEnvoyee(a: AlerteUrgence, ambulanceId: string, chauffeur: string, auteur: string): void {
    a.ambulanceId = ambulanceId;
    a.chauffeur = chauffeur;
    this.journaliser(a, 'Ambulance envoyée', auteur, `${ambulanceId} — ${chauffeur}`);
  }

  /** Étapes signalées par le chauffeur depuis l'application ambulance. */
  etapeChauffeur(a: AlerteUrgence, type: 'Arrivée sur place' | 'Patiente à bord' | 'Arrivée à l’hôpital', chauffeur: string): void {
    this.journaliser(a, type, chauffeur);
  }

  cloturer(a: AlerteUrgence, auteur: string, detail?: string): void {
    this.journaliser(a, 'Clôturée', auteur, detail, 'résolue');
  }

  annuler(a: AlerteUrgence, auteur: string, motif: string): void {
    this.journaliser(a, 'Annulée', auteur, motif, 'annulée');
  }

  // --- Indicateurs ---------------------------------------------------------------

  private evenement(a: AlerteUrgence, type: TypeEvenement): EvenementUrgence | undefined {
    return a.evenements.find(e => e.type === type);
  }

  /** Délai entre l'alerte et l'arrivée de l'ambulance sur place (min). */
  delaiArrivee(a: AlerteUrgence): number | null {
    const recu = this.evenement(a, 'Alerte reçue');
    const surPlace = this.evenement(a, 'Arrivée sur place');
    return recu && surPlace ? minutesEntre(recu.date, surPlace.date) : null;
  }

  /** Durée totale, de l'alerte à la clôture (min). */
  dureeTotale(a: AlerteUrgence): number | null {
    const recu = this.evenement(a, 'Alerte reçue');
    const fin = this.evenement(a, 'Clôturée') ?? this.evenement(a, 'Annulée');
    return recu && fin ? minutesEntre(recu.date, fin.date) : null;
  }
}
