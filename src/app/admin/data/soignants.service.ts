import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';

export type CategorieSoignant = 'Médecin' | 'Infirmier';
export type RoleSoignant =
  | 'Médecin' | 'Médecin chef de service' | 'Médecin directeur'
  | 'Infirmier(ère)' | 'Infirmier(ère) titulaire' | 'Infirmier(ère) superviseur(e)';
export type StatutSoignant = 'Actif' | 'Suspendu';
export type PieceIdentite = 'Carte d’électeur' | 'Passeport' | 'Carte militaire' | 'Permis de conduire';

/** Le rôle détermine la catégorie : c'est la seule différence dans le formulaire. */
export const ROLES_SOIGNANT: { categorie: CategorieSoignant; roles: RoleSoignant[] }[] = [
  { categorie: 'Médecin', roles: ['Médecin', 'Médecin chef de service', 'Médecin directeur'] },
  { categorie: 'Infirmier', roles: ['Infirmier(ère)', 'Infirmier(ère) titulaire', 'Infirmier(ère) superviseur(e)'] },
];
export const PIECES_IDENTITE: PieceIdentite[] = ['Carte d’électeur', 'Passeport', 'Carte militaire', 'Permis de conduire'];

/** Grades et spécialités proposés selon la catégorie. */
export const GRADES: Record<CategorieSoignant, string[]> = {
  Médecin: ['Médecin généraliste', 'Médecin spécialiste', 'Médecin résident', 'Professeur'],
  Infirmier: ['Licencié(e) (A0)', 'Gradué(e) (A1)', 'Diplômé(e) (A2)'],
};
export const SPECIALITES: Record<CategorieSoignant, string[]> = {
  Médecin: [
    'Médecine générale', 'Gynécologie-obstétrique', 'Pédiatrie', 'Médecine interne', 'Chirurgie générale',
    'Anesthésie-réanimation', 'Médecine d’urgence', 'Santé publique', 'Radiologie', 'Biologie médicale',
  ],
  Infirmier: [
    'Soins infirmiers généraux', 'Accoucheuse / sage-femme', 'Pédiatrie', 'Santé communautaire',
    'Soins d’urgence', 'Bloc opératoire', 'Anesthésie',
  ],
};
/** Ordre professionnel où le soignant est inscrit. */
export const ORDRE: Record<CategorieSoignant, string> = { Médecin: 'CNOM', Infirmier: 'CNOI' };

export function categorieDuRole(role: RoleSoignant): CategorieSoignant {
  return role.startsWith('Médecin') ? 'Médecin' : 'Infirmier';
}

export interface Affectation {
  etablissementId: string;
  /** Service dans cet établissement (facultatif). */
  service: string;
}

export interface Soignant {
  id: string;
  /** Identifiant interne attribué par la plateforme, ex. MED-0004 ou INF-0012. */
  matricule: string;
  // Identité
  prenom: string;
  nom: string;
  postnom: string;
  sexe: 'F' | 'M';
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  pieceType: PieceIdentite;
  pieceNumero: string;
  adresse: string;
  telephone: string;
  photo?: string;
  // Profession
  numeroOrdre: string;
  grade: string;
  specialite: string;
  /** Établissements où la personne exerce ; le premier est l'établissement principal. */
  affectations: Affectation[];
  // Accès
  email: string;
  role: RoleSoignant;
  statut: StatutSoignant;
  derniereConnexion: string | null;
  doitChangerMotDePasse: boolean;
  // Traçabilité
  /** Soignant qui a créé le compte ; null pour le compte initial (script serveur). */
  ajoutePar: AuteurAjout | null;
  /** Date d'ajout « AAAA-MM-JJ HH:MM » (createdAt du serveur). */
  creeLe: string | null;
}

/** Auteur d'un ajout, figé par le serveur au moment de la création du compte. */
export interface AuteurAjout {
  id: string | null;
  nom: string;
  role: RoleSoignant;
  matricule: string;
}

/** Champs saisis dans le formulaire d'ajout (le serveur attribue matricule, statut et traçabilité). */
export type NouveauSoignant = Omit<Soignant, 'id' | 'matricule' | 'statut' | 'derniereConnexion' | 'photo' | 'ajoutePar' | 'creeLe'>;

/** Date ISO du serveur → « AAAA-MM-JJ HH:MM » en heure locale. */
function formaterDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type SoignantServeur = Soignant & { createdAt?: string };

