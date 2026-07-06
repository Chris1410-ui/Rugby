import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel, RUGBY_POS } from "../../lib/positions.js";
import { buildAlerts, todayISO, statusOfLog, SEVC } from "../../lib/metrics.js";
import { useTeamData } from "../../data/useTeamData.js";
import { useTeamMessages } from "../../data/messages.js";
import { addPlayer } from "../../data/players.js";
import { BottomNav, Tag, Pill, KPI } from "../../lib/ui.jsx";
import { Users, Sun, Dumbbell, Plus, X, AlertOctagon, Bell } from "../../lib/icons.jsx";
import CreateSession from "./CreateSession.jsx";
import Alertes from "./Alertes.jsx";

const ACCENT = C.coral;

/* Espace staff. Une seule dérivation (useTeamData → enrichPlayers) ; tous les
   onglets lisent l'effectif enrichi. */
export default function StaffApp({ profile }) {
  const [tab, setTab] = useState("effectif");
  const { players, roster, sessions, logs, checkins, loading } = useTeamData(profile.team_id);
  const { threads } = useTeamMessages(players.map((p) => p.id));
  const unread = Object.values(threads).reduce((a, t) => a + t.unread, 0);

  const nav = [
    ["effectif", "Effectif", Users],
    ["aujourdhui", "Aujourd'hui", Sun],
    ["alertes", "Alertes", Bell, unread],
    ["seances", "Séances", Dumbbell],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <main style={{ flex: 1, padding: 18 }}>
        {tab === "effectif" && <Effectif teamId={profile.team_id} players={players} loading={loading} />}
        {tab === "aujourdhui" && <Aujourdhui players={players} sessions={sessions} logs={logs} checkins={checkins} />}
        {tab === "alertes" && <Alertes players={players} sessions={sessions} logs={logs} checkins={checkins} />}
        {tab === "seances" && <Seances teamId={profile.team_id} roster={roster} players={players} sessions={sessions} logs={logs} />}
      </main>
      <BottomNav items={nav} active={tab} onSelect={setTab} accent={ACCENT} />
    </div>
  );
}

/* ── Effectif enrichi ── */
function Effectif({ teamId, players, loading }) {
  const [adding, setAdding] = useState(false);
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Users size={18} color={ACCENT} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Effectif · {players.length}</div>
        <button onClick={() => setAdding(true)} style={{ background: ACCENT, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Ajouter
        </button>
      </div>
      {loading && !players.length ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Chargement…</div>
      ) : players.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.45)", fontSize: 12 })}>
          Aucun joueur. Ajoute le premier membre — il apparaîtra en direct sur tous les appareils du staff.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.map((p) => (
            <div key={p.id} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px" })}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.85)", width: 30, textAlign: "center" }}>{p.num ?? "—"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  {p.name}{p._live && <span title="Bilan du jour encodé" style={{ width: 6, height: 6, borderRadius: 4, background: C.green, display: "inline-block" }} />}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{p.pos} · {grpLabel(p.grp)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: p.readiness > 70 ? C.green : p.readiness > 50 ? C.amb : C.coral }}>{p.readiness}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>READY</div>
              </div>
              <Pill v={p.acwr} />
            </div>
          ))}
        </div>
      )}
      {adding && <AddPlayerModal teamId={teamId} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddPlayerModal({ teamId, onClose }) {
  const [name, setName] = useState("");
  const [posIdx, setPosIdx] = useState(0);
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10 };
  const save = async () => {
    if (!name.trim()) return setErr("Nom requis.");
    setBusy(true); setErr("");
    const [pos, grp] = RUGBY_POS[posIdx];
    try {
      await addPlayer(teamId, { name, pos, grp, num: num ? parseInt(num, 10) : null });
      onClose();
    } catch (e) { setErr(e.message || "Échec de l'ajout."); setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.panel, borderRadius: "18px 18px 0 0", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Ajouter un joueur</div>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Prénom Nom" autoFocus style={inp} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={posIdx} onChange={(e) => setPosIdx(Number(e.target.value))} style={{ ...inp, flex: 2 }}>
            {RUGBY_POS.map(([p, g], i) => <option key={i} value={i}>{p} · {grpLabel(g)}</option>)}
          </select>
          <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} placeholder="N°" inputMode="numeric" style={{ ...inp, flex: 1, textAlign: "center" }} />
        </div>
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: C.coral, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter à l'effectif"}</button>
      </div>
    </div>
  );
}

/* ── Aujourd'hui : synthèse readiness/bien-être + aperçu alertes (effectif enrichi) ── */
function Aujourdhui({ players, sessions, logs, checkins }) {
  if (!players.length) return <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.45)", fontSize: 12 })}>Aucune donnée. Ajoute des joueurs et attends les premiers bilans.</div>;
  const avg = (k) => Math.round(players.reduce((a, p) => a + (p[k] || 0), 0) / players.length);
  const live = players.filter((p) => p._live).length;
  const alerts = buildAlerts(players, sessions, logs, checkins);
  const top = alerts.slice(0, 4);
  return (
    <section>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Aujourd'hui · {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        <KPI label="READINESS MOY." value={avg("readiness")} color={avg("readiness") > 70 ? C.green : avg("readiness") > 50 ? C.amb : C.coral} />
        <KPI label="BIEN-ÊTRE MOY." value={`${avg("wellness")}/50`} color={C.blue} />
        <KPI label="BILANS DU JOUR" value={`${live}/${players.length}`} sub="encodés" color={C.viol} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <AlertOctagon size={16} color={C.coral} />
        <div style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Alertes · {alerts.length}</div>
        {alerts.length > top.length && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>→ onglet Alertes</span>}
      </div>
      {alerts.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.45)", fontSize: 12 })}>Aucune alerte. 👌</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {top.map((a, i) => (
            <div key={i} style={sc({ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderLeft: `3px solid ${SEVC[a.sev]}` })}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{a.txt}</div>
              </div>
              <Tag c={SEVC[a.sev]}>{a.cat}</Tag>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Séances : liste + compliance + création ── */
function Seances({ teamId, roster, players, sessions, logs }) {
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Dumbbell size={18} color={ACCENT} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Séances · {sessions.length}</div>
        <button onClick={() => setCreating(true)} style={{ background: ACCENT, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Créer
        </button>
      </div>
      {sessions.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.6 })}>
          Aucune séance. Crée-en une pour l'assigner à l'équipe — les joueurs pourront la logger set-par-set.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((s) => {
            const assigned = s.assignedIds.length;
            const done = s.assignedIds.filter((pid) => statusOfLog(logs, s.id, pid) === "done").length;
            const missed = s.assignedIds.filter((pid) => statusOfLog(logs, s.id, pid) === "missed").length;
            const pct = assigned ? Math.round((done / assigned) * 100) : 0;
            return (
              <div key={s.id} style={sc({ padding: "12px 13px" })}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Tag c={C.coral}>{s.code}</Tag>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.titre}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{s.date}{s.date <= today ? "" : " · à venir"} · {s.exercises.length} exercices</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: pct >= 70 ? C.green : pct >= 40 ? C.amb : C.coral }}>{done}/{assigned}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>VALIDÉES{missed ? ` · ${missed} ✗` : ""}</div>
                  </div>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: 5, width: `${pct}%`, background: pct >= 70 ? C.green : pct >= 40 ? C.amb : C.coral, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <CreateSession teamId={teamId} roster={roster} onClose={() => setCreating(false)} />}
    </section>
  );
}
