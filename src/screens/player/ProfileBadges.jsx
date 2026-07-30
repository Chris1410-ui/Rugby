import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { divLabel, todayISO } from "../../lib/metrics.js";
import { displayName } from "../../lib/identity.js";
import { deriveAchievements, weeklyLoggedSets } from "../../lib/achievements.js";
import { usePlayerStanding } from "../../data/clubPoints.js";
import { usePlayerCheckins } from "../../data/checkins.js";
import { usePlayer1RM } from "../../data/player1rm.js";

/* En-tête « Moi » — division (Bronze→Élite) + récompenses, VISUEL de la
   maquette, 100% sur des DONNÉES EXISTANTES : points = computePoints, division =
   DIVS. Deux familles de récompenses, aucune table/monnaie nouvelle :
   - « forme » : les badges déjà émis par computePoints (assidu…) ;
   - « accomplissements » : dérivés par lib/achievements.js (bien-être 7 j,
     mois complet, 1er record, import GPS, 100 séries/sem.). */

// Récompenses de FORME (miroir exact de computePoints).
const FORM_DEFS = [
  { key: "assidu", e: "🔥" },
  { key: "sansFaute", e: "✅" },
  { key: "enForme", e: "💪" },
  { key: "rigoureux", e: "📊" },
];
// Accomplissements dérivés (clés = lib/achievements.js).
const ACH_DEFS = [
  { key: "wellness7", e: "🌙" },
  { key: "monthComplete", e: "📅" },
  { key: "firstRecord", e: "🏅" },
  { key: "gpsImport", e: "📡" },
  { key: "sets100", e: "⚡" },
];
const BADGE_DEFS = [...FORM_DEFS, ...ACH_DEFS];

export default function ProfileBadges({ me, teamId, sessions = [], logs = {}, accent = C.green }) {
  const { t } = useTranslation();
  const standing = usePlayerStanding(teamId, me, sessions);
  const { checkins } = usePlayerCheckins(me?.id, 40);
  const { entries: oneRM } = usePlayer1RM(me?.id);
  const pts = standing?.pts ?? 0;
  const div = standing?.div;
  const next = standing?.next;

  const earned = useMemo(() => {
    const set = new Set((standing?.badges || []).map((b) => b.key));
    const today = todayISO();
    const weeklySets = weeklyLoggedSets(sessions, logs, me?.id, today);
    deriveAchievements({ checkins, oneRMCount: (oneRM || []).length, gpsCount: standing?.gpsCount || 0, weeklySets, todayIso: today })
      .forEach((k) => set.add(k));
    return set;
  }, [standing, checkins, oneRM, sessions, logs, me]);

  const pctToNext = next && div ? Math.max(0, Math.min(100, Math.round(((pts - div.min) / (next.min - div.min)) * 100))) : 100;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Carte division */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: `${div?.c || accent}22`, border: `1px solid ${div?.c || accent}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{div?.e || "🥉"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{displayName(me)}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: div?.c || "#fff" }}>{divLabel(t, div)}</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>{t("player.profile.points", { n: pts })}</div>
          </div>
        </div>
        {next ? (
          <>
            <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden", margin: "12px 0 6px" }}>
              <div style={{ height: "100%", width: `${pctToNext}%`, background: `linear-gradient(90deg, ${div?.c || accent}, ${next.c})`, borderRadius: 6, transition: "width .5s ease" }} />
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)" }}>{t("player.profile.toNext", { n: Math.max(0, next.min - pts), div: divLabel(t, next) })}</div>
          </>
        ) : (
          <div style={{ fontSize: 10.5, color: div?.c || accent, marginTop: 12, fontWeight: 700 }}>{t("player.profile.maxDiv")}</div>
        )}
      </div>

      {/* Récompenses */}
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", margin: "0 2px 8px" }}>{t("player.profile.rewards")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {BADGE_DEFS.map((b) => {
          const on = earned.has(b.key);
          return (
            <div key={b.key} style={{ background: C.card, border: `1px solid ${on ? `${accent}55` : C.border}`, borderRadius: 14, padding: "12px 6px", textAlign: "center", opacity: on ? 1 : 0.4 }}>
              <div style={{ width: 34, height: 34, margin: "0 auto 8px", borderRadius: "50%", background: on ? `${accent}22` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{b.e}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: on ? "#fff" : "rgba(255,255,255,0.55)", lineHeight: 1.2 }}>{t(`badges.${b.key}`)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
