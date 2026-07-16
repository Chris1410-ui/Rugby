import { useMemo } from "react";
import { C } from "../../lib/tokens.js";
import { statusOfLog } from "../../lib/metrics.js";
import { Section } from "../../lib/ui.jsx";
import { useCampParticipants, enrollInCamp, setParticipantStatus, removeParticipant } from "../../data/camps.js";

/* Liste de participation d'un camp (staff) : qui est inscrit / présent, et
   combien de séances de la période chacun a validées. Le staff inscrit
   manuellement, marque « présent », ou retire. « Séances validées » est dérivé
   des session_logs (aucun stockage). */
export default function CampParticipation({ camp, teamId, players = [], sessions = [], logs = {} }) {
  const { participants } = useCampParticipants(camp.id);

  // Séances validées par joueur dans la période (dérivé).
  const doneBy = useMemo(() => {
    const m = {};
    players.forEach((p) => {
      m[p.id] = sessions.reduce((a, s) => a + (statusOfLog(logs, s.id, p.id) === "done" ? 1 : 0), 0);
    });
    return m;
  }, [players, sessions, logs]);

  const inscrits = players.filter((p) => participants[p.id]);
  const present = inscrits.filter((p) => participants[p.id] === "present").length;

  const enroll = (pid) => enrollInCamp(camp.id, pid, teamId).catch((e) => console.error("[enroll]", e.message));
  const toggle = (pid, cur) => setParticipantStatus(camp.id, pid, cur === "present" ? "inscrit" : "present").catch((e) => console.error("[statut]", e.message));
  const remove = (pid) => removeParticipant(camp.id, pid).catch((e) => console.error("[remove]", e.message));

  return (
    <Section title={`PARTICIPATION · ${inscrits.length} inscrit${inscrits.length > 1 ? "s" : ""}`} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{present} présent{present > 1 ? "s" : ""}</span>}>
      {players.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Aucun joueur dans l'effectif.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {players.map((p) => {
            const st = participants[p.id]; // undefined | 'inscrit' | 'present'
            const done = doneBy[p.id] || 0;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{done} séance{done > 1 ? "s" : ""} validée{done > 1 ? "s" : ""}</div>
                </div>
                {!st ? (
                  <button onClick={() => enroll(p.id)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px", color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Inscrire</button>
                ) : (
                  <>
                    <button onClick={() => toggle(p.id, st)} title="Basculer inscrit / présent" style={{ background: st === "present" ? C.green : `${C.viol}22`, border: `1px solid ${st === "present" ? C.green : `${C.viol}66`}`, borderRadius: 8, padding: "5px 10px", color: st === "present" ? "#fff" : C.viol, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                      {st === "present" ? "✓ Présent" : "Inscrit"}
                    </button>
                    <button onClick={() => remove(p.id)} title="Retirer" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
