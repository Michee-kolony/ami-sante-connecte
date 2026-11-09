import { Component, computed, inject } from '@angular/core';
import { GroupePilotageService } from '../../data/groupe-pilotage.service';
import { SessionService } from '../../data/session.service';
import { GroupePilotageVueComponent } from '../../components/groupe-pilotage-vue.component';

/** Groupe de pilotage dans l'espace professionnel : médecin chef seulement. */
@Component({
  selector: 'app-groupe-pilotage',
  standalone: true,
  imports: [GroupePilotageVueComponent],
  template: `
    <div class="mx-auto flex h-[calc(100dvh-9rem)] max-w-7xl flex-col gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Groupe de pilotage</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Conversation commune à tous les médecins chefs et aux membres du comité de pilotage. Messages chiffrés, visibles par les membres du groupe seulement.</p>
      </div>
      <app-groupe-pilotage-vue class="min-h-0 flex-1" [groupe]="service.groupe" [moi]="moi()" />
    </div>
  `,
})
export class GroupePilotageComponent {
  service = inject(GroupePilotageService);
  private session = inject(SessionService);
  moi = computed(() => this.session.soignant()?.id ?? '');
}
