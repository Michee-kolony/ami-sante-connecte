/**
 * Petit carillon doux généré avec Web Audio (aucun fichier à charger).
 * Les navigateurs bloquent le son tant que le visiteur n'a pas interagi avec la page :
 * dans ce cas le carillon est joué à la première interaction (clic, touche, toucher).
 */
let contexte: AudioContext | null = null;

function obtenirContexte(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    contexte ??= new Ctx();
    return contexte;
  } catch {
    return null;
  }
}

function note(ctx: AudioContext, frequence: number, debut: number, duree: number, volume: number): void {
  const osc = ctx.createOscillator();
  const harmonique = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  harmonique.type = 'triangle';
  osc.frequency.value = frequence;
  harmonique.frequency.value = frequence * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.12;
  harmonique.connect(g2).connect(gain);
  osc.connect(gain).connect(ctx.destination);
  // Attaque douce puis extinction naturelle, comme une petite cloche.
  gain.gain.setValueAtTime(0.0001, debut);
  gain.gain.exponentialRampToValueAtTime(volume, debut + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  osc.start(debut);
  harmonique.start(debut);
  osc.stop(debut + duree + 0.05);
  harmonique.stop(debut + duree + 0.05);
}

function jouer(ctx: AudioContext): void {
  const t = ctx.currentTime + 0.02;
  note(ctx, 659.25, t, 0.55, 0.12);        // Mi 5
  note(ctx, 987.77, t + 0.13, 0.8, 0.09);  // Si 5
}

export function carillon(): void {
  lire(jouer);
}

/** Alarme clinique (partogramme) : trois bips aigus répétés deux fois, nettement distincts du carillon. */
function jouerAlarme(ctx: AudioContext): void {
  const t = ctx.currentTime + 0.02;
  for (let serie = 0; serie < 2; serie++) {
    for (let i = 0; i < 3; i++) note(ctx, 1046.5, t + serie * 0.9 + i * 0.18, 0.14, 0.2); // Do 6
  }
}

export function alarme(): void {
  lire(jouerAlarme);
}

function lire(jouer: (ctx: AudioContext) => void): void {
  const ctx = obtenirContexte();
  if (!ctx) return;
  if (ctx.state === 'running') {
    jouer(ctx);
    return;
  }
  // Son bloqué : on le joue à la première interaction du visiteur.
  const debloquer = () => {
    ctx.resume().then(() => jouer(ctx)).catch(() => undefined);
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, debloquer));
  };
  ctx.resume().then(() => {
    if (ctx.state === 'running') jouer(ctx);
    else ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, debloquer, { once: true }));
  }).catch(() => undefined);
}
