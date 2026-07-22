/* Fonds sonores d'AMBIANCE synthétisés (Web Audio API) — aucun fichier requis.
   2 thèmes au choix : vagues, feu de camp. Chacun expose la même API
   (start/pause/stop/setVolume) ; le volume est piloté par l'utilisateur (0..1).
   Silencieux si Web Audio indisponible (la voix reste). L'AudioContext n'est
   créé qu'au premier start() (autorisé sous geste user). */
export const AMBIENCE_THEMES = ["waves", "fire"];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Bruit brun (grave, feutré) bouclé.
function brownNoise(ctx, seconds, amp) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * amp; }
  return buf;
}

// Bruit rose (spectre en 1/f, chaud et naturel — bien plus « pluie » que le
// bruit blanc). Approximation de Paul Kellet. Bouclé.
function pinkNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return buf;
}

// Crépitements de feu pré-rendus : pops à attaque instantanée et chute
// exponentielle, durées/amplitudes très variées (quelques « claquements »
// forts parmi de nombreux petits ticks) → crépitement crédible, non répétitif.
function renderCrackle(ctx, seconds, perSec) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const n = Math.floor(seconds * perSec);
  for (let k = 0; k < n; k++) {
    const start = Math.floor(Math.random() * len);
    const big = Math.random() < 0.10;
    const dur = Math.floor(sr * (big ? 0.010 + Math.random() * 0.020 : 0.002 + Math.random() * 0.006));
    const amp = big ? 0.55 + Math.random() * 0.45 : 0.08 + Math.random() * 0.22;
    const decay = dur * 0.35;
    for (let i = 0; i < dur && start + i < len; i++) { const env = Math.exp(-i / decay); d[start + i] += (Math.random() * 2 - 1) * amp * env; }
  }
  return buf;
}

// Vagues : bruit brun filtré, houle lente (LFO sur le volume ET la coupure).
function buildWaves(ctx, master, keep) {
  const src = ctx.createBufferSource(); src.buffer = brownNoise(ctx, 4, 3.4); src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 540; lp.Q.value = 0.6;
  const swell = ctx.createGain(); swell.gain.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.09;
  const gLfo = ctx.createGain(); gLfo.gain.value = 0.35; lfo.connect(gLfo).connect(swell.gain);
  const fLfo = ctx.createGain(); fLfo.gain.value = 280; lfo.connect(fLfo).connect(lp.frequency);
  src.connect(hp).connect(lp).connect(swell).connect(master);
  src.start(); lfo.start(); keep(src); keep(lfo);
}

// Feu de camp : braise grave (rumble) + souffle de flammes (bruit rose medium)
// + crépitements variés (buffer pré-rendu bouclé).
function buildFire(ctx, master, keep) {
  const ember = ctx.createBufferSource(); ember.buffer = brownNoise(ctx, 4, 2.8); ember.loop = true;
  const elp = ctx.createBiquadFilter(); elp.type = "lowpass"; elp.frequency.value = 300;
  const eGain = ctx.createGain(); eGain.gain.value = 0.3;
  ember.connect(elp).connect(eGain).connect(master);
  ember.start(); keep(ember);

  const flame = ctx.createBufferSource(); flame.buffer = pinkNoise(ctx, 5); flame.loop = true;
  const fbp = ctx.createBiquadFilter(); fbp.type = "bandpass"; fbp.frequency.value = 1100; fbp.Q.value = 0.6;
  const fGain = ctx.createGain(); fGain.gain.value = 0.13;
  flame.connect(fbp).connect(fGain).connect(master);
  flame.start(); keep(flame);

  const crack = ctx.createBufferSource(); crack.buffer = renderCrackle(ctx, 10, 16); crack.loop = true;
  const cbp = ctx.createBiquadFilter(); cbp.type = "bandpass"; cbp.frequency.value = 2200; cbp.Q.value = 0.6;
  const cGain = ctx.createGain(); cGain.gain.value = 0.75;
  crack.connect(cbp).connect(cGain).connect(master);
  crack.start(); keep(crack);
}

const BUILDERS = { waves: buildWaves, fire: buildFire };

/* Crée un fond d'ambiance pour un thème donné. L'AudioContext est différé au
   premier start() (geste utilisateur). API : start/pause/stop/setVolume. */
export function createAmbience(theme = "waves", initialVolume = 0.55) {
  const buildGraph = BUILDERS[theme] || buildWaves;
  let ctx = null, master = null, nodes = [], built = false;
  let vol = clamp01(initialVolume);

  const build = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    buildGraph(ctx, master, (n) => nodes.push(n));
    built = true;
    return true;
  };

  return {
    start() { try { if (!built && build() === false) return; ctx?.resume?.(); } catch { /* Web Audio KO → silencieux */ } },
    pause() { try { ctx?.suspend?.(); } catch { /* noop */ } },
    stop() {
      try { nodes.forEach((n) => { try { n.stop?.(); } catch { /* noop */ } }); ctx?.close?.(); } catch { /* noop */ }
      ctx = master = null; nodes = []; built = false;
    },
    setVolume(v) {
      vol = clamp01(v);
      try { if (master && ctx) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.12); } catch { /* noop */ }
    },
  };
}
