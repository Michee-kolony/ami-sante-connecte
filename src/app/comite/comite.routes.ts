import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { API_COMITE, ComiteSessionService } from './comite-session.service';
import { ComiteConnexionComponent } from './pages/connexion.component';
import { ComiteShellComponent } from './pages/shell.component';
import { ComiteTableauDeBordComponent } from './pages/tableau-de-bord.component';
import { ComiteCompteComponent } from './pages/compte.component';
import { ComitePersonnelComponent } from './pages/personnel.component';
import { ComiteMembresComponent } from './pages/membres.component';
import { ComiteRecosComponent } from './pages/recos.component';
import { ComiteFlotteComponent } from './pages/flotte.component';
import { ComiteMessagesComponent } from './pages/messages.component';
import { ComitePatientesComponent } from './pages/patientes.component';
import { EtablissementsComponent } from '../admin/pages/etablissements/etablissements.component';
import { BASE_ETABLISSEMENTS, BASE_STATISTIQUES, ESPACE_COMITE } from '../admin/data/espace';
import { StatistiquesService, SyntheseEtatService } from '../admin/data/statistiques.service';
import { EtablissementsService } from '../admin/data/etablissements.service';

const connecteGuard = () => inject(ComiteSessionService).connecte() || inject(Router).parseUrl('/comite/connexion');

/** Mot de passe remis par l'administrateur : il est changé avant toute autre page. */
const motDePassePersonnelGuard = () => !inject(ComiteSessionService).membre()?.doitChangerMotDePasse || inject(Router).parseUrl('/comite/compte');

/**
 * Espace du comité de pilotage — monté sous /comite. Les pages et services partagés avec
 * l'administration (établissements, synthèse) reçoivent ici des instances propres, branchées sur
 * /api/comite : gestion complète des établissements et indicateurs de tous les établissements.
 */
export const COMITE_ROUTES: Routes = [
  { path: 'connexion', component: ComiteConnexionComponent, title: 'Comité de pilotage · AMI Santé Connect' },
  {
    path: '',
    component: ComiteShellComponent,
    canActivate: [connecteGuard],
    providers: [
      { provide: ESPACE_COMITE, useValue: true },
      { provide: BASE_STATISTIQUES, useValue: `${API_COMITE}/statistiques` },
      { provide: BASE_ETABLISSEMENTS, useValue: `${API_COMITE}/etablissements` },
      StatistiquesService,
      SyntheseEtatService,
      EtablissementsService,
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      { path: 'tableau-de-bord', component: ComiteTableauDeBordComponent, canActivate: [motDePassePersonnelGuard], title: 'Tableau de bord global · Comité de pilotage' },
      { path: 'etablissements', component: EtablissementsComponent, canActivate: [motDePassePersonnelGuard], title: 'Établissements sanitaires · Comité de pilotage' },
      // Tout le personnel soignant de la plateforme (?etablissement=<id> pour filtrer).
      { path: 'personnel', component: ComitePersonnelComponent, canActivate: [motDePassePersonnelGuard], title: 'Personnel soignant · Comité de pilotage' },
      // Tous les relais communautaires (RECO) de la plateforme (?etablissement=<id> pour filtrer).
      { path: 'recos', component: ComiteRecosComponent, canActivate: [motDePassePersonnelGuard], title: 'Relais communautaires · Comité de pilotage' },
      // Ambulances et chauffeurs de toute la plateforme (?etablissement=<id> pour filtrer).
      { path: 'flotte', component: ComiteFlotteComponent, canActivate: [motDePassePersonnelGuard], title: 'Ambulances et chauffeurs · Comité de pilotage' },
      // Patientes et enfants : identité seulement (aucune donnée médicale).
      { path: 'patientes', component: ComitePatientesComponent, canActivate: [motDePassePersonnelGuard], title: 'Patientes et enfants · Comité de pilotage' },
      // Messages privés avec les médecins chefs et groupe de pilotage.
      { path: 'messages', component: ComiteMessagesComponent, canActivate: [motDePassePersonnelGuard], title: 'Messages · Comité de pilotage' },
      { path: 'membres', component: ComiteMembresComponent, canActivate: [motDePassePersonnelGuard], title: 'Membres du comité · Comité de pilotage' },
      { path: 'compte', component: ComiteCompteComponent, title: 'Mon compte · Comité de pilotage' },
    ],
  },
];
