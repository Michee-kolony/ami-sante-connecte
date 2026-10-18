import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TraduirePipe } from '../../../shared/i18n/traduire.pipe';
import { carillon } from '../../../shared/son';

interface Lien {
  texte: string;
  route: string;
  fragment?: string;
}

interface Faq {
  question: string;
  reponse: string;
  /** Mots-clés (sans accents) pour reconnaître une question tapée librement. */
  motsCles: string[];
  lien?: Lien;
  urgent?: boolean;
}

interface Bulle {
  de: 'bot' | 'moi';
  texte: string;
  /** Texte tapé par le visiteur : affiché tel quel, sans traduction. */
  brut?: boolean;
  lien?: Lien;
  urgent?: boolean;
}

const DELAI_APPARITION = 5000;
const CLE_VU = 'ami-chat-vu';
const CLE_SON = 'ami-chat-son';

const FAQ: Faq[] = [
  {
    question: 'Qu’est-ce qu’AMI Santé Connect ?',
    reponse: 'C’est un outil numérique qui aide les équipes de santé à enregistrer et suivre les femmes enceintes lors des consultations prénatales, et à suivre la vaccination des enfants, même sans connexion internet.',
    motsCles: ['ami', 'quoi', 'projet', 'application', 'plateforme', 'c est quoi'],
  },
  {
    question: 'Quand commencer mes consultations prénatales ?',
    reponse: 'Dès que vous pensez être enceinte. L’OMS recommande au moins 8 contacts avec un professionnel de santé pendant la grossesse. Un suivi régulier permet de repérer tôt les complications.',
    motsCles: ['cpn', 'prenatal', 'consultation', 'commencer', 'quand', 'enceinte', 'grossesse'],
  },
  {
    question: 'Quels sont les signes d’urgence pendant la grossesse ?',
    reponse: 'Allez immédiatement à l’hôpital en cas de saignement, de fortes douleurs au ventre, de fièvre, de maux de tête violents ou de vision trouble, de convulsions, de perte de liquide, ou si le bébé ne bouge plus.',
    motsCles: ['urgence', 'urgent', 'saignement', 'sang', 'douleur', 'fievre', 'danger', 'bouge', 'convulsion'],
    urgent: true,
  },
  {
    question: 'Quels vaccins pour mon bébé ?',
    reponse: 'Votre bébé reçoit des vaccins à la naissance, à 6, 10 et 14 semaines, puis à 9 mois (dont la rougeole et la fièvre jaune). Gardez bien son carnet : l’agent de vaccination vous indiquera la prochaine date.',
    motsCles: ['vaccin', 'vaccination', 'bebe', 'enfant', 'rougeole', 'carnet', 'polio'],
  },
  {
    question: 'Vais-je recevoir des rappels de rendez-vous ?',
    reponse: 'Oui, si vous l’acceptez. Les rappels sont envoyés par SMS, appel ou WhatsApp selon votre choix, avec un message discret qui ne contient aucune information médicale.',
    motsCles: ['rappel', 'sms', 'whatsapp', 'message', 'rendez', 'rdv', 'notification'],
  },
  {
    question: 'Mes données sont-elles protégées ?',
    reponse: 'Oui. Seul le personnel autorisé accède à votre dossier, chaque accès est enregistré, et les échanges sont chiffrés. Vous pouvez retirer votre accord pour les messages à tout moment.',
    motsCles: ['donnee', 'confidentiel', 'prive', 'securite', 'protege', 'secret', 'dossier'],
  },
  {
    question: 'Où se trouve la structure pilote ?',
    reponse: 'À l’Hôpital Militaire de la Garde Républicaine, Camp Colonel Tshatshi, Zone de Santé Militaire Kokolo, à Kinshasa.',
    motsCles: ['ou', 'adresse', 'hopital', 'trouver', 'lieu', 'tshatshi', 'kokolo', 'situe'],
    lien: { texte: 'Voir le contact', route: '/', fragment: 'contact' },
  },
  {
    question: 'Je suis un professionnel de santé',
    reponse: 'Bienvenue ! Connectez-vous à l’espace professionnel avec votre compte individuel pour enregistrer et suivre les patientes.',
    motsCles: ['professionnel', 'medecin', 'infirmier', 'sage', 'agent', 'connexion', 'compte', 'connecter'],
    lien: { texte: 'Espace professionnel', route: '/admin/connexion' },
  },
];

