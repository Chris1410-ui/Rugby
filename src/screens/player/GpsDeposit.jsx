import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { todayISO, fmtShort } from "../../lib/metrics.js";
import { Overlay, Section } from "../../lib/ui.jsx";
import { Plus, Trash2 } from "../../lib/icons.jsx";
import { usePreview } from "../../lib/preview.js";
import { SPEED_ZONES, normalizeGpsMetrics, hasAnyMetric } from "../../lib/gps.js";
import { useGpsSessions, createGpsSession, uploadGpsImages, deleteGpsSession, newGpsId } from "../../data/gps.js";
import { useTeamTrainings } from "../../data/trainings.js";

const PROVIDERS = ["pitchero", "catapult", "statsports", "other"];
const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl = { fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 700, display: "block", marginBottom: 3 };
const num = (v) => v.replace(/[^\d.]/g, "");
const int = (v) => v.replace(/[^\d]/g, "");

/* Dépôt manuel de données GPS (GPS-2). Le joueur rattache la session à une
   séance/convocation du jour, ajoute éventuellement des captures (stockées, non
   analysées ici), et saisit les métriques à la main. Points câblés en GPS-2b. */
export default function GpsDeposit({ me, sessions = [], onClose }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const today = todayISO();
  const accent = C.teal;

  const [date, setDate] = useState(today);
  const [link, setLink] = useState(null);       // { type:'session'|'training', id }
  const [files, setFiles] = useState([]);
  const [provider, setProvider] = useState("");
  const [f, setF] = useState({ distance_m: "", m_per_min: "", hsr_m: "", hsr_count: "", vmax_kmh: "", vavg_kmh: "", durMin: "", durSec: "", session_name: "", notes: "" });
  const emptyZones = () => Object.fromEntries(SPEED_ZONES.map((z) => [z, { sec: "", pct: "" }]));
  const [zones, setZones] = useState(emptyZones);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { sessions: mine, refresh } = useGpsSessions(me?.id);
  const { trainings } = useTeamTrainings(me?.team);

  const todaySessions = sessions.filter((s) => s.date === date && s.assignedIds?.includes(me.id));
  const todayTrainings = (trainings || []).filter((tr) => tr.date === date);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const setField = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setZone = (z, k, v) => setZones((s) => ({ ...s, [z]: { ...s[z], [k]: v } }));
  const addFiles = (fl) => setFiles((cur) => [...cur, ...Array.from(fl || [])].slice(0, 6));

  const buildMetrics = () => {
    const speed_zones = SPEED_ZONES.map((z) => ({ zone: z, sec: zones[z].sec, pct: zones[z].pct })).filter((x) => x.sec !== "" || x.pct !== "");
    const duration_sec = (Number(f.durMin) || 0) * 60 + (Number(f.durSec) || 0);
    return {
      distance_m: f.distance_m, m_per_min: f.m_per_min, hsr_m: f.hsr_m, hsr_count: f.hsr_count,
      vmax_kmh: f.vmax_kmh, vavg_kmh: f.vavg_kmh, duration_sec: duration_sec || "",
      session_name: f.session_name, provider, speed_zones,
    };
  };
  const canSave = !preview && !busy && hasAnyMetric(normalizeGpsMetrics(buildMetrics()));

  const save = async () => {
    if (!canSave) return;
    setBusy(true); setErr("");
    try {
      const id = newGpsId();
      const paths = files.length ? await uploadGpsImages(me.team, me.id, id, files) : [];
      await createGpsSession({
        id, playerId: me.id, teamId: me.team, date,
        metrics: buildMetrics(), imagePaths: paths, source: "manual",
        linkedSessionId: link?.type === "session" ? link.id : null,
        linkedTrainingId: link?.type === "training" ? link.id : null,
      });
      setFiles([]); setF({ distance_m: "", m_per_min: "", hsr_m: "", hsr_count: "", vmax_kmh: "", vavg_kmh: "", durMin: "", durSec: "", session_name: "", notes: "" });
      setZones(emptyZones()); setLink(null); setProvider("");
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          {previews.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={p.url} alt="" style={{ width: 60, height: 84, objectFit: "cover", borderRadius: 8, background: "#000", border: `1px solid ${C.border}` }} />
              <button onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: C.coral, border: "none", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0 }}>×</button>
            </div>
          ))}
          {files.length < 6 && (
            <label style={{ width: 60, height: 84, borderRadius: 8, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: accent }}>
              <Plus size={20} />
              <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => addFiles(e.target.files)} style={{ display: "none" }} />
            </label>
          )}
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>{t("player.gps.capturesHint")}</div>

        {/* Métriques */}
        <Section title={t("player.gps.metrics")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label={t("player.gps.distance")} value={f.distance_m} onChange={(v) => setField("distance_m", int(v))} />
            <Field label={t("player.gps.mPerMin")} value={f.m_per_min} onChange={(v) => setField("m_per_min", num(v))} />
            <Field label={t("player.gps.hsr")} value={f.hsr_m} onChange={(v) => setField("hsr_m", int(v))} />
            <Field label={t("player.gps.hsrCount")} value={f.hsr_count} onChange={(v) => setField("hsr_count", int(v))} />
            <Field label={t("player.gps.vmax")} value={f.vmax_kmh} onChange={(v) => setField("vmax_kmh", num(v))} />
            <Field label={t("player.gps.vavg")} value={f.vavg_kmh} onChange={(v) => setField("vavg_kmh", num(v))} />
            <label style={{ display: "block" }}><span style={lbl}>{t("player.gps.duration")}</span>
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
          {busy ? t("player.gps.saving") : t("player.gps.save")}
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
                {!preview && <button onClick={() => del(g)} title={t("common.delete")} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex" }}><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}

function Field({ label, value, onChange, type }) {
  return (
    <label style={{ display: "block" }}>
      <span style={lbl}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={type === "text" ? undefined : "decimal"} style={{ ...inp, textAlign: type === "text" ? "left" : "center" }} />
    </label>
  );
}
