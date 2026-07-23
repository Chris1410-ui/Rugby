import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../../lib/tokens.js";
import { Dumbbell, Plus, Trash2, Pencil, Eye, EyeOff, FileText, ExternalLink } from "../../../lib/icons.jsx";
import { localeTag } from "../../../i18n/locale.js";
import { useProgramDocs, createProgramDoc, deleteProgramDoc, setProgramStatus, getProgramDoc } from "../../../data/programDocs.js";
import { emptyProgram } from "../../../lib/program/model.js";
import ProgramEditor from "./ProgramEditor.jsx";
import ProgramView from "../../shared/ProgramView.jsx";

const ACCENT = C.coral;

/* Écran staff « Protocoles » : liste des programmes d'entraînement riches du club
   + création / duplication / publication / suppression, et ouverture de
   l'éditeur. Réservé au staff écrivain (le nav est masqué en lecture seule). */
export default function Protocoles({ teamId }) {
  const { t } = useTranslation();
  const { docs, loading, refresh } = useProgramDocs(teamId);
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null); // { title, doc } en consultation
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const openView = async (row) => {
    try { const full = await getProgramDoc(row.id); setViewing({ title: full.title, doc: full.doc }); }
    catch (e) { console.error("[protocols view]", e.message); }
  };

  const createNew = async () => {
    setBusy(true);
    try {
      const created = await createProgramDoc(teamId, { title: t("protocols.untitled"), weeks: 4, doc: emptyProgram(4) });
      await refresh();
      setEditingId(created.id);
    } catch (e) { console.error("[protocols create]", e.message); }
    setBusy(false);
  };

  const duplicate = async (row) => {
    setBusy(true);
    try {
      const full = await getProgramDoc(row.id);
      await createProgramDoc(teamId, {
        title: `${full.title} ${t("protocols.copySuffix")}`.trim(),
        category: full.category, weeks: full.weeks, doc: full.doc, status: "draft",
      });
      await refresh();
    } catch (e) { console.error("[protocols duplicate]", e.message); }
    setBusy(false);
  };

  const togglePublish = async (row) => {
    try { await setProgramStatus(row.id, row.status !== "published"); await refresh(); }
    catch (e) { console.error("[protocols publish]", e.message); }
  };

  const remove = async (id) => {
    setConfirmDel(null);
    try { await deleteProgramDoc(id); await refresh(); }
    catch (e) { console.error("[protocols delete]", e.message); }
  };

  if (editingId) {
    return <ProgramEditor id={editingId} onClose={() => { setEditingId(null); refresh(); }} />;
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Dumbbell size={18} color={ACCENT} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("protocols.title")}</div>
        <button onClick={createNew} disabled={busy} style={btnPrimary}>
          <Plus size={15} /> {t("protocols.new")}
        </button>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 14, maxWidth: 640, lineHeight: 1.5 }}>{t("protocols.intro")}</p>

      {loading && !docs.length ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("protocols.loading")}</div>
      ) : docs.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("protocols.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => {
            const published = d.status === "published";
            return (
              <div key={d.id} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" })}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title || t("protocols.untitled")}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {d.category && <span>{d.category}</span>}
                    <span>{t("protocols.weeksN", { count: d.weeks })}</span>
                    {d.updatedAt && <span>{t("protocols.updatedAt", { date: new Date(d.updatedAt).toLocaleDateString(localeTag()) })}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: published ? C.green : C.amb, background: published ? `${C.green}1e` : `${C.amb}1e`, border: `1px solid ${published ? C.green : C.amb}55`, borderRadius: 6, padding: "3px 7px", flexShrink: 0 }}>
                  {published ? t("protocols.statusPublished") : t("protocols.statusDraft")}
                </span>
                <button onClick={() => openView(d)} title={t("protocols.view")} style={iconBtn}>
                  <ExternalLink size={15} />
                </button>
                <button onClick={() => togglePublish(d)} title={published ? t("protocols.unpublish") : t("protocols.publish")} style={iconBtn}>
                  {published ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button onClick={() => duplicate(d)} disabled={busy} title={t("protocols.duplicate")} style={iconBtn}>
                  <FileText size={15} />
                </button>
                <button onClick={() => setEditingId(d.id)} title={t("protocols.edit")} style={{ ...iconBtn, color: ACCENT, borderColor: `${ACCENT}66`, background: `${ACCENT}14` }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => setConfirmDel(d)} title={t("protocols.delete")} style={iconBtn}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {viewing && <ProgramView doc={viewing.doc} title={viewing.title} onClose={() => setViewing(null)} />}

      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: C.panel, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{t("protocols.delete")}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", marginBottom: 16, lineHeight: 1.5 }}>{t("protocols.confirmDelete", { title: confirmDel.title || t("protocols.untitled") })}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{t("protocols.cancel")}</button>
              <button onClick={() => remove(confirmDel.id)} style={{ flex: 1, background: C.coral, border: "none", borderRadius: 10, padding: 11, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>{t("protocols.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const btnPrimary = { background: ACCENT, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const iconBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 8, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", flexShrink: 0 };
