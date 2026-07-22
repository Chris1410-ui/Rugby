/* Fond sonore de VAGUES LÉGÈRES synthétisé (Web Audio API) — aucun fichier requis.
   Recette : bruit brun bouclé → passe-haut + passe-bas → « houle » lente (un LFO
   ~11 s module le volume ET la coupure du filtre → le « shhh » monte sur la crête).
   Volume volontairement bas, pour masquer la friture de la voix sans la couvrir.
   API : start() / pause() / stop() / setEnabled(bool). Silencieux si Web Audio
   indisponible (vieux navigateur) — la voix reste. */
export function createOceanWaves() {
  let ctx = null, src = null, lfo = null, mute = null, built = false;

  const build = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    // Bruit brun (4 s) bouclé → grondement doux et grave.
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;

    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 480; lp.Q.value = 0.6;

    // Houle : gain qui respire autour d'une base basse + coupure qui s'ouvre sur la crête.
    const swell = ctx.createGain(); swell.gain.value = 0.09;   // base « léger »
    mute = ctx.createGain(); mute.gain.value = 1;              // interrupteur global

    lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.09; // ~11 s
    const gLfo = ctx.createGain(); gLfo.gain.value = 0.06; lfo.connect(gLfo).connect(swell.gain);
    const fLfo = ctx.createGain(); fLfo.gain.value = 260; lfo.connect(fLfo).connect(lp.frequency);

    src.connect(hp).connect(lp).connect(swell).connect(mute).connect(ctx.destination);
    src.start(); lfo.start();
    built = true;
    return true;
  };

  return {
    start() {
      try { if (!built && build() === false) return; ctx?.resume?.(); } catch { /* Web Audio KO → silencieux */ }
    },
    pause() { try { ctx?.suspend?.(); } catch { /* noop */ } },
    stop() {
      try { src?.stop?.(); lfo?.stop?.(); ctx?.close?.(); } catch { /* noop */ }
      ctx = src = lfo = mute = null; built = false;
    },
    setEnabled(on) {
      try { if (mute && ctx) mute.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.25); } catch { /* noop */ }
    },
  };
}
