import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_ETABLISSEMENTS } from './espace';

export type TypeEtablissement =
  | 'Hôpital général de référence'
  | 'Hôpital militaire'
  | 'Centre de santé de référence'
  | 'Centre de santé'
  | 'Poste de santé'
  | 'Polyclinique'
  | 'Clinique'
  | 'Hôpital provincial'
  | 'Hôpital national'
  | 'Centre médical'
  | 'Autre';
export type SecteurEtablissement = 'Public' | 'Privé' | 'Confessionnel' | 'Militaire' | 'ONG';
export type StatutEtablissement = 'Actif' | 'Suspendu';

export const TYPES_ETABLISSEMENT: TypeEtablissement[] = [
  'Hôpital général de référence', 'Hôpital militaire', 'Centre de santé de référence',
  'Centre de santé', 'Poste de santé', 'Polyclinique', 'Clinique',
  'Hôpital provincial', 'Hôpital national', 'Centre médical', 'Autre',
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
  /** Code AMI (fiche, étape 1), ex. AMI-TAN-KAL-00124 : automatique, jamais modifié. */
  codeAmi?: string | null;
  /** Résumé de la fiche AMI (null : établissement enregistré avant la fiche). */
  ficheAmi?: { statut: string; completude: number; modulesActifs: string[] | null; niveauSanitaire: string | null; statutActuel: string | null } | null;
  nom: string;
  type: TypeEtablissement;
  secteur: SecteurEtablissement;
  province: string;
  /** District sanitaire (en-tête de la fiche CPN). */
  districtSanitaire: string;
  /** Zone de santé principale (la première de `zonesSante`). */
  zoneSante: string;
  /** Zones de santé couvertes, de la province (référentiel zones-sante.ts). */
  zonesSante: string[];
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
  /** Espace du comité seulement : médecin(s) chef(s) et effectifs de l'établissement. */
  medecinsChefs?: MedecinChef[];
  effectifs?: { soignants: number; patientes: number };
}

/** Médecin chef d'un établissement : superadmin de son établissement, désigné par le comité de pilotage. */
export interface MedecinChef {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  postnom: string;
  email: string;
  telephone: string;
  photo: string | null;
  statut: StatutEtablissement;
  derniereConnexion: string | null;
  doitChangerMotDePasse: boolean;
}

/** Identité du médecin chef saisie par le comité (son compte est créé avec un mot de passe temporaire). */
export interface DonneesMedecinChef {
  prenom: string;
  nom: string;
  postnom: string;
  sexe: 'F' | 'M' | '';
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  pieceType: string;
  pieceNumero: string;
  adresse: string;
  telephone: string;
  numeroOrdre: string;
  grade: string;
  specialite: string;
  email: string;
}

/** Compte du médecin chef créé : le mot de passe temporaire n'est renvoyé qu'une fois. */
export interface CompteMedecinChef {
  medecinChef: MedecinChef;
  motDePasseTemporaire: string;
}

/** Champs du formulaire d'ajout ou de modification. */
/** La zone principale (`zoneSante`) est déduite par le serveur : la première de `zonesSante`. */
export type DonneesEtablissement = Omit<Etablissement, 'id' | 'code' | 'codeAmi' | 'ficheAmi' | 'statut' | 'creeLe' | 'photos' | 'medecinsChefs' | 'effectifs' | 'zoneSante'> & {
  /** Fiche AMI : sections saisies (création) ou modifiées (modification), envoyées en JSON. */
  fiche?: object;
};

/**
 * Établissements sanitaires stockés par backend-ami-connecte. Les photos sont déposées
 * dans le bucket R2 (dossier etablissement/). Le personnel les consulte ; seul le comité de
 * pilotage les enregistre, avec leur médecin chef (espace /comite, adresse BASE_ETABLISSEMENTS).
 */
@Injectable({ providedIn: 'root' })
export class EtablissementsService {
  private http = inject(HttpClient);
  private url = inject(BASE_ETABLISSEMENTS);
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

  /** Comité de pilotage : l'établissement et le compte de son médecin chef sont créés ensemble. */
  async ajouter(donnees: DonneesEtablissement, photos: File[], medecinChef: DonneesMedecinChef): Promise<Etablissement & CompteMedecinChef> {
    const c = corps(donnees, photos);
    c.append('medecinChef', JSON.stringify(medecinChef));
    const r = await firstValueFrom(this.http.post<{ etablissement: Etablissement } & CompteMedecinChef>(this.url, c));
    const e: Etablissement = { ...r.etablissement, medecinsChefs: [r.medecinChef], effectifs: { soignants: 1, patientes: 0 } };
    this.etablissements.update(liste => [e, ...liste]);
    return { ...e, medecinChef: r.medecinChef, motDePasseTemporaire: r.motDePasseTemporaire };
  }

  /** Comité : désigne le médecin chef d'un établissement qui n'en a pas. */
  async designerMedecinChef(id: string, medecinChef: DonneesMedecinChef): Promise<CompteMedecinChef> {
    const r = await firstValueFrom(this.http.post<CompteMedecinChef>(`${this.url}/${id}/medecin-chef`, { medecinChef }));
    this.majChef(id, r.medecinChef);
    return r;
  }

  /** Comité : suspend ou réactive le compte du médecin chef. */
  async basculerMedecinChef(id: string, chefId: string): Promise<MedecinChef> {
    const chef = await firstValueFrom(this.http.patch<MedecinChef>(`${this.url}/${id}/medecin-chef/${chefId}/statut`, {}));
    this.majChef(id, chef);
    return chef;
  }

  /** Comité : nouveau mot de passe temporaire du médecin chef (affiché une seule fois). */
  async reinitialiserMedecinChef(id: string, chefId: string): Promise<CompteMedecinChef> {
    const r = await firstValueFrom(this.http.post<CompteMedecinChef>(`${this.url}/${id}/medecin-chef/${chefId}/mot-de-passe`, {}));
    this.majChef(id, r.medecinChef);
    return r;
  }

  private majChef(id: string, chef: MedecinChef): void {
    this.etablissements.update(liste => liste.map(e => {
      if (e.id !== id) return e;
      const avant = e.medecinsChefs ?? [];
      const nouveau = !avant.some(c => c.id === chef.id);
      return {
        ...e, medecinsChefs: [...avant.filter(c => c.id !== chef.id), chef],
        effectifs: e.effectifs && nouveau ? { ...e.effectifs, soignants: e.effectifs.soignants + 1 } : e.effectifs,
      };
    }));
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

  /** Remplace la fiche reçue du serveur en gardant le médecin chef et les effectifs déjà connus. */
  private remplacer(e: Etablissement): void {
    this.etablissements.update(liste => liste.map(x => x.id === e.id ? { ...e, medecinsChefs: x.medecinsChefs, effectifs: x.effectifs } : x));
  }
}

function corps(donnees: DonneesEtablissement, photos: File[]): FormData {
  const c = new FormData();
  for (const [cle, valeur] of Object.entries(donnees)) {
    if (valeur === undefined) continue;
    c.append(cle, valeur !== null && typeof valeur === 'object' ? JSON.stringify(valeur) : valeur == null ? '' : String(valeur));
  }
  for (const p of photos) c.append('photos', p);
  return c;
}

function abreviation(province: string): string {
  const mots = province.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[\s-]+/);
  return mots.length > 1 ? (mots[0][0] + mots[1].slice(0, 2)) : mots[0].slice(0, 3);
}
