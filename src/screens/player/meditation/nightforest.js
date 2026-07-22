/* Fond sonore de FORÊT LA NUIT synthétisé (Web Audio API) — aucun fichier requis.
   Deux couches :
     • Brise nocturne : bruit brun filtré (passe-bas doux) qui respire lentement
       via un LFO → souffle grave et feutré dans les feuillages.
     • Grillons : quelques voix ~4–5 kHz modulées en amplitude par un « trille »
       rapide (≈30 Hz) puis découpées en bouffées par une porte lente (~0,7 Hz)
       → stridulation caractéristique ; voix légèrement désaccordées et réparties
       à gauche/centre/droite pour la profondeur.
   Le volume global est réglable par l'utilisateur (setVolume 0..1). Silencieux si
   Web Audio indisponible (la voix reste). API : start/pause/stop/setVolume. */
export function createNightForest(initialVolume = 0.55) {
  let ctx = null, master = null, nodes = [], built = false;
  let vol = initialVolume;

  // Grillon : porteuse aiguë × trille rapide, ouverte/fermée en bouffées.
  const makeCricket = (freq, trillHz, gateHz, pan, level) => {
    const carrier = ctx.createOscillator(); carrier.type = "sine"; carrier.frequency.value = freq;

    const trillGain = ctx.createGain(); trillGain.gain.value = 0.5; // AM 0..1
    const trill = ctx.createOscillator(); trill.type = "square"; trill.frequency.value = trillHz;
    const trillDepth = ctx.createGain(); trillDepth.gain.value = 0.5;
    trill.connect(trillDepth).connect(trillGain.gain);

    const gateGain = ctx.createGain(); gateGain.gain.value = 0.5; // bouffées 0/1
    const gate = ctx.createOscillator(); gate.type = "square"; gate.frequency.value = gateHz;
    const gateDepth = ctx.createGain(); gateDepth.gain.value = 0.5;
    gate.connect(gateDepth).connect(gateGain.gain);

    const lvl = ctx.createGain(); lvl.gain.value = level;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    carrier.connect(trillGain).connect(gateGain).connect(lvl);
    (panner ? lvl.connect(panner).connect(master) : lvl.connect(master));
    carrier.start(); trill.start(); gate.start();
    nodes.push(carrier, trill, gate);
  };

  const build = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol;
    master.connect(ctx.destination);

    // Brise nocturne : bruit brun (4 s bouclé) → passe-bas doux, respiration lente.
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.5;
    const windGain = ctx.createGain(); windGain.gain.value = 0.5;
    const swell = ctx.createOscillator(); swell.type = "sine"; swell.frequency.value = 0.06; // ~16 s
    const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.28;
    swell.connect(swellDepth).connect(windGain.gain);
    wind.connect(lp).connect(windGain).connect(master);
    wind.start(); swell.start();
    nodes.push(wind, swell);

    // Grillons : 3 voix désaccordées, réparties dans le champ stéréo.
    makeCricket(4300 + Math.random() * 120, 27, 0.62, -0.55, 0.05);
    makeCricket(4600 + Math.random() * 140, 31, 0.74, 0.05, 0.045);
    makeCricket(5000 + Math.random() * 160, 24, 0.55, 0.6, 0.04);

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
      vol = Math.max(0, Math.min(1, v));
      try { if (master && ctx) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.12); } catch { /* noop */ }
    },
  };
}
