import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, TimeoutError, catchError, from, mergeMap, of, tap, throwError, timeout } from 'rxjs';
import { API_URL } from '../../../shared/api';
import { DossierLocal, HorsLigneService, REJEU, depuisFormData, estPanneReseau } from './hors-ligne.service';
import { ecrire, lire, toutLire } from './stockage';

/** Liste complète des patientes suivies (copiée par la préparation hors connexion). */
export const CLE_INDEX_PATIENTES = 'index:patientes';

/**
 * Modules utilisables sans connexion : patientes et CPN (grossesses, consultations, rendez-vous),
 * salle de travail (accouchements) et nouveau-nés (enfants, vaccination). Les référentiels,
 * établissements et statistiques sont lus depuis l'appareil pour que les pages s'affichent.
 */
const LECTURES_HORS_LIGNE = /^(patientes|grossesses|consultations|rendez-vous|journal|accouchements|enfants|referentiels|etablissements|statistiques|soignants)(\/|$|\?)/;
const ECRITURES_HORS_LIGNE = /^(patientes|grossesses|consultations|rendez-vous|accouchements|enfants)(\/|$|\?)/;
/** Mesures horodatées : sans heure saisie, l'heure de la saisie (et non celle de l'envoi) est gardée. */
const MESURES = /^accouchements\/[^/]+\/(post-partum\/)?surveillances$/;
/** Dossier créé hors ligne, pas encore connu du serveur : la saisie qui le vise attend sa synchronisation. */
const LOCAL = /local-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
/**
 * Réseau instable (connecté mais sans réponse) : au-delà de ce délai, une lecture est servie depuis
 * l'appareil et une saisie est gardée en file (même identifiant d'opération : jamais en double).
 */
const DELAI_LECTURE_MS = 12_000;
const DELAI_ECRITURE_MS = 20_000;

export const MESSAGE_HORS_LIGNE = 'Hors connexion : saisie enregistrée sur cet appareil. Elle sera envoyée automatiquement au serveur au retour du réseau (page Synchronisation).';

const chemin = (url: string) => url.slice(API_URL.length + 1);
/** Délai dépassé (réseau instable) traité comme une panne réseau. */
const versErreurReseau = (err: unknown, url: string) => (err instanceof TimeoutError ? new HttpErrorResponse({ status: 0, url, error: { message: 'Le serveur ne répond pas.' } }) : err);

/**
 * Lectures : la réponse du serveur est gardée sur l'appareil ; sans réseau (ou serveur muet), la
 * dernière réponse gardée est rendue. Écritures : chaque saisie porte un identifiant (X-Operation-Id) ;
 * sans réseau, elle est mise en file d'attente puis envoyée à la synchronisation.
 */
