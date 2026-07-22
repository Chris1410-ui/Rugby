/* Fond sonore de VAGUES synthétisé (Web Audio API) — aucun fichier requis.
   Bruit brun bouclé → passe-haut + passe-bas → « houle » lente (un LFO ~11 s
   module le volume ET la coupure du filtre → le « shhh » monte sur la crête).
   Le volume est réglable par l'utilisateur (setVolume 0..1). Silencieux si Web
   Audio indisponible (la voix reste). API : start/pause/stop/setVolume. */
export function createOceanWaves(initialVolume = 0.55) {
  let ctx = null, src = null, lfo = null, master = null, built = false;
  let vol = initialVolume;

  const build = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    // Bruit brun (4 s) bouclé → base grave et douce.
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.4; }
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;

    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 540; lp.Q.value = 0.6;

    // Houle : gain qui respire (0,25 → 0,95) + coupure qui s'ouvre sur la crête.
    const swell = ctx.createGain(); swell.gain.value = 0.6;
    master = ctx.createGain(); master.gain.value = vol; // volume utilisateur

    lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.09; // ~11 s
    const gLfo = ctx.createGain(); gLfo.gain.value = 0.35; lfo.connect(gLfo).connect(swell.gain);
    const fLfo = ctx.createGain(); fLfo.gain.value = 280; lfo.connect(fLfo).connect(lp.frequency);

    src.connect(hp).connect(lp).connect(swell).connect(master).connect(ctx.destination);
    src.start(); lfo.start();
    built = true;
    return true;
  };

  return {
    start() { try { if (!built && build() === false) return; ctx?.resume?.(); } catch { /* Web Audio KO → silencieux */ } },
    pause() { try { ctx?.suspend?.(); } catch { /* noop */ } },
    stop() {
      try { src?.stop?.(); lfo?.stop?.(); ctx?.close?.(); } catch { /* noop */ }
      ctx = src = lfo = master = null; built = false;
    },
    setVolume(v) {
      vol = Math.max(0, Math.min(1, v));
      try { if (master && ctx) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.12); } catch { /* noop */ }
    },
  };
}
