import { Component, WritableSignal, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { formatDate } from '../../data/mock-data';
import { TEINTE } from '../../data/carte';
import { AlerteUrgence, EtatAlerte, Gravite, TypeEvenement, jour } from '../../data/urgences';
import { UrgencesService } from '../../data/urgences.service';

type Periode = '7' | '30' | 'tout';

const ICONE_EVENEMENT: Record<TypeEvenement, string> = {
  'Alerte reçue': 'fa-bell text-rose-500',
  'Prise en charge': 'fa-hand-holding-medical text-brand-600 dark:text-brand-400',
  'Ambulance envoyée': 'fa-truck-medical text-sky-600 dark:text-sky-400',
  'En route': 'fa-route text-sky-600 dark:text-sky-400',
  'Arrivée sur place': 'fa-location-dot text-orange-500',
  'Patiente à bord': 'fa-user-injured text-violet-500',
  'Arrivée à l’hôpital': 'fa-hospital text-accent-600 dark:text-accent-400',
  'Clôturée': 'fa-circle-check text-accent-600 dark:text-accent-400',
  'Annulée': 'fa-ban text-slate-400',
};

/** Historique complet des urgences : filtres, indicateurs, chronologie de chaque intervention. */
@Component({
  selector: 'app-historique-urgences',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  template: `
<div class="space-y-6">
  <!-- Indicateurs sur la sélection -->
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <div class="card flex items-center gap-4 p-4">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><i class="fa-solid fa-clock-rotate-left"></i></div>
      <div><p class="text-2xl font-bold text-slate-900 dark:text-white">{{ stats().total }}</p><p class="text-xs text-slate-500 dark:text-slate-400">Urgences sur la période</p></div>
    </div>
    <div class="card flex items-center gap-4 p-4">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400"><i class="fa-solid fa-circle-check"></i></div>
      <div><p class="text-2xl font-bold text-slate-900 dark:text-white">{{ stats().resolues }}</p><p class="text-xs text-slate-500 dark:text-slate-400">Résolues</p></div>
    </div>
    <div class="card flex items-center gap-4 p-4">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"><i class="fa-solid fa-stopwatch"></i></div>
      <div><p class="text-2xl font-bold text-slate-900 dark:text-white">{{ stats().delaiMoyen ?? '—' }}<span class="text-sm font-medium"> min</span></p><p class="text-xs text-slate-500 dark:text-slate-400">Délai moyen d’arrivée sur place</p></div>
    </div>
    <div class="card flex items-center gap-4 p-4">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div><p class="text-2xl font-bold text-slate-900 dark:text-white">{{ stats().critiques }}</p><p class="text-xs text-slate-500 dark:text-slate-400">Urgences critiques</p></div>
    </div>
  </div>

  <div class="card overflow-hidden">
    <!-- Filtres -->
    <div class="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
      <div class="relative flex-1">
        <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
        <input type="search" class="input pl-10" placeholder="Rechercher par n° d’urgence, patiente, motif, ambulance ou chauffeur"
               [value]="recherche()" (input)="recherche.set($any($event.target).value)">
      </div>
      <div class="grid grid-cols-3 gap-2 lg:flex">
        @for (s of selects; track s.id) {
          <div class="relative">
            <select class="input appearance-none py-2.5 pr-9 text-sm lg:w-44" [attr.aria-label]="s.label" [value]="s.valeur()" (change)="s.valeur.set($any($event.target).value)">
              @for (o of s.options; track o.v) { <option [value]="o.v">{{ o.l }}</option> }
            </select>
            <i class="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
          </div>
        }
      </div>
      <button type="button" class="btn-secondary whitespace-nowrap" (click)="exporter()" [disabled]="!filtrees().length">
        <i class="fa-solid fa-file-csv"></i> Exporter
      </button>
    </div>

    <!-- Liste -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50/70 dark:bg-slate-800/50">
          <tr>
            <th class="table-th">Date</th>
            <th class="table-th">Patiente</th>
            <th class="table-th">Motif</th>
            <th class="table-th">Ambulance</th>
            <th class="table-th whitespace-nowrap">Arrivée</th>
            <th class="table-th whitespace-nowrap">Durée</th>
            <th class="table-th">État</th>
            <th class="table-th"><span class="sr-only">Détail</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (a of filtrees(); track a.id) {
            @let delai = urgences.delaiArrivee(a);
            @let duree = urgences.dureeTotale(a);
            <tr class="cursor-pointer transition hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                [class]="ouverte() === a.id ? 'bg-slate-50 dark:bg-slate-800/40' : ''" (click)="basculer(a.id)">
              <td class="table-td whitespace-nowrap">
                <p class="font-medium text-slate-900 dark:text-white">{{ libelleJour(a.date) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ a.heure }} · <span class="font-mono">{{ a.id }}</span></p>
              </td>
              <td class="table-td">
                <div class="flex items-center gap-3">
                  <span class="relative shrink-0">
                    <app-avatar [photo]="a.photo" [prenom]="a.patiente.split(' ')[0]" [nomFamille]="a.patiente.split(' ')[1]" class="h-9 w-9 rounded-full text-xs" />
                    <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 {{ teinte(a.gravite) }}"></span>
                  </span>
                  <div>
                    <p class="whitespace-nowrap font-medium text-slate-900 dark:text-white">{{ a.patiente }}</p>
                    <p class="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{{ a.quartier }}, {{ a.commune }}</p>
                  </div>
                </div>
              </td>
              <td class="table-td">
                <p class="min-w-[10rem]">{{ a.motif }}</p>
                <p class="text-xs font-medium" [class]="a.gravite === 'critique' ? 'text-rose-600 dark:text-rose-400' : a.gravite === 'élevée' ? 'text-orange-600 dark:text-orange-400' : 'text-amber-600 dark:text-amber-400'">{{ a.gravite }}</p>
              </td>
              <td class="table-td whitespace-nowrap">
                @if (a.ambulanceId) {
                  <p class="font-medium text-slate-900 dark:text-white">{{ a.ambulanceId }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ a.chauffeur }}</p>
                } @else {
                  <span class="text-slate-400">—</span>
                }
              </td>
              <td class="table-td whitespace-nowrap font-semibold" [class]="delai !== null && delai > 20 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'">
                {{ delai !== null ? delai + ' min' : '—' }}
              </td>
              <td class="table-td whitespace-nowrap">{{ duree !== null ? duree + ' min' : 'En cours' }}</td>
              <td class="table-td"><span class="badge {{ badgeEtat(a.etat) }}">{{ a.etat }}</span></td>
              <td class="table-td text-right">
                <i class="fa-solid fa-chevron-down text-xs text-slate-400 transition" [class.rotate-180]="ouverte() === a.id"></i>
              </td>
            </tr>

            <!-- Chronologie de l'intervention -->
            @if (ouverte() === a.id) {
              <tr class="bg-slate-50/60 dark:bg-slate-800/30">
                <td colspan="8" class="px-5 py-5">
                  <div class="flex flex-col gap-6 md:flex-row">
                    <ol class="relative flex-1 space-y-4 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
                      @for (e of a.evenements; track $index) {
                        <li class="relative">
                          <span class="absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs ring-2 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                            <i class="fa-solid {{ icone(e.type) }}"></i>
                          </span>
                          <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ e.type }} <span class="ml-1 font-mono text-xs font-normal text-slate-500 dark:text-slate-400">{{ e.date.slice(11) }}</span></p>
                          <p class="text-xs text-slate-500 dark:text-slate-400">{{ e.auteur }}@if (e.detail) { · {{ e.detail }} }</p>
                        </li>
                      }
                    </ol>
                    <div class="space-y-2 text-sm md:w-64">
                      <p class="text-slate-600 dark:text-slate-300"><i class="fa-solid fa-phone mr-2 w-4 text-slate-400"></i>{{ a.telephone }}</p>
                      <p class="text-slate-600 dark:text-slate-300"><i class="fa-solid fa-location-dot mr-2 w-4 text-slate-400"></i><span class="font-mono text-xs">{{ a.lat.toFixed(4) }}, {{ a.lng.toFixed(4) }}</span></p>
                      <a [routerLink]="['/admin/patientes', a.patienteId]" (click)="$event.stopPropagation()" class="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Dossier de la patiente <i class="fa-solid fa-arrow-right"></i></a>
                      @if (a.etat === 'nouvelle' || a.etat === 'prise en charge') {
                        <button type="button" class="btn-primary mt-2 w-full py-2 text-xs" (click)="$event.stopPropagation(); suivre.emit(a)"><i class="fa-solid fa-map-location-dot"></i> Suivre sur la carte</button>
                      }
                    </div>
                  </div>
                </td>
              </tr>
            }
          } @empty {
            <tr><td colspan="8" class="table-td py-10 text-center text-slate-500 dark:text-slate-400">Aucune urgence ne correspond aux filtres.</td></tr>
          }
        </tbody>
      </table>
    </div>
  </div>
</div>
  `,
})
export class HistoriqueUrgencesComponent {
  urgences = inject(UrgencesService);
  /** Demande d'affichage d'une urgence en cours sur la carte. */
  suivre = output<AlerteUrgence>();

  recherche = signal('');
  periode = signal<Periode>('30');
  gravite = signal<'toutes' | Gravite>('toutes');
  etat = signal<'tous' | EtatAlerte>('tous');
  ouverte = signal<string | null>(null);

  // Les valeurs des listes déroulantes sont exactement celles des types Periode, Gravite et EtatAlerte.
  selects: { id: string; label: string; valeur: WritableSignal<string>; options: { v: string; l: string }[] }[] = [
    { id: 'periode', label: 'Période', valeur: this.periode as WritableSignal<string>, options: [{ v: '7', l: '7 derniers jours' }, { v: '30', l: '30 derniers jours' }, { v: 'tout', l: 'Tout l’historique' }] },
    { id: 'gravite', label: 'Gravité', valeur: this.gravite as WritableSignal<string>, options: [{ v: 'toutes', l: 'Toutes gravités' }, { v: 'critique', l: 'Critique' }, { v: 'élevée', l: 'Élevée' }, { v: 'modérée', l: 'Modérée' }] },
    { id: 'etat', label: 'État', valeur: this.etat as WritableSignal<string>, options: [{ v: 'tous', l: 'Tous les états' }, { v: 'nouvelle', l: 'Nouvelle' }, { v: 'prise en charge', l: 'Prise en charge' }, { v: 'résolue', l: 'Résolue' }, { v: 'annulée', l: 'Annulée' }] },
  ];

  filtrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const depuis = this.periode() === 'tout' ? '' : jour(-Number(this.periode()) + 1);
    return this.urgences.alertes()
      .filter(a => a.date >= depuis)
      .filter(a => this.gravite() === 'toutes' || a.gravite === this.gravite())
      .filter(a => this.etat() === 'tous' || a.etat === this.etat())
      .filter(a => !q || `${a.id} ${a.patiente} ${a.motif} ${a.ambulanceId ?? ''} ${a.chauffeur ?? ''} ${a.quartier} ${a.commune}`.toLowerCase().includes(q))
      .sort((x, y) => `${y.date} ${y.heure}`.localeCompare(`${x.date} ${x.heure}`));
  });

  stats = computed(() => {
    const liste = this.filtrees();
    const delais = liste.map(a => this.urgences.delaiArrivee(a)).filter((d): d is number => d !== null);
    return {
      total: liste.length,
      resolues: liste.filter(a => a.etat === 'résolue').length,
      critiques: liste.filter(a => a.gravite === 'critique').length,
      delaiMoyen: delais.length ? Math.round(delais.reduce((s, d) => s + d, 0) / delais.length) : null,
    };
  });

  basculer(id: string): void {
    this.ouverte.set(this.ouverte() === id ? null : id);
  }

  libelleJour(date: string): string {
    if (date === jour(0)) return 'Aujourd’hui';
    if (date === jour(-1)) return 'Hier';
    return formatDate(date);
  }

  teinte(g: Gravite): string {
    return TEINTE[g];
  }

  icone(t: TypeEvenement): string {
    return ICONE_EVENEMENT[t];
  }

  badgeEtat(e: EtatAlerte): string {
    switch (e) {
      case 'nouvelle': return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
      case 'prise en charge': return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
      case 'annulée': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
      default: return 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300';
    }
  }

  /** Export CSV (séparateur « ; » pour Excel en français) des urgences filtrées. */
  exporter(): void {
    const champ = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lignes = [
      ['N°', 'Date', 'Heure', 'Patiente', 'Identifiant', 'Motif', 'Gravité', 'État', 'Ambulance', 'Chauffeur', 'Arrivée (min)', 'Durée (min)', 'Chronologie'],
      ...this.filtrees().map(a => [
        a.id, formatDate(a.date), a.heure, a.patiente, a.patienteId, a.motif, a.gravite, a.etat, a.ambulanceId, a.chauffeur,
        this.urgences.delaiArrivee(a), this.urgences.dureeTotale(a),
        a.evenements.map(e => `${e.date.slice(11)} ${e.type} (${e.auteur})`).join(' | '),
      ]),
    ];
    const csv = '﻿' + lignes.map(l => l.map(champ).join(';')).join('\r\n');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = `historique-urgences-${jour(0)}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }
}
