import { Routes } from '@angular/router';
import { ConnexionMamanComponent } from './pages/connexion.component';
import { EspaceMamanComponent } from './pages/espace.component';
import { mamanConnectee } from './espace-maman.service';

/** Espace des mamans (patientes) — monté sous /maman. */
export const MAMAN_ROUTES: Routes = [
  { path: 'connexion', component: ConnexionMamanComponent, title: 'Espace maman · AMI Santé Connect' },
  { path: '', component: EspaceMamanComponent, canActivate: [mamanConnectee], title: 'Mon espace · AMI Santé Connect' },
];
