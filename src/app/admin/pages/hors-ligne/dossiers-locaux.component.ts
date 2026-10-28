import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../../shared/api';
import { PrisePhotoComponent } from '../../components/prise-photo.component';
import { dpaNaegele, jourFr } from '../../data/format';
import { messageErreur } from '../../data/session.service';
import { DossierLocal, HorsLigneService, LIBELLES_STATUT, StatutSync, estMiseEnFile } from '../../data/hors-ligne/hors-ligne.service';
import { DoseLocale, DoseReferentiel, PHASE_ACTIVE_CM, SurveillanceLocale, alertesLocales, bcfAnormal, carnetLocal, jourKinshasa, pointsDilatation } from '../../data/hors-ligne/calculs-locaux';

/** Saisie rattachée à un dossier local (en attente dans la file, ou déjà synchronisée). */
interface Evenement { operationId: string; libelle: string; recordType: string; statut: StatutSync | 'ABANDONNÉE'; le: string; corps: Record<string, any> | null; url: string; erreur?: string | null }

type Formulaire = 'consultation' | 'rendezVous' | 'admission' | 'surveillance' | 'accouchement' | 'nouveauNe' | 'vaccination' | null;

const maintenantLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * Dossiers créés hors connexion (patiente, grossesse, enfant, accouchement) : consultables et
 * complétables sur l'appareil avant que le serveur ne leur attribue un numéro. Chaque saisie part
 * dans la file de synchronisation ; les liens (mère → enfant, patiente → accouchement → nouveau-né)
 * sont gardés par les identifiants locaux, remplacés par ceux du serveur à l'envoi.
 */
@Component({
  selector: 'app-dossiers-locaux',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, PrisePhotoComponent],
  templateUrl: './dossiers-locaux.component.html',
})
export class DossiersLocauxComponent implements OnInit {
  readonly hl = inject(HorsLigneService);
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Dossier ouvert (route /admin/hors-ligne/:localId). */
  @Input() set localId(v: string | undefined) {
    this.ouvert.set(v ?? null);
    this.formulaire.set(null);
    this.message.set('');
    this.erreur.set('');
  }
  readonly ouvert = signal<string | null>(null);
  readonly libellesStatut = LIBELLES_STATUT;
  readonly jourFr = jourFr;
  readonly bcfAnormal = bcfAnormal;

  formulaire = signal<Formulaire>(null);
  envoi = signal(false);
  message = signal('');
  erreur = signal('');
  calendrier = signal<DoseReferentiel[]>([]);
  tolerance = 14;
  photo: File | null = null;

  saisie: Record<string, any> = {};

  readonly dossiers = computed(() => this.hl.locaux().filter(l => ['Patiente', 'Enfant', 'Accouchement'].includes(l.type)));
  readonly dossier = computed(() => this.hl.locaux().find(l => l.localId === this.ouvert()) ?? null);

  async ngOnInit(): Promise<void> {
    try {
      const r = await firstValueFrom(this.http.get<{ calendrier: DoseReferentiel[]; toleranceJours: number }>(`${API_URL}/referentiels/vaccination`));
      this.calendrier.set(r.calendrier);
      this.tolerance = r.toleranceJours ?? 14;
    } catch { /* référentiel non copié : le carnet local n'est pas calculé */ }
  }

  // --- Lecture ----------------------------------------------------------------------------

  nom(l: DossierLocal | null | undefined): string {
    if (!l) return '';
    const r = l.resume as Record<string, any>;
    if (l.type === 'Accouchement') return `Admission de ${this.nom(this.local(l.parent)) || 'la patiente'}`;
    return [r['prenom'], r['nom'], r['postnom']].filter(Boolean).join(' ') || (l.type === 'Enfant' ? 'Enfant' : 'Sans nom');
  }

  local(id: string | null | undefined): DossierLocal | null {
    return id ? this.hl.locaux().find(l => l.localId === id || l.serverId === id) ?? null : null;
  }

