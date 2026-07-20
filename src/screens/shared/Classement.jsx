import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, NEON, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { computePoints, nextDiv, fmtShort, rankLeaderboard, pointLabel, badgeLabel, divLabel } from "../../lib/metrics.js";
import { bilanEventsOf } from "../../data/checkins.js";
import { bannerOf, bannerGradient } from "../../lib/crews.js";
import { useTeamTop14 } from "../../data/tests.js";
import { useTeamTaskPoints } from "../../data/tasks.js";
import { useTeamChallengePoints } from "../../data/challenges.js";
import { challengeBadges, topChallengeBadge, challengeBadgeLabel } from "../../lib/challenges.js";
import { useTeamReactivity } from "../../data/notifications.js";
import { useTeamSessionLogs, useTeamCheckinEvents } from "../../data/leaderboard.js";
import { KPI, CloseX, useModalClose } from "../../lib/ui.jsx";
import { Trophy } from "../../lib/icons.jsx";

const Move = ({ m }) =>
  m === 0 ? (
    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.56)" }}>—</span>
  ) : m > 0 ? (
    <span style={{ fontSize: 11, fontWeight: 800, color: C.green }}>▲{m}</span>
  ) : (
    <span style={{ fontSize: 11, fontWeight: 800, color: C.coral }}>▼{-m}</span>
  );

/* Classement / gamification. Points dérivés de l'effectif enrichi via
   computePoints (source unique). `me` (enrichi) = vue joueur ; sinon vue staff. */
