import { Component, OnDestroy, effect, input, model } from '@angular/core';

/**
 * Photo convertie en JPEG (1000 px max) : plus légère sur une connexion lente, et lisible
 * par le générateur de la carte patiente côté serveur (qui ne lit ni le WebP ni le HEIC).
 */
export async function enJpeg(fichier: File, cote = 1000): Promise<File> {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Conversion impossible');
  return new File([blob], fichier.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/**
 * Prise de photo d'identification : appareil photo en direct (repli sur le champ fichier, qui
 * ouvre l'appareil natif sur mobile) ou fichier choisi. Rend un JPEG de 2 Mo au plus.
 */
@Component({
  selector: 'app-prise-photo',
  standalone: true,
  template: `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
      @if (apercu) {
        <img [src]="apercu" [alt]="libelle()" class="h-28 w-28 flex-none rounded-2xl object-cover shadow ring-1 ring-slate-200 dark:ring-slate-700">
      } @else {
        <span class="flex h-28 w-28 flex-none flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-slate-400"
              [class]="requise() ? 'border-rose-300 dark:border-rose-500/50' : 'border-slate-300 dark:border-slate-700'">
          <i class="fa-solid {{ icone() }} text-2xl"></i><span class="text-[11px]">Aucune photo</span>
        </span>
      }
      <div class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-primary py-2 text-xs" (click)="ouvrirCamera(repliCamera)"><i class="fa-solid fa-camera"></i> Prendre une photo</button>
          <input #repliCamera type="file" accept="image/*" capture="environment" class="sr-only" tabindex="-1" aria-hidden="true" (change)="choisir($event)">
          <label class="btn-secondary cursor-pointer py-2 text-xs"><i class="fa-solid fa-image"></i> Choisir un fichier<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" (change)="choisir($event)"></label>
          @if (fichier()) { <button type="button" class="btn-ghost py-2 text-xs text-rose-600" (click)="retirer()"><i class="fa-solid fa-trash"></i> Retirer</button> }
        </div>
        <p class="text-xs" [class]="erreur ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'">{{ erreur || aide() }}</p>
      </div>
    </div>

    @if (camera) {
      <div class="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Appareil photo">
        <video #video [srcObject]="camera" autoplay playsinline muted
               class="min-h-0 flex-1 object-contain" [class.-scale-x-100]="face === 'user'"></video>
        @if (erreurCamera) { <p class="bg-rose-600 px-4 py-2 text-center text-xs text-white">{{ erreurCamera }}</p> }
        <div class="flex items-center justify-around px-6 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button type="button" class="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25" (click)="fermerCamera()" aria-label="Annuler">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <button type="button" class="h-16 w-16 rounded-full bg-white ring-4 ring-white/40 ring-offset-2 ring-offset-black transition active:scale-95" (click)="capturer(video)" aria-label="Prendre la photo"></button>
          <button type="button" class="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25" (click)="changerCamera(repliCamera)" aria-label="Changer de caméra">
            <i class="fa-solid fa-camera-rotate"></i>
          </button>
        </div>
      </div>
    }
  `,
})
export class PrisePhotoComponent implements OnDestroy {
  /** Fichier retenu (JPEG, 2 Mo max), null tant qu'aucune photo n'est prise. */
  fichier = model<File | null>(null);
  libelle = input('Photo');
  aide = input('JPG, PNG ou WebP, 2 Mo max. Visage bien éclairé, de face.');
  icone = input('fa-user');
  requise = input(false);

  apercu: string | null = null;
  erreur = '';
  camera: MediaStream | null = null;
  face: 'environment' | 'user' = 'environment';
  erreurCamera = '';

  constructor() {
    // Remise à zéro par le parent (formulaire enregistré) : l'aperçu est retiré aussi.
    effect(() => {
      if (!this.fichier() && this.apercu) {
        URL.revokeObjectURL(this.apercu);
        this.apercu = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.fermerCamera();
    if (this.apercu) URL.revokeObjectURL(this.apercu);
  }

  async choisir(evt: Event): Promise<void> {
    const champ = evt.target as HTMLInputElement;
    const f = champ.files?.[0];
    champ.value = '';
    this.erreur = '';
    if (f) await this.appliquer(f);
  }

  private async appliquer(f: File): Promise<void> {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      this.erreur = 'Format accepté : JPG, PNG ou WebP.';
      return;
    }
    // Les photos d'appareil dépassent souvent 2 Mo : on les réduit avant de vérifier la taille.
    const photo = await enJpeg(f).catch(() => f);
    if (photo.size > 2 * 1024 * 1024) {
      this.erreur = 'La photo doit faire 2 Mo au maximum.';
      return;
    }
    this.retirer();
    this.fichier.set(photo);
    this.apercu = URL.createObjectURL(photo);
  }

  retirer(): void {
    if (this.apercu) URL.revokeObjectURL(this.apercu);
    this.apercu = null;
    this.fichier.set(null);
  }

  async ouvrirCamera(repli: HTMLInputElement): Promise<void> {
    this.erreur = '';
    this.erreurCamera = '';
    if (!navigator.mediaDevices?.getUserMedia) {
      repli.click();
      return;
    }
    try {
      this.fermerCamera();
      this.camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.face, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch (e) {
      this.erreur = (e as DOMException)?.name === 'NotAllowedError'
        ? 'Accès à l’appareil photo refusé. Autorisez-le dans les réglages du navigateur, ou choisissez un fichier.'
        : 'Appareil photo introuvable ou indisponible. Choisissez un fichier.';
    }
  }

  async changerCamera(repli: HTMLInputElement): Promise<void> {
    this.face = this.face === 'environment' ? 'user' : 'environment';
    await this.ouvrirCamera(repli);
  }

  async capturer(video: HTMLVideoElement): Promise<void> {
    if (!video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.92));
    if (!blob) {
      this.erreurCamera = 'Capture impossible, réessayez.';
      return;
    }
    this.fermerCamera();
    await this.appliquer(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }

  fermerCamera(): void {
    this.camera?.getTracks().forEach(t => t.stop());
    this.camera = null;
  }
}
