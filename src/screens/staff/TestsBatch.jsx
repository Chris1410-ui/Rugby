import { useEffect, useMemo, useState } from "react";
import { C } from "../../lib/tokens.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { Plus, X, CheckCircle } from "../../lib/icons.jsx";
import { todayISO, fmtShort } from "../../lib/metrics.js";
import { useTestCampaigns, createCampaign, saveResultsBulk, TEST_METRICS } from "../../data/tests.js";
import { linkSessionCampaign } from "../../data/sessions.js";

const numFR = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const accent = C.coral;

/* Saisie groupée des tests physiques : une campagne × tout l'effectif dans une
   grille éditable (staff). Un seul enregistrement (bulk upsert). */
export default function TestsBatch({ teamId, players, camp = null, session = null, onClose }) {
  useModalClose(onClose);
  const { campaigns: allCampaigns, results } = useTestCampaigns(teamId);
  // En contexte camp : ne montrer/gérer que les campagnes rattachées à ce camp.
  const campaigns = camp ? allCampaigns.filter((c) => c.campId === camp.id) : allCampaigns;
  const [selCamp, setSelCamp] = useState(null);
  const [creating, setCreating] = useState((camp && campaigns.length === 0) && !session?.campaignId);
  const [newCamp, setNewCamp] = useState({ name: session ? "Tests" : "", date: session?.date || (camp ? camp.dateDebut : todayISO()) });
  const [grid, setGrid] = useState({}); // { [playerId]: { metricKey: value } }
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    // Séance-test déjà liée à une campagne → on l'ouvre directement.
    if (!selCamp && session?.campaignId) setSelCamp(session.campaignId);
    else if (!selCamp && campaigns.length) setSelCamp(campaigns[campaigns.length - 1].id);
  }, [campaigns, selCamp, session]);

  // (Re)charge la grille depuis les résultats de la campagne sélectionnée.
  const byPlayer = useMemo(() => {
    const m = {};
    results.filter((r) => r.campaignId === selCamp).forEach((r) => { m[r.playerId] = r; });
    return m;
  }, [results, selCamp]);

  useEffect(() => {
    const g = {};
    players.forEach((p) => {
      const r = byPlayer[p.id];
      const row = {};
      TEST_METRICS.forEach((m) => { row[m.key] = r?.[m.key] ?? ""; });
      g[p.id] = row;
    });
    setGrid(g);
  }, [byPlayer, players]);

  const setCell = (pid, key, v) => setGrid((g) => ({ ...g, [pid]: { ...g[pid], [key]: v } }));

  const doCreate = async () => {
    if (!newCamp.name.trim()) return setNote("Donne un nom à la campagne.");
    setBusy(true); setNote("");
    try {
      const c = await createCampaign(teamId, { ...newCamp, campId: camp?.id ?? null });
      // Séance-test : on lie la campagne créée à la séance → réouvre la même.
      if (session && !session.campaignId) { try { await linkSessionCampaign(session.id, c.id); } catch (e) { console.error("[link session campaign]", e.message); } }
      setSelCamp(c.id); setCreating(false); setNewCamp({ name: session ? "Tests" : "", date: session?.date || (camp ? camp.dateDebut : todayISO()) });
    } catch (e) { setNote("Échec : " + (e.message || "réessaie.")); }
    setBusy(false);
  };

  const doSaveAll = async () => {
    if (!selCamp) return setNote("Choisis ou crée une campagne.");
    setBusy(true); setNote("");
    const rows = players.map((p) => {
      const row = grid[p.id] || {};
      const metrics = {};
      TEST_METRICS.forEach((m) => {
        const raw = row[m.key];
        metrics[m.key] = m.type === "text" ? ((raw ?? "").toString().trim() || null) : numFR(raw);
      });
      return { playerId: p.id, metrics };
    });
    try {
      await saveResultsBulk(selCamp, teamId, rows);
      setNote(`Enregistré ✓ — ${rows.length} joueur${rows.length > 1 ? "s" : ""}.`);
    } catch (e) { setNote("Échec de l'enregistrement : " + (e.message || "")); }
    setBusy(false);
  };

  const cellInp = { width: 74, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 6px", color: "#fff", fontSize: 12, outline: "none", textAlign: "right" };
  const th = { fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 0.3, padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` };
  const nameCol = { position: "sticky", left: 0, zIndex: 1, background: C.panel, textAlign: "left", padding: "6px 10px 6px 0" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: C.panel, borderRadius: 18, padding: 18, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{camp ? `Résultats — ${camp.nom}` : "Saisie groupée des tests"}</div>
          <CloseX onClose={onClose} />
        </div>

        {/* Sélecteur / création de campagne */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          {creating ? (
            <>
              <input value={newCamp.name} onChange={(e) => setNewCamp((p) => ({ ...p, name: e.target.value }))} placeholder={camp ? "Nom (ex. Début, Fin)" : "Nom (ex. Camp 2 – Août)"} style={{ flex: "1 1 180px", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none" }} />
              <input type="date" value={newCamp.date} min={camp ? camp.dateDebut : undefined} max={camp ? camp.dateFin : undefined} onChange={(e) => setNewCamp((p) => ({ ...p, date: e.target.value }))} style={{ flex: "0 0 140px", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" }} />
              <button onClick={doCreate} disabled={busy} style={{ background: accent, border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Créer</button>
              <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}><X size={16} /></button>
            </>
          ) : (
            <>
              <select value={selCamp ?? ""} onChange={(e) => setSelCamp(e.target.value)} style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", colorScheme: "dark" }}>
                {campaigns.length === 0 && <option value="">— aucune campagne —</option>}
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {fmtShort(c.date)}</option>)}
              </select>
              <button onClick={() => setCreating(true)} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "8px 12px", color: accent, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Campagne</button>
            </>
          )}
        </div>

        {note && <div style={{ fontSize: 12, marginBottom: 10, color: note.startsWith("Enregistré") ? C.green : C.amb }}>{note}</div>}

        {/* Grille */}
        {!selCamp ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: 20, textAlign: "center" }}>Crée une campagne pour commencer la saisie.</div>
        ) : players.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: 20, textAlign: "center" }}>Aucun joueur dans l'effectif.</div>
        ) : (
          <div style={{ overflow: "auto", flex: 1, marginBottom: 12 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ ...th, ...nameCol, textAlign: "left" }}>Joueur</th>
                  {TEST_METRICS.map((m) => <th key={m.key} style={th}>{m.label}{m.unit ? <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{m.unit.trim()}</div> : null}</th>)}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...nameCol, fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border2}` }}>{p.name}</td>
                    {TEST_METRICS.map((m) => (
                      <td key={m.key} style={{ padding: "5px 4px", textAlign: "right", borderBottom: `1px solid ${C.border2}` }}>
                        <input
                          value={grid[p.id]?.[m.key] ?? ""}
                          onChange={(e) => setCell(p.id, m.key, e.target.value)}
                          inputMode={m.type === "text" ? "text" : "decimal"}
                          placeholder={m.type === "text" ? (m.key === "bronco" ? "5'15" : "3x170") : "—"}
                          style={cellInp}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={doSaveAll} disabled={busy || !selCamp} style={{ width: "100%", background: selCamp ? C.green : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: selCamp ? "pointer" : "default", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <CheckCircle size={15} /> {busy ? "Enregistrement…" : "Enregistrer toute l'équipe"}
        </button>
      </div>
    </div>
  );
}
