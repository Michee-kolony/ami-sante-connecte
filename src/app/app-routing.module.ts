import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Espaces chargés à la demande : les visiteurs du site public ne téléchargent
// jamais le code de l'administration ni celui de l'application ambulance.
const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: 'ambulance', loadChildren: () => import('./ambulance/ambulance.routes').then(m => m.AMBULANCE_ROUTES) },
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
