import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Tag } from "../../lib/ui.jsx";
import { getExerciseByName, instructionSteps, bodyPartLabel, equipmentLabel, targetLabel } from "../../data/exerciseLibrary.js";
import { useExerciseProgression } from "../../data/progressions.js";

/* Fiche exercice (lecture) ouverte depuis une séance : muscles / matériel /
   instructions, + GIF si le dataset en fournit un (souvent absent — données
   seules), + place dans la progression (chaîne d'exercices) et étape suivante à
   viser. Recherche par nom dans la bibliothèque. */
export default function ExerciseInfoModal({ name, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "fr").slice(0, 2);
  const [ex, setEx] = useState(undefined); // undefined = chargement ; null = introuvable

  useEffect(() => {
    let alive = true;
    getExerciseByName(name).then((e) => { if (alive) setEx(e); }).catch(() => { if (alive) setEx(null); });
    return () => { alive = false; };
  }, [name]);

  const { progression } = useExerciseProgression(ex?.id, !!ex?.id);
  const steps = ex ? instructionSteps(ex, lang) : [];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", background: C.panel, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{ex?.name || name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {ex === undefined ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("exInfo.loading")}</div>
        ) : ex === null ? (
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{t("exInfo.notFound")}</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {ex.bodyPart && <Tag c={C.teal}>{bodyPartLabel(t, ex.bodyPart)}</Tag>}
              {ex.target && <Tag c={C.viol}>{targetLabel(t, ex.target)}</Tag>}
              {ex.equipment && <Tag c={C.amb}>{equipmentLabel(t, ex.equipment)}</Tag>}
            </div>

            {ex.gifUrl && (
              <img src={ex.gifUrl} alt={ex.name} style={{ width: "100%", borderRadius: 10, marginBottom: 12, background: "#000" }} />
            )}

            {progression && progression.family && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{progression.family.name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.viol }}>{t("progression.step", { pos: progression.position, total: progression.total })}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {progression.steps.map((s) => {
                    const cur = s.position === progression.position;
                    const next = progression.next && s.position === progression.next.position;
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: cur ? "#fff" : "rgba(255,255,255,0.55)", fontWeight: cur ? 800 : 600 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, background: cur ? C.viol : next ? `${C.green}33` : "rgba(255,255,255,0.08)", color: cur ? "#fff" : next ? C.green : "rgba(255,255,255,0.6)", border: next ? `1px solid ${C.green}` : "none" }}>{s.position}</span>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                        {cur && <Tag c={C.viol}>{t("progression.current")}</Tag>}
                        {next && <Tag c={C.green}>{t("progression.next")}</Tag>}
                      </div>
                    );
                  })}
                </div>
                {progression.next && (
                  <div style={{ fontSize: 10.5, color: C.green, marginTop: 8, fontWeight: 700 }}>{t("progression.aim", { label: progression.next.label })}</div>
                )}
              </div>
            )}

            {steps.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {steps.map((s, i) => <li key={i} style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{s}</li>)}
              </ol>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("exInfo.noSteps")}</div>
            )}

            {ex.attribution && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginTop: 12 }}>{ex.attribution}</div>}
          </>
        )}
      </div>
    </div>
  );
}
