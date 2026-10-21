// Règles, génération et hachage des mots de passe (agents, chauffeurs).
// ⚠️ Maquette sans serveur : en production, le hachage et la vérification se font
// côté serveur (argon2/bcrypt) ; le navigateur n'envoie le mot de passe qu'en HTTPS.

export interface RegleMotDePasse {
  ok: boolean;
  texte: string;
}

export function reglesMotDePasse(m: string): RegleMotDePasse[] {
  return [
    { ok: m.length >= 10, texte: 'Au moins 10 caractères' },
    { ok: /[A-Z]/.test(m) && /[a-z]/.test(m), texte: 'Majuscules et minuscules' },
    { ok: /\d/.test(m), texte: 'Au moins un chiffre' },
    { ok: /[^A-Za-z0-9]/.test(m), texte: 'Au moins un caractère spécial' },
  ];
}

/** Mot de passe temporaire solide (sans caractères ambigus). */
export function genererMotDePasse(): string {
  const groupes = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
  const tous = groupes.join('');
  const hasard = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const car = groupes.map(g => g[hasard(g.length)]);
  while (car.length < 12) car.push(tous[hasard(tous.length)]);
  for (let i = car.length - 1; i > 0; i--) {
    const j = hasard(i + 1);
    [car[i], car[j]] = [car[j], car[i]];
  }
  return car.join('');
}

export interface Empreinte {
  sel: string;
  hash: string;
}

const enBase64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const depuisBase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function pbkdf2(motDePasse: string, sel: Uint8Array): Promise<string> {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: 210_000 }, cle, 256);
  return enBase64(bits);
}

/** Empreinte salée : le mot de passe lui-même n'est jamais conservé. */
export async function hacherMotDePasse(motDePasse: string): Promise<Empreinte> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  return { sel: enBase64(sel), hash: await pbkdf2(motDePasse, sel) };
}

export async function verifierMotDePasse(motDePasse: string, e: Empreinte): Promise<boolean> {
  const calcule = await pbkdf2(motDePasse, depuisBase64(e.sel));
  // Comparaison en temps constant.
  let diff = calcule.length ^ e.hash.length;
  for (let i = 0; i < Math.min(calcule.length, e.hash.length); i++) diff |= calcule.charCodeAt(i) ^ e.hash.charCodeAt(i);
  return diff === 0;
}
