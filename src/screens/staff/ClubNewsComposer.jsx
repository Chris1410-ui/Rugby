import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { localeTag } from "../../i18n/locale.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { Megaphone, Trash2 } from "../../lib/icons.jsx";
import { useClubNews, publishClubNews, updateClubNews, deleteClubNews } from "../../data/clubNews.js";

/* Composer d'actualité du club (staff écrivain / owner). Publie via la RPC
   (contrôle d'accès + fan-out notifications/push optionnel). Gère aussi
   l'édition/suppression et l'épinglage de l'historique. `authorLabel` = nom/rôle
   staff affiché (non pseudonymisé). */
export default function ClubNewsComposer({ teamId, authorLabel, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const { items, refresh } = useClubNews(teamId, 50);
  const [kind, setKind] = useState("actu");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13.5, outline: "none", boxSizing: "border-box" };

  const publish = async () => {
    if (!body.trim()) { setErr(t("staff.news.errBody")); return; }
    setBusy(true); setErr("");
    try {
      await publishClubNews({ title: title.trim(), body: body.trim(), kind, pinned, notify, authorLabel });
      setTitle(""); setBody(""); setPinned(false); setKind("actu");
      await refresh();
    } catch (e) { setErr(e?.message === "not_allowed" ? t("staff.news.errNotAllowed") : (e?.message || t("staff.news.errPublish"))); }
    finally { setBusy(false); }
  };
  const togglePin = async (n) => { try { await updateClubNews(n.id, { pinned: !n.pinned }); await refresh(); } catch (e) { console.error(e.message); } };
  const remove = async (n) => { if (!window.confirm(t("staff.news.confirmDelete"))) return; try { await deleteClubNews(n.id); await refresh(); } catch (e) { console.error(e.message); } };
  const fmt = (iso) => new Date(iso).toLocaleDateString(localeTag(), { day: "numeric", month: "short" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px 12px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.panel, borderRadius: 18, padding: 20, margin: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <Megaphone size={19} color={C.viol} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{t("staff.news.title")}</div>
          <CloseX onClose={onClose} />
        </div>

        {/* Type */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["actu", t("staff.news.kindActu")], ["mot", t("staff.news.kindMot")]].map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} style={{ flex: 1, minHeight: 40, borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: kind === k ? "#fff" : "rgba(255,255,255,0.6)", background: kind === k ? `${C.viol}33` : "rgba(255,255,255,0.05)", border: `1.5px solid ${kind === k ? C.viol : C.border}` }}>{l}</button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("staff.news.titlePh")} style={{ ...inp, marginBottom: 8 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("staff.news.bodyPh")} rows={4} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> {t("staff.news.pinned")}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> {t("staff.news.notify")}
          </label>
        </div>
        {err && <div style={{ fontSize: 11.5, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={publish} disabled={busy} style={{ width: "100%", minHeight: 46, background: C.coral, border: "none", borderRadius: 11, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? t("staff.news.publishing") : t("staff.news.publish")}</button>

        {/* Historique / gestion */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", margin: "18px 0 8px" }}>{t("staff.news.manage")}</div>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("staff.news.empty")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {items.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 11px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.kind === "mot" && <span style={{ color: C.amb }}>[{t("player.home.motStaff")}] </span>}{n.title || n.body}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{fmt(n.publishedAt)}</div>
                </div>
                <button onClick={() => togglePin(n)} title={t("staff.news.pinned")} style={{ background: n.pinned ? `${C.amb}22` : "rgba(255,255,255,0.06)", border: `1px solid ${n.pinned ? C.amb + "66" : C.border}`, borderRadius: 8, padding: "6px 8px", color: n.pinned ? C.amb : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>📌</button>
                <button onClick={() => remove(n)} title={t("staff.news.delete")} style={{ background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 8, padding: 7, color: C.coral, cursor: "pointer", display: "flex", flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
