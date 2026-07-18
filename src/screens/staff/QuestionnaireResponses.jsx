import { useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { fmtShort } from "../../lib/metrics.js";
import { Section, Tag, CloseX, useModalClose } from "../../lib/ui.jsx";
import { Download } from "../../lib/icons.jsx";
import { downloadCSV } from "../../lib/csv.js";
import { formatAnswer, questionnaireCSV } from "../../lib/questionnaires.js";

/* Écran « Réponses aux questionnaires » (staff). Vue tableau (joueurs × questions)
   + détail par joueur, filtres (ligne / statut) + export CSV. Données santé :
   staff du club uniquement (RLS), jamais au classement/comparaison. */
export default function QuestionnaireResponses({ questionnaire, players, assignments, onBack }) {
  const [grp, setGrp] = useState("all");
  const [statut, setStatut] = useState("all");
  const [detail, setDetail] = useState(null); // player
  const grps = [...new Set(players.map((p) => p.grp).filter(Boolean))];

  // Joueurs destinataires (= ayant une assignation).
  const rows = useMemo(() => players
    .filter((p) => assignments[p.id])
    .map((p) => ({ p, a: assignments[p.id] }))
    .filter(({ p, a }) => (grp === "all" || p.grp === grp) && (statut === "all" || a.statut === statut))
    .sort((x, y) => x.p.name.localeCompare(y.p.name)), [players, assignments, grp, statut]);

  const filled = Object.values(assignments).filter((a) => a.statut === "rempli").length;
  const total = Object.keys(assignments).length;

  const exportCSV = () => {
    const csvRows = players.filter((p) => assignments[p.id]).map((p) => ({ name: p.name, statut: assignments[p.id].statut, reponses: assignments[p.id].reponses }));
    downloadCSV(`reponses_${questionnaire.nom.replace(/[^a-z0-9]+/gi, "_")}.csv`, questionnaireCSV(questionnaire, csvRows));
  };

  const th = { fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.6)", padding: "6px 8px", textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` };
  const nameCol = { position: "sticky", left: 0, background: C.panel, zIndex: 1, textAlign: "left", padding: "6px 10px 6px 4px" };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Questionnaires</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{questionnaire.nom}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{filled}/{total} rempli(s)</div>
        </div>
        <button onClick={exportCSV} title="Export CSV" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex" }}><Download size={16} /></button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {[["all", "Toutes lignes"], ...grps.map((g) => [g, grpLabel(g)])].map(([v, l]) => (
          <button key={v} onClick={() => setGrp(v)} style={btn(grp === v)}>{l}</button>
        ))}
        <span style={{ width: 8 }} />
        {[["all", "Tous"], ["rempli", "Remplis"], ["a_remplir", "En attente"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatut(v)} style={btn(statut === v)}>{l}</button>
        ))}
      </div>

      {total === 0 ? (
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>Questionnaire pas encore envoyé.</div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ ...th, ...nameCol }}>Joueur</th>
                <th style={th}>Statut</th>
                {questionnaire.questions.map((q) => <th key={q.id} style={th}>{q.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, a }) => (
                <tr key={p.id} onClick={() => setDetail(p)} style={{ cursor: "pointer" }}>
                  <td style={{ ...nameCol, fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border2}` }}>{displayName(p)}</td>
                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border2}` }}>
                    {a.statut === "rempli" ? <Tag c={C.green}>rempli</Tag> : <Tag c={C.amb}>en attente</Tag>}
                  </td>
                  {questionnaire.questions.map((q) => (
                    <td key={q.id} style={{ padding: "6px 8px", fontSize: 11.5, color: "rgba(255,255,255,0.85)", borderBottom: `1px solid ${C.border2}`, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.statut === "rempli" ? (formatAnswer(q, a.reponses[q.id]) || "—") : "—"}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={questionnaire.questions.length + 2} style={{ padding: 16, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Aucun joueur pour ce filtre.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {detail && <PlayerAnswers questionnaire={questionnaire} player={detail} assignment={assignments[detail.id]} onClose={() => setDetail(null)} />}
    </section>
  );
}

const btn = (active) => ({ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: active ? C.coral : "rgba(255,255,255,0.07)", color: "#fff", whiteSpace: "nowrap" });

/* Détail complet des réponses d'un joueur (modal). Réutilisable depuis la fiche. */
export function PlayerAnswers({ questionnaire, player, assignment, onClose }) {
  const a = assignment;
  useModalClose(onClose);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{displayName(player)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{questionnaire.nom}{a?.filledAt ? ` · rempli le ${fmtShort(a.filledAt)}` : ""}</div>
          </div>
          <CloseX onClose={onClose} />
        </div>
        {!a || a.statut !== "rempli" ? (
          <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>Pas encore rempli.</div>
        ) : (
          questionnaire.questions.map((q) => (
            <div key={q.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>{q.label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", whiteSpace: "pre-wrap" }}>{formatAnswer(q, a.reponses[q.id]) || "—"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
