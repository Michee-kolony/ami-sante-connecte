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
    ],
  },
];
