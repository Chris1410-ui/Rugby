import { useCallback, useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { X, Upload, FileText, Video, ExternalLink } from "../../lib/icons.jsx";
import { programFolder, uploadFile, listFolder, signedUrl, removeFile } from "../../data/storage.js";

const accent = C.coral;
const kb = (n) => (n == null ? "" : n < 1024 ? `${n} o` : n < 1048576 ? `${Math.round(n / 1024)} Ko` : `${(n / 1048576).toFixed(1)} Mo`);
const isVideo = (name) => /\.(mp4|mov|webm|m4v|avi)$/i.test(name);

/* Pièces jointes d'un programme (PDF, vidéos d'analyse) stockées dans le bucket
   privé `team-files`. Ouverture via URL signée (jamais d'URL publique). */
export default function ProgramFiles({ teamId, program, onClose }) {
  const folder = programFolder(teamId, program.id);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      setFiles(await listFolder(folder));
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, [folder]);

  useEffect(() => { refresh(); }, [refresh]);

  const onUpload = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      await uploadFile(folder, file);
      await refresh();
    } catch (e) { setErr(e.message || "Échec de l'envoi."); }
    setBusy(false);
  };

  const open = async (path) => {
    try {
      const url = await signedUrl(path, 3600); // 1h
      window.open(url, "_blank", "noopener");
    } catch (e) { setErr(e.message); }
  };

  const del = async (path) => {
    setBusy(true);
    try { await removeFile(path); await refresh(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.panel, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Fichiers · {program.title}</div>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>Bucket privé · accès par lien signé (1 h)</div>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 10, padding: 12, color: accent, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
          <Upload size={15} />{busy ? "Envoi…" : "Ajouter un PDF ou une vidéo"}
          <input type="file" accept="application/pdf,video/*" style={{ display: "none" }} onChange={(e) => onUpload(e.target.files[0])} />
        </label>

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 10 }}>{err}</div>}

        {loading ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", padding: 16, textAlign: "center" }}>Chargement…</div>
        ) : files.length === 0 ? (
          <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.45)", fontSize: 12 })}>
            Aucun fichier. Ajoute le PDF du programme ou une vidéo d'analyse.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f) => (
              <div key={f.path} style={sc({ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" })}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: isVideo(f.name) ? C.viol : C.coral, flexShrink: 0 }}>
                  {isVideo(f.name) ? <Video size={16} /> : <FileText size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name.replace(/^\d{8}_/, "")}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{kb(f.size)}</div>
                </div>
                <button onClick={() => open(f.path)} title="Ouvrir (lien signé)" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex" }}>
                  <ExternalLink size={14} />
                </button>
                <button onClick={() => del(f.path)} disabled={busy} title="Supprimer" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 4 }}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
