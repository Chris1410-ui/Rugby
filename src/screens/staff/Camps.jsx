import { useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { todayISO, fmtShort } from "../../lib/metrics.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { Flag, Plus, Activity, Trash2 } from "../../lib/icons.jsx";
import { useTeamCamps, useCampCounts, useCampParticipants, createCamp, updateCamp, deleteCamp, inCamp } from "../../data/camps.js";
import { createSession } from "../../data/sessions.js";
import { useTestCampaigns } from "../../data/tests.js";
import TestsBatch from "./TestsBatch.jsx";
import CampParticipation from "./CampParticipation.jsx";

const accent = C.coral;
const period = (c) => `${fmtShort(c.dateDebut)} → ${fmtShort(c.dateFin)}`;

/* Onglet « Camps » (staff/owner) : périodes nommées regroupant séances,
   résultats de tests (datés par camp) et inscriptions. Ne duplique rien —
   les séances « du camp » sont celles dont la date tombe dans la fenêtre. */
export default function Camps({ teamId, players = [], sessions = [], logs = {} }) {
  const { camps } = useTeamCamps(teamId);
  const counts = useCampCounts(teamId, camps.map((c) => c.id));
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);

  const selCamp = camps.find((c) => c.id === sel) || null;

  if (selCamp) {
    return <CampDetail camp={selCamp} teamId={teamId} players={players} sessions={sessions} logs={logs} onBack={() => setSel(null)} onDeleted={() => setSel(null)} />;
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Flag size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Camps · {camps.length}</div>
        <button onClick={() => setCreating((v) => !v)} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Nouveau camp
        </button>
      </div>

      {creating && <CampForm teamId={teamId} onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {camps.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6 })}>
          Aucun camp. Crée une période nommée (ex. « Camp été – 21-28 juil ») pour regrouper séances, tests et inscriptions.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {camps.map((c) => {
            const active = inCamp(c, todayISO());
            return (
              <div key={c.id} onClick={() => setSel(c.id)} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", borderLeft: `3px solid ${active ? C.green : C.border}` })}>
                <Flag size={18} color={active ? C.green : "rgba(255,255,255,0.5)"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>{c.nom}{active && <Tag c={C.green}>en cours</Tag>}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{period(c)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.viol }}>{counts[c.id] || 0}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)" }}>INSCRITS</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CampForm({ teamId, camp, onDone, onCancel }) {
  const [nom, setNom] = useState(camp?.nom || "");
  const [dd, setDd] = useState(camp?.dateDebut || todayISO());
  const [df, setDf] = useState(camp?.dateFin || todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" };

  const save = async () => {
    if (!nom.trim()) return setErr("Donne un nom au camp.");
    if (df < dd) return setErr("La date de fin doit suivre la date de début.");
    setBusy(true); setErr("");
    try {
      if (camp) await updateCamp(camp.id, { nom, dateDebut: dd, dateFin: df });
      else await createCamp(teamId, { nom, dateDebut: dd, dateFin: df });
      onDone();
    } catch (e) { setErr("Échec : " + (e.message || "réessaie.")); setBusy(false); }
  };

  return (
    <div style={sc({ padding: 14, marginBottom: 12 })}>
      <input value={nom} onChange={(e) => { setNom(e.target.value); setErr(""); }} placeholder="Nom du camp (ex. Camp été)" maxLength={60} style={{ ...inp, width: "100%", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>du</span>
        <input type="date" value={dd} onChange={(e) => setDd(e.target.value)} style={inp} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>au</span>
        <input type="date" value={df} onChange={(e) => setDf(e.target.value)} style={inp} />
      </div>
      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ flex: 1, background: accent, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : camp ? "Enregistrer" : "Créer le camp"}</button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "10px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Annuler</button>
      </div>
    </div>
  );
}

function CampDetail({ camp, teamId, players, sessions, logs, onBack, onDeleted }) {
  const [edit, setEdit] = useState(false);
  const [results, setResults] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const { campaigns } = useTestCampaigns(teamId);

  const campSessions = useMemo(
    () => sessions.filter((s) => inCamp(camp, s.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, camp]
  );
  const campCampaigns = campaigns.filter((c) => c.campId === camp.id).sort((a, b) => a.date.localeCompare(b.date));

  const del = async () => {
    setBusy(true);
    try { await deleteCamp(camp.id); onDeleted(); }
    catch (e) { console.error("[camp delete]", e.message); setBusy(false); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Camps</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{camp.nom}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{period(camp)}</div>
        </div>
        <button onClick={() => setEdit((v) => !v)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 8, color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Modifier</button>
      </div>

      {edit && <CampForm teamId={teamId} camp={camp} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} />}

      {/* Résultats de tests datés par camp (baseline début vs fin) */}
      <Section title="RÉSULTATS DU CAMP" right={<button onClick={() => setResults(true)} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "5px 10px", color: accent, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Activity size={13} /> Saisir</button>}>
        {campCampaigns.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            Aucune campagne rattachée. « Saisir » crée une campagne (ex. « Début » puis « Fin ») datée du camp — les valeurs se reportent dans la fiche joueur + comparaison Top 14 + points.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {campCampaigns.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border2}` }}>
                <Tag c={i === 0 ? C.blue : C.viol}>{i === 0 ? "baseline" : i === campCampaigns.length - 1 ? "fin" : "intermédiaire"}</Tag>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{c.name}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{fmtShort(c.date)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Séances de la période */}
      <CampSessions camp={camp} teamId={teamId} sessions={campSessions} players={players} />

      {/* Participation (inscrits / présents / séances validées) */}
      <CampParticipation camp={camp} teamId={teamId} players={players} sessions={campSessions} logs={logs} />

      {/* Suppression */}
      {!confirmDel ? (
        <button onClick={() => setConfirmDel(true)} style={{ marginTop: 6, width: "100%", background: "transparent", border: `1px solid ${C.coral}55`, borderRadius: 10, padding: 11, color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Trash2 size={14} /> Supprimer le camp</button>
      ) : (
        <div style={{ marginTop: 6, border: `1px solid ${C.coral}55`, borderRadius: 10, padding: 12, background: `${C.coral}11` }}>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>Supprimer « {camp.nom} » ? Les inscriptions sont supprimées ; les campagnes de tests sont conservées (détachées).</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDel(false)} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Annuler</button>
            <button onClick={del} disabled={busy} style={{ flex: 1, background: C.coral, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>Supprimer</button>
          </div>
        </div>
      )}

      {results && <TestsBatch teamId={teamId} players={players} camp={camp} onClose={() => setResults(false)} />}
    </section>
  );
}

/* Séances de la période + création rapide (équipe / inscription libre / test).
   Une séance-test (code TEST) ouvre l'écran unique de saisie des résultats,
   lié à la campagne de tests du camp. */
function CampSessions({ camp, teamId, sessions, players = [] }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ date: camp.dateDebut, code: "RS", titre: "Séance", mode: "all" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saisie, setSaisie] = useState(null); // séance-test dont on saisit les résultats
  const { participants } = useCampParticipants(camp.id);
  const inp = { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" };

  const isTest = (s) => s.code === "TEST";

  const add = async () => {
    if (f.date < camp.dateDebut || f.date > camp.dateFin) return setErr("La date doit être dans la période du camp.");
    setBusy(true); setErr("");
    const test = f.mode === "test";
    // Séance-test → assignée aux joueurs du camp (participants ; à défaut toute l'équipe).
    const campIds = players.filter((p) => participants[p.id]).map((p) => p.id);
    const assigned = test
      ? { mode: "players", ids: campIds.length ? campIds : players.map((p) => p.id) }
      : f.mode === "open" ? { mode: "open", ids: [] } : { mode: "all" };
    try {
      await createSession(teamId, {
        date: f.date, code: test ? "TEST" : f.code, titre: test ? (f.titre === "Séance" ? "Tests physiques" : f.titre) : f.titre,
        durationMin: 60, exercises: [], assigned,
      });
      setAdding(false); setF({ date: camp.dateDebut, code: "RS", titre: "Séance", mode: "all" });
    } catch (e) { setErr("Échec : " + (e.message || "")); }
    setBusy(false);
  };

  return (
    <Section title={`SÉANCES DU CAMP · ${sessions.length}`} right={<button onClick={() => setAdding((v) => !v)} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "5px 10px", color: accent, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Séance</button>}>
      {adding && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input type="date" value={f.date} min={camp.dateDebut} max={camp.dateFin} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} style={{ ...inp, flex: "0 0 140px" }} />
            <input value={f.titre} onChange={(e) => setF((p) => ({ ...p, titre: e.target.value }))} placeholder="Titre" style={{ ...inp, flex: "1 1 120px" }} />
            {f.mode !== "test" && <input value={f.code} onChange={(e) => setF((p) => ({ ...p, code: e.target.value.toUpperCase().slice(0, 4) }))} placeholder="Code" style={{ ...inp, flex: "0 0 70px", textAlign: "center" }} />}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={f.mode} onChange={(e) => setF((p) => ({ ...p, mode: e.target.value }))} style={{ ...inp, flex: "1 1 160px" }}>
              <option value="all">Toute l'équipe</option>
              <option value="open">Inscription libre (les joueurs s'inscrivent)</option>
              <option value="test">Tests physiques (saisie des résultats)</option>
            </select>
            <button onClick={add} disabled={busy} style={{ background: accent, border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>Créer</button>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{f.mode === "test" ? "Séance-test assignée aux joueurs du camp — tu saisiras leurs valeurs le jour dit." : "Séance vierge — complète les exercices ensuite dans Programmes."}</div>
          {err && <div style={{ fontSize: 11, color: C.coral, marginTop: 6 }}>{err}</div>}
        </div>
      )}
      {sessions.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Aucune séance dans la période.</div>
      ) : sessions.map((s) => {
        const open = s.assigned?.mode === "open";
        const test = isTest(s);
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, width: 54 }}>{fmtShort(s.date)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{test ? "🧪 " : `${s.code} · `}{s.titre}</span>
            {test ? (
              <button onClick={() => setSaisie(s)} style={{ background: `${C.blue}22`, border: `1px solid ${C.blue}66`, borderRadius: 8, padding: "5px 10px", color: C.blue, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Activity size={13} /> Saisir</button>
            ) : (
              <>
                {open && <Tag c={C.teal}>{s.assignedIds.length} inscrit{s.assignedIds.length > 1 ? "s" : ""}</Tag>}
                {open ? <Tag c={C.viol}>ouverte</Tag> : <Tag c="rgba(255,255,255,0.4)">équipe</Tag>}
              </>
            )}
          </div>
        );
      })}
      {saisie && <TestsBatch teamId={teamId} players={players} camp={camp} session={saisie} onClose={() => setSaisie(null)} />}
    </Section>
  );
}
