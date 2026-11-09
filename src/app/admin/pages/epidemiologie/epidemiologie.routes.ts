import { Routes } from '@angular/router';
import { EpidemiologieComponent } from './epidemiologie.component';

/**
 * Module ÉPIDÉMIOLOGIE, chargé à la demande sous /admin/epidemiologie : vue générale puis les dix
 * sous-fenêtres (A. démographie et planification, B. analyse, C. pilotage et contrôle).
 */
export const EPIDEMIOLOGIE_ROUTES: Routes = [
  {
    path: '',
    component: EpidemiologieComponent,
    children: [
      { path: '', loadComponent: () => import('./vue-generale.component').then(m => m.VueGeneraleComponent), title: 'Épidémiologie · AMI Santé Connect' },
      { path: 'demographie', loadComponent: () => import('./demographie.component').then(m => m.DemographieComponent), title: 'Référentiel démographique · AMI Santé Connect' },
      { path: 'parametres', loadComponent: () => import('./parametres.component').then(m => m.ParametresComponent), title: 'Paramètres et coefficients · AMI Santé Connect' },
      { path: 'cibles', loadComponent: () => import('./cibles.component').then(m => m.CiblesComponent), title: 'Populations cibles · AMI Santé Connect' },
      { path: 'planification', loadComponent: () => import('./planification.component').then(m => m.PlanificationComponent), title: 'Planification · AMI Santé Connect' },
      { path: 'surveillance', loadComponent: () => import('./surveillance.component').then(m => m.SurveillanceComponent), title: 'Surveillance épidémiologique · AMI Santé Connect' },
      { path: 'morbi-mortalite', loadComponent: () => import('./morbi-mortalite.component').then(m => m.MorbiMortaliteComponent), title: 'Morbidité et mortalité · AMI Santé Connect' },
      { path: 'couvertures', loadComponent: () => import('./couvertures.component').then(m => m.CouverturesComponent), title: 'Couvertures sanitaires · AMI Santé Connect' },
      { path: 'alertes', loadComponent: () => import('./alertes.component').then(m => m.AlertesComponent), title: 'Alertes et insuffisances · AMI Santé Connect' },
      { path: 'rapports', loadComponent: () => import('./rapports.component').then(m => m.RapportsComponent), title: 'Rapports et exportation · AMI Santé Connect' },
      { path: 'tracabilite', loadComponent: () => import('./tracabilite.component').then(m => m.TracabiliteComponent), title: 'Historique, validation et traçabilité · AMI Santé Connect' },
    ],
  },
];
