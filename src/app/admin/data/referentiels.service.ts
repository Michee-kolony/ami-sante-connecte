import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';

export interface SigneCpn { code: string; libelle: string; groupe: string }
export interface MesurePreventive {
  code: string;
  libelle: string;
  groupe: string;
  /** Moment recommandé (« À 16 SA », « Dès la CPN 1 »…). */
  repere?: string;
  /** Âge gestationnel (SA) à partir duquel la mesure est attendue. */
  semaine?: number;
  /** Valeur à noter en plus de oui/non (résultat, méthode, code…). */
  saisie?: string;
}

/** Fiche CPN fournie par l'équipe médicale (backend-ami-connecte/config/cpn.js). */
export interface ReferentielCpn {
  ETATS_CIVILS: string[];
  GROUPES_SANGUINS: string[];
  RHESUS: string[];
  ELECTROPHORESES: string[];
  ATCD_MEDICAUX: string[];
  ATCD_GYNECO_CHIRURGICAUX: string[];
  ATCD_OBSTETRICAUX: string[];
  SIGNES_CPN: SigneCpn[];
  ETATS_GENERAUX: string[];
  PRESENTATIONS: string[];
  MESURES_PREVENTIVES: MesurePreventive[];
  EXAMENS_LABO: { code: string; libelle: string }[];
  INTERVALLES_RDV_SEMAINES: number[];
  MOTIFS_REFERENCE: string[];
}

/** Regroupe une liste par « groupe », dans l'ordre d'apparition (sections des formulaires). */
export function parGroupe<T extends { groupe: string }>(liste: T[]): { groupe: string; elements: T[] }[] {
  const groupes: { groupe: string; elements: T[] }[] = [];
  for (const x of liste) {
    const g = groupes.find(y => y.groupe === x.groupe);
    if (g) g.elements.push(x);
    else groupes.push({ groupe: x.groupe, elements: [x] });
  }
  return groupes;
}

/** Référentiels servis par backend-ami-connecte (source unique, chargés une fois). */
@Injectable({ providedIn: 'root' })
export class ReferentielsService {
  private http = inject(HttpClient);
  private enCours: Promise<string[]> | null = null;

  /** Les 26 provinces de la RDC (vide tant qu'elles ne sont pas reçues). */
  readonly provinces = signal<string[]>([]);
  readonly erreurProvinces = signal(false);

  /** Fiche CPN (null tant qu'elle n'est pas reçue). */
  readonly cpn = signal<ReferentielCpn | null>(null);
  private cpnEnCours: Promise<ReferentielCpn> | null = null;

  chargerCpn(): Promise<ReferentielCpn> {
    const deja = this.cpn();
    if (deja) return Promise.resolve(deja);
    this.cpnEnCours ??= firstValueFrom(this.http.get<ReferentielCpn>(`${API_URL}/referentiels/cpn`))
      .then(r => {
        this.cpn.set(r);
        return r;
      })
      .finally(() => (this.cpnEnCours = null));
    return this.cpnEnCours;
  }

  chargerProvinces(): Promise<string[]> {
    if (this.provinces().length) return Promise.resolve(this.provinces());
    this.erreurProvinces.set(false);
    this.enCours ??= firstValueFrom(this.http.get<string[]>(`${API_URL}/referentiels/provinces`))
      .then(liste => {
        this.provinces.set(liste);
        return liste;
      })
      .catch(err => {
        this.erreurProvinces.set(true);
        throw err;
      })
      .finally(() => (this.enCours = null));
    return this.enCours;
  }
}
