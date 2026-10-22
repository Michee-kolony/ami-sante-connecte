import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';

export type TypeEtablissement =
  | 'Hôpital général de référence'
  | 'Hôpital militaire'
  | 'Centre de santé de référence'
  | 'Centre de santé'
  | 'Poste de santé'
  | 'Polyclinique'
  | 'Clinique';
export type SecteurEtablissement = 'Public' | 'Privé' | 'Confessionnel' | 'Militaire' | 'ONG';
export type StatutEtablissement = 'Actif' | 'Suspendu';

export const TYPES_ETABLISSEMENT: TypeEtablissement[] = [
  'Hôpital général de référence', 'Hôpital militaire', 'Centre de santé de référence',
  'Centre de santé', 'Poste de santé', 'Polyclinique', 'Clinique',
];
export const SECTEURS_ETABLISSEMENT: SecteurEtablissement[] = ['Public', 'Privé', 'Confessionnel', 'Militaire', 'ONG'];
export const SERVICES_ETABLISSEMENT = [
  'CPN', 'Maternité', 'Vaccination', 'Urgences', 'Ambulance', 'Pédiatrie', 'Laboratoire', 'Imagerie', 'Chirurgie',
] as const;
export type ServiceEtablissement = (typeof SERVICES_ETABLISSEMENT)[number];

export interface Etablissement {
  id: string;
  /** Code unique attribué par la plateforme, ex. ETS-KIN-0003. */
  code: string;
  nom: string;
  type: TypeEtablissement;
  secteur: SecteurEtablissement;
  province: string;
  /** District sanitaire (en-tête de la fiche CPN). */
  districtSanitaire: string;
  zoneSante: string;
  aireSante: string;
  adresse: string;
  latitude: number | null;
  longitude: number | null;
  telephone: string;
  email: string;
  responsable: string;
  fonctionResponsable: string;
  lits: number;
  services: ServiceEtablissement[];
  /** URLs publiques des photos (R2) ; la première sert de couverture. */
  photos: string[];
  statut: StatutEtablissement;
  creeLe: string;
}

/** Champs du formulaire d'ajout ou de modification. */
export type DonneesEtablissement = Omit<Etablissement, 'id' | 'code' | 'statut' | 'creeLe' | 'photos'>;

/**
 * Établissements sanitaires stockés par backend-ami-connecte. Les photos sont déposées
 * dans le bucket R2 (dossier etablissement/). Seul le médecin chef peut les gérer.
 */
@Injectable({ providedIn: 'root' })
export class EtablissementsService {
  private http = inject(HttpClient);
  private url = `${API_URL}/etablissements`;
  private chargementEnCours: Promise<void> | null = null;

  readonly etablissements = signal<Etablissement[]>([]);
  readonly charge = signal(false);

  /** Charge la liste une fois (appels suivants sans effet, sauf `forcer`). */
  charger(forcer = false): Promise<void> {
    if (this.charge() && !forcer) return Promise.resolve();
    if (!this.chargementEnCours || forcer) {
      this.chargementEnCours = firstValueFrom(this.http.get<Etablissement[]>(this.url))
        .then(liste => {
          this.etablissements.set(liste);
          this.charge.set(true);
        })
        .finally(() => (this.chargementEnCours = null));
    }
    return this.chargementEnCours;
  }

  nomExiste(nom: string, province: string, saufId?: string): boolean {
    const n = nom.trim().toLowerCase();
    return !!n && this.etablissements().some(e => e.id !== saufId && e.nom.toLowerCase() === n && e.province === province);
  }

  /** Aperçu du code ETS-<province>-<numéro> (attribué définitivement par le serveur). */
  prochainCode(province: string): string {
    const prefixe = `ETS-${abreviation(province)}-`;
    const max = this.etablissements()
      .filter(e => e.code.startsWith(prefixe))
      .reduce((m, e) => Math.max(m, parseInt(e.code.slice(prefixe.length), 10) || 0), 0);
    return prefixe + String(max + 1).padStart(4, '0');
  }

  async ajouter(donnees: DonneesEtablissement, photos: File[]): Promise<Etablissement> {
    const e = await firstValueFrom(this.http.post<Etablissement>(this.url, corps(donnees, photos)));
    this.etablissements.update(liste => [e, ...liste]);
    return e;
  }

  /** `photosConservees` : URLs des photos existantes à garder ; les autres sont supprimées. */
  async modifier(id: string, donnees: DonneesEtablissement, photosConservees: string[], nouvelles: File[]): Promise<Etablissement> {
    const c = corps(donnees, nouvelles);
    c.append('photosConservees', JSON.stringify(photosConservees));
    const e = await firstValueFrom(this.http.patch<Etablissement>(`${this.url}/${id}`, c));
    this.remplacer(e);
    return e;
  }

  async basculer(id: string): Promise<void> {
    this.remplacer(await firstValueFrom(this.http.patch<Etablissement>(`${this.url}/${id}/statut`, {})));
  }

  async supprimer(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.url}/${id}`));
    this.etablissements.update(liste => liste.filter(e => e.id !== id));
  }

  private remplacer(e: Etablissement): void {
    this.etablissements.update(liste => liste.map(x => x.id === e.id ? e : x));
  }
}

function corps(donnees: DonneesEtablissement, photos: File[]): FormData {
  const c = new FormData();
  for (const [cle, valeur] of Object.entries(donnees)) {
    c.append(cle, cle === 'services' ? JSON.stringify(valeur) : valeur == null ? '' : String(valeur));
  }
  for (const p of photos) c.append('photos', p);
  return c;
}

function abreviation(province: string): string {
  const mots = province.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[\s-]+/);
  return mots.length > 1 ? (mots[0][0] + mots[1].slice(0, 2)) : mots[0].slice(0, 3);
}
