import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout.component';
import { HomeComponent } from './pages/home/home.component';

/** Site web ouvert au public — monté à la racine. */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: HomeComponent, title: 'AMI Santé Connect · Des données fiables pour une meilleure santé' },
      {
        path: 'guide-application-patiente',
        loadComponent: () => import('./pages/guide-patiente/guide-patiente.component').then(m => m.GuidePatienteComponent),
        title: 'Comment utiliser l’application mobile AMI Santé Connect · Espace patiente',
      },
      {
        path: 'guide-espace-medecin',
        loadComponent: () => import('./pages/guide-medecin/guide-medecin.component').then(m => m.GuideMedecinComponent),
        title: 'Guide de l’espace médecin · AMI Santé Connect',
      },
    ],
  },
];
