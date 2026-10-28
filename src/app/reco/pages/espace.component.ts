import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { messageErreur } from '../../admin/data/session.service';
import { RecoService, type TacheReco } from '../reco.service';

type Vue = 'liste' | 'tache' | 'signalement';
type Formulaire = 'tentative' | 'visite_planifiee' | 'visite_realisee' | 'orientation' | 'refus_report' | 'demande_appui' | 'urgence' | null;

/**
 * Espace du RECO : ses tâches de relance (consultables sans réseau), les actions de contact, de
 * visite et d'orientation, les signalements, l'état de la synchronisation et le verrouillage.
 */
@Component({
  selector: 'app-espace-reco',
  standalone: true,
  imports: [DatePipe, FormsModule, ThemeToggleComponent],
  templateUrl: './espace.component.html',
})
export class EspaceRecoComponent implements OnInit {
  readonly service = inject(RecoService);

  vue = signal<Vue>('liste');
  numero = signal<string | null>(null);
  formulaire = signal<Formulaire>(null);
  filtre = signal<'ouvertes' | 'toutes'>('ouvertes');
  erreur = signal('');
  message = signal('');
  envoi = signal(false);

  saisie = { canal: '', resultat: '', date: '', structure: '', priorite: 'Normale', motif: '', commentaire: '' };
  signalement = { nom: '', quartier: '', repere: '', telephone: '', domaine: 'Suivi communautaire', urgence: false, commentaire: '' };
  mdp = { actuel: '', nouveau: '', verrou: '' };

  readonly tache = computed(() => this.service.taches().find(t => t.numero === this.numero()) ?? null);
  readonly liste = computed(() => (this.filtre() === 'ouvertes' ? this.service.ouvertes() : this.service.taches()));
  readonly alertesOuvertes = computed(() => this.service.alertes().filter(a => a.ouverte));

  ngOnInit(): void {
    this.service.demarrer();
    this.service.actualiserProfil();
  }

  ouvrir(t: TacheReco): void {
    this.numero.set(t.numero);
    this.formulaire.set(null);
    this.vue.set('tache');
    window.scrollTo({ top: 0 });
  }

  retour(): void {
    this.vue.set('liste');
    this.formulaire.set(null);
    this.erreur.set('');
  }

  preparer(f: Formulaire): void {
    const t = this.tache();
    this.saisie = { canal: '', resultat: '', date: '', structure: t?.structure?.id ?? '', priorite: 'Normale', motif: '', commentaire: '' };
    this.erreur.set('');
    this.formulaire.set(f);
  }

  /** Canaux téléphoniques consentis (la visite à domicile est une action à part). */
  canauxTelephone(t: TacheReco): string[] {
    return t.canauxAutorises.filter(c => c !== 'Visite à domicile');
  }

  /** Lien d'appel, de SMS ou WhatsApp avec le message neutre (aucune donnée sensible). */
  lien(t: TacheReco, canal: string): string {
    const numero = t.personne.telephone.replace(/[^\d+]/g, '');
    const texte = encodeURIComponent(t.messageNeutre);
    if (canal === 'Appel') return `tel:${numero}`;
    if (canal === 'SMS') return `sms:${numero}?body=${texte}`;
    return `https://wa.me/${numero.replace('+', '')}?text=${texte}`;
  }

  async agir(type: string): Promise<void> {
    const t = this.tache();
    if (!t) return;
    const s = this.saisie;
    if (type === 'urgence' && !confirm('Signaler un danger ou un besoin clinique urgent ? Le superviseur et la structure sont alertés immédiatement. Orientez la personne vers la structure sans attendre.')) return;
    this.envoi.set(true);
    this.erreur.set('');
    try {
      await this.service.agir(t.numero, {
        type,
        canal: s.canal || null,
        resultat: s.resultat || null,
        motif: s.motif || null,
        commentaire: s.commentaire.trim(),
        date: s.date ? new Date(s.date).toISOString() : null,
        structure: type === 'orientation' ? s.structure || null : null,
        priorite: type === 'orientation' ? s.priorite : null,
      });
      this.formulaire.set(null);
      this.message.set(this.service.enLigne() ? 'Action enregistrée.' : 'Action enregistrée sur le téléphone : elle sera envoyée au retour du réseau.');
      setTimeout(() => this.message.set(''), 4000);
    } catch (err) {
      this.erreur.set(messageErreur(err));
    } finally {
      this.envoi.set(false);
    }
  }

  async signaler(): Promise<void> {
    const s = this.signalement;
    if (!s.nom.trim() || !s.quartier.trim()) {
      this.erreur.set('Nom de la personne et quartier requis.');
      return;
    }
    if (s.urgence && !confirm('Signaler une urgence ? Le superviseur est alerté immédiatement. Orientez la personne vers la structure sans attendre.')) return;
    await this.service.signaler({ ...s, commentaire: s.commentaire.trim() });
    this.signalement = { nom: '', quartier: '', repere: '', telephone: '', domaine: 'Suivi communautaire', urgence: false, commentaire: '' };
    this.vue.set('liste');
    this.message.set('Signalement enregistré : votre superviseur va le vérifier.');
    setTimeout(() => this.message.set(''), 4000);
  }

  async changerMotDePasse(): Promise<void> {
    this.envoi.set(true);
    this.erreur.set('');
    try {
      await this.service.changerMotDePasse(this.mdp.actuel, this.mdp.nouveau);
      this.mdp = { actuel: '', nouveau: '', verrou: '' };
    } catch (err) {
      this.erreur.set(messageErreur(err));
    } finally {
      this.envoi.set(false);
    }
  }

  async deverrouiller(): Promise<void> {
    const ok = await this.service.deverrouiller(this.mdp.verrou);
    this.mdp.verrou = '';
    this.erreur.set(ok ? '' : 'Mot de passe incorrect.');
  }

  async deconnecter(): Promise<void> {
    const n = this.service.operations().length;
    if (n && !confirm(`${n} action(s) n’ont pas encore été envoyées. En vous déconnectant, elles seront effacées de ce téléphone. Continuer ?`)) return;
    await this.service.deconnecter();
  }

  libelleAction(type: string): string {
    return ({
      accepter: 'Prise en charge', tentative: 'Tentative', visite_planifiee: 'Visite planifiée', visite_realisee: 'Visite',
      orientation: 'Orientation', refus_report: 'Refus / report', demande_appui: 'Demande d’appui', urgence: 'Urgence', signalement: 'Signalement',
    } as Record<string, string>)[type] ?? type;
  }

  couleur(statut: string): string {
    if (statut === 'Réintégration confirmée') return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
    if (['Non retrouvée', 'Escaladée'].includes(statut)) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    if (statut === 'Attribuée') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    if (['Clôturée sans réintégration', 'Doublon annulé'].includes(statut)) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  }

  /** Le RECO peut encore agir sur la tâche (sinon : en supervision ou clôturée). */
  actionnable(t: TacheReco): boolean {
    return t.attribueeAMoi && ['Attribuée', 'En cours', 'Contact établi', 'Visite planifiée', 'Orientée'].includes(t.statut);
  }
}
