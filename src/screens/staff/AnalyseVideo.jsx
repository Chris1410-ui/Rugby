import { useCallback, useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { Video, Upload, X, ExternalLink } from "../../lib/icons.jsx";
import { teamVideosFolder, uploadFile, listFolder, signedUrl, removeFile } from "../../data/storage.js";

const accent = C.coral;
const mb = (n) => (n == null ? "" : n < 1048576 ? `${Math.round(n / 1024)} Ko` : `${(n / 1048576).toFixed(1)} Mo`);

/* Analyse vidéo — bibliothèque de vidéos de match/entraînement de l'équipe,
   stockées dans le bucket privé `team-files` (dossier <team_id>/videos).
   Lecture par lien signé (jamais d'URL publique). Upload réservé au staff. */
export default function AnalyseVideo({ teamId }) {
  const folder = teamVideosFolder(teamId);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(null); // { path, url }

  const refresh = useCallback(async () => {
    try { setFiles(await listFolder(folder)); }
    catch (e) { setErr(e.message); }
    setLoading(false);
  }, [folder]);

  useEffect(() => { refresh(); }, [refresh]);

  const onUpload = async (file) => {
    if (!file) return;
    if (!/^video\//.test(file.type)) { setErr("Choisis un fichier vidéo."); return; }
    setBusy(true); setErr("");
    try { await uploadFile(folder, file); await refresh(); }
    catch (e) { setErr(e.message || "Échec de l'envoi."); }
    setBusy(false);
  };

  const play = async (f) => {
    setErr("");
    try {
      const url = await signedUrl(f.path, 3600);
      setActive({ path: f.path, url, name: f.name });
    } catch (e) { setErr(e.message); }
  };

  const del = async (path) => {
    setBusy(true);
    try {
      if (active?.path === path) setActive(null);
      await removeFile(path);
      await refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <section>
      <Section title="ANALYSE VIDÉO">
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 12 }}>
          Vidéos de match/entraînement stockées dans le <strong style={{ color: "#fff" }}>bucket privé</strong> de
          l'équipe. Lecture par lien signé temporaire — jamais d'URL publique (données de mineurs, RGPD).
        </div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 10, padding: 13, color: accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <Upload size={16} />{busy ? "Envoi…" : "Téléverser une vidéo"}
          <input type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => onUpload(e.target.files[0])} />
        </label>
        {err && <div style={{ fontSize: 11, color: C.coral, marginTop: 10 }}>{err}</div>}
      </Section>

      {active && (
        <div style={sc({ marginBottom: 12, padding: 10 })}>
          <video key={active.url} src={active.url} controls playsInline style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 360 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.name.replace(/^\d{8}_/, "")}</div>
            <a href={active.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: accent, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Plein écran <ExternalLink size={12} /></a>
          </div>
        </div>
      )}

      <Section title={`BIBLIOTHÈQUE · ${files.length}`}>
        {loading ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: 12 }}>Chargement…</div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Aucune vidéo. Téléverse un match ou une séquence à analyser.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f) => (
              <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
                <button onClick={() => play(f)} style={{ width: 34, height: 34, borderRadius: 9, background: active?.path === f.path ? accent : `${accent}22`, border: `1px solid ${accent}55`, display: "flex", alignItems: "center", justifyContent: "center", color: active?.path === f.path ? "#fff" : accent, cursor: "pointer", flexShrink: 0 }}>
                  <Video size={16} />
                </button>
                <div onClick={() => play(f)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name.replace(/^\d{8}_/, "")}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{mb(f.size)}</div>
                </div>
                <button onClick={() => del(f.path)} disabled={busy} title="Supprimer" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.56)", cursor: "pointer", padding: 4 }}><X size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </section>
  );
}
