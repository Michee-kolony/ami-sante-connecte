import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../shared/api';

/** Référentiels servis par backend-ami-connecte (source unique, chargés une fois). */
@Injectable({ providedIn: 'root' })
export class ReferentielsService {
  private http = inject(HttpClient);
  private enCours: Promise<string[]> | null = null;

  /** Les 26 provinces de la RDC (vide tant qu'elles ne sont pas reçues). */
  readonly provinces = signal<string[]>([]);
  readonly erreurProvinces = signal(false);

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
