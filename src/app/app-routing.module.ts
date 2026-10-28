import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Espaces chargés à la demande : les visiteurs du site public ne téléchargent
// jamais le code de l'administration (l'application des chauffeurs est le projet ami-connecte-chauffeur).
const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: 'maman', loadChildren: () => import('./maman/maman.routes').then(m => m.MAMAN_ROUTES) },
  // Application des relais communautaires (RECO) : relance, utilisable hors connexion.
  { path: 'reco', loadChildren: () => import('./reco/reco.routes').then(m => m.RECO_ROUTES) },
  { path: '', loadChildren: () => import('./public/public.routes').then(m => m.PUBLIC_ROUTES) },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    bindToComponentInputs: true,
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled',
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
