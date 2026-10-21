import { Routes } from '@angular/router';
import { ConnexionChauffeurComponent } from './pages/connexion/connexion.component';
import { MissionComponent } from './pages/mission/mission.component';
import { chauffeurConnecte } from './session.service';

/** Application des chauffeurs d'ambulance — montée sous /ambulance. */
export const AMBULANCE_ROUTES: Routes = [
  { path: 'connexion', component: ConnexionChauffeurComponent, title: 'Connexion chauffeur · AMI Santé Connect' },
  { path: '', component: MissionComponent, canActivate: [chauffeurConnecte], title: 'Ma mission · AMI Santé Connect' },
];
