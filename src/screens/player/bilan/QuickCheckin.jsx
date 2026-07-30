import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { wbToWellness, computeReadiness } from "../../../lib/metrics.js";
import { Ring } from "../../../lib/ui.jsx";
import { CheckCircle } from "../../../lib/icons.jsx";
import { saveCheckin } from "../../../data/checkins.js";
import {
  QUICK_MIN, QUICK_MAX, clampQuick, quickCheckinPayload,
  wbToQuick, checkinStreak,
} from "../../../lib/checkinScale.js";

/* Check-in du matin par GLISSEMENT — tête de l'écran « Aujourd'hui ».
   Un seul geste (1–5) → bilan du matin enregistré (daily_checkins, moment
   'matin'), +10 pts (barème existant `bilanMorning`, inchangé). Après
   validation, la carte se replie sur l'anneau de readiness + un verdict court.
   Le formulaire détaillé (6 marqueurs) reste accessible via « détailler ».

   Accessibilité : la piste est un role="slider" pilotable au clavier
   (flèches / Home / End, Entrée/Espace pour valider) ET doublée de 5 boutons
   ≥44px (un appui = valeur + enregistrement). `prefers-reduced-motion` coupe
   les transitions de remplissage. */
export default function QuickCheckin({ me, accent = C.green, day, checkins = [], today, preview, onSaved, onDetail }) {
  const { t } = useTranslation();
  const matin = day?.matin || null;
  const done = !!matin;

  // Valeur affichée : geste en cours (drag/clavier) sinon reflet du bilan sauvé.
  const [val, setVal] = useState(() => wbToQuick(matin?.wb) ?? 3);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const trackRef = useRef(null);

  useEffect(() => { if (done) setVal(wbToQuick(matin.wb) ?? 3); }, [done, matin]);

  // Série de check-in (jours consécutifs) — dérivée des lignes déjà chargées.
  const streak = useMemo(() => checkinStreak(checkins, today), [checkins, today]);

  // Readiness du bilan sauvé (formules inchangées ; sleep_h éventuellement null).
  const readiness = useMemo(() => {
    if (!matin?.wb) return 0;
    return computeReadiness(wbToWellness(matin.wb, matin.sleepH) || 0, me.risque, matin.sleepH);
  }, [matin, me.risque]);
  const rColor = readiness > 70 ? C.green : readiness > 50 ? C.amb : C.coral;
  const verdictKey = readiness > 70 ? "high" : readiness > 50 ? "mid" : "low";

  const commit = async (v) => {
    if (preview || busy) return;
    const q = clampQuick(v);
    setVal(q);
    setBusy(true); setErr("");
    try {
      await saveCheckin(me.id, quickCheckinPayload(q, matin), undefined, "matin");
      onSaved?.();
    } catch (e) {
      setErr(e.message || t("player.bilan.saveFail"));
    }
    setBusy(false);
  };

  // Position 0–1 d'un pointeur sur la piste → valeur 1–5 (pas de valeur 0).
  const valFromClientX = (clientX) => {
    const el = trackRef.current; if (!el) return val;
    const r = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return clampQuick(QUICK_MIN + Math.round(ratio * (QUICK_MAX - QUICK_MIN)));
  };

  const onPointerDown = (e) => {
    if (preview) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setVal(valFromClientX(e.clientX));
  };
  const onPointerMove = (e) => { if (dragging) setVal(valFromClientX(e.clientX)); };
  const onPointerUp = (e) => { if (!dragging) return; setDragging(false); commit(valFromClientX(e.clientX)); };

  const onKeyDown = (e) => {
    if (preview) return;
    let v = val;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") v = clampQuick(val + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = clampQuick(val - 1);
    else if (e.key === "Home") v = QUICK_MIN;
    else if (e.key === "End") v = QUICK_MAX;
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commit(val); return; }
    else return;
    e.preventDefault();
    setVal(v);
  };

  const scaleLabel = (v) => t(`player.checkin.scale.${v}`);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fillPct = ((val - QUICK_MIN) / (QUICK_MAX - QUICK_MIN)) * 100;

  // ── État « fait » : anneau readiness + verdict + accès au détail ──
  if (done && !dragging) {
    return (
      <div style={card()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Ring val={readiness} max={100} color={rColor} label={t("player.bilan.readiness")} size={62} sw={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{t(`player.checkin.verdict.${verdictKey}`)}</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {t("player.checkin.doneSub", { pts: 10 })}
              {streak > 1 ? ` · ${t("player.checkin.streak", { count: streak })}` : ""}
            </div>
            <button onClick={onDetail} style={linkBtn}>{t("player.checkin.detail")}</button>
          </div>
          <CheckCircle size={20} color={C.green} />
        </div>
      </div>
    );
  }

  // ── Curseur (non fait, ou geste en cours) ──
  return (
    <div style={card(true)}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{t("player.checkin.question")}</div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{t("player.checkin.promise", { pts: 10 })}</div>

      {/* Piste glissable (slider accessible) */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={preview ? -1 : 0}
        aria-label={t("player.checkin.sliderAria")}
        aria-valuemin={QUICK_MIN}
        aria-valuemax={QUICK_MAX}
        aria-valuenow={val}
        aria-valuetext={`${val} — ${scaleLabel(val)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: "relative", marginTop: 14, height: 72, borderRadius: 16,
          background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
          overflow: "hidden", touchAction: "none", cursor: preview ? "default" : "grab",
          userSelect: "none", outline: "none",
        }}
      >
        <div style={{
          position: "absolute", inset: 0, width: `${fillPct}%`,
          background: `linear-gradient(90deg, ${C.coral}, ${C.amb} 55%, ${C.green})`,
          transition: (dragging || reduce) ? "none" : "width .22s ease",
        }} />
        {/* Séparateurs des 5 crans */}
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(5,1fr)" }}>
          {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ borderRight: i < 4 ? `1px solid ${C.border2}` : "none" }} />)}
        </div>
        {/* Bouton (valeur en gros) */}
        <div aria-hidden style={{
          position: "absolute", top: 7, bottom: 7, width: 58,
          left: `calc(${fillPct}% - ${(fillPct / 100) * 58}px)`,
          borderRadius: 12, background: "#fff", color: C.navy,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, fontWeight: 900, boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          transition: (dragging || reduce) ? "none" : "left .22s ease, transform .12s ease",
          transform: dragging ? "scale(1.06)" : "none",
        }}>{val}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
        <span>{t("player.checkin.legendLow")}</span>
        <span>{t("player.checkin.legendHigh")}</span>
      </div>

      {/* Alternative accessible : 5 boutons (un appui = valeur + enregistrement) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 12 }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" onClick={() => commit(v)} disabled={preview || busy}
            aria-label={`${v} — ${scaleLabel(v)}`}
            style={{
              minHeight: 44, borderRadius: 11, cursor: preview || busy ? "default" : "pointer",
              background: v === val ? accent : "rgba(255,255,255,0.06)",
              border: `1.5px solid ${v === val ? accent : C.border}`,
              color: v === val ? "#fff" : "rgba(255,255,255,0.8)",
              fontSize: 15, fontWeight: 800,
            }}>{v}</button>
        ))}
      </div>

      {err && <div style={{ fontSize: 11, color: C.coral, marginTop: 8, textAlign: "center" }}>{err}</div>}
      <button onClick={onDetail} style={{ ...linkBtn, marginTop: 12 }}>{t("player.checkin.detail")}</button>
    </div>
  );
}

const card = (accentBorder) => ({
  background: C.card,
  border: `1px solid ${accentBorder ? `${C.coral}55` : C.border}`,
  borderRadius: 14,
  padding: 16,
  marginBottom: 14,
});
const linkBtn = { background: "none", border: "none", padding: 0, marginTop: 8, color: C.coral, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "block" };