export default function Classement({ players, sessions, crews = [], me, accent = C.coral }) {
  const { t } = useTranslation();
  const isJoueur = !!me;
  const groups = [...new Set(players.map((p) => p.grp))];
  const [scope, setScope] = useState("all");
  const [mode, setMode] = useState("indiv"); // indiv | team (bascule #6)
  const [sel, setSel] = useState(null);

  // Statut Top 14 par joueur, dérivé côté serveur (SECURITY DEFINER) → visible
  // par tous (émulation collective) sans exposer les valeurs brutes des tests.
  const teamId = players[0]?.team || null;
  const top14ByPlayer = useTeamTop14(teamId);
  const taskPtsByPlayer = useTeamTaskPoints(teamId);
  const chalPtsByPlayer = useTeamChallengePoints(teamId);
  const reactByPlayer = useTeamReactivity(teamId);
  // Entrées de points À L'ÉCHELLE DU CLUB (RPC SECURITY DEFINER) → classement
  // IDENTIQUE pour owner/staff/joueur. Sans ça, un joueur (RLS = ses données
  // seules) calculait de faux points pour ses coéquipiers. On IGNORE donc les
  // props logs/activities/bilans (limités par la RLS) pour le calcul des points.
  const clubLogs = useTeamSessionLogs(teamId);
  const { activities: clubActivities, bilans: clubBilans } = useTeamCheckinEvents(teamId);

  const data = useMemo(() => {
    const all = players.map((p) => {
      const events = top14ByPlayer[p.id] || [];
      const taskEvents = (taskPtsByPlayer[p.id] || []).map((t) => ({ label: t.titre, date: t.date }));
      const reactEvents = reactByPlayer[p.id] || [];
      const bilanEvents = bilanEventsOf(clubBilans[p.id]);
      const chalPts = chalPtsByPlayer[p.id] || [];
      const challengeEvents = chalPts.map((c) => ({ label: c.titre, points: c.points, date: c.date }));
      return { p, top14: events.length, top14Tests: events, chalCount: chalPts.length, chalBadge: topChallengeBadge(chalPts.length), ...computePoints(p, sessions, clubLogs, clubActivities[p.id], events, taskEvents, reactEvents, bilanEvents, challengeEvents) };
    });
    // Rang PARTAGÉ + départage stable par nom (les ex æquo ne « sautent » plus).
    const cur = rankLeaderboard(all, { pointsOf: (d) => d.pts, labelOf: (d) => d.p.name, rankKey: "rank" });
    // Rang de la semaine précédente (pts - delta), même départage, pour la flèche ▲▼.
    const prev = [...all].sort((a, b) =>
      ((b.pts - b.weekDelta) - (a.pts - a.weekDelta)) || String(a.p.name ?? "").localeCompare(String(b.p.name ?? ""), "fr", { sensitivity: "base" }));
    const pr = {};
    prev.forEach((d, i) => (pr[d.p.id] = i));
    cur.forEach((d, i) => { d.move = pr[d.p.id] - i; });
    return cur;
  }, [players, sessions, clubLogs, clubActivities, clubBilans, top14ByPlayer, taskPtsByPlayer, chalPtsByPlayer, reactByPlayer]);

  // Classement par équipe. Agrégat = somme des points des membres actifs.
  // Priorité aux CREWS (équipes formées par les joueurs, avec bannière) ; en
  // l'absence de crew, repli sur un regroupement par ligne (avants/arrières).
  const ptsById = useMemo(() => Object.fromEntries(data.map((d) => [d.p.id, d.pts])), [data]);
  const hasCrews = crews.length > 0;
  const teams = useMemo(() => {
    if (hasCrews) {
      const rows = crews.map((c) => {
        const active = c.members.filter((m) => m.status === "active");
        const pts = active.reduce((a, m) => a + (ptsById[m.playerId] || 0), 0);
        return { key: c.id, label: c.name, banner: c.banner, pts, count: active.length };
      });
      return rows.sort((a, b) => b.pts - a.pts).map((t, i) => ({ ...t, rank: i + 1 }));
    }
    const by = {};
    data.forEach((d) => {
      const k = d.p.grp || "—";
      (by[k] = by[k] || { key: k, label: grpLabel(k) || t("shared.leaderboard.noLine"), pts: 0, count: 0 });
      by[k].pts += d.pts;
      by[k].count += 1;
    });
    return Object.values(by).sort((a, b) => b.pts - a.pts).map((tm, i) => ({ ...tm, rank: i + 1 }));
  }, [hasCrews, crews, data, ptsById, t]);

  const pool = scope === "all" ? data : data.filter((d) => d.p.grp === scope);
  // Rang partagé au sein du périmètre affiché (même départage stable par nom).
  const ranked = rankLeaderboard(pool, { pointsOf: (d) => d.pts, labelOf: (d) => d.p.name, rankKey: "scopeRank" });
  const mine = isJoueur ? data.find((d) => d.p.id === me.id) : null;
  // Mon équipe = mon crew actif si j'en ai un, sinon ma ligne.
  const myCrew = isJoueur ? crews.find((c) => c.members.some((m) => m.playerId === me.id && m.status === "active")) : null;
  const myTeamKey = isJoueur ? (hasCrews ? myCrew?.id : me.grp) : null;
  const scopeBtns = isJoueur
    ? [["all", t("shared.leaderboard.scopeAll")], [me.grp, t("shared.leaderboard.scopeMyLine", { line: grpLabel(me.grp) })]]
    : [["all", t("shared.leaderboard.scopeTeam")], ...groups.map((g) => [g, grpLabel(g)])];

  return (
    <div>
      <div style={{ borderRadius: 16, overflow: "hidden", background: NEON.panel, border: "1px solid rgba(160,120,255,0.3)", padding: "16px 18px", marginBottom: 12, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Trophy size={26} color={NEON.cyan} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 900, fontStyle: "italic", letterSpacing: 0.5, lineHeight: 1 }}>{t("shared.leaderboard.title")}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{t("shared.leaderboard.subtitle", { count: data.length })}</div>
          </div>
          {isJoueur && mine && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 30, fontWeight: 900, fontStyle: "italic", color: NEON.yellow, lineHeight: 1 }}>{mine.pts}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>{t("shared.leaderboard.ptsRank", { rank: mine.rank })}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["indiv", t("shared.leaderboard.modeIndiv")], ["team", t("shared.leaderboard.modeTeam")]].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", background: mode === v ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>{l}</button>
        ))}
      </div>

      {mode === "indiv" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          {scopeBtns.map(([v, l]) => <button key={v} onClick={() => setScope(v)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "7px 13px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", background: scope === v ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>{l}</button>)}
        </div>
      )}

      {mode === "indiv" && (
      <div style={{ borderRadius: 14, overflow: "hidden", background: NEON.panel, border: "1px solid rgba(160,120,255,0.25)", padding: 8 }}>
        {ranked.map((d) => {
          const meRow = isJoueur && d.p.id === me.id, top = d.scopeRank === 1;
          return (
            <div key={d.p.id} onClick={() => setSel(d)} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", alignItems: "center", gap: 8, padding: "9px 10px", marginBottom: 6, borderRadius: 9, cursor: "pointer", background: top ? "linear-gradient(90deg,rgba(39,232,214,0.9),rgba(39,232,214,0.5))" : meRow ? NEON.rowB : NEON.row, border: meRow && !top ? `1px solid ${accent}` : "1px solid transparent" }}>
              <div style={{ fontSize: d.scopeRank <= 3 ? 15 : 13, fontWeight: 900, fontStyle: "italic", textAlign: "center", color: top ? "#0c2b2b" : d.scopeRank === 2 ? "#C8D2E0" : d.scopeRank === 3 ? "#F2C84B" : "rgba(255,255,255,0.65)" }}>{top ? "#1" : d.scopeRank + "ᵉ"}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: top ? "#0c2b2b" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meRow ? "⭐ " + displayName(d.p) : displayName(d.p)}</span>
                  {d.top14 > 0 && <span title={t("shared.leaderboard.top14Title", { count: d.top14 })} style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 900, letterSpacing: 0.3, color: "#0c2b2b", background: `linear-gradient(90deg, ${C.amb}, #ffd873)`, borderRadius: 5, padding: "2px 6px", boxShadow: "0 0 8px rgba(240,180,60,0.5)" }}>🏆 TOP 14{d.top14 > 1 ? ` ×${d.top14}` : ""}</span>}{/* i18n-ok: nom de ligue */}
                  {d.chalBadge && <span title={t("shared.leaderboard.chalTitle", { count: d.chalCount, badge: challengeBadgeLabel(t, d.chalBadge) })} style={{ flexShrink: 0, fontSize: 11 }}>{d.chalBadge.emoji}{d.chalCount > 1 ? <span style={{ fontSize: 8.5, fontWeight: 800, color: top ? "#0c2b2b" : "rgba(255,255,255,0.6)" }}>×{d.chalCount}</span> : null}</span>}
                </div>
                <div style={{ fontSize: 9.5, color: top ? "rgba(12,43,43,0.7)" : "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}><span>{d.div.e} {divLabel(t, d.div)}</span>{d.streak >= 3 && <span>🔥{d.streak}</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Move m={d.move} />
                <span style={{ fontSize: 10, fontWeight: 800, color: d.weekDelta >= 0 ? (top ? "#0c5c3a" : "#5BE39A") : (top ? "#9c2b1b" : "#FF8A78") }}>{d.weekDelta >= 0 ? "+" : ""}{d.weekDelta}</span>
              </div>
              <div style={{ minWidth: 60, textAlign: "right", fontSize: 19, fontWeight: 900, fontStyle: "italic", color: top ? "#0c2b2b" : NEON.yellow }}>{d.pts}<span style={{ fontSize: 9, fontWeight: 700 }}> {t("shared.leaderboard.ptsUnit")}</span></div>
            </div>
          );
        })}
      </div>
      )}

      {mode === "team" && (
        <div style={{ borderRadius: 14, overflow: "hidden", background: NEON.panel, border: "1px solid rgba(160,120,255,0.25)", padding: 8 }}>
          {teams.map((tm) => {
            const meT = tm.key === myTeamKey, top = tm.rank === 1;
            return (
              <div key={tm.key} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", alignItems: "center", gap: 8, padding: "11px 10px", marginBottom: 6, borderRadius: 9, background: top ? "linear-gradient(90deg,rgba(39,232,214,0.9),rgba(39,232,214,0.5))" : meT ? NEON.rowB : NEON.row, border: meT && !top ? `1px solid ${accent}` : "1px solid transparent" }}>
                <div style={{ fontSize: tm.rank <= 3 ? 15 : 13, fontWeight: 900, fontStyle: "italic", textAlign: "center", color: top ? "#0c2b2b" : "rgba(255,255,255,0.65)" }}>{top ? "#1" : tm.rank + "ᵉ"}</div>
                <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                  {tm.banner && <div style={{ width: 30, height: 30, borderRadius: 9, background: bannerGradient(tm.banner), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, boxShadow: "inset 0 0 12px rgba(0,0,0,0.25)" }}>{bannerOf(tm.banner).emoji}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: top ? "#0c2b2b" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meT ? "⭐ " + tm.label : tm.label}</div>
                    <div style={{ fontSize: 9.5, color: top ? "rgba(12,43,43,0.7)" : "rgba(255,255,255,0.5)" }}>{t("shared.leaderboard.teamMembers", { count: tm.count, avg: tm.count ? Math.round(tm.pts / tm.count) : 0 })}</div>
                  </div>
                </div>
                <div style={{ minWidth: 60, textAlign: "right", fontSize: 19, fontWeight: 900, fontStyle: "italic", color: top ? "#0c2b2b" : NEON.yellow }}>{tm.pts}<span style={{ fontSize: 9, fontWeight: 700 }}> {t("shared.leaderboard.ptsUnit")}</span></div>
              </div>
            );
          })}
          {teams.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center", padding: 18 }}>{t("shared.leaderboard.teamEmpty")}</div>}
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "6px 8px 2px", lineHeight: 1.5 }}>
            {hasCrews ? t("shared.leaderboard.teamFooterCrews") : t("shared.leaderboard.teamFooterLines")}
          </div>
        </div>
      )}

      {mode === "indiv" && isJoueur && mine && (() => {
        const nx = nextDiv(mine.pts), cur = mine.div, lo = cur.min, hi = nx ? nx.min : mine.pts + 1;
        const prog = Math.min(100, Math.max(6, ((mine.pts - lo) / (hi - lo)) * 100));
        return (
          <div style={sc({ marginTop: 12, borderLeft: `4px solid ${cur.c}` })}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 26 }}>{cur.e}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: cur.c }}>{t("shared.leaderboard.division", { level: divLabel(t, cur) })}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{nx ? t("shared.leaderboard.toNext", { pts: hi - mine.pts, next: divLabel(t, nx) }) : t("shared.leaderboard.maxDiv")}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: mine.weekDelta >= 0 ? C.green : C.coral }}>{t("shared.leaderboard.weekPts", { delta: `${mine.weekDelta >= 0 ? "+" : ""}${mine.weekDelta}` })}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{t("shared.leaderboard.thisWeek")}</div>
              </div>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: 7, width: `${prog}%`, background: cur.c, borderRadius: 4 }} />
            </div>
            {mine.badges.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {mine.badges.map((b) => <span key={b.key} style={{ fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 9px" }}>{b.e} {badgeLabel(t, b)}</span>)}
              </div>
            )}
            <button onClick={() => setSel(mine)} style={{ marginTop: 10, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t("shared.leaderboard.seeGains")}</button>
          </div>
        );
      })()}

      {sel && <PlayerPointsDetail sel={sel} accent={accent} onClose={() => setSel(null)} />}
    </div>
  );
}

