import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { agLisible, dateHeureFr, jourFr } from '../../data/format';
import { PageRecherche, PatientesService, StatutPatiente } from '../../data/patientes.service';
import { ExportCompletDirective } from '../../components/export-complet.directive';
import { Feuille, ImageCellule, miniature, telephoneExcel } from '../../data/excel';
import { ReferentielsService } from '../../data/referentiels.service';
import { SessionService, messageErreur } from '../../data/session.service';

/** Recherche de dossiers (médecins) : résultats paginés et minimisés par le serveur. */
@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, ExportCompletDirective],
  templateUrl: './patients.component.html',
})
export class PatientsComponent {
  private service = inject(PatientesService);
  /** ?supprime=AC-PAT-… après une suppression depuis le dossier. */
  @Input() supprime?: string;
  referentiels = inject(ReferentielsService);
  session = inject(SessionService);
  province = '';
  ag = agLisible;
  jour = jourFr;
  dateHeure = dateHeureFr;

  query = '';
  statut = 'Tous';
  statuts: ('Tous' | StatutPatiente)[] = ['Tous', 'Suivi prénatal', 'Suivi postnatal', 'Grossesse terminée', 'Archivé'];
  readonly lignesSquelette = [1, 2, 3, 4, 5];

  page: PageRecherche | null = null;
  chargement = false;
  erreur = '';
  /** Recherche saisie au moment du dernier envoi (pour le message « aucun dossier »). */
  derniereRecherche = '';

  constructor() {
    this.charger(1);
    this.referentiels.chargerProvinces().catch(() => {});
  }

  get pages(): number {
    return this.page ? Math.max(1, Math.ceil(this.page.total / this.page.parPage)) : 1;
  }

  async charger(numero: number): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      this.page = await this.service.rechercher(this.query, this.statut, numero, 20, this.province);
      this.derniereRecherche = this.query.trim();
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  search(): void {
    this.charger(1);
  }

  /**
   * Export Excel de toute la recherche en cours (mêmes filtres) : photo d'identité dans la
   * première colonne, téléphones complets en texte (+243 …), coordonnées et suivi.
   * Route serveur réservée aux médecins et journalisée.
   */
  exporterTout = async (): Promise<Feuille> => {
    const { lignes, total, tronque } = await this.service.exporter(this.query, this.statut, this.province);

    // Photos : téléchargées 6 par 6 et réduites en vignettes ; une photo illisible laisse la cellule vide.
    const vignettes = new Map<string, Awaited<ReturnType<typeof miniature>>>();
    const avecPhoto = lignes.filter((p) => p.aPhoto);
    for (let i = 0; i < avecPhoto.length; i += 6) {
      await Promise.all(avecPhoto.slice(i, i + 6).map(async (p) => {
        const blob = await this.service.photo(p.numero).catch(() => null);
        vignettes.set(p.numero, blob ? await miniature(blob, 64) : null);
      }));
    }

    const date = (s: string | null | undefined) => (s ? new Date(s) : null);
    const ouiNon = (v: boolean | null | undefined) => (v == null ? null : v ? 'Oui' : 'Non');
    const images: ImageCellule[] = [];
    const feuille: Feuille = {
      nom: tronque ? `Patientes (${lignes.length} sur ${total})` : 'Patientes',
      colonnes: [
        'Photo', 'N° dossier', 'Prénom', 'Nom', 'Postnom', 'Âge (ans)', 'Date de naissance',
        'Téléphone', 'Téléphone partagé', 'Téléphone 2', 'E-mail',
        'Province', 'Commune', 'Quartier', 'Avenue',
        'Contact d’urgence', 'Lien', 'Téléphone d’urgence',
        'Consentement SMS', 'Consentement appel', 'Consentement WhatsApp',
        'Statut', 'Grossesse', 'Âge gestationnel', 'DPA', 'À risque', 'Prochain RDV', 'Motif du RDV', 'Enregistrée le',
      ],
      lignes: lignes.map((p, i) => {
        const v = vignettes.get(p.numero);
        if (v) images.push({ ...v, ligne: i, colonne: 0, description: `Photo de ${p.prenom} ${p.nom}` });
        return [
          v ? null : p.aPhoto ? 'Photo indisponible' : 'Sans photo',
          p.numero, p.prenom, p.nom, p.postnom, p.age, date(p.dateNaissance),
          telephoneExcel(p.telephone), ouiNon(p.telephonePartage), telephoneExcel(p.telephone2), p.email,
          p.province, p.commune, p.quartier, p.avenue,
          p.contactUrgence.nom, p.contactUrgence.lien, telephoneExcel(p.contactUrgence.telephone),
          ouiNon(p.consentements.sms), ouiNon(p.consentements.appel), ouiNon(p.consentements.whatsapp),
          p.statut, p.grossesse?.statut ?? null, p.grossesse?.statut === 'En cours' ? this.ag(p.grossesse.agJours) : null,
          date(p.grossesse?.dpa), p.grossesse ? (p.grossesse.aRisque ? 'Oui' : 'Non') : null,
          date(p.prochainRdv?.date), p.prochainRdv?.motif ?? null, date(p.creeLe),
        ];
      }),
      images,
    };
    return feuille;
  };

  statutClass(s: string): string {
    return {
      'Suivi prénatal': 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300 ring-1 ring-accent-200 dark:ring-accent-500/30',
      'Suivi postnatal': 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30',
      'Grossesse terminée': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700',
      'Archivé': 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700',
    }[s] ?? '';
  }
}
