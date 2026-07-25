import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, sc } from "../../lib/tokens.js";
import { CloseX, useModalClose, Tag } from "../../lib/ui.jsx";
import { useReadOnly } from "../../lib/readonly.js";
import { Plus, Trash2, FileText, Download } from "../../lib/icons.jsx";
import { getClubId } from "../../data/catalog.js";
import { useReferenceDocs, uploadReferenceDoc, deleteReferenceDoc, referenceDocUrl } from "../../data/referenceDocs.js";

const accent = C.viol;

/* « Documents de référence » (staff/owner) : dépôt de PDF de méthodo / doctrine
   qui enrichissent la base de connaissance (analyse LLM en PR6). Provenance
   obligatoire (case auteur/autorisation + source) ; scope club strict, jamais
   inter-club. */
export default function ReferenceDocs({ teamId }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const [clubId, setClubId] = useState(null);
  const { docs, loading, refresh } = useReferenceDocs(clubId);
  const [form, setForm] = useState(false);

  useEffect(() => { let a = true; getClubId(teamId).then((id) => { if (a) setClubId(id); }); return () => { a = false; }; }, [teamId]);

  const del = (d) => {
    if (confirm(t("staff.refdocs.delConfirm"))) deleteReferenceDoc(d).then(refresh).catch((e) => console.error(e.message));
  };
  const open = async (d) => {
    try { const url = await referenceDocUrl(d.storagePath); if (url) window.open(url, "_blank", "noopener"); }
    catch (e) { console.error("[refdoc url]", e.message); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>📚</span>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.refdocs.title", { count: docs.length })}</div>
        {!readOnly && <button onClick={() => setForm(true)} disabled={!clubId} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: clubId ? "pointer" : "default", opacity: clubId ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("staff.refdocs.addBtn")}</button>}
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 1.5 }}>{t("staff.refdocs.hint")}</div>

      {loading ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 0" }}>{t("common.loading")}</div>
      ) : docs.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>{t("staff.refdocs.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map((d) => (
            <div key={d.id} style={sc({ padding: 12, display: "flex", alignItems: "center", gap: 12 })}>
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", color: accent }}><FileText size={17} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                  {d.theme && <Tag c={C.teal}>{d.theme}</Tag>}
                  {d.tags.slice(0, 3).map((tg) => <Tag key={tg} c={"rgba(255,255,255,0.4)"}>{tg}</Tag>)}
                  {!d.authorOwned && <Tag c={C.amb}>{t("staff.refdocs.noRights")}</Tag>}
                </div>
                {d.source && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{t("staff.refdocs.sourceLabel")} {d.source}</div>}
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{new Date(d.createdAt).toLocaleDateString(localeTag())} · {t("staff.refdocs.clubOnly")}</div>
              </div>
              {d.storagePath && <button onClick={() => open(d)} title={t("staff.refdocs.openPdf")} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex" }}><Download size={15} /></button>}
              {!readOnly && <button onClick={() => del(d)} title={t("staff.refdocs.delete")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      )}

      {form && <UploadForm teamId={teamId} clubId={clubId} onClose={(ok) => { setForm(false); if (ok) refresh(); }} />}
    </section>
  );
}

function UploadForm({ teamId, clubId, onClose }) {
  const { t } = useTranslation();
  useModalClose(() => onClose(false));
  const [d, setD] = useState({ title: "", theme: "", source: "", tags: "", objective: "" });
  const [file, setFile] = useState(null);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setErr(""); };

  const submit = async () => {
    if (!file) return setErr(t("staff.refdocs.errFile"));
    if (!owned) return setErr(t("staff.refdocs.errOwned"));
    setBusy(true); setErr("");
    try {
      await uploadReferenceDoc(teamId, clubId, file, {
        title: d.title || file.name, theme: d.theme, source: d.source,
        tags: d.tags.split(",").map((x) => x.trim()).filter(Boolean),
        objective: d.objective, authorOwned: true,
      });
      onClose(true);
    } catch (e) { setErr(t("staff.refdocs.errSave", { err: e.message || "" })); setBusy(false); }
  };
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" };
  const lbl = { fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 4 };

  return (
    <div onClick={() => onClose(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("staff.refdocs.newTitle")}</div>
          <CloseX onClose={() => onClose(false)} />
        </div>

        <div style={lbl}>{t("staff.refdocs.lblFile")}</div>
        <input type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; setFile(f || null); if (f && !d.title) set("title", f.name.replace(/\.pdf$/i, "")); }} style={{ ...inp, padding: 8 }} />

        <input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder={t("staff.refdocs.titlePh")} maxLength={140} style={inp} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><div style={lbl}>{t("staff.refdocs.lblTheme")}</div><input value={d.theme} onChange={(e) => set("theme", e.target.value)} placeholder={t("staff.refdocs.themePh")} style={inp} /></div>
          <div style={{ flex: 1 }}><div style={lbl}>{t("staff.refdocs.lblObjective")}</div><input value={d.objective} onChange={(e) => set("objective", e.target.value)} placeholder={t("staff.refdocs.objectivePh")} style={inp} /></div>
        </div>
        <div style={lbl}>{t("staff.refdocs.lblTags")}</div>
        <input value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder={t("staff.refdocs.tagsPh")} style={inp} />
        <div style={lbl}>{t("staff.refdocs.lblSource")}</div>
        <input value={d.source} onChange={(e) => set("source", e.target.value)} placeholder={t("staff.refdocs.sourcePh")} style={inp} />

        <label style={{ display: "flex", alignItems: "flex-start", gap: 9, background: owned ? `${C.green}14` : "rgba(255,255,255,0.04)", border: `1px solid ${owned ? C.green + "66" : C.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", marginBottom: 12 }}>
          <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} style={{ marginTop: 2, accentColor: C.green }} />
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.45 }}>{t("staff.refdocs.ownedLabel")}</span>
        </label>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 12, lineHeight: 1.5 }}>{t("staff.refdocs.privacyNote")}</div>

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? t("staff.refdocs.uploading") : t("staff.refdocs.save")}</button>
      </div>
    </div>
  );
}