function normaliser(texte: string): string {
  return texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [FormsModule, RouterLink, TraduirePipe],
  templateUrl: './chatbot.component.html',
})
export class ChatbotComponent implements OnInit, AfterViewChecked, OnDestroy {
  faq = FAQ;
  visible = false;
  ouvert = false;
  accroche = false;
  frappe = false;
  sonActif = true;
  saisie = '';
  bulles: Bulle[] = [];
  posees = new Set<string>();

  @ViewChild('fil') private filRef?: ElementRef<HTMLElement>;
  private defiler = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  get suggestions(): Faq[] {
    return this.faq.filter(f => !this.posees.has(f.question)).slice(0, 4);
  }

  ngOnInit(): void {
    try {
      this.sonActif = localStorage.getItem(CLE_SON) !== 'off';
    } catch {
      // ignore
    }
    this.plus(() => this.apparaitre(), DELAI_APPARITION);
  }

  private apparaitre(): void {
    this.visible = true;
    if (this.sonActif) carillon();
    let dejaVu = false;
    try {
      dejaVu = sessionStorage.getItem(CLE_VU) === '1';
    } catch {
      // ignore
    }
    // Ouvre la fenêtre sur grand écran ; sur mobile, une simple bulle d'accroche.
    if (!dejaVu && window.matchMedia('(min-width: 768px)').matches) this.ouvrir(false);
    else if (!dejaVu) this.accroche = true;
  }

  ouvrir(avecSon = true): void {
    this.ouvert = true;
    this.accroche = false;
    try {
      sessionStorage.setItem(CLE_VU, '1');
    } catch {
      // ignore
    }
    if (!this.bulles.length) {
      this.bulles.push({ de: 'bot', texte: 'Bonjour 👋 Je suis l’assistant d’AMI Santé Connect.' });
      this.bulles.push({ de: 'bot', texte: 'Choisissez une question ou écrivez la vôtre.' });
    }
    if (avecSon && this.sonActif) carillon();
    this.defiler = true;
  }

  fermer(): void {
    this.ouvert = false;
  }

  basculerSon(): void {
    this.sonActif = !this.sonActif;
    try {
      localStorage.setItem(CLE_SON, this.sonActif ? 'on' : 'off');
    } catch {
      // ignore
    }
    if (this.sonActif) carillon();
  }

  choisir(f: Faq): void {
    this.bulles.push({ de: 'moi', texte: f.question });
    this.repondre(f);
  }

  envoyer(): void {
    const texte = this.saisie.trim();
    if (!texte || this.frappe) return;
    this.saisie = '';
    this.bulles.push({ de: 'moi', texte, brut: true });
    this.repondre(this.chercher(texte));
  }

  private chercher(texte: string): Faq | null {
    const mots = normaliser(texte).split(/\s+/).filter(m => m.length > 1);
    let meilleure: Faq | null = null;
    let score = 0;
    for (const f of this.faq) {
      const s = f.motsCles.filter(k => mots.some(m => m.startsWith(k) || k.startsWith(m) && m.length > 3)).length
        + (f.urgent && mots.some(m => ['urgence', 'saignement', 'sang'].some(k => m.startsWith(k))) ? 2 : 0);
      if (s > score) {
        score = s;
        meilleure = f;
      }
    }
    return meilleure;
  }

  private repondre(f: Faq | null): void {
    this.frappe = true;
    this.defiler = true;
    this.plus(() => {
      this.frappe = false;
      if (f) {
        this.posees.add(f.question);
        this.bulles.push({ de: 'bot', texte: f.reponse, lien: f.lien, urgent: f.urgent });
      } else {
        this.bulles.push({
          de: 'bot',
          texte: 'Je n’ai pas trouvé de réponse à votre question. Écrivez à notre équipe, elle vous répondra.',
          lien: { texte: 'Formulaire de contact', route: '/', fragment: 'contact' },
        });
      }
      if (this.sonActif) carillon();
      this.defiler = true;
    }, 900);
  }

  ngAfterViewChecked(): void {
    if (this.defiler && this.filRef) {
      const el = this.filRef.nativeElement;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      this.defiler = false;
    }
  }

  private plus(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }
}
