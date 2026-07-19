import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const preview = usePreview();
  const { tasks } = useTeamTasks(me.team, players);
  const { statutByTask } = useMyTaskCompletions(me.id);
  const [busy, setBusy] = useState(null);

  const mine = tasks.filter((t) => t.assignedIds.includes(me.id));
  const todo = mine.filter((t) => (statutByTask[t.id] || "a_faire") !== "confirmee");
  const done = mine.filter((t) => (statutByTask[t.id] || "a_faire") === "confirmee");

  const run = (k, fn) => { if (preview) return; setBusy(k); fn().catch((e) => console.error("[task]", e.message)).finally(() => setBusy(null)); };

  const Card = (task) => {
    const st = statutByTask[task.id] || "a_faire";
    return (
      <div key={task.id} style={sc({ marginBottom: 10, padding: 14, borderLeft: `3px solid ${st === "confirmee" ? C.green : st === "validee_joueur" ? C.amb : accent}` })}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{task.titre}</div>
        {task.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 3, lineHeight: 1.45 }}>{task.description}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
          {task.lieu && <Tag c={C.teal}>📍 {task.lieu}</Tag>}
          {task.echeance && <Tag c={C.amb}><Calendar size={10} /> {fmtShort(task.echeance)}</Tag>}
        </div>

        <div style={{ marginTop: 12 }}>
          {st === "a_faire" && (
            <button onClick={() => run(task.id, () => markTaskDone(task.id))} disabled={preview || busy === task.id} style={{ width: "100%", background: preview ? "rgba(255,255,255,0.06)" : accent, border: "none", borderRadius: 10, padding: 11, color: preview ? "rgba(255,255,255,0.5)" : "#fff", fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: busy === task.id ? 0.6 : 1 }}>
              <CheckCircle size={15} /> {preview ? t("common.previewReadonly") : t("player.taches.markDone")}
            </button>
          )}
          {st === "validee_joueur" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.amb }}>{t("player.taches.awaitingCoach")}</div>
              {!preview && <button onClick={() => run(task.id, () => unmarkTask(task.id))} disabled={busy === task.id} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t("common.cancel")}</button>}
            </div>
          )}
          {st === "confirmee" && <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>{t("player.taches.confirmed")}</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("player.taches.title")}</div>
      </div>

      {mine.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          {t("player.taches.empty")}<br />{t("player.taches.emptyHint")}
        </div>
      ) : (
        <>
          {todo.map(Card)}
          {done.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1, fontWeight: 700, margin: "16px 0 10px" }}>{t("player.taches.doneSection")}</div>
              {done.map(Card)}
            </>
          )}
        </>
      )}
    </div>
  );
}