  /** Saisies qui visent ce dossier (file d'attente et accusés de réception). */
  evenements(l: DossierLocal): Evenement[] {
    // Saisies sur le dossier lui-même et, pour une patiente, sur sa grossesse (consultations).
    const g = l.type === 'Patiente' ? this.grossesseDe(l) : null;
    const ids = [l.localId, l.serverId, g?.localId, g?.serverId].filter((x): x is string => !!x);
    const vise = (url: string, corps: unknown) => {
      const texte = JSON.stringify(corps ?? '');
      return ids.some(id => url.includes(id) || texte.includes(id));
    };
    const enFile: Evenement[] = this.hl.operations()
      .filter(o => o.operationId !== l.operationId && vise(o.url, o.corps ?? o.formulaire?.find(c => c.nom === 'donnees')?.valeur))
      .map(o => ({ operationId: o.operationId, libelle: o.libelle, recordType: o.recordType, statut: o.statut, le: o.creeLe, corps: donnees(o.corps, o.formulaire), url: o.url, erreur: o.erreur }));
    const envoyes: Evenement[] = this.hl.journal()
      .filter(r => r.operationId !== l.operationId && vise(r.url, r.corps))
      .map(r => ({ operationId: r.operationId, libelle: r.libelle, recordType: r.recordType, statut: r.statut, le: r.creeLe, corps: (r.corps as Record<string, any>) ?? null, url: r.url }));
    return [...enFile, ...envoyes].sort((a, b) => a.le.localeCompare(b.le));
  }

  enfantsDe(l: DossierLocal): DossierLocal[] {
    return this.hl.locaux().filter(x => x.type === 'Enfant' && (x.parent === l.localId || x.mere === l.localId));
  }

  accouchementsDe(l: DossierLocal): DossierLocal[] {
    return this.hl.locaux().filter(x => x.type === 'Accouchement' && x.parent === l.localId);
  }

  grossesseDe(l: DossierLocal): DossierLocal | null {
    return this.hl.locaux().find(x => x.type === 'Grossesse' && x.parent === l.localId) ?? null;
  }

  /** DPA estimée par la DDR (règle de Naegele), à confirmer en consultation. */
  dpa(l: DossierLocal): string | null {
    const ddr = (this.grossesseDe(l)?.resume as Record<string, any> | undefined)?.['datation']?.ddr;
    return ddr ? dpaNaegele(ddr) : null;
  }

  /** Surveillances du travail d'un accouchement local, et partogramme calculé sur l'appareil. */
  surveillances(l: DossierLocal): SurveillanceLocale[] {
    return this.evenements(l).filter(e => /\/surveillances$/.test(e.url) && !/post-partum/.test(e.url) && e.corps)
      .map(e => ({ ...e.corps!, le: e.corps!['le'] ?? e.le } as SurveillanceLocale));
  }

  points(l: DossierLocal) {
    return pointsDilatation(this.surveillances(l));
  }

  pointDe(l: DossierLocal, le: string) {
    return this.points(l).find(p => p.le === le) ?? null;
  }

  alertes(l: DossierLocal) {
    return alertesLocales(this.surveillances(l));
  }

  /** Carnet vaccinal d'un enfant local : doses reçues (carnet papier et saisies) et doses dues. */
  carnet(l: DossierLocal): DoseLocale[] {
    const r = l.resume as Record<string, any>;
    const naissance: string | undefined = r['dateNaissance'] ?? (r['neLe'] ? jourKinshasa(new Date(r['neLe'])) : undefined) ?? jourKinshasa(new Date(l.creeLe));
    if (!naissance || !this.calendrier().length) return [];
    const faites = [
      ...((r['vaccinationsAnterieures'] ?? []) as { code: string; date: string }[]),
      ...this.evenements(l).filter(e => /\/vaccinations$/.test(e.url) && e.corps).flatMap(e => (e.corps!['doses'] ?? [e.corps]) as { code: string; date: string }[]),
    ];
    return carnetLocal(naissance, this.calendrier(), faites, this.tolerance);
  }

  dosesDues(l: DossierLocal): DoseLocale[] {
    return this.carnet(l).filter(d => d.statut === 'À faire' || d.statut === 'En retard');
  }

  couleurStatut(s: string): string {
    return s === 'SYNCED' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300'
      : s === 'ERROR' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      : s === 'LOCAL_ONLY' ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
      : s === 'ABANDONNÉE' ? 'bg-slate-100 text-slate-500'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }

  libelleStatut(s: string): string {
    return (LIBELLES_STATUT as Record<string, string>)[s] ?? s;
  }

