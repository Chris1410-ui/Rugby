import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { Flame, Snowflake, Check } from "../../../lib/icons.jsx";
import { isoDate, parseISO } from "../../../lib/metrics.js";
import { useStreak, freezeNight } from "../../../data/streak.js";

/* « Série » — écran Aujourd'hui, refonte Open Design.

   Jour validé = bilan du matin fait ; une nuit gelée protège la série. Le
   compteur (série / record / gels dispo / gelé ce soir) est DÉRIVÉ côté base
   (RPC streak_sync). La bandelette 7 jours et le compte à rebours sont un reflet
   visuel local : un jour « tenu » = bilan matin ce jour-là (checkins fournis) OU
   la nuit du jour gelée. Paliers 7/14/30 affichés en progression (les points de
   palier arrivent en PR-5 — ici on ne fait qu'indiquer l'objectif). */

const TIERS = [7, 14, 30];

export default function AccueilStreak({ me, checkins = [], today, preview = false }) {
  const { t } = useTranslation();
  const { streak, best, freezesAvailable, frozenTonight, loading, refresh } = useStreak(me?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Jours « tenus » (reflet visuel) : dates de bilan matin.
  const heldMornings = useMemo(() => {
    const s = new Set();
    (checkins || []).forEach((c) => { if (c.moment === "matin") s.add(c.date); });
    return s;
  }, [checkins]);

  // Bandelette : 7 derniers jours finissant aujourd'hui.
  const strip = useMemo(() => {
    const b = parseISO(today);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(b); dt.setDate(b.getDate() - (6 - i));
      const iso = isoDate(dt);
      const isToday = iso === today;
      const held = heldMornings.has(iso) || (isToday && frozenTonight);
      const frozen = isToday && frozenTonight && !heldMornings.has(iso);
      return { iso, isToday, held, frozen, dow: dt.getDay() };
    });
  }, [today, heldMornings, frozenTonight]);

  const validatedToday = heldMornings.has(today);
  const secured = validatedToday || frozenTonight;

  // Compte à rebours jusqu'à minuit local (reset du jour, lot 1). Uniquement
  // pertinent si la journée n'est pas encore sécurisée et qu'une série est en jeu.
  const hoursLeft = useMemo(() => {
    if (secured) return null;
    const now = new Date();
    const mid = new Date(now); mid.setHours(24, 0, 0, 0);
    return Math.max(0, Math.ceil((mid - now) / 36e5));
  }, [secured]);

  // Prochain palier (progression visuelle vers 7/14/30).
  const nextTier = TIERS.find((n) => n > streak) || null;
  const prevTier = [...TIERS].reverse().find((n) => n <= streak) || 0;
  const tierPct = nextTier ? Math.min(100, ((streak - prevTier) / (nextTier - prevTier)) * 100) : 100;

  const canFreeze = !preview && !secured && freezesAvailable > 0;

  const onFreeze = async () => {
    if (!canFreeze || busy) return;
    setBusy(true); setErr(null);
    try {
      await freezeNight(today);
      await refresh();
    } catch (e) {
      const code = e?.message || "";
      setErr(["already_validated", "already_frozen", "no_freeze", "bad_night"].includes(code) ? code : "generic");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 26, background: streak > 0 ? "rgba(232,85,59,0.16)" : "rgba(255,255,255,0.05)", border: `1px solid ${streak > 0 ? C.coral + "55" : C.border}` }}>
          <Flame size={26} color={streak > 0 ? C.coral : "rgba(255,255,255,0.35)"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: C.coral, marginBottom: 2 }}>{t("player.accueil.streakKicker")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 0.9 }}>{loading ? "—" : streak}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{t("player.accueil.streakDays", { count: streak })}</span>
          </div>
        </div>
        {best > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.amb, lineHeight: 1 }}>{best}</div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>{t("player.accueil.streakBest")}</div>
          </div>
        )}
      </div>

      {/* Bandelette 7 jours */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        {strip.map((d) => (
          <div key={d.iso} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.3, color: d.isToday ? "#fff" : "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{t(`player.accueil.dow.${d.dow}`)}</span>
            <div style={{ width: "100%", height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: d.held ? (d.frozen ? "rgba(28,114,147,0.22)" : "rgba(44,140,90,0.22)") : "rgba(255,255,255,0.05)", border: `1.5px solid ${d.isToday ? (d.held ? "transparent" : C.coral + "88") : "transparent"}`, boxShadow: d.held ? `inset 0 0 0 1px ${d.frozen ? C.teal + "55" : C.green + "55"}` : "none" }}>
              {d.frozen ? <Snowflake size={13} color={C.teal} /> : d.held ? <Check size={13} color={C.green} /> : d.isToday ? <span style={{ width: 5, height: 5, borderRadius: 3, background: C.coral }} /> : <span style={{ width: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)" }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Progression vers le prochain palier */}
      {nextTier && (
        <div style={{ marginBottom: secured || canFreeze ? 14 : 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{t("player.accueil.streakNextTier", { n: nextTier })}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: C.coral }}>{Math.max(0, nextTier - streak)} {t("player.accueil.streakToGo")}</span>
          </div>
          <div style={{ height: 7, borderRadius: 5, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${tierPct}%`, background: `linear-gradient(90deg, ${C.coral}, ${C.amb})`, borderRadius: 5, transition: "width .4s ease" }} />
          </div>
        </div>
      )}

      {/* État du jour : sécurisé, ou compte à rebours + gel disponible */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
        {secured ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: C.green, display: "flex", alignItems: "center", gap: 7 }}>
            {frozenTonight && !validatedToday ? <Snowflake size={15} color={C.teal} /> : <Check size={15} color={C.green} />}
            {frozenTonight && !validatedToday ? t("player.accueil.streakFrozenTonight") : t("player.accueil.streakSecured")}
          </span>
        ) : (
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
            {streak > 0 && hoursLeft != null
              ? t("player.accueil.streakDeadline", { h: hoursLeft })
              : t("player.accueil.streakStart")}
          </span>
        )}
        {!secured && (
          <button onClick={onFreeze} disabled={!canFreeze || busy} title={freezesAvailable > 0 ? undefined : t("player.accueil.streakNoFreeze")}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", minHeight: 44, borderRadius: 11, cursor: canFreeze && !busy ? "pointer" : "not-allowed", background: canFreeze ? "rgba(28,114,147,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${canFreeze ? C.teal + "66" : C.border}`, color: canFreeze ? C.teal : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 800 }}>
            <Snowflake size={15} />
            {t("player.accueil.streakFreeze")}
            <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.8 }}>{freezesAvailable}</span>
          </button>
        )}
      </div>

      {err && (
        <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: C.coral }}>
          {t(`player.accueil.streakErr.${err}`, t("player.accueil.streakErr.generic"))}
        </div>
      )}
    </div>
  );
}