export const horsLigneInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${API_URL}/`) || req.context.get(REJEU)) return next(req);
  const c = chemin(req.url);
  const horsLigne = inject(HorsLigneService);

  if (req.method === 'GET') {
    if (!LECTURES_HORS_LIGNE.test(c)) return next(req);
    const cle = req.urlWithParams;
    const local = () => from(lire<{ corps: unknown; le: string }>('lectures', cle).catch(() => undefined).then(garde => garde?.corps ?? rechercheLocale(req, c)));
    const reseau = () => next(req).pipe(
      timeout(DELAI_LECTURE_MS),
      tap((e: HttpEvent<unknown>) => {
        if (e instanceof HttpResponse && e.status === 200 && e.body != null && typeof e.body === 'object') {
          horsLigne.signalerReseau(true);
          ecrire('lectures', { corps: e.body, le: new Date().toISOString() }, cle).catch(() => {});
        }
      }),
    );
    const repli = (corps: unknown): Observable<HttpEvent<unknown>> => (corps !== undefined
      ? of(new HttpResponse({ status: 200, body: corps, url: req.url }))
      : throwError(() => new HttpErrorResponse({ status: 0, url: req.url, error: { message: 'Hors connexion : ces données n’ont pas encore été consultées sur cet appareil.' } })));
    // Serveur déjà connu comme injoignable : copie de l'appareil tout de suite (sinon le réseau).
    if (!navigator.onLine || !horsLigne.enLigne()) {
      return local().pipe(mergeMap(corps => (corps !== undefined ? repli(corps) : reseau().pipe(catchError(() => repli(undefined))))));
    }
    return reseau().pipe(
      catchError((brute: unknown) => {
        const err = versErreurReseau(brute, req.url) as HttpErrorResponse;
        if (!estPanneReseau(err.status)) return throwError(() => err);
        horsLigne.signalerReseau(false);
        return local().pipe(mergeMap(repli));
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
  const requete = req.clone({ body: corps, setHeaders: { 'X-Operation-Id': operationId, 'X-Appareil': horsLigne.appareil } });

  const mettreEnFile = () => from((async () => horsLigne.mettreEnFile({
    operationId,
    methode: req.method,
    url: req.urlWithParams,
    corps: corps instanceof FormData ? null : corps,
    formulaire: corps instanceof FormData ? depuisFormData(corps) : null,
    // Modification d'un dossier existant : version vue sur l'appareil (le serveur détecte les conflits).
    versionBase: req.method === 'PATCH' || req.method === 'PUT' ? await versionDe(c) : undefined,
  }))()).pipe(mergeMap(op => throwError(() => new HttpErrorResponse({
    status: 0, url: req.url,
    error: { message: MESSAGE_HORS_LIGNE, horsLigne: true, operationId: op.operationId, localId: op.localIds?.['id'] ?? null },
  }))));

  // Hors ligne, ou dossier créé sur l'appareil pas encore synchronisé : la saisie est gardée.
  const vise = `${req.url} ${corps instanceof FormData ? String(corps.get('donnees') ?? '') : JSON.stringify(corps ?? '')}`;
  if (!navigator.onLine || !horsLigne.enLigne() || LOCAL.test(vise)) {
    if (!navigator.onLine) horsLigne.signalerReseau(false);
    return mettreEnFile();
  }
  return next(requete).pipe(
    timeout(DELAI_ECRITURE_MS),
    tap(() => horsLigne.signalerReseau(true)),
    catchError((brute: unknown) => {
      const err = versErreurReseau(brute, req.url) as HttpErrorResponse;
      if (!estPanneReseau(err.status)) return throwError(() => err);
      // Réseau coupé pendant l'envoi : la saisie (peut-être déjà reçue) est gardée avec le même
      // identifiant ; le serveur ne l'exécutera pas deux fois.
      horsLigne.signalerReseau(false);
      return mettreEnFile();
    }),
  );
};

/**
 * Version (date de dernière modification) du dossier visé, telle que l'appareil l'a reçue : cherchée
 * dans les réponses gardées (dossier patiente, agenda, carnet…). Sans version connue : pas de contrôle.
 */
async function versionDe(c: string): Promise<string | undefined> {
  const id = c.split('/')[1];
  if (!id) return undefined;
  const lectures = await toutLire<{ corps: unknown }>('lectures').catch(() => []);
  let trouvee: string | undefined;
  const parcourir = (v: unknown, profondeur = 0): void => {
    if (trouvee || !v || typeof v !== 'object' || profondeur > 6) return;
    const o = v as Record<string, unknown>;
    if ((o['id'] === id || o['numero'] === id) && typeof o['updatedAt'] === 'string') {
      trouvee = o['updatedAt'];
      return;
    }
    for (const x of Array.isArray(v) ? v : Object.values(o)) parcourir(x, profondeur + 1);
  };
  for (const l of lectures) parcourir(l.corps);
  return trouvee;
}

interface Fiche { numero: string; nom: string; postnom?: string; prenom: string }
type Lu<T> = { corps: T } | undefined;

/** Chaque mot recherché figure dans le numéro, le nom, le postnom ou le prénom (comme le serveur). */
function correspond(f: Fiche, q: string): boolean {
  const texte = [(f as Fiche & { id?: string }).id, f.numero, f.nom, f.postnom, f.prenom].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(m => texte.includes(m));
}

/**
 * Recherche sans réseau, faite sur l'appareil : patientes (liste copiée par la préparation hors
 * connexion) et enfants (dernière liste reçue). undefined si rien n'a été copié.
 */
/** Patiente créée sur l'appareil, présentée dans la recherche (identifiant local, numéro « en attente »). */
function ficheLocale(l: DossierLocal) {
  const r = l.resume as Record<string, any>;
  return {
    id: l.localId, numero: 'En attente de synchronisation', nom: String(r['nom'] ?? '').toUpperCase(), postnom: String(r['postnom'] ?? '').toUpperCase(),
    prenom: r['prenom'] ?? '', age: null, dateNaissance: r['dateNaissance'] ?? null, telephoneMasque: '', province: r['adresse']?.province ?? '',
    commune: r['adresse']?.commune ?? '', quartier: r['adresse']?.quartier ?? '', statut: 'Suivi prénatal', creeLe: l.creeLe, photoUrl: null,
    grossesse: null, prochainRdv: null, locale: true,
  };
}

async function rechercheLocale(req: HttpRequest<unknown>, c: string): Promise<unknown> {
  const p = req.params;
  const q = p.get('q') ?? '';
  // Doublons pendant un enregistrement sans réseau : même nom et même prénom ou même date de
  // naissance, parmi les patientes copiées sur l'appareil (le serveur revérifie à l'envoi).
  if (/^patientes\/doublons(\?|$)/.test(c)) {
    const index = await lire<Lu<(Fiche & { id: string; dateNaissance?: string | null; age?: number | null; telephoneMasque?: string; commune?: string })[]>>('lectures', CLE_INDEX_PATIENTES).catch(() => undefined);
    const norme = (v?: string | null) => (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const nom = norme(p.get('nom'));
    if (!index || !nom) return [];
    return index.corps
      .filter(f => norme(f.nom) === nom && ((!!p.get('prenom') && norme(f.prenom) === norme(p.get('prenom'))) || (!!p.get('dateNaissance') && f.dateNaissance === p.get('dateNaissance'))))
      .slice(0, 5)
      .map(f => ({ id: f.id, numero: f.numero, nom: f.nom, postnom: f.postnom ?? '', prenom: f.prenom, age: f.age ?? null, telephoneMasque: f.telephoneMasque ?? '', commune: f.commune ?? '' }));
  }
  if (/^patientes(\?|$)/.test(c)) {
    let index = await lire<Lu<(Fiche & { statut: string; province: string })[]>>('lectures', CLE_INDEX_PATIENTES).catch(() => undefined);
    // Patientes créées sur l'appareil, pas encore synchronisées : proposées aussi (mère d'un enfant…).
    const locales = (await toutLire<DossierLocal>('locaux').catch(() => [])).filter(l => l.type === 'Patiente' && !l.serverId).map(ficheLocale);
    if (!index && !locales.length) return undefined;
    index = { corps: [...locales, ...(index?.corps ?? [])] };
    const page = Math.max(1, Number(p.get('page')) || 1);
    const parPage = Math.max(1, Number(p.get('parPage')) || 20);
    const trouvees = index.corps.filter(f => correspond(f, q)
      && (!p.get('statut') || f.statut === p.get('statut'))
      && (!p.get('province') || f.province === p.get('province')));
    return { total: trouvees.length, page, parPage, resultats: trouvees.slice((page - 1) * parPage, page * parPage) };
  }
  if (/^enfants(\?|$)/.test(c)) {
    const liste = await lire<Lu<(Fiche & { mereId?: string; vaccination?: { enRetard?: number } })[]>>('lectures', `${API_URL}/enfants`).catch(() => undefined);
    if (!liste) return undefined;
    return liste.corps.filter(e => correspond(e, q)
      && (!p.get('mereId') || e.mereId === p.get('mereId'))
      && (p.get('retard') !== 'true' || (e.vaccination?.enRetard ?? 0) > 0));
  }
  return undefined;
}