  lienServeur(l: DossierLocal): string[] | null {
    if (!l.serverId) return null;
    if (l.type === 'Patiente') return ['/admin/patientes', l.serverId];
    if (l.type === 'Enfant') return ['/admin/enfants', l.serverId];
    if (l.type === 'Accouchement') return ['/admin/accouchements', l.serverNumero ?? l.serverId];
    return null;
  }

  // --- Saisies -----------------------------------------------------------------------------

  ouvrirFormulaire(f: Formulaire): void {
    this.message.set('');
    this.erreur.set('');
    this.photo = null;
    const maintenant = maintenantLocal();
    this.saisie = {
      consultation: { type: 'Suivi prénatal', date: maintenant, motif: '', poidsKg: null, taSystolique: null, taDiastolique: null, temperature: null, hauteurUterineCm: null, bcf: null, conseils: '', finaliser: false },
      rendezVous: { date: '', motif: 'Consultation prénatale' },
      admission: { admiseLe: maintenant, motif: 'Contractions utérines' },
      surveillance: { le: maintenant, dilatationCm: null, bcf: null, contractions10min: null, dureeContractionsSec: null, membranes: '', liquideAmniotique: '', pouls: null, taSystolique: null, taDiastolique: null, temperature: null },
      accouchement: { heure: maintenant, mode: 'Normal', nombreEnfants: 1, pertesSangMl: null, delivranceMode: 'Spontanée', placentaComplet: true, indicationCesarienne: '' },
      nouveauNe: { prenom: '', sexe: 'Féminin', etatNaissance: 'Vivant', poidsG: null, tailleCm: null, perimetreCranienCm: null, miseAuSeinMoins1h: true, vitamineK1: true },
      vaccination: { date: jourKinshasa(), lot: '', site: '', lieu: '', codes: {} as Record<string, boolean> },
    }[f!] ?? {};
    this.formulaire.set(f);
  }

