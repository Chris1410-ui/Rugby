import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { todayISO, fmtShort } from "../../lib/metrics.js";
import { Overlay, Section } from "../../lib/ui.jsx";
import { Plus, Trash2 } from "../../lib/icons.jsx";
import { usePreview } from "../../lib/preview.js";
import { SPEED_ZONES, IMAGE_KINDS, HEATMAP_TABS, normalizeGpsMetrics, hasAnyMetric } from "../../lib/gps.js";
import { useGpsSessions, createGpsSession, uploadGpsImages, deleteGpsSession, newGpsId } from "../../data/gps.js";
import { analyzeGpsShot } from "../../data/gpsAI.js";
import { useTeamTrainings } from "../../data/trainings.js";

const PROVIDERS = ["pitchero", "catapult", "statsports", "other"];
const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl = { fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 700, display: "block", marginBottom: 3 };
const num = (v) => v.replace(/[^\d.]/g, "");
const int = (v) => v.replace(/[^\d]/g, "");
const s = (v) => (v == null ? "" : String(v)); // null (non lu) → champ vide
// Palier de confiance IA d'un champ → couleur de pastille (haute / moyenne / basse).
const confColor = (c) => (c == null ? null : c >= 0.75 ? C.green : c >= 0.5 ? "#f5b301" : C.coral);

/* Dépôt manuel de données GPS (GPS-2). Le joueur rattache la session à une
   séance/convocation du jour, ajoute éventuellement des captures (stockées, non
   analysées ici), et saisit les métriques à la main. Chaque dépôt vaut +10 pts
   (charge externe → sans impact sur sRPE/ACWR ; barème câblé en GPS-2b). */
