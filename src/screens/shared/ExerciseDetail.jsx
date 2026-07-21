import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Overlay, Section } from "../../lib/ui.jsx";
import { Dumbbell } from "../../lib/icons.jsx";
import { bodyPartLabel, equipmentLabel, targetLabel, instructionSteps } from "../../data/exerciseLibrary.js";

const accent = C.green;
const INSTR_LANGS = ["fr", "en", "nl"]; // NL → repli FR (dataset fr/en)

/* Fiche détail d'un exercice de la Bibliothèque (feuille du bas), partagée par
   l'écran Bibliothèque et le sélecteur d'exercices (séance libre / compositeur
   staff). Vignette générique : aucun média n'est hébergé (© Gym visual). */
export default function ExerciseDetail({ ex, onClose }) {
  const { t, i18n } = useTranslation();
  const appLang = INSTR_LANGS.includes(i18n.language) ? i18n.language : "fr";
  const [lang, setLang] = useState(appLang);
  const steps = instructionSteps(ex, lang);
  const chip = { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 9px" };

  return (
    <Overlay onClose={onClose} sheet z={340}>
      <div style={{ padding: "6px 20px 26px" }}>
        <div style={{ height: 120, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          <Dumbbell size={34} color="rgba(255,255,255,0.25)" />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{t("shared.exlib.noMedia")}</span>
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>{ex.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <span style={{ ...chip, color: accent, background: `${accent}22` }}>{bodyPartLabel(t, ex.bodyPart)}</span>
          <span style={{ ...chip, color: C.blue, background: `${C.blue}22` }}>{equipmentLabel(t, ex.equipment)}</span>
          <span style={{ ...chip, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.08)" }}>{targetLabel(t, ex.target)}</span>
        </div>

        <Section title={t("shared.exlib.musclesTitle")}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>{t("shared.exlib.primaryMuscle")}: </span>{targetLabel(t, ex.target)}</div>
            {ex.secondaryMuscles?.length > 0 && (
              <div><span style={{ color: "rgba(255,255,255,0.5)" }}>{t("shared.exlib.secondaryMuscles")}: </span>{ex.secondaryMuscles.map((m) => targetLabel(t, m)).join(", ")}</div>
            )}
          </div>
        </Section>

        <Section
          title={t("shared.exlib.instructionsTitle")}
          right={
            <div style={{ display: "flex", gap: 4 }}>
              {INSTR_LANGS.map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderRadius: 6, padding: "3px 8px", border: "none", cursor: "pointer", background: lang === l ? accent : "rgba(255,255,255,0.08)", color: "#fff" }}>{l}</button>
              ))}
            </div>
          }
        >
          {steps.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("shared.exlib.noInstructions")}</div>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.65 }}>
              {steps.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
            </ol>
          )}
        </Section>

        {ex.attribution && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 14, textAlign: "center" }}>{ex.attribution}</div>
        )}
      </div>
    </Overlay>
  );
}
