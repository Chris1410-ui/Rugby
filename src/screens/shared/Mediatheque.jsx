import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { CloseX, useModalClose, Tag } from "../../lib/ui.jsx";
import { Video, Plus, Trash2, Pencil, ExternalLink } from "../../lib/icons.jsx";
import { useTeamMedia, addMedia, updateMedia, deleteMedia } from "../../data/media.js";
import { MEDIA_THEMES, detectPlatform, mediaThumb, mediaEmbed, safeVideoUrl } from "../../lib/media.js";

const PLAT_LABEL = { youtube: "YouTube", instagram: "Instagram" };
const PLAT_COLOR = { youtube: "#ff4d4f", instagram: "#c13584", autre: C.teal };

/* Médiathèque vidéos du club (thème). Lecture ouverte à tout le club ; ajout /
   suppression réservés au staff (`canEdit`). Vignette auto YouTube ; lecteur
   intégré (embed) ou ouverture dans un nouvel onglet. */
export default function Mediatheque({ teamId, canEdit = false, accent = C.coral }) {
  const { t } = useTranslation();
  const { media, loading } = useTeamMedia(teamId);
  const [theme, setTheme] = useState("all");
  const [sel, setSel] = useState(null);   // média ouvert (lecteur)
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);   // média en cours d'édition

  const themes = useMemo(() => [...new Set(media.map((m) => m.theme).filter(Boolean))], [media]);
  const shown = theme === "all" ? media : media.filter((m) => m.theme === theme);

  const del = (id) => { if (confirm(t("shared.media.delConfirm"))) deleteMedia(id).catch((e) => console.error(e.message)); };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Video size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("shared.media.title", { count: media.length })}</div>
        {canEdit && (
          <button onClick={() => setAdding(true)} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> {t("shared.media.add")}
          </button>
        )}
      </div>

      {/* Filtre par thème */}
      {themes.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {["all", ...themes].map((th) => (
            <button key={th} onClick={() => setTheme(th)} style={{ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: theme === th ? accent : "rgba(255,255,255,0.07)", color: "#fff", whiteSpace: "nowrap" }}>
              {th === "all" ? t("shared.media.filterAll") : th}
            </button>
          ))}
        </div>
      )}

      {loading && media.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.55)", fontSize: 12 })}>{t("shared.media.loading")}</div>
      ) : shown.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          {t("shared.media.emptyBase", { scope: theme !== "all" ? t("shared.media.emptyScope") : "" })}{canEdit ? t("shared.media.emptyHint") : ""}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {shown.map((m) => <Tile key={m.id} m={m} canEdit={canEdit} onOpen={() => setSel(m)} onEdit={() => setEditing(m)} onDelete={() => del(m.id)} />)}
        </div>
      )}

      {sel && <Player m={sel} onClose={() => setSel(null)} />}
      {adding && <MediaModal teamId={teamId} themes={themes} onClose={() => setAdding(false)} accent={accent} />}
      {editing && <MediaModal teamId={teamId} media={editing} themes={themes} onClose={() => setEditing(null)} accent={accent} />}
    </section>
  );
}

