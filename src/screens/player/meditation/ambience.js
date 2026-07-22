/* Fonds sonores d'AMBIANCE synthétisés (Web Audio API) — aucun fichier requis.
   4 thèmes au choix : forêt la nuit, vagues, pluie, feu de camp. Chacun expose
   la même API (start/pause/stop/setVolume) ; le volume est piloté par
   l'utilisateur (0..1). Silencieux si Web Audio indisponible (la voix reste).
   L'AudioContext n'est créé qu'au premier start() (autorisé sous geste user). */
export const AMBIENCE_THEMES = ["forest", "waves", "rain", "fire"];

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

// Bruit blanc bouclé (couture inaudible car aléatoire).
function whiteNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Buffer de « crépitements » pré-calculé : pops courts décroissants placés au hasard.
function crackleBuffer(ctx, seconds, pops) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < pops; k++) {
    const start = Math.floor(Math.random() * len);
    const dur = Math.floor(ctx.sampleRate * (0.004 + Math.random() * 0.02));
    const amp = 0.4 + Math.random() * 0.6;
    for (let i = 0; i < dur && start + i < len; i++) { const env = 1 - i / dur; d[start + i] += (Math.random() * 2 - 1) * amp * env * env; }
  }
  return buf;
}

// Forêt la nuit : brise feutrée + grillons stridulants répartis en stéréo.
function buildForest(ctx, master, keep) {
  const wind = ctx.createBufferSource(); wind.buffer = brownNoise(ctx, 4, 3.2); wind.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.5;
  const windGain = ctx.createGain(); windGain.gain.value = 0.5;
  const swell = ctx.createOscillator(); swell.type = "sine"; swell.frequency.value = 0.06;
  const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.28;
  swell.connect(swellDepth).connect(windGain.gain);
  wind.connect(lp).connect(windGain).connect(master);
  wind.start(); swell.start(); keep(wind); keep(swell);

  const cricket = (freq, trillHz, gateHz, pan, level) => {
    const carrier = ctx.createOscillator(); carrier.type = "sine"; carrier.frequency.value = freq;
    const trillGain = ctx.createGain(); trillGain.gain.value = 0.5;
    const trill = ctx.createOscillator(); trill.type = "square"; trill.frequency.value = trillHz;
    const trillDepth = ctx.createGain(); trillDepth.gain.value = 0.5;
    trill.connect(trillDepth).connect(trillGain.gain);
    const gateGain = ctx.createGain(); gateGain.gain.value = 0.5;
    const gate = ctx.createOscillator(); gate.type = "square"; gate.frequency.value = gateHz;
    const gateDepth = ctx.createGain(); gateDepth.gain.value = 0.5;
    gate.connect(gateDepth).connect(gateGain.gain);
    const lvl = ctx.createGain(); lvl.gain.value = level;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;
    carrier.connect(trillGain).connect(gateGain).connect(lvl);
    (panner ? lvl.connect(panner).connect(master) : lvl.connect(master));
    carrier.start(); trill.start(); gate.start(); keep(carrier); keep(trill); keep(gate);
  };
  cricket(4300 + Math.random() * 120, 27, 0.62, -0.55, 0.05);
  cricket(4600 + Math.random() * 140, 31, 0.74, 0.05, 0.045);
  cricket(5000 + Math.random() * 160, 24, 0.55, 0.6, 0.04);
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

// Pluie : bruit blanc filtré (sifflement fin) + corps grave, intensité qui ondule.
function buildRain(ctx, master, keep) {
  const hiss = ctx.createBufferSource(); hiss.buffer = whiteNoise(ctx, 3); hiss.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 800;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500; lp.Q.value = 0.4;
  const bed = ctx.createGain(); bed.gain.value = 0.3;
  const swell = ctx.createOscillator(); swell.type = "sine"; swell.frequency.value = 0.08;
  const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.08;
  swell.connect(swellDepth).connect(bed.gain);
  hiss.connect(hp).connect(lp).connect(bed).connect(master);
  hiss.start(); swell.start(); keep(hiss); keep(swell);

  const body = ctx.createBufferSource(); body.buffer = brownNoise(ctx, 4, 3.0); body.loop = true;
  const blp = ctx.createBiquadFilter(); blp.type = "lowpass"; blp.frequency.value = 320;
  const bGain = ctx.createGain(); bGain.gain.value = 0.16;
  body.connect(blp).connect(bGain).connect(master);
  body.start(); keep(body);
}

// Feu de camp : braise grave + crépitements aléatoires (buffer pré-calculé bouclé).
function buildFire(ctx, master, keep) {
  const ember = ctx.createBufferSource(); ember.buffer = brownNoise(ctx, 4, 3.0); ember.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 360;
  const emberGain = ctx.createGain(); emberGain.gain.value = 0.42;
  ember.connect(lp).connect(emberGain).connect(master);
  ember.start(); keep(ember);

  const crack = ctx.createBufferSource(); crack.buffer = crackleBuffer(ctx, 8, 110); crack.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.7;
  const crackGain = ctx.createGain(); crackGain.gain.value = 0.5;
  crack.connect(bp).connect(crackGain).connect(master);
  crack.start(); keep(crack);
}

const BUILDERS = { forest: buildForest, waves: buildWaves, rain: buildRain, fire: buildFire };

/* Crée un fond d'ambiance pour un thème donné. L'AudioContext est différé au
   premier start() (geste utilisateur). API : start/pause/stop/setVolume. */
export function createAmbience(theme = "forest", initialVolume = 0.55) {
  const buildGraph = BUILDERS[theme] || buildForest;
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
