import { Injectable, signal } from '@angular/core';

export type FonctionAgent = 'Vaccinateur' | 'Superviseur vaccination' | 'Relais communautaire';
export type StatutAgent = 'Actif' | 'Suspendu';

export interface Agent {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  postnom: string;
  sexe: 'F' | 'M';
  fonction: FonctionAgent;
  telephone: string;
  email: string;
  aire: string;
  statut: StatutAgent;
  /** Photo d'identité (facultative) : sinon les initiales s'affichent. */
  photo?: string;
  vaccinationsMois: number;
  derniereConnexion: string | null;
  /** Le mot de passe temporaire devra être changé à la première connexion. */
  doitChangerMotDePasse: boolean;
}

/** Données fictives — photos générées par IA (personnes inexistantes). */
const AGENTS_INITIAUX: Agent[] = [
  {
    id: 'AG-001', matricule: 'VAC-0142', prenom: 'Patrick', nom: 'LUKUSA', postnom: 'MBUYI', sexe: 'M',
    fonction: 'Vaccinateur', telephone: '+243 81 400 1122', email: 'p.lukusa@amisante.cd', aire: 'AS Camp Tshatshi',
    statut: 'Actif', photo: 'images/agents/agent-1.webp', vaccinationsMois: 214, derniereConnexion: '2026-10-18 08:12', doitChangerMotDePasse: false,
  },
  {
    id: 'AG-002', matricule: 'VAC-0157', prenom: 'Junior', nom: 'KASONGO', postnom: 'ILUNGA', sexe: 'M',
    fonction: 'Vaccinateur', telephone: '+243 99 310 4455', email: 'j.kasongo@amisante.cd', aire: 'AS Kokolo',
    statut: 'Actif', photo: 'images/agents/agent-2.webp', vaccinationsMois: 187, derniereConnexion: '2026-10-17 16:40', doitChangerMotDePasse: false,
  },
  {
    id: 'AG-003', matricule: 'SUP-0009', prenom: 'Henriette', nom: 'MAVUNGU', postnom: 'NZUZI', sexe: 'F',
    fonction: 'Superviseur vaccination', telephone: '+243 82 700 9031', email: 'h.mavungu@amisante.cd', aire: 'AS Camp Tshatshi',
    statut: 'Actif', photo: 'images/agents/agent-3.webp', vaccinationsMois: 0, derniereConnexion: '2026-10-18 07:55', doitChangerMotDePasse: false,
  },
  {
    id: 'AG-004', matricule: 'VAC-0121', prenom: 'Didier', nom: 'MBALA', postnom: 'KIESE', sexe: 'M',
    fonction: 'Vaccinateur', telephone: '+243 85 220 6610', email: 'd.mbala@amisante.cd', aire: 'AS Kokolo',
    statut: 'Suspendu', photo: 'images/agents/agent-4.webp', vaccinationsMois: 0, derniereConnexion: '2026-09-02 10:21', doitChangerMotDePasse: false,
  },
  {
    id: 'AG-005', matricule: 'RECO-0033', prenom: 'Chantal', nom: 'NSIMBA', postnom: 'MAKIESE', sexe: 'F',
    fonction: 'Relais communautaire', telephone: '+243 97 115 2083', email: 'c.nsimba@amisante.cd', aire: 'AS Camp Tshatshi',
    statut: 'Actif', vaccinationsMois: 0, derniereConnexion: '2026-10-16 12:03', doitChangerMotDePasse: false,
  },
  {
    id: 'AG-006', matricule: 'VAC-0163', prenom: 'Grâce', nom: 'TSHIMANGA', postnom: 'KAPINGA', sexe: 'F',
    fonction: 'Vaccinateur', telephone: '+243 81 902 3377', email: 'g.tshimanga@amisante.cd', aire: 'AS Kokolo',
    statut: 'Actif', vaccinationsMois: 96, derniereConnexion: null, doitChangerMotDePasse: true,
  },
];

/**
 * Liste des agents, gardée en mémoire pendant la session (maquette sans serveur).
 * ⚠️ Le mot de passe n'est jamais conservé ici : il devra être envoyé au serveur,
 * qui le stockera haché (bcrypt/argon2).
 */
@Injectable({ providedIn: 'root' })
export class AgentsService {
  readonly agents = signal<Agent[]>(AGENTS_INITIAUX);

  emailExiste(email: string): boolean {
    const e = email.trim().toLowerCase();
    return this.agents().some(a => a.email.toLowerCase() === e);
  }

  prochainMatricule(fonction: FonctionAgent): string {
    const prefixe = fonction === 'Superviseur vaccination' ? 'SUP' : fonction === 'Relais communautaire' ? 'RECO' : 'VAC';
    const max = this.agents()
      .filter(a => a.matricule.startsWith(prefixe + '-'))
      .reduce((m, a) => Math.max(m, parseInt(a.matricule.split('-')[1], 10) || 0), 0);
    return `${prefixe}-${String(max + 1).padStart(4, '0')}`;
  }

  ajouter(agent: Omit<Agent, 'id'>): Agent {
    const nouvel: Agent = { ...agent, id: `AG-${String(this.agents().length + 1).padStart(3, '0')}` };
    this.agents.update(liste => [nouvel, ...liste]);
    return nouvel;
  }

  basculerStatut(id: string): void {
    this.agents.update(liste => liste.map(a => a.id === id ? { ...a, statut: a.statut === 'Actif' ? 'Suspendu' : 'Actif' } : a));
  }
}
