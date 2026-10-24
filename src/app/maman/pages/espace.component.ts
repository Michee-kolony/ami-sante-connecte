import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { agLisible, dateHeureFr, jourFr } from '../../admin/data/format';
import { classeStatutDose, iconeStatutDose, parSeance, DoseCarnet } from '../../admin/data/enfants.service';
import { messageErreur } from '../../admin/data/session.service';
import { AccouchementMaman, AccueilMaman, EnfantMaman, EspaceMamanService, RdvMaman } from '../espace-maman.service';

type Onglet = 'accueil' | 'enfants' | 'rendez-vous' | 'accouchements';

/**
 * Espace de la maman (lecture seule) : prochains rendez-vous (les siens et ceux de ses bébés),
 * carnet de vaccination et croissance de chaque enfant, résumé de ses accouchements.
 */
@Component({
  selector: 'app-espace-maman',
  standalone: true,
  imports: [FormsModule, ThemeToggleComponent],
  template: `
<div class="min-h-[100dvh] bg-slate-50 pb-24 dark:bg-slate-950">
  <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
    <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300"><i class="fa-solid fa-person-breastfeeding"></i></span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">Bonjour {{ service.patiente()?.prenom || service.patiente()?.nom }}</p>
        <p class="truncate text-xs text-slate-500">{{ accueil?.patiente?.etablissement?.nom ?? 'Espace maman' }}</p>
      </div>
      <app-theme-toggle />
      <button class="btn-ghost px-2" (click)="service.deconnecter()" aria-label="Se déconnecter"><i class="fa-solid fa-right-from-bracket"></i></button>
    </div>
  </header>

  <main class="mx-auto max-w-3xl space-y-5 px-4 py-5">
    @if (erreur) { <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">{{ erreur }}</p> }
    @if (chargement) {
      <div class="space-y-4" aria-hidden="true"><div class="skeleton h-32 rounded-2xl"></div><div class="skeleton h-48 rounded-2xl"></div></div>
    } @else {
      @switch (onglet) {
        <!-- ============================ ACCUEIL ============================ -->
        @case ('accueil') {
          @if (accueil; as a) {
            @if (a.grossesse) {
              <div class="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lg">
                <p class="text-xs font-semibold uppercase tracking-wider opacity-80">Ma grossesse</p>
                <p class="mt-1 text-2xl font-bold">{{ ag(a.grossesse.agJours) }}</p>
                @if (a.grossesse.dpa) { <p class="text-sm opacity-90">Date prévue d’accouchement : {{ jour(a.grossesse.dpa) }}</p> }
              </div>
            }

            @for (e of a.enfants; track e.id) {
              @if (e.vaccination; as v) {
                <button type="button" class="card w-full p-5 text-left" (click)="ouvrirEnfant(e.id)">
                  <div class="flex items-center gap-3">
                    @if (e.photoUrl) {
                      <img [src]="e.photoUrl" [alt]="'Photo de ' + (e.prenom || 'mon bébé')" class="h-14 w-14 rounded-full object-cover ring-2 ring-pink-200 dark:ring-pink-500/30">
                    } @else {
                      <span class="flex h-12 w-12 items-center justify-center rounded-full text-xl text-white" [class]="e.sexe === 'Féminin' ? 'bg-pink-500' : 'bg-brand-600'"><i class="fa-solid fa-baby"></i></span>
                    }
                    <div class="flex-1">
                      <p class="font-semibold text-slate-900 dark:text-white">{{ e.prenom || 'Mon bébé' }}</p>
                      <p class="text-xs text-slate-500">{{ e.age?.libelle }} · {{ v.vaccinsFaits }}/{{ v.vaccinsTotal }} vaccins reçus</p>
                    </div>
                    <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                  </div>
                  @if (v.prochaineSeance; as s) {
                    <div class="mt-4 rounded-xl p-3" [class]="v.enRetard ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-brand-50 dark:bg-brand-500/10'">
                      <p class="text-sm font-semibold" [class]="v.enRetard ? 'text-rose-700 dark:text-rose-300' : 'text-brand-800 dark:text-brand-200'">
                        <i class="fa-solid fa-syringe mr-1"></i> {{ v.enRetard ? 'Vaccins en retard : venez dès que possible' : 'Prochaine vaccination le ' + jour(s.date) }}
                      </p>
                      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ libelles(s.doses) }}</p>
                    </div>
                  } @else if (v.completementVaccine) {
                    <p class="mt-4 rounded-xl bg-accent-50 p-3 text-sm font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"><i class="fa-solid fa-shield-heart mr-1"></i> Complètement vacciné(e)</p>
                  }
                </button>
              }
            }

            <div class="card">
              <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-calendar-check text-brand-600 dark:text-brand-400"></i> Mes prochains rendez-vous</h2></div>
              <ul class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (r of a.prochainsRendezVous; track r.id) { <li class="px-5 py-3.5">
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ dateHeure(r.date) }}</p>
                  <p class="text-sm text-slate-600 dark:text-slate-300">{{ r.motif }}</p>
                  @if (r.enfant) { <span class="badge mt-1 bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300"><i class="fa-solid fa-baby"></i> {{ r.enfant.prenom || 'Bébé' }}</span> }
                  @if (r.consignes) { <p class="mt-1 text-xs text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>{{ r.consignes }}</p> }
                </li> } @empty { <li class="px-5 py-6 text-center text-sm text-slate-500">Aucun rendez-vous à venir.</li> }
              </ul>
            </div>
          }
        }

        <!-- ============================ ENFANTS ============================ -->
        @case ('enfants') {
          @if (enfants.length > 1) {
            <div class="flex gap-2 overflow-x-auto">
              @for (e of enfants; track e.id) {
                <button type="button" class="flex-none rounded-full px-4 py-2 text-sm font-medium ring-1" (click)="enfantId = e.id"
                        [class]="enfant?.id === e.id ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'">{{ e.prenom || 'Bébé ' + e.rang }}</button>
              }
            </div>
          }
          @if (enfant; as e) {
            <div class="card p-5">
              <h1 class="text-xl font-bold text-slate-900 dark:text-white">{{ e.prenom || 'Mon bébé' }} {{ e.nom }}</h1>
              <p class="text-sm text-slate-500">{{ e.sexe }} · né(e) le {{ dateHeure(e.neLe) }} · {{ e.age?.libelle }}</p>
              <div class="mt-4 grid grid-cols-3 gap-3 text-center">
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-lg font-bold text-slate-900 dark:text-white">{{ e.naissance.poidsG ?? '—' }}<span class="text-xs font-normal"> g</span></p><p class="text-xs text-slate-500">Poids de naissance</p></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-lg font-bold text-slate-900 dark:text-white">{{ e.naissance.tailleCm ?? '—' }}<span class="text-xs font-normal"> cm</span></p><p class="text-xs text-slate-500">Taille</p></div>
                <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p class="text-lg font-bold text-slate-900 dark:text-white">{{ e.naissance.apgar.m5 ?? '—' }}<span class="text-xs font-normal">/10</span></p><p class="text-xs text-slate-500">APGAR 5 min</p></div>
              </div>
            </div>

            @if (e.carnet; as c) {
              <div class="card overflow-hidden">
                <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-syringe text-brand-600 dark:text-brand-400"></i> Carnet de vaccination</h2><span class="text-xs text-slate-500">{{ c.resume.vaccinsFaits }}/{{ c.resume.vaccinsTotal }}</span></div>
                @for (s of seances(c.doses); track s.seance) {
                  <div class="border-b border-slate-100 px-5 py-3 last:border-0 dark:border-slate-800">
                    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ s.seance }}</p>
                    <ul class="space-y-1.5">
                      @for (d of s.doses; track d.code) {
                        <li class="flex items-center gap-3 text-sm">
                          <span class="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] {{ classeDose(d.statut) }}"><i class="fa-solid {{ iconeDose(d.statut) }}"></i></span>
                          <span class="flex-1 text-slate-800 dark:text-slate-200">{{ d.libelle }} <span class="block text-xs text-slate-500">{{ d.maladies }}</span></span>
                          <span class="text-right text-xs" [class]="d.statut === 'En retard' ? 'font-semibold text-rose-600' : 'text-slate-500'">
                            {{ d.administration ? 'Reçu le ' + jour(d.administration.date) : d.statut + ' · ' + jour(d.datePrevue) }}
                          </span>
                        </li>
                      }
                    </ul>
                  </div>
                }
                <!-- Consignes de l'affiche du PEV RDC -->
                <ul class="space-y-1 bg-accent-50 px-5 py-3 text-xs font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                  <li><i class="fa-solid fa-check mr-2"></i>La vaccination est gratuite</li>
                  <li><i class="fa-solid fa-check mr-2"></i>Respectez les dates recommandées</li>
                  <li><i class="fa-solid fa-check mr-2"></i>Gardez le carnet de vaccination de votre enfant</li>
                </ul>
              </div>
            }

            <div class="card overflow-hidden">
              <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-weight-scale text-brand-600 dark:text-brand-400"></i> Croissance</h2></div>
              <ul class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (m of e.croissance; track m.date + $index) {
                  <li class="px-5 py-3 text-sm"><span class="font-medium text-slate-900 dark:text-white">{{ jour(m.date) }}</span> · {{ m.poidsG != null ? m.poidsG + ' g' : '' }} {{ m.tailleCm != null ? '· ' + m.tailleCm + ' cm' : '' }} {{ m.alimentation ? '· ' + m.alimentation : '' }}
                    @if (m.observations) { <p class="text-xs text-slate-500">{{ m.observations }}</p> }</li>
                } @empty { <li class="px-5 py-6 text-center text-sm text-slate-500">Les pesées faites au centre apparaîtront ici.</li> }
              </ul>
            </div>
          } @else {
            <p class="card p-6 text-center text-sm text-slate-500">Aucun enfant enregistré pour l’instant.</p>
          }
        }

        <!-- ============================ RENDEZ-VOUS ============================ -->
        @case ('rendez-vous') {
          <div class="card overflow-hidden">
            <div class="card-header"><h2 class="card-title"><i class="fa-solid fa-calendar-days text-brand-600 dark:text-brand-400"></i> Tous mes rendez-vous</h2></div>
            <ul class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (r of rendezVous; track r.id) {
                <li class="flex items-start gap-3 px-5 py-3.5">
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ dateHeure(r.date) }}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-300">{{ r.motif }}</p>
                    @if (r.enfant) { <span class="badge mt-1 bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300"><i class="fa-solid fa-baby"></i> {{ r.enfant.prenom || 'Bébé' }}</span> }
                    @if (r.lieu) { <p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot mr-1"></i>{{ r.lieu }}</p> }
                  </div>
                  <span class="badge" [class]="r.statut === 'Effectué' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : r.statut === 'Annulé' || r.statut === 'Absent' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'">{{ r.statut }}</span>
                </li>
              } @empty { <li class="px-5 py-6 text-center text-sm text-slate-500">Aucun rendez-vous.</li> }
            </ul>
          </div>
        }

        <!-- ============================ ACCOUCHEMENTS ============================ -->
        @case ('accouchements') {
          @for (a of accouchements; track a.id) {
            <div class="card p-5">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Accouchement</p>
              <p class="mt-1 text-lg font-bold text-slate-900 dark:text-white">{{ dateHeure(a.date) }}</p>
              <p class="text-sm text-slate-600 dark:text-slate-300">{{ a.mode }}{{ a.multiple ? ' · grossesse multiple' : '' }}{{ a.accoucheur ? ' · par ' + a.accoucheur : '' }}</p>
              <p class="mt-2 text-sm">@for (e of a.enfants; track e.id) { <span class="badge mr-1 bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300"><i class="fa-solid fa-baby"></i> {{ e.prenom || 'Bébé' }} · {{ e.sexe }}</span> }</p>
              @if (a.sortie; as s) {
                <p class="mt-3 text-sm text-slate-700 dark:text-slate-300"><i class="fa-solid fa-door-open mr-1"></i>Sortie le {{ jour(s.date) }}{{ s.rdvCpon ? ' · consultation postnatale le ' + dateHeure(s.rdvCpon) : '' }}</p>
              }
              @if (a.conseils) { <p class="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-500/10 dark:text-brand-100"><i class="fa-solid fa-lightbulb mr-1"></i>{{ a.conseils }}</p> }
              @if (a.mesuresPreventives.mere.length || a.mesuresPreventives.nouveauNe.length) {
                <div class="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                  <div><p class="font-semibold text-slate-700 dark:text-slate-300">Reçu par la maman</p><p class="text-slate-500">{{ a.mesuresPreventives.mere.join(', ') || '—' }}</p></div>
                  <div><p class="font-semibold text-slate-700 dark:text-slate-300">Reçu par le bébé</p><p class="text-slate-500">{{ a.mesuresPreventives.nouveauNe.join(', ') || '—' }}</p></div>
                </div>
              }
            </div>
          } @empty { <p class="card p-6 text-center text-sm text-slate-500">Aucun accouchement enregistré.</p> }
        }
      }
    }
  </main>

  <!-- Barre d'onglets -->
  <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
    <div class="mx-auto grid max-w-3xl grid-cols-4">
      @for (t of onglets; track t.k) {
        <button type="button" class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium" (click)="changer(t.k)"
                [class]="onglet === t.k ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'">
          <i class="fa-solid {{ t.i }} text-lg"></i> {{ t.l }}
        </button>
      }
    </div>
  </nav>
</div>
  `,
})
export class EspaceMamanComponent implements OnInit {
  service = inject(EspaceMamanService);
  jour = jourFr;
  dateHeure = dateHeureFr;
  ag = agLisible;
  classeDose = classeStatutDose;
  iconeDose = iconeStatutDose;
  seances = parSeance<DoseCarnet>;

