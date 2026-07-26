import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { badgeLabel, divLabel } from "../../lib/metrics.js";
import { challengeBadges, challengeBadgeLabel } from "../../lib/challenges.js";
import { natureLabel, natureColor } from "../../lib/nature.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";

/* Profil athlète d'un STAFF-athlète, tel qu'un JOUEUR a le droit de le voir.
   Strictement limité au public (RPC team_athlete_public + classement) : points /
   division / badges, séances réalisées (nombre + nature) et routine du matin
   ✓/✗. JAMAIS de charges, tests, poids, bilans, détail de routine ni journal des
   points. `sel` = ligne enrichie du classement (avec sel.athlete = projection). */
export default function AthleteProfile({ sel, accent = C.green, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const a = sel.athlete || { sessionsDone: 0, natures: {}, routineToday: false };
  const natures = Object.entries(a.natures || {});

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: C.panel, borderRadius: 18, padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
        {/* En-tête : totem + badge staff + division + points */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 26 }}>{sel.div.e}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(sel.p)}</span>
                <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 900, letterSpacing: 0.4, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 5, padding: "1px 5px" }}>{t("shared.leaderboard.staffAthleteBadge")}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("shared.leaderboard.detailSub", { rank: sel.rank, div: divLabel(t, sel.div), pts: sel.pts })}</div>
            </div>
          </div>
          <CloseX onClose={onClose} />
        </div>

        {/* Badges (division + Top 14 + défis) */}
        {(sel.badges?.length > 0 || sel.top14 > 0 || sel.chalCount > 0) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 8 }}>{t("shared.leaderboard.athleteBadges")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sel.top14 > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0c2b2b", background: C.amb, borderRadius: 6, padding: "3px 9px" }}>🏆 TOP 14{sel.top14 > 1 ? ` ×${sel.top14}` : ""}</span>}{/* i18n-ok: nom de ligue */}
              {(sel.badges || []).map((b) => <span key={b.key} style={{ fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 9px" }}>{b.e} {badgeLabel(t, b)}</span>)}
              {sel.chalCount > 0 && challengeBadges(sel.chalCount).map((b) => <span key={b.n} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(108,92,224,0.25)", border: `1px solid ${C.viol}66`, borderRadius: 6, padding: "3px 9px" }}>{b.emoji} {challengeBadgeLabel(t, b)}</span>)}
            </div>
          </div>
        )}

        {/* Activité visible : séances réalisées (nombre + nature) + routine du jour */}
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 10 }}>{t("shared.leaderboard.athletePublicTitle")}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: natures.length ? 10 : 0 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>{t("shared.leaderboard.athleteSessionsDone", { count: a.sessionsDone })}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: a.routineToday ? accent : "rgba(255,255,255,0.5)" }}>{a.routineToday ? t("shared.leaderboard.athleteRoutineDone") : t("shared.leaderboard.athleteRoutineNone")}</span>
          </div>
          {natures.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {natures.map(([k, n]) => (
                <span key={k} style={{ fontSize: 10.5, fontWeight: 700, color: natureColor(k), background: `${natureColor(k)}20`, border: `1px solid ${natureColor(k)}44`, borderRadius: 6, padding: "2px 8px" }}>{n}× {natureLabel(t, k)}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, textAlign: "center" }}>{t("shared.leaderboard.athleteScopeNote")}</div>
      </div>
    </div>
  );
}
