import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { Dumbbell, ExternalLink } from "../../lib/icons.jsx";
import { useProgramDocs, getProgramDoc } from "../../data/programDocs.js";
import { useTeamProgramAssignments } from "../../data/programAssignments.js";
import { isVisibleToPlayer, mergeTargets } from "../../lib/program/assign.js";
import ProgramView from "../shared/ProgramView.jsx";

/* Consultation joueur des PROTOCOLES : la RLS ne renvoie que les protocoles
   PUBLIÉS du club. On filtre en plus par ASSIGNATION (visible par tout le club
   si non ciblé, sinon uniquement les groupes/joueurs concernés) et on injecte
   les CIBLES individualisées du joueur dans le rendu. Lecture seule. */
export default function PlayerProtocols({ teamId, me, accent = C.green }) {
  const { t } = useTranslation();
  const { docs, loading } = useProgramDocs(teamId);
  const { assignments } = useTeamProgramAssignments(teamId);
  const [viewing, setViewing] = useState(null);

  const ctx = { playerId: me?.id, group: me?.grp };
  const asgsFor = (id) => assignments.filter((a) => a.programId === id);
  const visible = docs.filter((d) => d.status === "published" && isVisibleToPlayer(asgsFor(d.id), ctx));

  const open = async (row) => {
    try {
      const full = await getProgramDoc(row.id);
      const targets = mergeTargets(asgsFor(row.id), ctx);
      setViewing({ id: full.id, title: full.title, doc: full.doc, targets });
    } catch (e) { console.error("[player protocols]", e.message); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Dumbbell size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("protocols.title")}</div>
      </div>

      {loading && !visible.length ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("protocols.loading")}</div>
      ) : visible.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("protocols.emptyPlayer")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((d) => (
            <div key={d.id} onClick={() => open(d)} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" })}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title || t("protocols.untitled")}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {d.category && <span>{d.category}</span>}
                  <span>{t("protocols.weeksN", { count: d.weeks })}</span>
                </div>
              </div>
              <ExternalLink size={16} color={accent} />
            </div>
          ))}
        </div>
      )}

      {viewing && <ProgramView id={viewing.id} doc={viewing.doc} title={viewing.title} targets={viewing.targets} onClose={() => setViewing(null)} />}
    </section>
  );
}
