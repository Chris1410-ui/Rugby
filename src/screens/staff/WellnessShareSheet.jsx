import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { localeTag } from "../../i18n/locale.js";
import { Overlay } from "../../lib/ui.jsx";
import { createShareLink, listShareLinks, revokeShareLink } from "../../data/wellnessShare.js";
import { Clock, Trash2, CheckCircle } from "../../lib/icons.jsx";

/* Générer / gérer les liens de consultation Wellness (owner/staff écrivain).
   Le lien ponctuel s'envoie soi-même (WhatsApp/SMS). Liste des liens actifs +
   révocation. Le token brut n'apparaît QUE juste après génération. */
export default function WellnessShareSheet({ teamId = null, onClose }) {
  const { t } = useTranslation();
  const [ttl, setTtl] = useState(48);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fresh, setFresh] = useState(null); // { url, expiresAt } du lien à peine créé
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState([]);

  const refresh = useCallback(async () => {
    try { setLinks(await listShareLinks(teamId)); } catch { /* RLS → vide */ }
  }, [teamId]);
  useEffect(() => { refresh(); }, [refresh]);

  const generate = async () => {
    if (busy) return;
    setBusy(true); setErr(""); setCopied(false);
    try {
      const res = await createShareLink({ teamId, ttlHours: ttl, label });
      setFresh(res); setLabel("");
      await refresh();
    } catch (e) {
      setErr(e?.message?.includes("NOT_AUTHORIZED") ? t("share.errAuth") : t("share.errGeneric"));
    }
    setBusy(false);
  };

  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* noop */ }
  };
  const nativeShare = (url) => {
    const text = t("share.shareText");
    if (navigator.share) { navigator.share({ text, url }).catch(() => {}); }
    else { window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener"); }
  };

  const doRevoke = async (id) => {
    if (!window.confirm(t("share.revokeConfirm"))) return;
    try { await revokeShareLink(id); await refresh(); } catch { /* noop */ }
  };

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(localeTag(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
  const isActive = (l) => !l.revoked && new Date(l.expires_at) > new Date();
  const active = links.filter(isActive);

  const sel = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", colorScheme: "dark", minHeight: 40 };
  const inp = { ...sel, width: "100%", fontWeight: 400 };
  const lbl = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 5 };

  return (
    <Overlay onClose={onClose} sheet z={340}>
      <div style={{ padding: "4px 18px 10px", fontSize: 16, fontWeight: 900 }}>{t("share.title")}</div>
      <div style={{ padding: "0 18px 24px" }}>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 14 }}>{t("share.intro")}</div>

        {/* Génération */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div><div style={lbl}>{t("share.expiry")}</div>
            <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))} style={sel}>
              <option value={24}>24 h</option><option value={48}>48 h</option><option value={72}>72 h</option>
            </select></div>
          <div style={{ flex: 1 }}><div style={lbl}>{t("share.label")}</div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("share.labelPlaceholder")} style={inp} /></div>
        </div>
        {err && <div style={{ fontSize: 11.5, color: C.coral, margin: "2px 0 8px", textAlign: "center" }}>{err}</div>}
        <button onClick={generate} disabled={busy} style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : C.coral, border: "none", borderRadius: 11, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy ? "default" : "pointer" }}>
          {busy ? t("share.generating") : t("share.generate")}
        </button>

        {/* Lien fraîchement créé */}
        {fresh && (
          <div style={{ marginTop: 14, background: `${C.green}10`, border: `1px solid ${C.green}44`, borderRadius: 11, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.green, marginBottom: 7 }}>{t("share.ready", { date: fmtDate(fresh.expiresAt) })}</div>
            <input readOnly value={fresh.url} onFocus={(e) => e.target.select()} style={{ ...inp, fontSize: 11, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(fresh.url)} style={{ flex: 1, background: C.green, border: "none", borderRadius: 9, padding: 10, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                {copied ? t("share.copied") : t("share.copy")}
              </button>
              <button onClick={() => nativeShare(fresh.url)} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 10, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                {t("share.send")}
              </button>
            </div>
          </div>
        )}

        {/* Liens actifs */}
        <div style={{ marginTop: 20, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{t("share.activeTitle", { count: active.length })}</div>
        {active.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", padding: "8px 2px" }}>{t("share.none")}</div>
        ) : active.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: `1px solid ${C.border2}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label || t("share.untitled")}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Clock size={11} color="rgba(255,255,255,0.5)" /> {t("share.expiresAt", { date: fmtDate(l.expires_at) })} · {t("share.views", { count: l.view_count || 0 })}
              </div>
            </div>
            <button onClick={() => doRevoke(l.id)} title={t("share.revoke")} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${C.coral}14`, border: `1px solid ${C.coral}44`, borderRadius: 8, padding: "7px 10px", color: C.coral, fontSize: 11.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
              <Trash2 size={12} color={C.coral} /> {t("share.revoke")}
            </button>
          </div>
        ))}

        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 16, lineHeight: 1.5, display: "flex", gap: 7 }}>
          <CheckCircle size={13} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} /> {t("share.note")}
        </div>
      </div>
    </Overlay>
  );
}
