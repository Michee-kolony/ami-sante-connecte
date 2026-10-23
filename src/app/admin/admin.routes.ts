import { Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { UTILISATEUR } from './data/mock-data';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AccesRapideComponent } from './pages/acces-rapide/acces-rapide.component';
import { PatientsComponent } from './pages/patients/patients.component';
import { PatientNewComponent } from './pages/patient-new/patient-new.component';
import { PatientDetailComponent } from './pages/patient-detail/patient-detail.component';
import { AppointmentsComponent } from './pages/appointments/appointments.component';
import { DuplicatesComponent } from './pages/duplicates/duplicates.component';
import { SyncComponent } from './pages/sync/sync.component';
import { AuditComponent } from './pages/audit/audit.component';
import { AgentsComponent } from './pages/agents/agents.component';
import { EnfantsComponent } from './pages/enfants/enfants.component';
import { MessagesComponent } from './pages/messages/messages.component';
import { AmbulancesComponent } from './pages/ambulances/ambulances.component';
import { ChauffeursComponent } from './pages/chauffeurs/chauffeurs.component';
import { EtablissementsComponent } from './pages/etablissements/etablissements.component';
import { SoignantsComponent } from './pages/soignants/soignants.component';
import { SessionService } from './data/session.service';
import { ProfilComponent } from './pages/profil/profil.component';
import { SoignantDetailComponent } from './pages/soignant-detail/soignant-detail.component';
import { ConsultationComponent } from './pages/consultation/consultation.component';
import { DiscussionsComponent } from './pages/discussions/discussions.component';
import { ArticlesComponent } from './pages/articles/articles.component';
import { SalleTravailComponent } from './pages/salle-travail/salle-travail.component';
import { AccouchementComponent } from './pages/accouchement/accouchement.component';
import { EnfantDetailComponent } from './pages/enfant-detail/enfant-detail.component';

/** Pages réservées au superadmin. ⚠️ Côté client seulement : le serveur doit refuser aussi. */
const superAdminGuard = () => UTILISATEUR.superAdmin || inject(Router).parseUrl('/admin/tableau-de-bord');

/** Pages branchées sur le serveur : une session est nécessaire. */
const connecteGuard = () => inject(SessionService).connecte() || inject(Router).parseUrl('/admin/connexion');

/** Dossier médical (enregistrement, consultations) : médecins seulement. ⚠️ Le serveur refuse aussi. */
const medecinGuard = () => inject(SessionService).estMedecin() || inject(Router).parseUrl('/admin/patientes');

/** Salle de travail et dossier d'accouchement : médecins et sages-femmes. ⚠️ Le serveur refuse aussi. */
const materniteGuard = () => inject(SessionService).estMaternite() || inject(Router).parseUrl('/admin/patientes');

/** Espace réservé au personnel et aux administrateurs — monté sous /admin. */
export const ADMIN_ROUTES: Routes = [
  { path: 'connexion', component: LoginComponent, title: 'Connexion · AMI Santé Connect' },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'acces-rapide' },
      { path: 'acces-rapide', component: AccesRapideComponent, title: 'Accès rapide · AMI Santé Connect' },
      { path: 'tableau-de-bord', component: DashboardComponent, title: 'Tableau de bord · AMI Santé Connect' },
      // Suivi prénatal (serveur) : dossier complet pour les médecins, vue de suivi en lecture seule pour les infirmier·ères.
      { path: 'patientes', component: PatientsComponent, canActivate: [connecteGuard], title: 'Patientes · AMI Santé Connect' },
      { path: 'patientes/nouvelle', component: PatientNewComponent, canActivate: [connecteGuard, medecinGuard], title: 'Enregistrement CPN · AMI Santé Connect' },
      { path: 'patientes/:id', component: PatientDetailComponent, canActivate: [connecteGuard], title: 'Dossier patiente · AMI Santé Connect' },
      { path: 'patientes/:id/consultation', component: ConsultationComponent, canActivate: [connecteGuard, medecinGuard], title: 'Nouvelle consultation · AMI Santé Connect' },
      { path: 'consultations/:cid', component: ConsultationComponent, canActivate: [connecteGuard, medecinGuard], title: 'Consultation · AMI Santé Connect' },
      { path: 'rendez-vous', component: AppointmentsComponent, canActivate: [connecteGuard], title: 'Rendez-vous · AMI Santé Connect' },
      // Chargée à la demande : Leaflet n'alourdit pas les autres pages (préchargée par ShellComponent).
      { path: 'urgences', loadComponent: () => import('./pages/urgences/urgences.component').then(m => m.UrgencesComponent), title: 'Urgences · AMI Santé Connect' },
      { path: 'ambulances', component: AmbulancesComponent, title: 'Ambulances · AMI Santé Connect' },
      { path: 'chauffeurs', component: ChauffeursComponent, title: 'Chauffeurs · AMI Santé Connect' },
      { path: 'discussions', component: DiscussionsComponent, canActivate: [connecteGuard], title: 'Discussions · AMI Santé Connect' },
      // Articles de conseils : médecins seulement (le serveur refuse aussi les infirmier·ères).
      { path: 'conseils', component: ArticlesComponent, canActivate: [connecteGuard, medecinGuard], title: 'Conseils aux mamans · AMI Santé Connect' },
      { path: 'messages', component: MessagesComponent, canActivate: [connecteGuard], title: 'Messages · AMI Santé Connect' },
      // Accouchement (modules I à VI) et suivi de l'enfant (carnet PEV) : serveur.
      { path: 'accouchements', component: SalleTravailComponent, canActivate: [connecteGuard, materniteGuard], title: 'Salle de travail · AMI Santé Connect' },
      { path: 'accouchements/:id', component: AccouchementComponent, canActivate: [connecteGuard, materniteGuard], title: 'Dossier d’accouchement · AMI Santé Connect' },
      { path: 'enfants', component: EnfantsComponent, canActivate: [connecteGuard], title: 'Enfants et vaccination · AMI Santé Connect' },
      { path: 'enfants/:id', component: EnfantDetailComponent, canActivate: [connecteGuard], title: 'Carnet de l’enfant · AMI Santé Connect' },
      { path: 'agents', component: AgentsComponent, title: 'Agents de vaccination · AMI Santé Connect' },
      { path: 'doublons', component: DuplicatesComponent, title: 'Doublons · AMI Santé Connect' },
      { path: 'synchronisation', component: SyncComponent, title: 'Synchronisation · AMI Santé Connect' },
      { path: 'etablissements', component: EtablissementsComponent, canActivate: [superAdminGuard], title: 'Établissements sanitaires · AMI Santé Connect' },
      { path: 'soignants', component: SoignantsComponent, canActivate: [superAdminGuard, connecteGuard], title: 'Médecins et infirmiers · AMI Santé Connect' },
      { path: 'soignants/:id', component: SoignantDetailComponent, canActivate: [superAdminGuard, connecteGuard], title: 'Profil du soignant · AMI Santé Connect' },
      { path: 'profil', component: ProfilComponent, canActivate: [connecteGuard], title: 'Mon profil · AMI Santé Connect' },
      { path: 'audit', component: AuditComponent, canActivate: [connecteGuard], title: 'Journal d’audit · AMI Santé Connect' },
    ],
  },
];