function Tile({ m, canEdit, onOpen, onEdit, onDelete }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const thumb = mediaThumb(m);
  const plat = m.plateforme || detectPlatform(m.url);
  return (
    <div style={sc({ padding: 0, overflow: "hidden", cursor: "pointer", position: "relative" })} onClick={onOpen}>
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {thumb && !broken ? (
          <img src={thumb} alt="" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Video size={26} color="rgba(255,255,255,0.35)" />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16 }}>▶</div>
        </div>
        <span style={{ position: "absolute", top: 6, left: 6, fontSize: 8.5, fontWeight: 800, color: "#fff", background: PLAT_COLOR[plat], borderRadius: 5, padding: "1px 6px" }}>{PLAT_LABEL[plat] || t("shared.media.linkLabel")}</span>
        {canEdit && (
          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 5 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title={t("shared.media.editTitle")} style={{ background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 7, padding: 5, color: "#fff", cursor: "pointer", display: "flex" }}>
              <Pencil size={13} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title={t("shared.media.deleteTitle")} style={{ background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 7, padding: 5, color: "#fff", cursor: "pointer", display: "flex" }}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.titre}</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{m.theme}</div>
      </div>
    </div>
  );
}

function Player({ m, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const embed = mediaEmbed(m);
  const open = safeVideoUrl(m.url);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, background: C.navy, borderRadius: 16, padding: 16, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{m.titre}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{m.theme} · {PLAT_LABEL[m.plateforme] || t("shared.media.linkLabel")}</div>
          </div>
          <CloseX onClose={onClose} />
        </div>
        {embed ? (
          <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#000", borderRadius: 10, overflow: "hidden" }}>
            <iframe src={embed} title={m.titre} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
          </div>
        ) : (
          <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.7)", fontSize: 12.5, lineHeight: 1.6 })}>
            {t("shared.media.noEmbed")}
          </div>
        )}
        {open && (
          <a href={open} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            <ExternalLink size={14} /> {t("shared.media.openNewTab")}
          </a>
        )}
      </div>
    </div>
  );
}

/* Modal add/edit. `media` fourni → édition (thème, titre, URL) ; sinon → ajout.
   La vignette (thumb) n'est proposée qu'à l'ajout d'un lien non-YouTube. */
function MediaModal({ teamId, media, themes, onClose, accent }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const isEdit = !!media;
  const [url, setUrl] = useState(media?.url || "");
  const [titre, setTitre] = useState(media?.titre || "");
  const [theme, setTheme] = useState(media?.theme || "");
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const suggestions = [...new Set([...MEDIA_THEMES, ...themes])];
  const plat = url ? detectPlatform(url) : null;

  const save = async () => {
    if (!/^https?:\/\/\S+/i.test(url.trim())) return setErr(t("shared.media.errUrl"));
    if (!titre.trim()) return setErr(t("shared.media.errTitle"));
    if (!theme.trim()) return setErr(t("shared.media.errTheme"));
    setBusy(true); setErr("");
    try {
      if (isEdit) await updateMedia(media.id, { theme, titre, url });
      else await addMedia(teamId, { theme, titre, url, thumbUrl: thumb });
      onClose();
    } catch (e) { setErr(t("shared.media.errSave", { err: e.message || "" })); setBusy(false); }
  };
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{isEdit ? t("shared.media.modalEdit") : t("shared.media.modalAdd")}</div>
          <CloseX onClose={onClose} />
        </div>
        <input value={url} onChange={(e) => { setUrl(e.target.value); setErr(""); }} placeholder={t("shared.media.urlPlaceholder")} style={inp} />
        {plat && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: -4, marginBottom: 10 }}>{t("shared.media.platformDetected")}<b style={{ color: PLAT_COLOR[plat] }}>{PLAT_LABEL[plat] || t("shared.media.linkLabel")}</b>{plat !== "youtube" ? (isEdit ? t("shared.media.thumbGenericEdit") : t("shared.media.thumbGenericAdd")) : ""}</div>}
        <input value={titre} onChange={(e) => { setTitre(e.target.value); setErr(""); }} placeholder={t("shared.media.titrePlaceholder")} maxLength={120} style={inp} />
        <input value={theme} onChange={(e) => { setTheme(e.target.value); setErr(""); }} placeholder={t("shared.media.themePlaceholder")} list="media-themes" style={inp} />
        <datalist id="media-themes">{suggestions.map((th) => <option key={th} value={th} />)}</datalist>
        {!isEdit && plat && plat !== "youtube" && (
          <input value={thumb} onChange={(e) => setThumb(e.target.value)} placeholder={t("shared.media.thumbPlaceholder")} style={inp} />
        )}
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : isEdit ? t("shared.media.saveEdit") : t("shared.media.saveAdd")}</button>
      </div>
    </div>
  );
}
