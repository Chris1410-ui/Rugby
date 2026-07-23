import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { Dumbbell, ExternalLink } from "../../lib/icons.jsx";
import { useProgramDocs, getProgramDoc } from "../../data/programDocs.js";
import ProgramView from "../shared/ProgramView.jsx";

/* Consultation joueur des PROTOCOLES : la RLS ne renvoie que les protocoles
   PUBLIÉS du club du joueur (défense en profondeur : on refiltre côté client).
   Lecture seule — ouverture dans le rendu « stade ». */
export default function PlayerProtocols({ teamId, accent = C.green }) {
  const { t } = useTranslation();
  const { docs, loading } = useProgramDocs(teamId);
  const [viewing, setViewing] = useState(null);
  const published = docs.filter((d) => d.status === "published");

  const open = async (row) => {
    try { const full = await getProgramDoc(row.id); setViewing({ title: full.title, doc: full.doc }); }
    catch (e) { console.error("[player protocols]", e.message); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Dumbbell size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("protocols.title")}</div>
      </div>

      {loading && !published.length ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("protocols.loading")}</div>
      ) : published.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("protocols.emptyPlayer")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {published.map((d) => (
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

      {viewing && <ProgramView doc={viewing.doc} title={viewing.title} onClose={() => setViewing(null)} />}
    </section>
  );
}
