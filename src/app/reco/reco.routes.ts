import { Routes } from '@angular/router';
import { ConnexionRecoComponent } from './pages/connexion.component';
import { EspaceRecoComponent } from './pages/espace.component';
import { recoConnecte } from './reco.service';

/** Application des relais communautaires (RECO) — montée sous /reco. */
export const RECO_ROUTES: Routes = [
  { path: 'connexion', component: ConnexionRecoComponent, title: 'Espace RECO · AMI Santé Connect' },
  { path: '', component: EspaceRecoComponent, canActivate: [recoConnecte], title: 'Mes tâches · AMI Santé Connect' },
];
