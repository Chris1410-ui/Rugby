import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { Download } from "../../lib/icons.jsx";
import { renderProgramHtml } from "../../lib/program/template.js";
import { getExercisesByRefs } from "../../data/exerciseLibrary.js";
import ExerciseDetail from "./ExerciseDetail.jsx";

/* Consultation d'un PROTOCOLE : rend la page « stade » (renderProgramHtml) dans
   une iframe isolée — fidèle à l'export/PDF. Les exercices liés sont cliquables
   (postMessage → ouverture de la fiche in-app). Impression navigateur dispo ;
   l'export PDF serveur arrive en PR4. `doc` = contenu { meta, sections }. */
export default function ProgramView({ doc, title, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const iframeRef = useRef(null);
  const [exMap, setExMap] = useState({});
  const [detail, setDetail] = useState(null);

  // Résout les exercices liés (attribution / média / fiche) par leurs refs.
  useEffect(() => {
    const refs = [];
    (doc?.sections || []).forEach((s) => { if (s.type === "exercises") (s.rows || []).forEach((r) => r.exerciseRef && refs.push(r.exerciseRef)); });
    let alive = true;
    getExercisesByRefs(refs).then((m) => { if (alive) setExMap(m); });
    return () => { alive = false; };
  }, [doc]);

  const html = useMemo(() => renderProgramHtml(doc, { interactive: true, exercisesByRef: exMap }), [doc, exMap]);

  // Clic sur un exercice lié dans l'iframe → ouvre sa fiche.
  useEffect(() => {
    const onMsg = (e) => { if (e.data?.type === "protocol-exercise") { const ex = exMap[e.data.ref]; if (ex) setDetail(ex); } };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [exMap]);

  const print = () => { try { iframeRef.current?.contentWindow?.focus(); iframeRef.current?.contentWindow?.print(); } catch { /* noop */ } };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0D1117", zIndex: 400, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "#0D1117" }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: "#E8EDF3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || t("protocols.untitled")}</div>
        <button onClick={print} title={t("protocols.print")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 12px", color: "#E8EDF3", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Download size={15} /> {t("protocols.print")}
        </button>
        <CloseX onClose={onClose} />
      </div>
      <iframe ref={iframeRef} title={title || t("protocols.title")} srcDoc={html} style={{ flex: 1, width: "100%", border: "none", background: "#0D1117" }} />
      {detail && <ExerciseDetail ex={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
