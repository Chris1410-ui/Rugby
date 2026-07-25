import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../../lib/tokens.js";
import { Dumbbell, Plus, Trash2, Pencil, Eye, EyeOff, FileText, ExternalLink, BookOpen, Sparkles } from "../../../lib/icons.jsx";
import { localeTag } from "../../../i18n/locale.js";
import { useProgramDocs, createProgramDoc, deleteProgramDoc, setProgramStatus, getProgramDoc } from "../../../data/programDocs.js";
import { getClubId, verseDocToCatalog, useClubCatalog, deleteCatalogEntry } from "../../../data/catalog.js";
import { emptyProgram } from "../../../lib/program/model.js";
import ProgramEditor from "./ProgramEditor.jsx";
import ProgramView from "../../shared/ProgramView.jsx";

const ACCENT = C.coral;

/* Écran staff « Protocoles » : liste des programmes d'entraînement riches du club
   + création / duplication / publication / suppression, et ouverture de
   l'éditeur. Réservé au staff écrivain (le nav est masqué en lecture seule). */
export default function Protocoles({ teamId, players = [] }) {
  const { t } = useTranslation();
  const { docs, loading, refresh } = useProgramDocs(teamId);
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null); // { title, doc } en consultation
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [clubId, setClubId] = useState(null);   // club auquel est ancré le catalogue
  const [flash, setFlash] = useState("");        // récap du versement au catalogue
  const [showCatalog, setShowCatalog] = useState(false);
  const { entries: catalog, refresh: refreshCatalog } = useClubCatalog(clubId);

  useEffect(() => { let a = true; getClubId(teamId).then((id) => { if (a) setClubId(id); }); return () => { a = false; }; }, [teamId]);

  // « Verser au catalogue » : extrait les sections réutilisables d'un protocole
  // et les dépose (dédupliquées) dans le catalogue du club.
  const verse = async (row) => {
    if (busy || !clubId) return;
    setBusy(true); setFlash("");
    try {
      const full = await getProgramDoc(row.id);
      const { total, created, merged } = await verseDocToCatalog({ clubId, teamId, doc: full.doc });
      setFlash(total === 0 ? t("catalog.verseEmpty") : t("catalog.verseDone", { created, merged, total }));
      await refreshCatalog();
      setShowCatalog(true);
    } catch (e) {
      setFlash(t("catalog.verseErr", { err: e.message || "" }));
    }
    setBusy(false);
    setTimeout(() => setFlash(""), 6000);
  };

  const openView = async (row) => {
    try { const full = await getProgramDoc(row.id); setViewing({ id: full.id, title: full.title, doc: full.doc }); }
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
    return <ProgramEditor id={editingId} teamId={teamId} players={players} onClose={() => { setEditingId(null); refresh(); }} />;
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

      {flash && (
        <div style={sc({ marginBottom: 12, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.9)", background: flash.startsWith("⚠") ? `${C.amb}1a` : `${C.viol}1a`, borderColor: `${C.viol}55` })}>{flash}</div>
      )}

      <CatalogPanel entries={catalog} open={showCatalog} onToggle={() => setShowCatalog((v) => !v)} onDelete={async (id) => { try { await deleteCatalogEntry(id); await refreshCatalog(); } catch (e) { console.error("[catalog del]", e.message); } }} t={t} />


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
                <div onClick={() => openView(d)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }} title={t("protocols.view")}>
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
                <button onClick={() => verse(d)} disabled={busy || !clubId} title={t("catalog.verse")} style={{ ...iconBtn, color: C.viol, borderColor: `${C.viol}66`, background: `${C.viol}14` }}>
                  <Sparkles size={15} />
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

      {viewing && <ProgramView id={viewing.id} doc={viewing.doc} title={viewing.title} onClose={() => setViewing(null)} onEdit={() => { const vid = viewing.id; setViewing(null); setEditingId(vid); }} />}

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

/* Panneau « Catalogue du club » (repliable) : sections-types candidates extraites
   des protocoles, les plus reprises en tête. En PR1, club-local (pas de partage).
   Chaque entrée : type fonctionnel, objectif, matériel, compteur d'usage. */
function CatalogPanel({ entries = [], open, onToggle, onDelete, t }) {
  const kindLabel = (k) => t(`catalog.kind.${k}`, { defaultValue: k });
  return (
    <div style={sc({ marginBottom: 14, padding: 0, overflow: "hidden" })}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
        <BookOpen size={16} color={C.viol} />
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, textAlign: "left" }}>{t("catalog.title")}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.viol, background: `${C.viol}1e`, border: `1px solid ${C.viol}55`, borderRadius: 6, padding: "2px 8px" }}>{entries.length}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          {entries.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", padding: "6px 0 10px", lineHeight: 1.5 }}>{t("catalog.empty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 9 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 3 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: C.viol, background: `${C.viol}1c`, borderRadius: 5, padding: "1px 6px" }}>{kindLabel(e.kind)}</span>
                      {e.objective && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "1px 6px" }}>{t(`data.nature.${e.objective}`, { defaultValue: e.objective })}</span>}
                      {e.equipment.slice(0, 3).map((eq) => <span key={eq} style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>· {eq}</span>)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)", flexShrink: 0 }} title={t("catalog.usageTitle")}>×{e.usageCount}</span>
                  <button onClick={() => onDelete(e.id)} title={t("protocols.delete")} style={{ ...iconBtn, padding: 6 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnPrimary = { background: ACCENT, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const iconBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 8, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", flexShrink: 0 };
