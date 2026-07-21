import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { Search, Dumbbell, ChevronLeft, ChevronRight } from "../../lib/icons.jsx";
import {
  useExerciseLibrary, useExerciseFacets, PAGE_SIZE,
  bodyPartLabel, equipmentLabel, targetLabel,
} from "../../data/exerciseLibrary.js";
import ExerciseDetail from "./ExerciseDetail.jsx";

const accent = C.green;

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

      {sel && <ExerciseDetail ex={sel} onClose={() => setSel(null)} />}
    </section>
  );
}

const pagerBtn = (disabled) => ({ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 12px", color: "#fff", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "flex", alignItems: "center" });