/* Détail des points d'un joueur (delta, série, journal) — modal. */
function PlayerPointsDetail({ sel, accent, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, margin: "0 auto", background: C.panel, borderRadius: 18, padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 24 }}>{sel.div.e}</span><div><div style={{ fontSize: 16, fontWeight: 800 }}>{displayName(sel.p)}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("shared.leaderboard.detailSub", { rank: sel.rank, div: divLabel(t, sel.div), pts: sel.pts })}</div></div></div>
          <CloseX onClose={onClose} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
          <KPI label={t("shared.leaderboard.kpiDelta")} value={`${sel.weekDelta >= 0 ? "+" : ""}${sel.weekDelta}`} color={sel.weekDelta >= 0 ? C.green : C.coral} />
          <KPI label={t("shared.leaderboard.kpiStreak")} value={sel.streak} sub={t("shared.leaderboard.kpiStreakSub")} color={accent} />
          <KPI label={t("shared.leaderboard.kpiSessions")} value={sel.doneCount} sub={t("shared.leaderboard.kpiSessionsSub", { count: sel.missedCount })} />
        </div>
        {sel.top14Tests?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.amb, letterSpacing: 1, marginBottom: 8 }}>{t("shared.leaderboard.top14Section", { count: sel.top14Tests.length })}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sel.top14Tests.map((e) => (
                <span key={e.key} style={{ fontSize: 10.5, fontWeight: 800, color: "#0c2b2b", background: C.amb, borderRadius: 6, padding: "3px 9px" }}>{t("data.top14test." + e.key)}</span>
              ))}
            </div>
          </div>
        )}
        {sel.chalCount > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.viol, letterSpacing: 1, marginBottom: 8 }}>{t("shared.leaderboard.chalSection", { count: sel.chalCount })}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {challengeBadges(sel.chalCount).map((b) => (
                <span key={b.n} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(108,92,224,0.25)", border: `1px solid ${C.viol}66`, borderRadius: 6, padding: "3px 9px" }}>{b.emoji} {challengeBadgeLabel(t, b)}</span>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 8 }}>{t("shared.leaderboard.journalTitle")}</div>
        {sel.ev.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("shared.leaderboard.noMovement")}</div>}
        {sel.ev.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: e.v >= 0 ? C.green : C.coral }} /><span style={{ fontSize: 12 }}>{pointLabel(t, e)}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 9, color: "rgba(255,255,255,0.56)" }}>{fmtShort(e.date)}</span><span style={{ fontSize: 13, fontWeight: 800, color: e.v >= 0 ? C.green : C.coral }}>{e.v >= 0 ? "+" : ""}{e.v}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
