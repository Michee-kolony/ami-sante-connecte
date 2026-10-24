import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UTILISATEUR } from '../../data/mock-data';
import { SessionService } from '../../data/session.service';

interface Raccourci {
  titre: string;
  description: string;
  icone: string;
  lien: string;
  queryParams?: Record<string, string>;
  couleur: string;
}

/**
 * Page d'accueil après la connexion : les actions les plus courantes en un clic. Chaque
 * raccourci n'apparaît qu'aux comptes autorisés (les routes et le serveur refusent aussi).
 */
@Component({
  selector: 'app-acces-rapide',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Accès rapide</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Bonjour {{ nom() }}, que souhaitez-vous faire ?</p>
      </div>

      <!-- Mobile : deux cartes par ligne, icône au-dessus du texte. -->
      <div class="grid grid-cols-2 gap-3 sm:gap-4">
        @for (r of raccourcis(); track r.lien) {
          <a [routerLink]="r.lien" [queryParams]="r.queryParams"
             class="group flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl sm:flex-row sm:items-center sm:gap-5 sm:p-6 {{ r.couleur }}">
            <div class="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/20 text-xl sm:h-16 sm:w-16 sm:rounded-2xl sm:text-2xl">
              <i class="fa-solid {{ r.icone }}"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold leading-snug sm:text-lg">{{ r.titre }}</p>
              <p class="mt-0.5 text-xs text-white/80 sm:text-sm">{{ r.description }}</p>
            </div>
            <i class="fa-solid fa-arrow-right hidden text-white/70 transition group-hover:translate-x-1 group-hover:text-white sm:inline"></i>
          </a>
        }
      </div>

      <a routerLink="/admin/tableau-de-bord" class="btn-secondary"><i class="fa-solid fa-gauge-high"></i> Aller au tableau de bord</a>
    </div>
  `,
})
export class AccesRapideComponent {
  private session = inject(SessionService);

  nom = computed(() => {
    const s = this.session.soignant();
    if (!s) return UTILISATEUR.nom;
    return `${this.session.estMedecin() ? 'Dr ' : ''}${s.prenom} ${s.nom}`;
  });

  raccourcis = computed<Raccourci[]>(() => {
    const medecin = this.session.estMedecin();
    const gestion = UTILISATEUR.superAdmin && this.session.peutGererSoignants();
    return [
      {
        titre: 'Urgences', description: 'Patientes en détresse, localisées par GPS', icone: 'fa-truck-medical',
        lien: '/admin/urgences', couleur: 'from-red-500 to-red-800',
      },
      ...(medecin ? [{
        titre: 'Enregistrement CPN', description: 'Nouvelle patiente, grossesse et datation', icone: 'fa-file-circle-plus',
        lien: '/admin/patientes/nouvelle', couleur: 'from-brand-600 to-brand-800',
      }] : []),
      // Salle de travail : médecins et sages-femmes (le serveur refuse aussi les autres rôles).
      ...(this.session.estMaternite() ? [{
        titre: 'Accouchement', description: 'Admission en salle de travail, partogramme, naissance et sortie', icone: 'fa-bed-pulse',
        lien: '/admin/accouchements', couleur: 'from-pink-500 to-rose-700',
      }] : []),
      {
        titre: 'Enfants vaccinés', description: 'Carnets de vaccination, doses à jour et en retard', icone: 'fa-syringe',
        lien: '/admin/enfants', couleur: 'from-indigo-500 to-blue-700',
      },
      ...(gestion ? [{
        titre: 'Ajout soignant', description: 'Créer le compte d’un médecin, d’un infirmier ou d’une sage-femme', icone: 'fa-user-doctor',
        lien: '/admin/soignants', queryParams: { ajout: '1' }, couleur: 'from-emerald-500 to-teal-700',
      }] : []),
      ...(medecin ? [{
        titre: 'Publier un article conseil', description: 'Conseils pour les mamans', icone: 'fa-newspaper',
        lien: '/admin/conseils', couleur: 'from-violet-500 to-fuchsia-700',
      }] : []),
      {
        titre: 'Envoyer un message', description: 'Écrire à une patiente', icone: 'fa-paper-plane',
        lien: '/admin/messages', couleur: 'from-orange-500 to-rose-600',
      },
      {
        titre: 'Écrire à un collègue', description: 'Discuter avec un médecin, un infirmier ou une sage-femme', icone: 'fa-comment-medical',
        lien: '/admin/discussions', couleur: 'from-sky-500 to-cyan-700',
      },
    ];
  });
}
