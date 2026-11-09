import { NgModule, isDevMode } from '@angular/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { authInterceptor } from './admin/data/session.service';
import { horsLigneInterceptor } from './admin/data/hors-ligne/hors-ligne.interceptor';
import { comiteInterceptor } from './comite/comite-session.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    // Application gardée sur l'appareil : l'espace administrateur s'ouvre même sans connexion.
    // Enregistré dès le chargement : une première visite courte suffit à rendre l'appareil prêt hors connexion.
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerImmediately' }),
  ],
  // Hors connexion : lectures depuis l'appareil, saisies en file d'attente (avant le jeton de session).
  // Comité de pilotage : son propre jeton, sur /api/comite seulement.
  providers: [provideHttpClient(withInterceptors([horsLigneInterceptor, authInterceptor, comiteInterceptor]))],
  bootstrap: [AppComponent]
})
export class AppModule { }
