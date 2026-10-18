import { AfterViewChecked, Component, computed, ElementRef, inject, Input, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar.component';
import { formatDate, PATIENTES, Patiente, UTILISATEUR } from '../../data/mock-data';
import { Canal, Conversation, MessagesService, MODELES } from '../../data/messages.service';

interface Fil extends Conversation {
  patiente: Patiente;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './messages.component.html',
})
export class MessagesComponent implements AfterViewChecked {
  private service = inject(MessagesService);
  fmt = formatDate;
  user = UTILISATEUR;
  modeles = MODELES;

  recherche = signal('');
  selection = signal<string | null>(null);
  texte = '';
  afficherModeles = false;
  private defilerEnBas = false;

  @ViewChild('fil') private filRef?: ElementRef<HTMLElement>;

  /** Ouvre directement une conversation : /admin/messages?patiente=AMI-… */
  @Input() set patiente(id: string | undefined) {
    if (id) this.ouvrir(id);
  }

  fils = computed<Fil[]>(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.service.conversations()
      .map(c => ({ ...c, patiente: PATIENTES.find(p => p.id === c.patienteId)! }))
      .filter(f => f.patiente && (!q || `${f.patiente.prenom} ${f.patiente.nom}`.toLowerCase().includes(q)))
      .sort((a, b) => this.derniereDate(b).localeCompare(this.derniereDate(a)));
  });

  actif = computed(() => this.fils().find(f => f.patienteId === this.selection()) ?? null);

  ouvrir(id: string): void {
    this.selection.set(id);
    this.service.marquerLu(id);
    this.texte = '';
    this.afficherModeles = false;
    this.defilerEnBas = true;
  }

  fermer(): void {
    this.selection.set(null);
  }

  envoyer(): void {
    const f = this.actif();
    const t = this.texte.trim();
    if (!f || !t || !f.consentement) return;
    this.service.envoyer(f.patienteId, t);
    this.texte = '';
    this.defilerEnBas = true;
  }

  /** Entrée envoie, Maj+Entrée fait un retour à la ligne. */
  clavier(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.envoyer();
    }
  }

  insererModele(m: string): void {
    this.texte = this.texte ? `${this.texte} ${m}` : m;
    this.afficherModeles = false;
  }

  ngAfterViewChecked(): void {
    if (this.defilerEnBas && this.filRef) {
      this.filRef.nativeElement.scrollTop = this.filRef.nativeElement.scrollHeight;
      this.defilerEnBas = false;
    }
  }

  derniereDate(c: Conversation): string {
    return c.messages.at(-1)?.date ?? '';
  }

  apercu(c: Conversation): string {
    const m = c.messages.at(-1);
    if (!m) return c.consentement ? 'Aucun message' : 'Pas de consentement au contact';
    return (m.auteur === 'medecin' ? 'Vous : ' : '') + m.texte;
  }

  heure(date: string): string {
    return date.slice(11, 16);
  }

  jour(date: string): string {
    const d = date.slice(0, 10);
    if (d === '2026-10-18') return 'Aujourd’hui';
    if (d === '2026-10-17') return 'Hier';
    return this.fmt(d);
  }

  /** Affiche un séparateur de date quand le jour change. */
  nouveauJour(i: number): boolean {
    const msgs = this.actif()?.messages ?? [];
    return i === 0 || msgs[i].date.slice(0, 10) !== msgs[i - 1].date.slice(0, 10);
  }

  icone(canal: Canal | null): string {
    return canal === 'WhatsApp' ? 'fa-brands fa-whatsapp' : canal === 'SMS' ? 'fa-solid fa-comment-sms' : canal === 'Application' ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-ban';
  }
}