export default function GpsDeposit({ me, sessions = [], onClose }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const today = todayISO();
  const accent = C.teal;

  const [date, setDate] = useState(today);
  const [link, setLink] = useState(null);       // { type:'session'|'training', id }
  const [files, setFiles] = useState([]);
  const [imgMeta, setImgMeta] = useState([]);   // parallèle à files : [{kind:''|'heatmap'|'stats'|'chart', tab}]
  const [provider, setProvider] = useState("");
  const [f, setF] = useState({ distance_m: "", m_per_min: "", hsr_m: "", hsr_count: "", vmax_kmh: "", vavg_kmh: "", durMin: "", durSec: "", session_name: "", notes: "" });
  const emptyZones = () => Object.fromEntries(SPEED_ZONES.map((z) => [z, { sec: "", pct: "" }]));
  const [zones, setZones] = useState(emptyZones);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // État IA : source du dépôt courant, confiance par champ, alerte nom, warnings,
  // et message de repli (IA non configurée / quota atteint).
  const [source, setSource] = useState("manual");
  const [ai, setAi] = useState(null);            // { conf:{field:0..1}, nameDetected, warnings, confidence }
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  const { sessions: mine, refresh } = useGpsSessions(me?.id);
  const { trainings } = useTeamTrainings(me?.team);

  const todaySessions = sessions.filter((s) => s.date === date && s.assignedIds?.includes(me.id));
  const todayTrainings = (trainings || []).filter((tr) => tr.date === date);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const setField = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setZone = (z, k, v) => setZones((s) => ({ ...s, [z]: { ...s[z], [k]: v } }));
  const addFiles = (fl) => {
    const add = Array.from(fl || []);
    setFiles((cur) => [...cur, ...add].slice(0, 6));
    setImgMeta((cur) => [...cur, ...add.map(() => ({ kind: "", tab: "" }))].slice(0, 6));
  };
  const removeFile = (i) => { setFiles((c) => c.filter((_, j) => j !== i)); setImgMeta((c) => c.filter((_, j) => j !== i)); };
  // Type d'une capture (auto = "" → inconnu) ; l'onglet ne vaut que pour une heatmap.
  const setImgKind = (i, kind) => setImgMeta((c) => c.map((m, j) => (j === i ? { kind, tab: kind === "heatmap" ? m.tab : "" } : m)));
  const setImgTab = (i, tab) => setImgMeta((c) => c.map((m, j) => (j === i ? { ...m, tab } : m)));

  const buildMetrics = () => {
    const speed_zones = SPEED_ZONES.map((z) => ({ zone: z, sec: zones[z].sec, pct: zones[z].pct })).filter((x) => x.sec !== "" || x.pct !== "");
    const duration_sec = (Number(f.durMin) || 0) * 60 + (Number(f.durSec) || 0);
    return {
      distance_m: f.distance_m, m_per_min: f.m_per_min, hsr_m: f.hsr_m, hsr_count: f.hsr_count,
      vmax_kmh: f.vmax_kmh, vavg_kmh: f.vavg_kmh, duration_sec: duration_sec || "",
      session_name: f.session_name, provider, speed_zones,
      // Métadonnées IA conservées quand le dépôt vient d'une analyse (sinon ignorées).
      ...(source === "ai" ? { confidence: ai?.conf || {}, name_detected: !!ai?.nameDetected } : {}),
    };
  };
  const canSave = !preview && !busy && hasAnyMetric(normalizeGpsMetrics(buildMetrics()));
  // Confiance IA d'un champ (uniquement en mode dépôt IA), sinon null → pas de pastille.
  const cf = (k) => (source === "ai" && ai ? ai.conf?.[k] : null) ?? null;

  // Analyse IA des captures : l'IA PRÉ-REMPLIT, le joueur vérifie/valide. Les
  // champs non lus restent vides (jamais inventés). Repli manuel si non dispo.
  const analyze = async () => {
    if (preview || aiBusy || !files.length) return;
    setAiBusy(true); setAiMsg(""); setErr("");
    const r = await analyzeGpsShot(files);
    if (r.source !== "claude") {
      setAiMsg(r.note === "over_quota" ? t("player.gps.ai.overQuota", { used: r.used ?? 5, limit: r.limit ?? 5 })
        : r.note === "no_api_key" ? t("player.gps.ai.notConfigured")
        : t("player.gps.ai.failed"));
      setAiBusy(false);
      return;
    }
    const m = r.metrics;
    const mm = Math.floor((m.durationSec || 0) / 60), ss = (m.durationSec || 0) % 60;
    setF({
      distance_m: s(m.distanceM), m_per_min: s(m.mPerMin), hsr_m: s(m.hsrM), hsr_count: s(m.hsrCount),
      vmax_kmh: s(m.vmaxKmh), vavg_kmh: s(m.vavgKmh),
      durMin: m.durationSec != null ? s(mm) : "", durSec: m.durationSec != null ? s(ss) : "",
      session_name: s(m.sessionName), notes: f.notes,
    });
    const z = emptyZones();
    (m.speedZones || []).forEach((x) => { if (z[x.zone]) z[x.zone] = { sec: s(x.sec), pct: s(x.pct) }; });
    setZones(z);
    if (m.provider) setProvider(m.provider);
    // Pré-remplit le type de chaque capture depuis le classement IA (index → capture).
    const meta = files.map(() => ({ kind: "", tab: "" }));
    (r.imageKinds || []).forEach((ik) => { if (ik.index >= 0 && ik.index < meta.length) meta[ik.index] = { kind: ik.kind, tab: ik.tab || "" }; });
    setImgMeta(meta);
    setSource("ai");
    setAi({ conf: m.confidence || {}, nameDetected: !!m.nameDetected, warnings: r.warnings || [], confidence: r.confidence });
    setAiBusy(false);
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true); setErr("");
    try {
      const id = newGpsId();
      const paths = files.length ? await uploadGpsImages(me.team, me.id, id, files) : [];
      // Type/onglet par capture, aligné sur l'ordre d'upload (kind "" auto → null).
      const images = paths.map((path, i) => {
        const mm = imgMeta[i] || {};
        const kind = IMAGE_KINDS.includes(mm.kind) ? mm.kind : null;
        return { path, kind, tab: kind === "heatmap" && mm.tab ? mm.tab : null };
      });
      await createGpsSession({
        id, playerId: me.id, teamId: me.team, date,
        metrics: buildMetrics(), imagePaths: paths, images, source,
        linkedSessionId: link?.type === "session" ? link.id : null,
        linkedTrainingId: link?.type === "training" ? link.id : null,
      });
      setFiles([]); setImgMeta([]); setF({ distance_m: "", m_per_min: "", hsr_m: "", hsr_count: "", vmax_kmh: "", vavg_kmh: "", durMin: "", durSec: "", session_name: "", notes: "" });
      setZones(emptyZones()); setLink(null); setProvider(""); setSource("manual"); setAi(null); setAiMsg("");
      refresh();
    } catch (e) {
      setErr(t("common.actionFailed", { err: e.message }));
    }
    setBusy(false);
  };

  const del = async (g) => { if (preview) return; try { await deleteGpsSession(g.id, g.imagePaths); refresh(); } catch (e) { console.error("[gps del]", e.message); } };

  const chip = (active, onClick, label) => (
    <button onClick={onClick} style={{ padding: "6px 10px", borderRadius: 8, border: active ? `1px solid ${accent}` : `1px solid ${C.border}`, background: active ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  return (
    <Overlay onClose={onClose} sheet>
      <div style={{ padding: "6px 18px 24px" }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>📡 {t("player.gps.title")}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>{t("player.gps.subtitle")}</div>

        {/* Date + rattachement */}
        <label style={{ display: "block", marginBottom: 10 }}><span style={lbl}>{t("player.gps.date")}</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
        </label>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 700, marginBottom: 6 }}>{t("player.gps.linkTo")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {chip(!link, () => setLink(null), t("player.gps.standalone"))}
          {todaySessions.map((s) => chip(link?.type === "session" && link.id === s.id, () => setLink({ type: "session", id: s.id }), `🏋️ ${s.titre || s.code}`))}
          {todayTrainings.map((tr) => chip(link?.type === "training" && link.id === tr.id, () => setLink({ type: "training", id: tr.id }), `📣 ${tr.titre || tr.label || t("player.gps.training")}`))}
        </div>

        {/* Captures (optionnelles) */}
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 700, marginBottom: 6 }}>{t("player.gps.captures")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4, alignItems: "flex-start" }}>
          {previews.map((p, i) => {
            const kind = imgMeta[i]?.kind || "";
            const isHeat = kind === "heatmap";
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3, width: 60 }}>
                <div style={{ position: "relative" }}>
                  <img src={p.url} alt="" style={{ width: 60, height: 84, objectFit: "cover", borderRadius: 8, background: "#000", border: `1px solid ${isHeat ? accent : C.border}` }} />
                  {isHeat && <span style={{ position: "absolute", bottom: 3, left: 3, fontSize: 11 }} title={t("player.gps.img.heatmap")}>🗺️</span>}
                  {!preview && <button onClick={() => removeFile(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: C.coral, border: "none", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0 }}>×</button>}{/* i18n-ok: symbole fermeture */}
                </div>
                <select value={kind} onChange={(e) => setImgKind(i, e.target.value)} disabled={preview} style={{ ...inp, padding: "3px 4px", fontSize: 8.5, textAlign: "center" }}>
                  <option value="">{t("player.gps.img.auto")}</option>
                  {IMAGE_KINDS.map((k) => <option key={k} value={k}>{t(`player.gps.img.${k}`)}</option>)}
                </select>
                {isHeat && (
                  <select value={imgMeta[i]?.tab || ""} onChange={(e) => setImgTab(i, e.target.value)} disabled={preview} style={{ ...inp, padding: "3px 4px", fontSize: 8.5, textAlign: "center" }}>
                    <option value="">{t("player.gps.img.tab")}</option>
                    {HEATMAP_TABS.map((tb) => <option key={tb} value={tb}>{t(`player.gps.tab.${tb}`)}</option>)}
                  </select>
                )}
              </div>
            );
          })}
          {files.length < 6 && (
            <label style={{ width: 60, height: 84, borderRadius: 8, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: accent }}>
              <Plus size={20} />
              <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => addFiles(e.target.files)} style={{ display: "none" }} />
            </label>
          )}
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>{t("player.gps.capturesHint")}</div>

        {/* Analyse IA (optionnelle) : pré-remplit les métriques, le joueur valide. */}
        {!preview && files.length > 0 && (
          <button onClick={analyze} disabled={aiBusy} style={{ width: "100%", background: aiBusy ? "rgba(255,255,255,0.08)" : `${accent}22`, border: `1px solid ${accent}`, borderRadius: 10, padding: 11, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: aiBusy ? "default" : "pointer", marginBottom: 8 }}>
            {aiBusy ? t("player.gps.ai.analyzing") : `✨ ${t("player.gps.ai.analyze")}`}
          </button>
        )}
        {aiMsg && <div style={{ fontSize: 11, color: "#f5b301", background: "rgba(245,179,1,0.1)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>{aiMsg}</div>}
        {source === "ai" && ai && (
          <div style={{ background: `${accent}12`, border: `1px solid ${accent}44`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: accent, marginBottom: 4 }}>✨ {t("player.gps.ai.previewTitle")}</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginBottom: ai.nameDetected || ai.warnings.length ? 8 : 0 }}>{t("player.gps.ai.unreadLeftBlank")}</div>
            {ai.nameDetected && (
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#f5b301", background: "rgba(245,179,1,0.12)", borderRadius: 8, padding: "7px 9px", marginBottom: ai.warnings.length ? 8 : 0 }}>⚠️ {t("player.gps.ai.nameAlert")}</div>
            )}
            {ai.warnings.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                {ai.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Métriques */}
        <Section title={t("player.gps.metrics")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label={t("player.gps.distance")} value={f.distance_m} onChange={(v) => setField("distance_m", int(v))} conf={cf("distance_m")} />
            <Field label={t("player.gps.mPerMin")} value={f.m_per_min} onChange={(v) => setField("m_per_min", num(v))} conf={cf("m_per_min")} />
            <Field label={t("player.gps.hsr")} value={f.hsr_m} onChange={(v) => setField("hsr_m", int(v))} conf={cf("hsr_m")} />
            <Field label={t("player.gps.hsrCount")} value={f.hsr_count} onChange={(v) => setField("hsr_count", int(v))} conf={cf("hsr_count")} />
            <Field label={t("player.gps.vmax")} value={f.vmax_kmh} onChange={(v) => setField("vmax_kmh", num(v))} conf={cf("vmax_kmh")} />
            <Field label={t("player.gps.vavg")} value={f.vavg_kmh} onChange={(v) => setField("vavg_kmh", num(v))} conf={cf("vavg_kmh")} />
            <label style={{ display: "block" }}><span style={lbl}>{t("player.gps.duration")}{confDot(cf("duration_sec"))}</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input value={f.durMin} onChange={(e) => setField("durMin", int(e.target.value))} inputMode="numeric" placeholder={t("player.session.min")} style={{ ...inp, textAlign: "center" }} />
                <span style={{ color: "rgba(255,255,255,0.4)" }}>:</span>
                <input value={f.durSec} onChange={(e) => setField("durSec", int(e.target.value))} inputMode="numeric" placeholder={t("player.session.ssHint")} style={{ ...inp, textAlign: "center" }} />
              </div>
            </label>
          </div>
        </Section>

        {/* Zones de vitesse (optionnelles) */}
        <Section title={t("player.gps.zones")}>
          {SPEED_ZONES.map((z) => (
            <div key={z} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t(`player.gps.zone_${z}`)}</span>
              <input value={zones[z].sec} onChange={(e) => setZone(z, "sec", int(e.target.value))} inputMode="numeric" placeholder={t("player.gps.sec")} style={{ ...inp, textAlign: "center" }} />
              <input value={zones[z].pct} onChange={(e) => setZone(z, "pct", int(e.target.value))} inputMode="numeric" placeholder="%" style={{ ...inp, textAlign: "center" }} />{/* i18n-ok: unité % */}
            </div>
          ))}
        </Section>

        {/* Contexte : provider, nom (privé), notes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <label style={{ display: "block" }}><span style={lbl}>{t("player.gps.provider")}</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">—</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{t(`player.gps.provider_${p}`)}</option>)}
            </select>
          </label>
          <Field label={t("player.gps.sessionName")} value={f.session_name} onChange={(v) => setField("session_name", v)} type="text" />
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", margin: "4px 0 12px" }}>{t("player.gps.namePrivate")}</div>

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={!canSave} style={{ width: "100%", background: canSave ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 13, cursor: canSave ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}>
          {busy ? t("player.gps.saving") : source === "ai" ? t("player.gps.ai.validateSave") : t("player.gps.save")}
        </button>

        {/* Mes dépôts récents */}
        {mine.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, marginBottom: 8 }}>{t("player.gps.myDeposits")}</div>
            {mine.slice(0, 8).map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{fmtShort(g.date)}{g.source === "manual" ? "" : ` · ${t("player.gps.aiTag")}`}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{[g.distanceM != null ? `${g.distanceM} m` : null, g.vmaxKmh != null ? `${g.vmaxKmh} km/h` : null, g.hsrM != null ? `HSR ${g.hsrM} m` : null].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <span title={t("player.gps.pointsHint")} style={{ fontSize: 9.5, fontWeight: 800, color: C.green, background: "rgba(52,211,153,0.12)", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>{t("player.gps.pointsBadge", { n: 10 })}</span>
                {!preview && <button onClick={() => del(g)} title={t("common.delete")} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex" }}><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}

// Pastille de confiance IA (verte/orange/rouge) à côté du libellé d'un champ pré-rempli.
function confDot(c) {
  const color = confColor(c);
  if (!color) return null;
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: color, marginLeft: 5, verticalAlign: "middle" }} />;
}

function Field({ label, value, onChange, type, conf }) {
  return (
    <label style={{ display: "block" }}>
      <span style={lbl}>{label}{confDot(conf)}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={type === "text" ? undefined : "decimal"} style={{ ...inp, textAlign: type === "text" ? "left" : "center" }} />
    </label>
  );
}
