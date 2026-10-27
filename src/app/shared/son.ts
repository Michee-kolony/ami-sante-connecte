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

// --- Sirène de détresse (alertes des patientes) ----------------------------------------

/**
 * Sirène forte et reconnaissable : balayage aigu ↔ grave (type « deux tons »), répété tant
 * qu'une alerte attend sa prise en charge. Le compresseur pousse le volume sans saturer.
 */
function jouerSirene(ctx: AudioContext): void {
  if (!minuterieSirene) return; // arrêtée entre-temps (alerte prise en charge, son coupé)
  const t = ctx.currentTime + 0.02;
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -10;
  compresseur.ratio.value = 4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.9, t + 0.05);
  gain.gain.setValueAtTime(0.9, t + 1.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
  gain.connect(compresseur).connect(ctx.destination);
  sortieSirene = gain;
  for (const [type, decalage] of [['sawtooth', 0], ['square', 3]] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = decalage;
    // Deux montées-descentes 650 → 1450 Hz : le cri d'une sirène d'ambulance.
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.linearRampToValueAtTime(1450, t + 0.42);
    osc.frequency.linearRampToValueAtTime(650, t + 0.85);
    osc.frequency.linearRampToValueAtTime(1450, t + 1.27);
    osc.frequency.linearRampToValueAtTime(650, t + 1.7);
    const g = ctx.createGain();
    g.gain.value = type === 'square' ? 0.25 : 0.45;
    osc.connect(g).connect(gain);
    osc.start(t);
    osc.stop(t + 1.8);
  }
}

let minuterieSirene: ReturnType<typeof setInterval> | undefined;
/** Sortie du son en cours, coupée à l'arrêt de la sirène. */
let sortieSirene: GainNode | null = null;

/** Démarre la sirène (répétée toutes les 2,5 s) ; sans effet si elle sonne déjà. */
export function demarrerSirene(): void {
  if (minuterieSirene) return;
  minuterieSirene = setInterval(() => {
    if (contexte?.state === 'running') jouerSirene(contexte);
  }, 2500);
  // Son encore bloqué par le navigateur : lire() le jouera à la première interaction (si la sirène est toujours active).
  lire(jouerSirene);
}

export function arreterSirene(): void {
  clearInterval(minuterieSirene);
  minuterieSirene = undefined;
  sortieSirene?.disconnect();
  sortieSirene = null;
}
