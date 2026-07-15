import { useEffect, useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { Section, LineChart } from "../../lib/ui.jsx";
import { Plus, X, CheckCircle } from "../../lib/icons.jsx";
import {
  useTestCampaigns, createCampaign, deleteCampaign, saveResult, TEST_METRICS,
} from "../../data/tests.js";
import { todayISO, fmtShort } from "../../lib/metrics.js";

const numFR = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const hasVal = (v) => v != null && v !== "";

/* Évolution des tests physiques par campagne (historisation).
   Affichage lecture seule (joueur) + éditeur staff (canEdit). Source unique :
   test_campaigns / test_results (les colonnes plates players.* sont dormantes). */
export default function TestsEvolution({ player, canEdit = false, accent = C.viol }) {
  const teamId = player.team;
  const { campaigns, results } = useTestCampaigns(teamId);

  const [editing, setEditing] = useState(false);
  const [selCamp, setSelCamp] = useState(null);
  const [form, setForm] = useState({});
  const [creating, setCreating] = useState(false);
  const [newCamp, setNewCamp] = useState({ name: "", date: todayISO() });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Résultats du joueur, indexés par campagne.
  const byCamp = useMemo(() => {
    const m = {};
    results.filter((r) => r.playerId === player.id).forEach((r) => { m[r.campaignId] = r; });
    return m;
  }, [results, player.id]);

  // Campagne sélectionnée par défaut = la plus récente.
  useEffect(() => {
    if (!selCamp && campaigns.length) setSelCamp(campaigns[campaigns.length - 1].id);
  }, [campaigns, selCamp]);

  // (Re)charge le formulaire depuis le résultat de la campagne sélectionnée.
  useEffect(() => {
    const r = selCamp ? byCamp[selCamp] : null;
    const f = {};
    TEST_METRICS.forEach((m) => { f[m.key] = r?.[m.key] ?? ""; });
    setForm(f);
  }, [selCamp, byCamp]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const doCreate = async () => {
    if (!newCamp.name.trim()) return setNote("Donne un nom à la campagne.");
    setBusy(true); setNote("");
    try {
      const c = await createCampaign(teamId, newCamp);
      setSelCamp(c.id); setCreating(false); setNewCamp({ name: "", date: todayISO() });
    } catch (e) { setNote("Échec : " + (e.message || "réessaie.")); }
    setBusy(false);
  };

  const doSave = async () => {
    if (!selCamp) return setNote("Choisis ou crée une campagne.");
    setBusy(true); setNote("");
    const metrics = {
      bronco: (form.bronco ?? "").toString().trim() || null,
      yoyo: numFR(form.yoyo),
      squat_5rm: (form.squat_5rm ?? "").toString().trim() || null,
      cmj_overall: numFR(form.cmj_overall),
      bench_5rm: numFR(form.bench_5rm),
      hang_clean_2rm: numFR(form.hang_clean_2rm),
    };
    try {
      await saveResult(selCamp, player.id, teamId, metrics);
      setEditing(false); setNote("");
    } catch (e) { setNote("Échec de l'enregistrement : " + (e.message || "")); }
    setBusy(false);
  };

  const doDeleteCamp = async () => {
    if (!selCamp) return;
    setBusy(true); setNote("");
    try { await deleteCampaign(selCamp); setSelCamp(null); }
    catch (e) { setNote("Échec de la suppression : " + (e.message || "")); }
    setBusy(false);
  };

  const inp = { width: 96, background: "rgba(255,255,255,0.1)", border: `1px solid ${accent}66`, borderRadius: 6, padding: "4px 7px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", textAlign: "right" };
  const selSt = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", colorScheme: "dark" };

  const editorBtn = canEdit && !editing ? (
    <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Saisir</button>
  ) : null;

  return (
    <Section title="ÉVOLUTION DES TESTS" right={editorBtn}>
      {note && <div style={{ fontSize: 11, color: C.amb, marginBottom: 8 }}>{note}</div>}

      {/* ── Éditeur staff ── */}
      {editing && (
        <div style={sc({ marginBottom: 12, background: "rgba(255,255,255,0.03)" })}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            {creating ? (
              <>
                <input value={newCamp.name} onChange={(e) => setNewCamp((p) => ({ ...p, name: e.target.value }))} placeholder="Nom (ex. Camp 2 – Août)" style={selSt} />
                <input type="date" value={newCamp.date} onChange={(e) => setNewCamp((p) => ({ ...p, date: e.target.value }))} style={{ ...selSt, flex: "0 0 140px" }} />
                <button onClick={doCreate} disabled={busy} style={{ background: accent, border: "none", borderRadius: 8, padding: "8px 10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Créer</button>
                <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X size={16} /></button>
              </>
            ) : (
              <>
                <select value={selCamp ?? ""} onChange={(e) => setSelCamp(e.target.value)} style={selSt}>
                  {campaigns.length === 0 && <option value="">— aucune campagne —</option>}
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {fmtShort(c.date)}</option>)}
                </select>
                <button onClick={() => setCreating(true)} title="Nouvelle campagne" style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "8px 10px", color: accent, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Camp.</button>
              </>
            )}
          </div>

          {!creating && selCamp && (
            <>
              {TEST_METRICS.map((m) => (
                <div key={m.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border2}` }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{m.label}{m.unit ? ` (${m.unit.trim()})` : ""}</span>
                  <input value={form[m.key] ?? ""} onChange={(e) => setF(m.key, e.target.value)} inputMode={m.type === "text" ? "text" : "decimal"} placeholder={m.type === "text" ? (m.key === "bronco" ? "5'15" : "3x170") : ""} style={inp} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setEditing(false)} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Fermer</button>
                <button onClick={doDeleteCamp} disabled={busy} title="Supprimer cette campagne (tous les joueurs)" style={{ flex: "0 0 auto", background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 8, padding: "10px 12px", color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Suppr. camp.</button>
                <button onClick={doSave} disabled={busy} style={{ flex: 2, background: C.green, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}><CheckCircle size={13} /> Enregistrer</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Affichage évolution (lecture) ── */}
      {campaigns.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          {canEdit ? "Aucune campagne de tests. Clique « Saisir » pour en créer une et enregistrer les valeurs." : "Aucun test enregistré pour le moment."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TEST_METRICS.map((m) => (
            <MetricCard key={m.key} m={m} campaigns={campaigns} byCamp={byCamp} accent={accent} />
          ))}
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", textAlign: "center", paddingTop: 2 }}>{campaigns.length} campagne{campaigns.length > 1 ? "s" : ""} · dernière : {campaigns[campaigns.length - 1].name}</div>
        </div>
      )}
    </Section>
  );
}

function MetricCard({ m, campaigns, byCamp, accent }) {
  const series = campaigns.map((c) => ({ c, v: byCamp[c.id]?.[m.key] })).filter((s) => hasVal(s.v));
  const current = series.length ? series[series.length - 1] : null;
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const isNum = m.type === "num";
  const delta = isNum && current && prev ? Number(current.v) - Number(prev.v) : null;
  const improved = delta == null || delta === 0 ? null : (m.better === "down" ? delta < 0 : delta > 0);
  const deltaColor = improved == null ? "rgba(255,255,255,0.5)" : improved ? C.green : C.coral;
  const fmtV = (v) => (v == null || v === "" ? "—" : `${v}${m.unit || ""}`);
  const pts = isNum ? series.map((s) => Number(s.v)) : [];

  return (
    <div style={sc({ padding: 12 })}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{m.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 900 }}>{current ? fmtV(current.v) : "—"}</span>
            {prev && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                préc. {fmtV(prev.v)}
                {delta != null && delta !== 0 && <span style={{ color: deltaColor, fontWeight: 800 }}>  {delta > 0 ? "+" : ""}{Math.round(delta * 10) / 10}</span>}
              </span>
            )}
          </div>
        </div>
        {isNum && pts.length >= 2 && (
          <div style={{ width: 110, flexShrink: 0 }}><LineChart pts={pts} color={accent} height={40} /></div>
        )}
      </div>
    </div>
  );
}
