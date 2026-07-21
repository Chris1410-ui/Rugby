import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { Overlay, Section } from "../../lib/ui.jsx";
import { Search, Dumbbell, ChevronLeft, ChevronRight } from "../../lib/icons.jsx";
import {
  useExerciseLibrary, useExerciseFacets, PAGE_SIZE,
  bodyPartLabel, equipmentLabel, targetLabel, instructionSteps,
} from "../../data/exerciseLibrary.js";

const accent = C.green;
const INSTR_LANGS = ["fr", "en", "nl"]; // NL → repli FR (dataset fr/en)

/* Bibliothèque d'exercices (catalogue MIT) : liste paginée + filtres + recherche
   + fiche détail. Accessible à tout membre du club (lecture seule). Aucun média
   n'est hébergé (© Gym visual) → vignette générique. */
export default function ExerciseLibrary() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [target, setTarget] = useState("");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(null);

  const facets = useExerciseFacets();
  const { exercises, total, loading, pageCount } = useExerciseLibrary({ search, bodyPart, equipment, target, page });

  // Un changement de filtre/recherche remet à la première page.
  const setFilter = (setter) => (v) => { setter(v); setPage(0); };

  const selStyle = { flex: "1 1 30%", minWidth: 120, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" };

  return (
    <section>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={15} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setFilter(setSearch)(e.target.value)}
          placeholder={t("shared.exlib.search")}
          style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px 10px 34px", color: "#fff", fontSize: 13, outline: "none" }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <select value={bodyPart} onChange={(e) => setFilter(setBodyPart)(e.target.value)} style={selStyle}>
          <option value="">{t("shared.exlib.allBodyParts")}</option>
          {facets.bodyParts.map((v) => <option key={v} value={v}>{bodyPartLabel(t, v)}</option>)}
        </select>
        <select value={equipment} onChange={(e) => setFilter(setEquipment)(e.target.value)} style={selStyle}>
          <option value="">{t("shared.exlib.allEquipment")}</option>
          {facets.equipment.map((v) => <option key={v} value={v}>{equipmentLabel(t, v)}</option>)}
        </select>
        <select value={target} onChange={(e) => setFilter(setTarget)(e.target.value)} style={selStyle}>
          <option value="">{t("shared.exlib.allTargets")}</option>
          {facets.targets.map((v) => <option key={v} value={v}>{targetLabel(t, v)}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
        {t("shared.exlib.count", { count: total })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "34px 18px", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{t("common.loading")}</div>
      ) : exercises.length === 0 ? (
        <div style={{ textAlign: "center", padding: "34px 18px", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{t("shared.exlib.empty")}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {exercises.map((e) => (
            <button key={e.id} onClick={() => setSel(e)} style={{ textAlign: "left", ...sc({ padding: 0, cursor: "pointer", overflow: "hidden", border: `1px solid ${C.border}` }) }}>
              <div style={{ height: 76, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${C.border2}` }}>
                <Dumbbell size={26} color="rgba(255,255,255,0.25)" />
              </div>
              <div style={{ padding: "9px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, lineHeight: 1.25 }}>{e.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: accent, background: `${accent}22`, borderRadius: 5, padding: "2px 6px" }}>{bodyPartLabel(t, e.bodyPart)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.07)", borderRadius: 5, padding: "2px 6px" }}>{equipmentLabel(t, e.equipment)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={pagerBtn(page === 0)} aria-label={t("shared.exlib.prevPage")}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{t("shared.exlib.pageOf", { page: page + 1, total: pageCount })}</div>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} style={pagerBtn(page >= pageCount - 1)} aria-label={t("shared.exlib.nextPage")}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {sel && <ExoDetail sel={sel} onClose={() => setSel(null)} />}
    </section>
  );
}

const pagerBtn = (disabled) => ({ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 12px", color: "#fff", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "flex", alignItems: "center" });

/* Fiche détail (feuille du bas) : vignette générique (média non hébergé),
   muscles, instructions pas à pas avec sélecteur de langue (défaut = langue de
   l'app, NL → repli FR), crédit © Gym visual. */
function ExoDetail({ sel, onClose }) {
  const { t, i18n } = useTranslation();
  const appLang = INSTR_LANGS.includes(i18n.language) ? i18n.language : "fr";
  const [lang, setLang] = useState(appLang);
  const steps = instructionSteps(sel, lang);

  const chip = { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 9px" };

  return (
    <Overlay onClose={onClose} sheet>
      <div style={{ padding: "6px 20px 26px" }}>
        <div style={{ height: 120, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          <Dumbbell size={34} color="rgba(255,255,255,0.25)" />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{t("shared.exlib.noMedia")}</span>
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>{sel.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <span style={{ ...chip, color: accent, background: `${accent}22` }}>{bodyPartLabel(t, sel.bodyPart)}</span>
          <span style={{ ...chip, color: C.blue, background: `${C.blue}22` }}>{equipmentLabel(t, sel.equipment)}</span>
          <span style={{ ...chip, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.08)" }}>{targetLabel(t, sel.target)}</span>
        </div>

        <Section title={t("shared.exlib.musclesTitle")}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>{t("shared.exlib.primaryMuscle")}: </span>{targetLabel(t, sel.target)}</div>
            {sel.secondaryMuscles.length > 0 && (
              <div><span style={{ color: "rgba(255,255,255,0.5)" }}>{t("shared.exlib.secondaryMuscles")}: </span>{sel.secondaryMuscles.map((m) => targetLabel(t, m)).join(", ")}</div>
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

        {sel.attribution && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 14, textAlign: "center" }}>{sel.attribution}</div>
        )}
      </div>
    </Overlay>
  );
}
