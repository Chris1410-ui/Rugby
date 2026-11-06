import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Overlay } from "../../lib/ui.jsx";
import { parseSpreadsheetFile } from "../../lib/spreadsheet.js";
import { importCivilNames, clearCivilNames } from "../../data/civilNames.js";
import { Upload, CheckCircle, AlertTriangle, Trash2 } from "../../lib/icons.jsx";

/* Import des noms civils par TOTEM (staff/owner). Fichier .csv/.xlsx → mappage
   des colonnes (totem + nom) → aperçu des correspondances → import. L'owner
   peut tout effacer (droit à l'effacement). Rien n'est stocké tant que « Importer »
   n'est pas cliqué ; le serveur re-vérifie l'autorisation et les totems. */
export default function CivilNamesSheet({ players = [], isOwner = false, onClose, onImported }) {
  const { t } = useTranslation();
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [colTotem, setColTotem] = useState("");
  const [colName, setColName] = useState("");
  const [colName2, setColName2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { matched, unmatched }

  // Totems connus (players.name) → set pour l'aperçu client.
  const totemSet = useMemo(() => new Set(players.map((p) => (p.name || "").trim().toLowerCase())), [players]);

  const onFile = async (file) => {
    if (!file) return;
    setErr(""); setResult(null);
    try {
      const data = await parseSpreadsheetFile(file);
      if (!data.length) { setErr(t("staff.names.errEmpty")); return; }
      const hs = Object.keys(data[0] || {});
      setHeaders(hs); setRows(data);
      // Devine les colonnes.
      const guess = (re) => hs.find((h) => re.test(h)) || "";
      setColTotem(guess(/totem|pseudo|surnom/i) || "");
      setColName(guess(/(^|[^é])nom|name|last/i) || "");
      setColName2(guess(/pr[ée]nom|first/i) || "");
    } catch (e) { setErr(e.message || t("staff.names.errParse")); }
  };

  // Lignes { totem, name } construites depuis le mappage.
  const mapped = useMemo(() => {
    if (!colTotem || !colName) return [];
    return rows
      .map((r) => {
        const totem = String(r[colTotem] ?? "").trim();
        const n1 = String(r[colName] ?? "").trim();
        const n2 = colName2 ? String(r[colName2] ?? "").trim() : "";
        const name = [n1, n2].filter(Boolean).join(" ");
        return { totem, name };
      })
      .filter((x) => x.totem && x.name);
  }, [rows, colTotem, colName, colName2]);

  const preview = useMemo(() => {
    const matched = [], unmatched = [];
    for (const m of mapped) (totemSet.has(m.totem.toLowerCase()) ? matched : unmatched).push(m);
    return { matched, unmatched };
  }, [mapped, totemSet]);

  const doImport = async () => {
    if (!mapped.length) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const res = await importCivilNames(mapped);
      setResult(res);
      onImported?.();
    } catch (e) {
      setErr(e.message?.includes("NOT_AUTHORIZED") ? t("staff.names.errAuth") : (e.message || t("staff.names.errImport")));
    }
    setBusy(false);
  };

  const doClear = async () => {
    if (!window.confirm(t("staff.names.clearConfirm"))) return;
    setBusy(true); setErr("");
    try {
      const n = await clearCivilNames();
      setResult({ cleared: n, matched: [], unmatched: [] });
      onImported?.();
    } catch (e) {
      setErr(e.message?.includes("OWNER_ONLY") ? t("staff.names.errOwner") : (e.message || t("staff.names.errClear")));
    }
    setBusy(false);
  };

  const sel = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", colorScheme: "dark", width: "100%", minHeight: 40 };
  const lbl = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 5 };

  return (
    <Overlay onClose={onClose} sheet z={340}>
      <div style={{ padding: "4px 18px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 900 }}>{t("staff.names.title")}</div>
      </div>
      <div style={{ padding: "0 18px 24px" }}>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 14 }}>{t("staff.names.intro")}</div>

        {/* Upload */}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: "16px 12px", cursor: "pointer", marginBottom: 14, background: "rgba(255,255,255,0.03)" }}>
          <Upload size={18} color={C.viol} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("staff.names.pick")}</span>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "none" }} />
        </label>

        {headers.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><div style={lbl}>{t("staff.names.colTotem")}</div>
                <select value={colTotem} onChange={(e) => setColTotem(e.target.value)} style={sel}>
                  <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select></div>
              <div><div style={lbl}>{t("staff.names.colName")}</div>
                <select value={colName} onChange={(e) => setColName(e.target.value)} style={sel}>
                  <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select></div>
              <div><div style={lbl}>{t("staff.names.colName2")}</div>
                <select value={colName2} onChange={(e) => setColName2(e.target.value)} style={sel}>
                  <option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select></div>
            </div>

            {/* Aperçu */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <Stat icon={<CheckCircle size={14} color={C.green} />} n={preview.matched.length} label={t("staff.names.matched")} color={C.green} />
              <Stat icon={<AlertTriangle size={14} color={C.amb} />} n={preview.unmatched.length} label={t("staff.names.unmatched")} color={C.amb} />
            </div>
            {preview.unmatched.length > 0 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", background: `${C.amb}12`, border: `1px solid ${C.amb}40`, borderRadius: 9, padding: "8px 10px", marginBottom: 12, lineHeight: 1.5 }}>
                <b>{t("staff.names.unmatchedHint")}</b> {preview.unmatched.slice(0, 12).map((x) => x.totem).join(", ")}{preview.unmatched.length > 12 ? "…" : ""}
              </div>
            )}
          </>
        )}

        {err && <div style={{ fontSize: 11.5, color: C.coral, margin: "4px 0 10px", textAlign: "center" }}>{err}</div>}
        {result && (
          <div style={{ fontSize: 12, color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}44`, borderRadius: 9, padding: "9px 11px", marginBottom: 12, textAlign: "center", fontWeight: 700 }}>
            {result.cleared != null
              ? t("staff.names.cleared", { count: result.cleared })
              : t("staff.names.imported", { count: result.matched.length, skipped: result.unmatched.length })}
          </div>
        )}

        <button onClick={doImport} disabled={busy || !mapped.length} style={{ width: "100%", background: busy || !mapped.length ? "rgba(255,255,255,0.1)" : C.green, border: "none", borderRadius: 11, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy || !mapped.length ? "default" : "pointer" }}>
          {t("staff.names.importBtn", { count: preview.matched.length })}
        </button>

        {isOwner && (
          <button onClick={doClear} disabled={busy} style={{ width: "100%", marginTop: 10, background: "none", border: `1px solid ${C.coral}55`, borderRadius: 11, padding: 11, color: C.coral, fontWeight: 800, fontSize: 12.5, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Trash2 size={14} color={C.coral} /> {t("staff.names.clearBtn")}
          </button>
        )}
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 12, lineHeight: 1.5 }}>{t("staff.names.privacy")}</div>
      </div>
    </Overlay>
  );
}

function Stat({ icon, n, label, color }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 11px" }}>
      {icon}
      <span style={{ fontSize: 18, fontWeight: 900, color }}>{n}</span>
      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{label}</span>
    </div>
  );
}
