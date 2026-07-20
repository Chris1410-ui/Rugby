import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { CloseX, useModalClose, Tag } from "../../lib/ui.jsx";
import { Download, Upload, CheckCircle } from "../../lib/icons.jsx";
import { downloadCSV } from "../../lib/csv.js";
import { IMPORT_COLUMNS, buildPreview } from "../../lib/importPlayers.js";
import { commitImport } from "../../data/importer.js";
import { todayISO, fmtShort } from "../../lib/metrics.js";

const HEADERS = IMPORT_COLUMNS.map((c) => c.header);
// Exemple pédagogique (une ligne) pour le modèle téléchargeable.
const EXAMPLE = ["Minotaure", "8", "Troisième ligne centre", "Avants", "RC Namur", "4,72", "5'15", "1840", "3x150", "110", "180", "95", "18", "42", "98"];

const ACTION_C = { create: C.green, update: C.blue, error: C.coral };
const ACTION_LK = { create: "staff.import.actionCreate", update: "staff.import.actionUpdate", error: "staff.import.actionError" };

/* Import Excel/CSV (staff/owner) : modèle téléchargeable → dépôt fichier →
   APERÇU obligatoire (create/update, doublons, erreurs) → écriture confirmée.
   Rien n'est écrit tant que le staff n'a pas cliqué « Importer ». */
export default function ImportPlayers({ teamId, players = [], onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const [step, setStep] = useState("file"); // file | preview | done
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // { rows, counts, columnMap }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);

  const downloadTemplate = async (kind) => {
    if (kind === "csv") { downloadCSV("modele_import_joueurs.csv", [HEADERS, EXAMPLE]); return; }
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Joueurs");
    XLSX.writeFile(wb, "modele_import_joueurs.xlsx");
  };

  const onFile = async (file) => {
    if (!file) return;
    setErr(""); setBusy(true); setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!raw.length) { setErr(t("staff.import.emptyFile")); setBusy(false); return; }
      const pv = buildPreview(raw, players);
      if (!Object.keys(pv.columnMap).length) { setErr(t("staff.import.noColumn")); setBusy(false); return; }
      setPreview(pv);
      setStep("preview");
    } catch (e) { setErr(t("staff.import.readError", { err: e.message || t("staff.import.unsupportedFormat") })); }
    setBusy(false);
  };

  const doImport = async () => {
    if (!preview) return;
    setBusy(true); setErr("");
    try {
      const res = await commitImport(teamId, preview.rows, todayISO());
      setSummary(res); setStep("done");
    } catch (e) { setErr(t("staff.import.importFail", { err: e.message || "" })); }
    setBusy(false);
  };

  const validCount = preview ? preview.counts.create + preview.counts.update : 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 920, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{t("staff.import.title")}</div>
          <CloseX onClose={onClose} />
        </div>

        {/* ── Étape 1 : modèle + dépôt ── */}
        {step === "file" && (
          <div>
            <div style={sc({ padding: 14, marginBottom: 12 })}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{t("staff.import.step1")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => downloadTemplate("xlsx")} style={tplBtn}><Download size={14} /> {t("staff.import.templateXlsx")}</button>
                <button onClick={() => downloadTemplate("csv")} style={tplBtn}><Download size={14} /> {t("staff.import.templateCsv")}</button>
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 10, lineHeight: 1.6 }}>
                {t("staff.import.step1Hint")}
              </div>
            </div>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: "26px 16px", cursor: "pointer", background: "rgba(255,255,255,0.03)" }}>
              <Upload size={22} color={C.coral} />
              <div style={{ fontSize: 13, fontWeight: 700 }}>{busy ? t("staff.import.reading") : t("staff.import.step2")}</div>
              {fileName && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{fileName}</div>}
              <input type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }} onChange={(e) => onFile(e.target.files[0])} />
            </label>
            {err && <div style={{ fontSize: 12, color: C.coral, marginTop: 10 }}>{err}</div>}
          </div>
        )}

        {/* ── Étape 2 : aperçu ── */}
        {step === "preview" && preview && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <Tag c={C.green}>{t("staff.import.countCreate", { count: preview.counts.create })}</Tag>
              <Tag c={C.blue}>{t("staff.import.countUpdate", { count: preview.counts.update })}</Tag>
              {preview.counts.errors > 0 && <Tag c={C.coral}>{t("staff.import.countErrors", { count: preview.counts.errors })}</Tag>}
              {preview.counts.warnings > 0 && <Tag c={C.amb}>{t("staff.import.warnings", { count: preview.counts.warnings })}</Tag>}
            </div>
            <div style={{ overflow: "auto", flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620, fontSize: 11.5 }}>
                <thead>
                  <tr>
                    {["", t("staff.import.colTotem"), "N°", t("staff.import.colPos"), t("staff.import.colLine"), t("staff.import.colTests"), t("staff.import.colNotes")].map((h, i) => (
                      <th key={i} style={{ position: "sticky", top: 0, background: C.panel, textAlign: "left", padding: "7px 8px", fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.index} style={{ opacity: r.action === "error" ? 0.65 : 1 }}>
                      <td style={td}><span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: ACTION_C[r.action], borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>{t(ACTION_LK[r.action])}</span></td>
                      <td style={{ ...td, fontWeight: 700 }}>{r.name || "—"}</td>
                      <td style={td}>{r.num ?? "—"}</td>
                      <td style={td}>{r.pos || "—"}</td>
                      <td style={td}>{r.grp === "avants" ? t("staff.import.lineAvants") : r.grp === "arrieres" ? t("staff.import.lineArrieres") : "—"}</td>
                      <td style={td}>{Object.keys(r.metrics || {}).length || "—"}</td>
                      <td style={{ ...td, color: r.errors.length ? C.coral : "rgba(255,255,255,0.6)", fontSize: 10.5 }}>
                        {[...r.errors, ...r.warnings].join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {err && <div style={{ fontSize: 12, color: C.coral, marginBottom: 8 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setStep("file"); setPreview(null); setErr(""); }} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, padding: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("staff.import.chooseOther")}</button>
              <button onClick={doImport} disabled={busy || validCount === 0} style={{ flex: 2, background: validCount ? C.coral : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: validCount ? "pointer" : "default", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <CheckCircle size={15} /> {busy ? t("staff.import.importing") : t("staff.import.importBtn", { count: validCount })}
              </button>
            </div>
          </>
        )}

        {/* ── Étape 3 : résumé ── */}
        {step === "done" && summary && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{t("staff.import.importDone")}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
              {t("staff.import.summaryLine1", { created: summary.created, updated: summary.updated })}<br />
              {summary.results > 0 ? t("staff.import.summaryTests", { count: summary.results, date: fmtShort(todayISO()) }) : t("staff.import.summaryNoTests")}
            </div>
            <button onClick={onClose} style={{ marginTop: 16, background: C.green, border: "none", borderRadius: 10, padding: "11px 20px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("staff.import.close")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

const tplBtn = { display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const td = { padding: "7px 8px", borderBottom: `1px solid ${C.border2}`, whiteSpace: "nowrap", verticalAlign: "top" };
