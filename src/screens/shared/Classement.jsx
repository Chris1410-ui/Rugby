import { useMemo, useState } from "react";
import { C, NEON, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { computePoints, nextDiv, fmtShort } from "../../lib/metrics.js";
import { KPI } from "../../lib/ui.jsx";
import { Trophy, X } from "../../lib/icons.jsx";

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
export default function Classement({ players, sessions, logs, activities = {}, me, accent = C.coral }) {
  const isJoueur = !!me;
  const groups = [...new Set(players.map((p) => p.grp))];
  const [scope, setScope] = useState("all");
  const [mode, setMode] = useState("indiv"); // indiv | team (bascule #6)
  const [sel, setSel] = useState(null);

  const data = useMemo(() => {
    const all = players.map((p) => ({ p, ...computePoints(p, sessions, logs, activities[p.id]) }));
    const cur = [...all].sort((a, b) => b.pts - a.pts);
    const prev = [...all].sort((a, b) => b.pts - b.weekDelta - (a.pts - a.weekDelta));
    const pr = {};
    prev.forEach((d, i) => (pr[d.p.id] = i));
    cur.forEach((d, i) => { d.rank = i + 1; d.move = pr[d.p.id] - i; });
    return cur;
  }, [players, sessions, logs, activities]);

  // Classement par équipe (#6). Agrégat = somme des points des membres. En
  // attendant les crews (équipes formées par les joueurs), on regroupe par
  // ligne (avants / arrières) — la logique d'agrégat est réutilisable telle
  // quelle une fois les crews en place.
  const teams = useMemo(() => {
    const by = {};
    data.forEach((d) => {
      const k = d.p.grp || "—";
      (by[k] = by[k] || { key: k, label: grpLabel(k) || "Sans ligne", pts: 0, count: 0, weekDelta: 0 });
      by[k].pts += d.pts;
      by[k].weekDelta += d.weekDelta;
      by[k].count += 1;
    });
    return Object.values(by).sort((a, b) => b.pts - a.pts).map((t, i) => ({ ...t, rank: i + 1 }));
  }, [data]);

  const pool = scope === "all" ? data : data.filter((d) => d.p.grp === scope);
  const ranked = pool.map((d, i) => ({ ...d, scopeRank: i + 1 }));
  const mine = isJoueur ? data.find((d) => d.p.id === me.id) : null;
  const myTeamKey = isJoueur ? me.grp : null;
  const scopeBtns = isJoueur
    ? [["all", "Toute l'équipe"], [me.grp, "Ma ligne · " + grpLabel(me.grp)]]
    : [["all", "Équipe"], ...groups.map((g) => [g, grpLabel(g)])];

  return (
    <div>
      <div style={{ borderRadius: 16, overflow: "hidden", background: NEON.panel, border: "1px solid rgba(160,120,255,0.3)", padding: "16px 18px", marginBottom: 12, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Trophy size={26} color={NEON.cyan} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 900, fontStyle: "italic", letterSpacing: 0.5, lineHeight: 1 }}>CLASSEMENT</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>Saison interne · {data.length} joueurs</div>
          </div>
          {isJoueur && mine && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 30, fontWeight: 900, fontStyle: "italic", color: NEON.yellow, lineHeight: 1 }}>{mine.pts}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>PTS · #{mine.rank}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["indiv", "Individuel"], ["team", "Par équipe"]].map(([v, l]) => (
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
                <div style={{ fontSize: 13, fontWeight: 800, color: top ? "#0c2b2b" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meRow ? "⭐ " + d.p.name : d.p.name}</div>
                <div style={{ fontSize: 9.5, color: top ? "rgba(12,43,43,0.7)" : "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}><span>{d.div.e} {d.div.l}</span>{d.streak >= 3 && <span>🔥{d.streak}</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Move m={d.move} />
                <span style={{ fontSize: 10, fontWeight: 800, color: d.weekDelta >= 0 ? (top ? "#0c5c3a" : "#5BE39A") : (top ? "#9c2b1b" : "#FF8A78") }}>{d.weekDelta >= 0 ? "+" : ""}{d.weekDelta}</span>
              </div>
              <div style={{ minWidth: 60, textAlign: "right", fontSize: 19, fontWeight: 900, fontStyle: "italic", color: top ? "#0c2b2b" : NEON.yellow }}>{d.pts}<span style={{ fontSize: 9, fontWeight: 700 }}> PTS</span></div>
            </div>
          );
        })}
      </div>
      )}

      {mode === "team" && (
        <div style={{ borderRadius: 14, overflow: "hidden", background: NEON.panel, border: "1px solid rgba(160,120,255,0.25)", padding: 8 }}>
          {teams.map((t) => {
            const meT = t.key === myTeamKey, top = t.rank === 1;
            return (
              <div key={t.key} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", alignItems: "center", gap: 8, padding: "11px 10px", marginBottom: 6, borderRadius: 9, background: top ? "linear-gradient(90deg,rgba(39,232,214,0.9),rgba(39,232,214,0.5))" : meT ? NEON.rowB : NEON.row, border: meT && !top ? `1px solid ${accent}` : "1px solid transparent" }}>
                <div style={{ fontSize: t.rank <= 3 ? 15 : 13, fontWeight: 900, fontStyle: "italic", textAlign: "center", color: top ? "#0c2b2b" : "rgba(255,255,255,0.65)" }}>{top ? "#1" : t.rank + "ᵉ"}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: top ? "#0c2b2b" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meT ? "⭐ " + t.label : t.label}</div>
                  <div style={{ fontSize: 9.5, color: top ? "rgba(12,43,43,0.7)" : "rgba(255,255,255,0.5)" }}>{t.count} joueur{t.count > 1 ? "s" : ""} · moy. {t.count ? Math.round(t.pts / t.count) : 0} pts</div>
                </div>
                <div style={{ minWidth: 60, textAlign: "right", fontSize: 19, fontWeight: 900, fontStyle: "italic", color: top ? "#0c2b2b" : NEON.yellow }}>{t.pts}<span style={{ fontSize: 9, fontWeight: 700 }}> PTS</span></div>
              </div>
            );
          })}
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "6px 8px 2px", lineHeight: 1.5 }}>Regroupé par ligne. Bientôt : vos propres équipes (crews) formées entre joueurs.</div>
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
                <div style={{ fontSize: 15, fontWeight: 800, color: cur.c }}>Division {cur.l}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{nx ? `Encore ${hi - mine.pts} pts → ${nx.l}` : "Division maximale atteinte"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: mine.weekDelta >= 0 ? C.green : C.coral }}>{mine.weekDelta >= 0 ? "+" : ""}{mine.weekDelta} pts</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>cette semaine</div>
              </div>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: 7, width: `${prog}%`, background: cur.c, borderRadius: 4 }} />
            </div>
            {mine.badges.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {mine.badges.map((b) => <span key={b.l} style={{ fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 9px" }}>{b.e} {b.l}</span>)}
              </div>
            )}
            <button onClick={() => setSel(mine)} style={{ marginTop: 10, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Voir mes gains / pertes</button>
          </div>
        );
      })()}

      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => setSel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, margin: "0 auto", background: C.panel, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 24 }}>{sel.div.e}</span><div><div style={{ fontSize: 16, fontWeight: 800 }}>{sel.p.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>#{sel.rank} · Division {sel.div.l} · {sel.pts} pts</div></div></div>
              <X size={20} color="rgba(255,255,255,0.5)" onClick={() => setSel(null)} style={{ cursor: "pointer" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              <KPI label="DELTA SEMAINE" value={`${sel.weekDelta >= 0 ? "+" : ""}${sel.weekDelta}`} color={sel.weekDelta >= 0 ? C.green : C.coral} />
              <KPI label="SÉRIE" value={sel.streak} sub="séances" color={accent} />
              <KPI label="SÉANCES OK" value={sel.doneCount} sub={`${sel.missedCount} manquées`} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 8 }}>JOURNAL DES POINTS</div>
            {sel.ev.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Aucun mouvement récent.</div>}
            {sel.ev.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: e.v >= 0 ? C.green : C.coral }} /><span style={{ fontSize: 12 }}>{e.label}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 9, color: "rgba(255,255,255,0.56)" }}>{fmtShort(e.date)}</span><span style={{ fontSize: 13, fontWeight: 800, color: e.v >= 0 ? C.green : C.coral }}>{e.v >= 0 ? "+" : ""}{e.v}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
