import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, mergeMap, of, tap, throwError } from 'rxjs';
import { API_URL } from '../../../shared/api';
import { HorsLigneService, REJEU, depuisFormData, estPanneReseau } from './hors-ligne.service';
import { ecrire, lire } from './stockage';

/**
 * Modules utilisables sans connexion : patientes et CPN (grossesses, consultations, rendez-vous),
 * salle de travail (accouchements) et nouveau-nés (enfants, vaccination). Les référentiels,
 * établissements et statistiques sont lus depuis l'appareil pour que les pages s'affichent.
 */
const LECTURES_HORS_LIGNE = /^(patientes|grossesses|consultations|rendez-vous|journal|accouchements|enfants|referentiels|etablissements|statistiques|soignants)(\/|$|\?)/;
const ECRITURES_HORS_LIGNE = /^(patientes|grossesses|consultations|rendez-vous|accouchements|enfants)(\/|$|\?)/;
/** Mesures horodatées : sans heure saisie, l'heure de la saisie (et non celle de l'envoi) est gardée. */
const MESURES = /^accouchements\/[^/]+\/(post-partum\/)?surveillances$/;

export const MESSAGE_HORS_LIGNE = 'Hors connexion : saisie enregistrée sur cet appareil. Elle sera envoyée automatiquement au serveur au retour du réseau (page Synchronisation).';

const chemin = (url: string) => url.slice(API_URL.length + 1);

/**
 * Lectures : la réponse du serveur est gardée sur l'appareil ; sans réseau, la dernière réponse
 * gardée est rendue (dossier consulté auparavant). Écritures : chaque saisie porte un identifiant
 * (X-Operation-Id) ; sans réseau, elle est mise en file d'attente puis envoyée à la synchronisation.
 */
export const horsLigneInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${API_URL}/`) || req.context.get(REJEU)) return next(req);
  const c = chemin(req.url);
  const horsLigne = inject(HorsLigneService);

  if (req.method === 'GET') {
    if (!LECTURES_HORS_LIGNE.test(c)) return next(req);
    const cle = req.urlWithParams;
    return next(req).pipe(
      tap((e: HttpEvent<unknown>) => {
        if (e instanceof HttpResponse && e.status === 200 && e.body != null && typeof e.body === 'object') {
          horsLigne.signalerReseau(true);
          ecrire('lectures', { corps: e.body, le: new Date().toISOString() }, cle).catch(() => {});
        }
      }),
      catchError((err: HttpErrorResponse) => {
        if (!estPanneReseau(err.status)) return throwError(() => err);
        horsLigne.signalerReseau(false);
        return from(lire<{ corps: unknown; le: string }>('lectures', cle).catch(() => undefined)).pipe(
          mergeMap((garde): Observable<HttpEvent<unknown>> => (garde
            ? of(new HttpResponse({ status: 200, body: garde.corps, url: req.url }))
            : throwError(() => new HttpErrorResponse({
              status: 0, url: req.url,
              error: { message: 'Hors connexion : ces données n’ont pas encore été consultées sur cet appareil.' },
            })))),
        );
      }),
    );
  }

  // Suppressions et autres modules : jamais hors connexion (action à faire en ligne).
  if (req.method === 'DELETE' || !ECRITURES_HORS_LIGNE.test(c)) return next(req);

  let corps = req.body;
  if (MESURES.test(c) && corps && typeof corps === 'object' && !(corps instanceof FormData) && !(corps as { le?: string }).le) {
    corps = { ...(corps as object), le: new Date().toISOString() };
  }
  const operationId = `op-${crypto.randomUUID()}`;
  const requete = req.clone({ body: corps, setHeaders: { 'X-Operation-Id': operationId } });

  const mettreEnFile = () => from(horsLigne.mettreEnFile({
    operationId,
    methode: req.method,
    url: req.urlWithParams,
    corps: corps instanceof FormData ? null : corps,
    formulaire: corps instanceof FormData ? depuisFormData(corps) : null,
  })).pipe(mergeMap(op => throwError(() => new HttpErrorResponse({
    status: 0, url: req.url, error: { message: MESSAGE_HORS_LIGNE, horsLigne: true, operationId: op.operationId },
  }))));

  if (!navigator.onLine) {
    horsLigne.signalerReseau(false);
    return mettreEnFile();
  }
  return next(requete).pipe(
    tap(() => horsLigne.signalerReseau(true)),
    catchError((err: HttpErrorResponse) => {
      if (!estPanneReseau(err.status)) return throwError(() => err);
      // Réseau coupé pendant l'envoi : la saisie (peut-être déjà reçue) est gardée avec le même
      // identifiant ; le serveur ne l'exécutera pas deux fois.
      horsLigne.signalerReseau(false);
      return mettreEnFile();
    }),
  );
};
