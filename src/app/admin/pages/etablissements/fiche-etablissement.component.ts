import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FicheEtapesComponent } from '../../components/fiche-etapes.component';
import {
  ETAPES, FicheAmi, FicheComplete, FicheEtablissementService, classeStatut, ficheDepuis, filtrerPourChef, nomPersonne, sectionsAEnvoyer,
  sectionsModifiees,
} from '../../data/fiche-etablissement';
import { ESPACE_COMITE } from '../../data/espace';
import { SessionService, messageErreur } from '../../data/session.service';

type Onglet = 'synthese' | 'saisie' | 'circuit';

/**
 * Fiche AMI d'un établissement. Comité de pilotage (/comite/etablissements/:id/fiche) : calculs,
 * saisie complète et circuit de validation (étape 10). Médecin chef (/admin/mon-etablissement) :
 * calculs et saisie des champs facultatifs de son établissement ; le circuit est en lecture seule.
 */
@Component({
  selector: 'app-fiche-etablissement',
  standalone: true,
  imports: [FormsModule, RouterLink, FicheEtapesComponent],
  providers: [FicheEtablissementService],
  templateUrl: './fiche-etablissement.component.html',
})
export class FicheEtablissementComponent implements OnInit {
  private service = inject(FicheEtablissementService);
  private route = inject(ActivatedRoute);
  private session = inject(SessionService);
  readonly comite = inject(ESPACE_COMITE);
  readonly etapes = ETAPES.filter(e => e.n !== 8 && e.n !== 10);
  readonly classeStatut = classeStatut;
  readonly nomPersonne = nomPersonne;

  id = '';
  donnees: FicheComplete | null = null;
  fiche: FicheAmi | null = null;
  private instantane: ReturnType<typeof sectionsAEnvoyer> | null = null;
  chargement = true;
  erreur = '';
  onglet: Onglet = 'synthese';
  etape = 4;
  enregistrement = false;
  message = '';
  erreurAction = '';
  action: string | null = null;

  verification = { nom: '', fonction: '', date: aujourdhui(), resultat: 'Conforme' as 'Conforme' | 'Non conforme', observations: '', motifs: '' };
  validation = { nom: '', fonction: '', date: aujourdhui(), statutFinal: 'Validée', observations: '' };
  motif = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? this.session.etablissement()?.id ?? '';
    // Médecin chef : il complète d'abord les étapes facultatives (4, 5, 7, 9).
    if (!this.comite) this.onglet = 'saisie';
    this.charger();
  }

  charger(): void {
    if (!this.id) {
      this.chargement = false;
      this.erreur = 'Aucun établissement de connexion.';
      return;
    }
    this.chargement = true;
    this.service.obtenir(this.id)
      .then(r => this.recevoir(r))
      .catch(err => (this.erreur = messageErreur(err)))
      .finally(() => (this.chargement = false));
  }

  private recevoir(r: FicheComplete): void {
    this.donnees = r;
    this.fiche = ficheDepuis(r.fiche);
    this.instantane = sectionsAEnvoyer(this.fiche);
  }

  get statut(): string {
    return this.donnees?.fiche?.circuit?.statut ?? 'Brouillon';
  }

  get circuit() {
    return this.donnees?.fiche?.circuit ?? null;
  }

  get modifie(): boolean {
    return !!this.fiche && !!this.instantane && Object.keys(this.aEnvoyer()).length > 0;
  }

  private aEnvoyer(): Partial<FicheAmi> {
    const changes = sectionsModifiees(this.instantane ?? {}, sectionsAEnvoyer(this.fiche!));
    return this.comite ? changes : filtrerPourChef(changes);
  }

  async enregistrer(f: NgForm): Promise<void> {
    if (!this.fiche || this.enregistrement) return;
    if (f.invalid) {
      this.erreurAction = 'Vérifiez les champs signalés (équipement sans nom, agent sans nom ou profession, année sans population).';
      return;
    }
    const sections = this.aEnvoyer();
    if (!Object.keys(sections).length) {
      this.message = 'Aucune modification à enregistrer.';
      return;
    }
    this.enregistrement = true;
    this.erreurAction = this.message = '';
    try {
      this.recevoir(await this.service.modifier(this.id, sections));
      this.message = 'Fiche enregistrée.';
    } catch (err) {
      this.erreurAction = messageErreur(err);
    } finally {
      this.enregistrement = false;
    }
  }

  /** Étape 10 : action du circuit de validation (comité). */
  async executer(action: string, corps: object = {}): Promise<void> {
    if (this.action) return;
    this.action = action;
    this.erreurAction = this.message = '';
    try {
      this.recevoir(await this.service.circuit(this.id, action, corps));
      this.message = `Fiche « ${this.statut} ».`;
      this.motif = '';
    } catch (err: unknown) {
      const e = err as { error?: { erreurs?: string[] } };
      this.erreurAction = messageErreur(err);
      // Contrôle automatique refusé : la liste des points à corriger est enregistrée dans la fiche.
      if (e.error?.erreurs) this.charger();
    } finally {
      this.action = null;
    }
  }

  verifier(): void {
    const v = this.verification;
    this.executer('verifier', { ...v, motifs: v.motifs.split('\n').map(m => m.trim()).filter(Boolean) });
  }

  async ajouterPiece(type: 'autorisation' | 'verification', event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    if (fichier.size > 10 * 1024 * 1024) {
      this.erreurAction = 'Le fichier dépasse 10 Mo.';
      return;
    }
    this.action = 'piece';
    this.erreurAction = '';
    try {
      this.recevoir(await this.service.ajouterPiece(this.id, type, fichier));
      this.message = 'Pièce jointe ajoutée.';
    } catch (err) {
      this.erreurAction = messageErreur(err);
    } finally {
      this.action = null;
    }
  }

  entrees(o: Record<string, number> | undefined): { cle: string; n: number }[] {
    return Object.entries(o ?? {}).map(([cle, n]) => ({ cle, n })).sort((a, b) => b.n - a.n);
  }

  classeAlerte(niveau: string | undefined): string {
    return niveau === 'rouge' ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
      : niveau === 'orange' ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
        : 'bg-accent-50 text-accent-800 dark:bg-accent-500/10 dark:text-accent-200';
  }
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}
