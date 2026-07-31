import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { displayName } from "../../../lib/identity.js";
import { Trophy } from "../../../lib/icons.jsx";
import { useTeamActivityFeed } from "../../../data/teamFeed.js";
import { useClubLeaderboard } from "../../../data/clubPoints.js";

const AV = ["#2C8C5A", "#3E4CA8", "#6C5CE0", "#C9851F", "#1C7293"];

/* « Le groupe aujourd'hui » — X/N ont validé leur journée (fait d'activité,
   pseudonymisé), avatars des joueurs, et l'écart chiffré avec le joueur devant
   au classement (barème existant). Aucune donnée de santé. */
export default function AccueilTeam({ me, teamId, players = [], sessions = [], today, onNavigate }) {
  const { t } = useTranslation();
  const { items } = useTeamActivityFeed(teamId);
  const { list, rankById } = useClubLeaderboard(teamId, players, sessions);
  const byId = useMemo(() => Object.fromEntries((players || []).map((p) => [p.id, p])), [players]);

  // Effectif « comptable » : membres actifs, hors démo.
  const roster = useMemo(() => (players || []).filter((p) => p.membership_status !== "rejected" && !p.is_demo), [players]);

  // Ont validé aujourd'hui = au moins un fait d'activité daté d'aujourd'hui.
  const validated = useMemo(() => {
    const s = new Set();
    (items || []).forEach((it) => { if (it.at && String(it.at).slice(0, 10) === today) s.add(it.playerId); });
    return s;
  }, [items, today]);

  const validatedList = roster.filter((p) => validated.has(p.id));
  const n = validated.size, total = roster.length || 0;

  const myRank = rankById[me?.id] || null;
  const myIdx = list.findIndex((r) => r.id === me?.id);
  const above = myIdx > 0 ? list[myIdx - 1] : null;
  const gap = above ? Math.max(0, above.pts - list[myIdx].pts) : 0;

  const avatarText = (p) => (p?.initials || (p?.name || "?").slice(0, 2)).toUpperCase();

  return (
    <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: C.green, marginBottom: 3 }}>{me?.club || t("player.accueil.teamKicker")}</div>
          <div style={{ fontSize: 21, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.2 }}>{t("player.accueil.teamTitle")}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.green, lineHeight: 0.9 }}>{n}<span style={{ fontSize: 15, color: "rgba(255,255,255,0.34)" }}>/{total}</span></div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.34)" }}>{t("player.accueil.validated")}</div>
        </div>
      </div>

      {validatedList.length > 0 && (
        <div style={{ display: "flex", alignItems: "center" }}>
          {validatedList.slice(0, 5).map((p, i) => (
            <span key={p.id} style={{ width: 32, height: 32, borderRadius: 16, marginLeft: i ? -9 : 0, border: "2px solid #2A2450", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: AV[i % AV.length], flexShrink: 0 }}>{avatarText(p)}</span>
          ))}
          {validatedList.length > 5 && (
            <span style={{ width: 32, height: 32, borderRadius: 16, marginLeft: -9, border: "2px solid #2A2450", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>+{validatedList.length - 5}</span>
          )}
        </div>
      )}

      <button onClick={() => onNavigate && onNavigate("classement")} style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 12, paddingTop: 12, width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.border}`, cursor: "pointer" }}>
        <Trophy size={17} color={C.amb} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.56)", flex: 1 }}>
          {myRank ? (
            above
              ? <>{t("player.accueil.rankYouAre", { rank: myRank })} <b style={{ color: "#fff", fontWeight: 800 }}>{t("player.accueil.gapPts", { n: gap })}</b> {t("player.accueil.gapFrom", { name: displayName(byId[above.id]) })}</>
              : <>{t("player.accueil.rankLeader")}</>
          ) : t("player.accueil.rankUnknown")}
        </span>
      </button>
    </div>
  );
}