const normaliser = (s: SoignantServeur): Soignant => ({
  ...s,
  derniereConnexion: formaterDate(s.derniereConnexion),
  ajoutePar: s.ajoutePar ?? null,
  creeLe: s.creeLe ?? formaterDate(s.createdAt ?? null),
});

/** « Dr » devant le nom des médecins uniquement. */
export function nomAuteur(a: AuteurAjout): string {
  return `${categorieDuRole(a.role) === 'Médecin' ? 'Dr ' : ''}${a.nom}`;
}

/**
 * Comptes du personnel soignant (médecins et infirmier·ères), stockés par backend-ami-connecte.
 * Les photos sont envoyées au serveur, qui les dépose dans le bucket R2 (dossier soignant/).
 * Le mot de passe est haché côté serveur (bcrypt).
 */
@Injectable({ providedIn: 'root' })
export class SoignantsService {
  private http = inject(HttpClient);
  private url = `${API_URL}/soignants`;

  readonly soignants = signal<Soignant[]>([]);
  readonly chargement = signal(false);

  async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const liste = await firstValueFrom(this.http.get<Soignant[]>(this.url));
      this.soignants.set(liste.map(normaliser));
    } finally {
      this.chargement.set(false);
    }
  }

  emailExiste(email: string): boolean {
    const e = email.trim().toLowerCase();
    return !!e && this.soignants().some(s => s.email === e);
  }

  numeroOrdreExiste(numero: string): boolean {
    const n = numero.trim().toUpperCase();
    return !!n && this.soignants().some(s => s.numeroOrdre === n);
  }

  /** Aperçu du matricule : MED-xxxx pour les médecins, INF-xxxx pour les infirmier·ères (attribué par le serveur). */
  prochainMatricule(role: RoleSoignant): string {
    const prefixe = categorieDuRole(role) === 'Médecin' ? 'MED' : 'INF';
    const max = this.soignants()
      .filter(s => s.matricule.startsWith(prefixe + '-'))
      .reduce((m, s) => Math.max(m, parseInt(s.matricule.split('-')[1], 10) || 0), 0);
    return `${prefixe}-${String(max + 1).padStart(4, '0')}`;
  }

  async ajouter(donnees: NouveauSoignant, photo: File, motDePasse: string): Promise<Soignant> {
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(donnees)) {
      corps.append(cle, cle === 'affectations' ? JSON.stringify(valeur) : String(valeur));
    }
    corps.append('motDePasse', motDePasse);
    corps.append('photo', photo);
    const s = normaliser(await firstValueFrom(this.http.post<Soignant>(this.url, corps)));
    this.soignants.update(liste => [s, ...liste]);
    return s;
  }

  /** Le serveur génère un mot de passe temporaire et le renvoie une seule fois. */
  async reinitialiserMotDePasse(id: string): Promise<string> {
    const r = await firstValueFrom(this.http.post<{ soignant: Soignant; motDePasse: string }>(`${this.url}/${id}/mot-de-passe`, {}));
    this.remplacer(r.soignant);
    return r.motDePasse;
  }

  async basculer(id: string): Promise<void> {
    this.remplacer(await firstValueFrom(this.http.patch<Soignant>(`${this.url}/${id}/statut`, {})));
  }

  /** Un soignant : depuis la liste déjà chargée, sinon depuis le serveur. */
  async obtenir(id: string): Promise<Soignant> {
    const connu = this.soignants().find(s => s.id === id);
    if (connu) return connu;
    return normaliser(await firstValueFrom(this.http.get<Soignant>(`${this.url}/${id}`)));
  }

  async supprimer(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.url}/${id}`));
    this.soignants.update(liste => liste.filter(s => s.id !== id));
  }

  /** Médecin chef : modification du profil d'un soignant (affectations vérifiées actives par le serveur). */
  async modifier(id: string, donnees: Partial<NouveauSoignant>, photo: File | null): Promise<Soignant> {
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(donnees)) {
      if (valeur !== undefined) corps.append(cle, cle === 'affectations' ? JSON.stringify(valeur) : String(valeur ?? ''));
    }
    if (photo) corps.append('photo', photo);
    const s = await firstValueFrom(this.http.patch<Soignant>(`${this.url}/${id}`, corps));
    this.remplacer(s);
    return normaliser(s);
  }

  private remplacer(s: Soignant): void {
    this.soignants.update(liste => liste.map(x => x.id === s.id ? normaliser(s) : x));
  }
}
