import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
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

/** Espace réservé au personnel et aux administrateurs — monté sous /admin. */
export const ADMIN_ROUTES: Routes = [
  { path: 'connexion', component: LoginComponent, title: 'Connexion · AMI Santé Connect' },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      { path: 'tableau-de-bord', component: DashboardComponent, title: 'Tableau de bord · AMI Santé Connect' },
      { path: 'patientes', component: PatientsComponent, title: 'Patientes · AMI Santé Connect' },
      { path: 'patientes/nouvelle', component: PatientNewComponent, title: 'Enregistrement CPN · AMI Santé Connect' },
      { path: 'patientes/:id', component: PatientDetailComponent, title: 'Dossier patiente · AMI Santé Connect' },
      { path: 'rendez-vous', component: AppointmentsComponent, title: 'Rendez-vous · AMI Santé Connect' },
      { path: 'messages', component: MessagesComponent, title: 'Messages · AMI Santé Connect' },
      { path: 'enfants', component: EnfantsComponent, title: 'Enfants vaccinés · AMI Santé Connect' },
      { path: 'agents', component: AgentsComponent, title: 'Agents de vaccination · AMI Santé Connect' },
      { path: 'doublons', component: DuplicatesComponent, title: 'Doublons · AMI Santé Connect' },
      { path: 'synchronisation', component: SyncComponent, title: 'Synchronisation · AMI Santé Connect' },
      { path: 'audit', component: AuditComponent, title: 'Journal d’audit · AMI Santé Connect' },
    ],
  },
];