  onglets: { k: Onglet; l: string; i: string }[] = [
    { k: 'accueil', l: 'Accueil', i: 'fa-house' },
    { k: 'enfants', l: 'Mes enfants', i: 'fa-baby' },
    { k: 'rendez-vous', l: 'Rendez-vous', i: 'fa-calendar-check' },
    { k: 'accouchements', l: 'Accouchements', i: 'fa-heart' },
  ];
  onglet: Onglet = 'accueil';
  chargement = true;
  erreur = '';

  accueil: AccueilMaman | null = null;
  enfants: EnfantMaman[] = [];
  enfantId: string | null = null;
  rendezVous: RdvMaman[] = [];
  accouchements: AccouchementMaman[] = [];

  get enfant(): EnfantMaman | null {
    return this.enfants.find(e => e.id === this.enfantId) ?? this.enfants[0] ?? null;
  }

  async ngOnInit(): Promise<void> {
    await this.charger(() => this.service.accueil().then(a => { this.accueil = a; }));
  }

  private async charger(f: () => Promise<void>): Promise<void> {
    this.chargement = true;
    this.erreur = '';
    try {
      await f();
    } catch (err) {
      this.erreur = messageErreur(err);
    } finally {
      this.chargement = false;
    }
  }

  changer(o: Onglet): void {
    this.onglet = o;
    window.scrollTo({ top: 0 });
    if (o === 'accueil') this.charger(() => this.service.accueil().then(a => { this.accueil = a; }));
    if (o === 'enfants') this.charger(() => this.service.enfants().then(l => { this.enfants = l; }));
    if (o === 'rendez-vous') this.charger(() => this.service.rendezVous().then(l => { this.rendezVous = l; }));
    if (o === 'accouchements') this.charger(() => this.service.accouchements().then(l => { this.accouchements = l; }));
  }

  ouvrirEnfant(id: string): void {
    this.enfantId = id;
    this.changer('enfants');
  }

  libelles(doses: { libelle: string }[]): string {
    return doses.map(d => d.libelle).join(', ');
  }
}
