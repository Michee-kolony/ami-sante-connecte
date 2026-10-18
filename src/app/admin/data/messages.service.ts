import { computed, Injectable, signal } from '@angular/core';

export type Canal = 'WhatsApp' | 'SMS' | 'Application';

export interface Message {
  id: string;
  auteur: 'medecin' | 'patiente';
  texte: string;
  /** Format « AAAA-MM-JJ HH:MM ». */
  date: string;
  statut?: 'envoyé' | 'lu';
}

export interface Conversation {
  patienteId: string;
  canal: Canal | null;
  /** Consentement de la patiente pour être contactée sur ce canal. */
  consentement: boolean;
  derniereConsultation: string;
  nonLus: number;
  messages: Message[];
}

/** Conversations fictives — gardées en mémoire pendant la session (maquette sans serveur). */
const CONVERSATIONS: Conversation[] = [
  {
    patienteId: 'AMI-2026-000142', canal: 'WhatsApp', consentement: true, derniereConsultation: '2026-09-24', nonLus: 2,
    messages: [
      { id: 'm1', auteur: 'medecin', texte: 'Bonjour Esther, c’est l’infirmière Grâce de l’HMGR. Comment vous sentez-vous depuis la dernière consultation ?', date: '2026-10-16 09:12', statut: 'lu' },
      { id: 'm2', auteur: 'patiente', texte: 'Bonjour madame, ça va bien merci. Le bébé bouge beaucoup 😊', date: '2026-10-16 10:03' },
      { id: 'm3', auteur: 'medecin', texte: 'Très bonne nouvelle ! Continuez à bien vous hydrater et à prendre votre fer et acide folique chaque jour.', date: '2026-10-16 10:15', statut: 'lu' },
      { id: 'm4', auteur: 'patiente', texte: 'D’accord. J’ai une question : est-ce que je peux venir avec mon mari au prochain rendez-vous ?', date: '2026-10-18 07:41' },
      { id: 'm5', auteur: 'patiente', texte: 'C’est toujours le mercredi 22 à 10h ?', date: '2026-10-18 07:42' },
    ],
  },
  {
    patienteId: 'AMI-2026-000141', canal: 'SMS', consentement: true, derniereConsultation: '2026-09-29', nonLus: 1,
    messages: [
      { id: 'm1', auteur: 'medecin', texte: 'Bonjour Ruth. Rappel : votre rendez-vous à l’HMGR est le lundi 20/10 à 8h30. Merci de venir avec votre carnet.', date: '2026-10-17 15:00', statut: 'lu' },
      { id: 'm2', auteur: 'patiente', texte: 'Merci, je serai là.', date: '2026-10-17 18:22' },
    ],
  },
  {
    patienteId: 'AMI-2026-000140', canal: 'SMS', consentement: true, derniereConsultation: '2026-09-10', nonLus: 0,
    messages: [
      { id: 'm1', auteur: 'medecin', texte: 'Bonjour Marie. Vous n’êtes pas venue à votre rendez-vous du 15/10. Pouvez-vous nous rappeler pour en fixer un nouveau ?', date: '2026-10-16 08:30', statut: 'envoyé' },
    ],
  },
  {
    patienteId: 'AMI-LOC-7F3A2C', canal: 'Application', consentement: true, derniereConsultation: '2026-10-18', nonLus: 0,
    messages: [
      { id: 'm1', auteur: 'medecin', texte: 'Bienvenue Divine ! Votre dossier est créé. Vous pouvez nous écrire ici si vous avez une question avant votre prochain rendez-vous.', date: '2026-10-18 09:50', statut: 'lu' },
      { id: 'm2', auteur: 'patiente', texte: 'Merci beaucoup 🙏', date: '2026-10-18 09:58' },
    ],
  },
  {
    patienteId: 'AMI-2026-000138', canal: null, consentement: false, derniereConsultation: '2026-09-27', nonLus: 0,
    messages: [],
  },
];

/** Modèles de messages rapides (texte discret, sans détail médical). */
export const MODELES = [
  'Bonjour, comment vous sentez-vous aujourd’hui ?',
  'Petit rappel : n’oubliez pas votre prochain rendez-vous. Pensez à apporter votre carnet.',
  'Merci pour votre message, je vous réponds au plus vite.',
  'En cas de saignement, de fortes douleurs ou de fièvre, rendez-vous immédiatement à l’hôpital.',
];

@Injectable({ providedIn: 'root' })
export class MessagesService {
  readonly conversations = signal<Conversation[]>(CONVERSATIONS);
  readonly totalNonLus = computed(() => this.conversations().reduce((n, c) => n + c.nonLus, 0));

  marquerLu(patienteId: string): void {
    this.conversations.update(liste => liste.map(c => c.patienteId === patienteId ? { ...c, nonLus: 0 } : c));
  }

  envoyer(patienteId: string, texte: string): void {
    const maintenant = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${maintenant.getFullYear()}-${pad(maintenant.getMonth() + 1)}-${pad(maintenant.getDate())} ${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`;
    // TODO serveur : transmettre le message via le canal consenti (API WhatsApp/SMS ou application patiente).
    this.conversations.update(liste => liste.map(c => c.patienteId !== patienteId ? c : {
      ...c,
      messages: [...c.messages, { id: crypto.randomUUID(), auteur: 'medecin', texte, date, statut: 'envoyé' }],
    }));
  }
}
