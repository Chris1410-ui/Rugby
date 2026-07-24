import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { Overlay } from "../../lib/ui.jsx";
import { listPlayerFiles, playerFileUrl } from "../../data/storage.js";
import { parseProgramSmart } from "../../data/programImport.js";
import { importProgramForPlayer } from "../../data/freeSessions.js";
import { createProgramDoc } from "../../data/programDocs.js";
import PdfImportReview from "../shared/PdfImportReview.jsx";

/* Traitement EN MASSE des PDF de programme déjà stockés (staff écrivain).
   Parcourt tous les PDF de tous les joueurs, un APERÇU après l'autre : le staff
   valide (crée les séances datées assignées au joueur), passe, ou arrête. Rien
   n'est écrit sans validation — le parse PDF reste faillible. */
const btnGhost = { flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 13, cursor: "pointer" };

function Panel({ onClose, children }) {
  return (
    <Overlay onClose={onClose} sheet z={360} maxWidth={560}>
      <div style={{ padding: "26px 22px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>{children}</div>
    </Overlay>
  );
}

export default function BulkPdfImport({ teamId, players = [], onClose }) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState(null);   // null = construction ; [] = vide
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null); // parse du fichier courant
  const [err, setErr] = useState("");
  const [loadingItem, setLoadingItem] = useState(false);
  const [stats, setStats] = useState({ sessions: 0, files: 0, skipped: 0 });

  // 1) Construit la file : tous les PDF stockés de tous les joueurs.
  useEffect(() => {
    let active = true;
    (async () => {
      const lists = await Promise.all(
        players.filter((p) => p?.id).map(async (p) => {
          try { return { p, files: await listPlayerFiles(teamId, p.id) }; }
          catch { return { p, files: [] }; }
        }),
      );
      const q = [];
      for (const { p, files } of lists)
        for (const f of files) if (/\.pdf$/i.test(f.name)) q.push({ playerId: p.id, playerName: displayName(p), num: p.num, ...f });
      if (active) setQueue(q);
    })();
    return () => { active = false; };
  }, [teamId, players]);

  // 2) À chaque item : télécharge + parse (pas d'écriture ici).
  useEffect(() => {
    if (!queue || idx >= queue.length) return;
    let active = true;
    setResult(null); setErr(""); setLoadingItem(true);
    (async () => {
      try {
        const url = await playerFileUrl(queue[idx].path, { download: true });
        const blob = await (await fetch(url)).blob();
        const r = await parseProgramSmart(blob, { weeks: 4, filename: queue[idx].name });
        if (active) setResult(r);
      } catch (e) {
        if (active) setErr(e.message === "no-pdfjs" ? t("staff.programs.pdfNoLib") : t("pdfImport.extractFail", { err: e.message || "" }));
      } finally { if (active) setLoadingItem(false); }
    })();
    return () => { active = false; };
  }, [queue, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = (patch) => { setStats((s) => ({ ...s, ...patch(s) })); setIdx((i) => i + 1); };
  const onConfirm = async (sessions, opts, doc) => {
    const item = queue[idx];
    const n = sessions.length ? await importProgramForPlayer(item.playerId, teamId, sessions, opts) : 0;
    // Protocole riche associé (best-effort) — le staff a le droit d'écrire.
    if (doc) {
      try { await createProgramDoc(teamId, { title: doc?.meta?.title || item.playerName, weeks: doc?.meta?.weeks, doc, status: "draft" }); }
      catch { /* n'empêche pas la matérialisation des séances */ }
    }
    next((s) => ({ sessions: s.sessions + n, files: s.files + 1 }));
  };
  const skip = () => next((s) => ({ skipped: s.skipped + 1 }));

  if (queue === null) return <Panel onClose={onClose}><div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{t("pdfImport.bulkScanning")}</div></Panel>;

  if (queue.length === 0) return (
    <Panel onClose={onClose}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>📂</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{t("pdfImport.bulkEmpty")}</div>
      <button onClick={onClose} style={{ ...btnGhost, flex: "0 0 auto", marginTop: 12, padding: "10px 20px" }}>{t("common.close")}</button>
    </Panel>
  );

  if (idx >= queue.length) return (
    <Panel onClose={onClose}>
      <div style={{ fontSize: 30, marginBottom: 6 }}>✅</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("pdfImport.bulkDoneTitle")}</div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{t("pdfImport.bulkDoneSummary", { files: stats.files, sessions: stats.sessions, skipped: stats.skipped })}</div>
      <button onClick={onClose} style={{ ...btnGhost, flex: "0 0 auto", marginTop: 14, padding: "10px 20px" }}>{t("common.close")}</button>
    </Panel>
  );

  const item = queue[idx];
  const subtitle = `${item.num != null ? "#" + item.num + " · " : ""}${item.playerName} · ${item.name} · ${idx + 1}/${queue.length}`;

  if (loadingItem) return (
    <Panel onClose={onClose}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{subtitle}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{t("pdfImport.bulkParsing")}</div>
    </Panel>
  );

  if (err) return (
    <Panel onClose={onClose}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>{subtitle}</div>
      <div style={{ fontSize: 12, color: C.coral, marginBottom: 14 }}>{err}</div>
      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        <button onClick={onClose} style={btnGhost}>{t("pdfImport.stop")}</button>
        <button onClick={skip} style={btnGhost}>{t("pdfImport.skip")}</button>
      </div>
    </Panel>
  );

  return <PdfImportReview result={result} withPlan subtitle={subtitle} onConfirm={onConfirm} onSkip={skip} onCancel={onClose} />;
}