  /** Toute saisie passe par l'API : l'intercepteur la garde dans la file (dossier local, pas de réseau). */
  private async envoyer(methode: 'POST' | 'PUT', chemin: string, corps: unknown, succes: string): Promise<void> {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      await firstValueFrom(this.http.request(methode, `${API_URL}/${chemin}`, { body: corps }));
      this.message.set(`${succes} Envoyée au serveur.`);
    } catch (err) {
      if (estMiseEnFile(err)) this.message.set(`${succes} Gardée sur cet appareil : elle partira au retour du réseau, une fois le dossier créé sur le serveur.`);
      else {
        this.erreur.set(messageErreur(err));
        return;
      }
    } finally {
      this.envoi.set(false);
    }
    this.formulaire.set(null);
  }

  private iso(local: string): string {
    return new Date(local).toISOString();
  }

  /** Nombre saisi (champ vide → absent). */
  private n(v: unknown): number | undefined {
    return v === null || v === '' || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v);
  }

  enregistrerConsultation(l: DossierLocal): void {
    const s = this.saisie;
    const g = this.grossesseDe(l);
    const id = g?.serverId ?? g?.localId;
    if (!id) return;
    this.envoyer('POST', `grossesses/${id}/consultations`, {
      type: s['type'], date: this.iso(s['date']), motif: s['motif'], conseils: s['conseils'],
      constantes: { poidsKg: this.n(s['poidsKg']), taSystolique: this.n(s['taSystolique']), taDiastolique: this.n(s['taDiastolique']), temperature: this.n(s['temperature']), hauteurUterineCm: this.n(s['hauteurUterineCm']), bcf: this.n(s['bcf']) },
      finaliser: !!s['finaliser'],
    }, 'Consultation enregistrée.');
  }

  enregistrerRendezVous(l: DossierLocal): void {
    if (!this.saisie['date']) {
      this.erreur.set('Indiquez la date du rendez-vous.');
      return;
    }
    this.envoyer('POST', `patientes/${l.serverId ?? l.localId}/rendez-vous`, { date: this.iso(this.saisie['date']), motif: this.saisie['motif'] }, 'Rendez-vous enregistré.');
  }

  admettre(l: DossierLocal): void {
    this.envoyer('POST', 'accouchements', { patienteId: l.serverId ?? l.localId, admission: { admiseLe: this.iso(this.saisie['admiseLe']), motif: this.saisie['motif'] } }, 'Admission en salle de travail enregistrée.');
  }

  surveiller(l: DossierLocal): void {
    const s = this.saisie;
    if (this.n(s['dilatationCm']) == null && this.n(s['bcf']) == null && this.n(s['contractions10min']) == null) {
      this.erreur.set('Saisissez au moins la dilatation, le BCF ou les contractions.');
      return;
    }
    this.envoyer('POST', `accouchements/${l.serverId ?? l.localId}/surveillances`, {
      le: this.iso(s['le']), dilatationCm: this.n(s['dilatationCm']), bcf: this.n(s['bcf']), contractions10min: this.n(s['contractions10min']),
      dureeContractionsSec: this.n(s['dureeContractionsSec']), membranes: s['membranes'] || undefined, liquideAmniotique: s['liquideAmniotique'] || undefined,
      pouls: this.n(s['pouls']), taSystolique: this.n(s['taSystolique']), taDiastolique: this.n(s['taDiastolique']), temperature: this.n(s['temperature']),
    }, 'Surveillance enregistrée.');
  }

  accoucher(l: DossierLocal): void {
    const s = this.saisie;
    if (s['mode'] === 'Césarienne' && !s['indicationCesarienne']) {
      this.erreur.set('Indiquez l’indication de la césarienne.');
      return;
    }
    this.envoyer('PUT', `accouchements/${l.serverId ?? l.localId}/accouchement`, {
      mode: s['mode'], heure: this.iso(s['heure']), nombreEnfants: this.n(s['nombreEnfants']) ?? 1, multiple: (this.n(s['nombreEnfants']) ?? 1) > 1,
      indicationCesarienne: s['indicationCesarienne'] || undefined,
      delivrance: { mode: s['delivranceMode'], placenta: { complet: !!s['placentaComplet'] }, pertesSangMl: this.n(s['pertesSangMl']) },
    }, 'Accouchement enregistré.');
  }

  async ajouterNouveauNe(l: DossierLocal): Promise<void> {
    const s = this.saisie;
    if (s['etatNaissance'] === 'Vivant' && !this.photo) {
      this.erreur.set('La photo du bébé né vivant est obligatoire (évite les confusions entre bébés).');
      return;
    }
    const f = new FormData();
    f.append('donnees', JSON.stringify({
      prenom: s['prenom'], sexe: s['sexe'], etatNaissance: s['etatNaissance'],
      naissance: { poidsG: this.n(s['poidsG']), tailleCm: this.n(s['tailleCm']), perimetreCranienCm: this.n(s['perimetreCranienCm']), miseAuSeinMoins1h: !!s['miseAuSeinMoins1h'], traitement: { vitamineK1: !!s['vitamineK1'] } },
    }));
    if (this.photo) f.append('photo', this.photo);
    await this.envoyer('POST', `accouchements/${l.serverId ?? l.localId}/nouveau-nes`, f, 'Nouveau-né enregistré (lié à sa mère).');
  }

  vacciner(l: DossierLocal): void {
    const s = this.saisie;
    const codes = Object.keys(s['codes']).filter(c => s['codes'][c]);
    if (!codes.length) {
      this.erreur.set('Cochez au moins une dose.');
      return;
    }
    this.envoyer('POST', `enfants/${l.serverId ?? l.localId}/vaccinations`, {
      doses: codes.map(code => ({ code, date: s['date'], lot: s['lot'], site: s['site'], lieu: s['lieu'] })),
    }, `${codes.length} dose(s) enregistrée(s).`);
  }

  enregistrerEnfant(l: DossierLocal): void {
    this.router.navigate(['/admin/enfants/nouveau'], { queryParams: { mere: l.localId } });
  }

  readonly phaseActiveCm = PHASE_ACTIVE_CM;
}

function donnees(corps: unknown, formulaire: { nom: string; valeur: string | Blob }[] | null): Record<string, any> | null {
  const brut = formulaire?.find(c => c.nom === 'donnees')?.valeur;
  if (typeof brut === 'string') {
    try {
      return JSON.parse(brut);
    } catch {
      return null;
    }
  }
  return corps && typeof corps === 'object' ? corps as Record<string, any> : null;
}
