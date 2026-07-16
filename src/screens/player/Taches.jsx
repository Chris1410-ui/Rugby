import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { fmtShort } from "../../lib/metrics.js";
import { Tag } from "../../lib/ui.jsx";
import { ClipboardList, CheckCircle, Calendar } from "../../lib/icons.jsx";
import { usePreview } from "../../lib/preview.js";
import { useTeamTasks, useMyTaskCompletions, markTaskDone, unmarkTask } from "../../data/tasks.js";

/* « Mes tâches » (joueur) : liste des tâches qui me sont assignées + validation
   en 2 temps. « Fait » → +2 pts (en attente de confirmation coach). Lecture
   seule en mode aperçu owner/staff. */
export default function Taches({ me, players = [], accent = C.green }) {
  const preview = usePreview();
  const { tasks } = useTeamTasks(me.team, players);
  const { statutByTask } = useMyTaskCompletions(me.id);
  const [busy, setBusy] = useState(null);

  const mine = tasks.filter((t) => t.assignedIds.includes(me.id));
  const todo = mine.filter((t) => (statutByTask[t.id] || "a_faire") !== "confirmee");
  const done = mine.filter((t) => (statutByTask[t.id] || "a_faire") === "confirmee");

  const run = (k, fn) => { if (preview) return; setBusy(k); fn().catch((e) => console.error("[task]", e.message)).finally(() => setBusy(null)); };

  const Card = (t) => {
    const st = statutByTask[t.id] || "a_faire";
    return (
      <div key={t.id} style={sc({ marginBottom: 10, padding: 14, borderLeft: `3px solid ${st === "confirmee" ? C.green : st === "validee_joueur" ? C.amb : accent}` })}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{t.titre}</div>
        {t.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 3, lineHeight: 1.45 }}>{t.description}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
          {t.lieu && <Tag c={C.teal}>📍 {t.lieu}</Tag>}
          {t.echeance && <Tag c={C.amb}><Calendar size={10} /> {fmtShort(t.echeance)}</Tag>}
        </div>

        <div style={{ marginTop: 12 }}>
          {st === "a_faire" && (
            <button onClick={() => run(t.id, () => markTaskDone(t.id))} disabled={preview || busy === t.id} style={{ width: "100%", background: preview ? "rgba(255,255,255,0.06)" : accent, border: "none", borderRadius: 10, padding: 11, color: preview ? "rgba(255,255,255,0.5)" : "#fff", fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: busy === t.id ? 0.6 : 1 }}>
              <CheckCircle size={15} /> {preview ? "Aperçu — lecture seule" : "Marquer comme fait (+2)"}
            </button>
          )}
          {st === "validee_joueur" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.amb }}>✓ Fait — en attente de validation du coach</div>
              {!preview && <button onClick={() => run(t.id, () => unmarkTask(t.id))} disabled={busy === t.id} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Annuler</button>}
            </div>
          )}
          {st === "confirmee" && <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>🏅 Confirmée par le coach · +2 points</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>Mes tâches</div>
      </div>

      {mine.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          Aucune tâche pour le moment.<br />Ton staff t'en assignera ici (chaque tâche validée = +2 points).
        </div>
      ) : (
        <>
          {todo.map(Card)}
          {done.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1, fontWeight: 700, margin: "16px 0 10px" }}>TERMINÉES</div>
              {done.map(Card)}
            </>
          )}
        </>
      )}
    </div>
  );
}
