import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Overlay, Tag } from "../../lib/ui.jsx";
import { Search, Plus, Check, Dumbbell, ChevronLeft, ChevronRight, FileText } from "../../lib/icons.jsx";
import { useExerciseLibrary, useExerciseFacets, bodyPartLabel, equipmentLabel, targetLabel, PAGE_SIZE } from "../../data/exerciseLibrary.js";
import ExerciseDetail from "./ExerciseDetail.jsx";

const accent = C.green;

/* Sélecteur d'exercices partagé (feuille modale) : recherche + filtres (partie
   du corps / matériel / muscle), multi-sélection et fiche détail. Réutilisé par
   la « séance libre » du joueur ET le compositeur de programmes du staff.
   `isAdded(ex)` marque les exercices déjà présents dans la cible (non
   sélectionnables). « Ajouter (N) » renvoie les exercices choisis via onAdd. */
export default function ExercisePickerSheet({ onAdd, onClose, isAdded }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [target, setTarget] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState({}); // ref → exercice choisi
  const [detail, setDetail] = useState(null);

  const facets = useExerciseFacets();
  const { exercises, total, loading } = useExerciseLibrary({ search, bodyPart, equipment, target, page });
  const setFilter = (setter) => (v) => { setter(v); setPage(0); };

  const nPicked = Object.keys(picked).length;
  const togglePick = (ex) => setPicked((p) => {
    const n = { ...p };
    if (n[ex.ref]) delete n[ex.ref]; else n[ex.ref] = ex;
    return n;
  });

  const confirm = () => { onAdd(Object.values(picked)); onClose(); };

  const selStyle = { flex: "1 1 30%", minWidth: 110, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 9px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" };

  return (
    <Overlay onClose={onClose} sheet z={330}>
      <div style={{ padding: "6px 18px 24px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{t("shared.expick.title")}</div>

        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search size={14} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setFilter(setSearch)(e.target.value)} placeholder={t("shared.exlib.search")} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px 9px 32px", color: "#fff", fontSize: 12.5, outline: "none" }} />
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

        {loading ? (
          <div style={{ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{t("common.loading")}</div>
        ) : exercises.length === 0 ? (
          <div style={{ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{t("shared.exlib.empty")}</div>
        ) : (
          exercises.map((e) => {
            const already = isAdded?.(e);
            const on = !!picked[e.ref];
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}`, opacity: already ? 0.5 : 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Dumbbell size={16} color="rgba(255,255,255,0.3)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{e.name}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                    <Tag c={accent}>{bodyPartLabel(t, e.bodyPart)}</Tag>
                    {already && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{t("shared.expick.alreadyAdded")}</span>}
                  </div>
                </div>
                <button onClick={() => setDetail(e)} title={t("shared.expick.detail")} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={14} />
                </button>
                <button onClick={() => !already && togglePick(e)} disabled={already} title={on ? t("shared.expick.selected") : t("shared.expick.select")} style={{ width: 34, height: 34, borderRadius: 8, border: on ? "none" : `1px solid ${accent}66`, background: on ? accent : `${accent}18`, color: "#fff", cursor: already ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {on ? <Check size={16} /> : <Plus size={16} color={accent} />}
                </button>
              </div>
            );
          })
        )}

        {!loading && total > PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={pagerBtn(page === 0)}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{t("shared.exlib.pageOf", { page: page + 1, total: Math.max(1, Math.ceil(total / PAGE_SIZE)) })}</div>
            <button onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE < total ? p + 1 : p))} disabled={(page + 1) * PAGE_SIZE >= total} style={pagerBtn((page + 1) * PAGE_SIZE >= total)}><ChevronRight size={16} /></button>
          </div>
        )}

        <button onClick={confirm} disabled={nPicked === 0} style={{ width: "100%", marginTop: 16, background: nPicked ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 13, cursor: nPicked ? "pointer" : "default" }}>
          {t("shared.expick.add", { count: nPicked })}
        </button>
      </div>

      {detail && <ExerciseDetail ex={detail} onClose={() => setDetail(null)} />}
    </Overlay>
  );
}

const pagerBtn = (disabled) => ({ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "#fff", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "flex", alignItems: "center" });
