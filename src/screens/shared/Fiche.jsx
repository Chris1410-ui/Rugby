import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel, posDisplay } from "../../lib/positions.js";
import { acwrZ, fmtShort, zoneLabel } from "../../lib/metrics.js";
import { Ring, Section, Pill, Tag, KPI, CloseX, useModalClose, EstimatedBadge } from "../../lib/ui.jsx";
import { readinessReady, acwrEstimated } from "../../lib/reliability.js";
import { CheckCircle, Eye, EyeOff, Lock, ExternalLink, Download, Trash2, FileText, Upload, Calendar } from "../../lib/icons.jsx";
import { uploadPlayerPdf, listPlayerFiles, playerFileUrl, removePlayerFile } from "../../data/storage.js";
import { parseProgramSmart } from "../../data/programImport.js";
import { importProgramForSelf, importProgramForPlayer } from "../../data/freeSessions.js";
import { createProgramDoc } from "../../data/programDocs.js";
import PdfImportReview from "./PdfImportReview.jsx";
import { pwdStrength } from "../../lib/password.js";
import { normalizeInitials } from "../../lib/identity.js";
import { updatePlayer, resetPlayerPassword, setMyInitials } from "../../data/players.js";
import { openPlayerReport } from "../../data/report.js";
import { useTestCampaigns } from "../../data/tests.js";
import { useMyQuestionnaires } from "../../data/questionnaires.js";
import { useTeamChallengePoints } from "../../data/challenges.js";
import { challengeBadges, challengeBadgeLabel } from "../../lib/challenges.js";
import { top14Player, datedResultsFor, currentBodyweight, withCurrentBodyweight } from "../../lib/top14.js";
import TestsEvolution from "./TestsEvolution.jsx";
import Top14Panel from "./Top14Panel.jsx";
import { PlayerAnswers } from "../staff/QuestionnaireResponses.jsx";
import Confidentialite from "./Confidentialite.jsx";

/* Réponses aux questionnaires du joueur (vue staff, lien croisé depuis la fiche).
   Données santé : staff du club uniquement (RLS). */
function FicheQuestionnaires({ player }) {
  const { t } = useTranslation();
  const { list } = useMyQuestionnaires(player.id);
  const [sel, setSel] = useState(null);
  if (!list.length) return null;
  return (
    <Section title={t("shared.fiche.qTitle", { count: list.length })}>
      {list.map((a) => (
        <div key={a.questionnaire.id} onClick={() => setSel(a)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border2}`, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.questionnaire.nom}</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{t("shared.fiche.questions", { count: a.questionnaire.questions.length })}</div>
          </div>
          {a.statut === "rempli" ? <Tag c={C.green}>{t("shared.fiche.tagFilled")}</Tag> : <Tag c={C.amb}>{t("shared.fiche.tagPending")}</Tag>}
        </div>
      ))}
      {sel && <PlayerAnswers questionnaire={sel.questionnaire} player={player} assignment={sel} onClose={() => setSel(null)} />}
    </Section>
  );
}

/* Réinitialisation du mot de passe d'un joueur PAR LE STAFF / L'OWNER (pas
   d'auto-service côté joueur). Pose directement un nouveau mot de passe via
   l'Edge Function sécurisée — aucun email, aucun lien. Affiché uniquement si le
   joueur a un compte (auto-inscrit → owner_uid). Mêmes règles de robustesse
   qu'à l'inscription + confirmation. */
function PasswordReset({ playerId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const st = pwdStrength(pwd);
  const sCol = st.score <= 2 ? C.coral : st.score <= 4 ? C.amb : C.green;
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13.5, outline: "none", marginBottom: 8 };

  const submit = async () => {
    setMsg(null);
    if (!st.valid) return setMsg({ ok: false, text: t("shared.fiche.pwErrWeak") });
    if (pwd !== pwd2) return setMsg({ ok: false, text: t("shared.fiche.pwErrMismatch") });
    setBusy(true);
    try {
      await resetPlayerPassword(playerId, pwd);
      setMsg({ ok: true, text: t("shared.fiche.pwDone") });
      setPwd(""); setPwd2("");
    } catch (e) { setMsg({ ok: false, text: e.message || t("shared.fiche.pwErrFail") }); }
    setBusy(false);
  };

  return (
    <Section title={t("shared.fiche.accountTitle")}>
      {!open ? (
        <button onClick={() => { setOpen(true); setMsg(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Lock size={14} /> {t("shared.fiche.pwResetBtn")}
        </button>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 10 }}>
            {t("shared.fiche.pwIntro")}
          </div>
          <div style={{ position: "relative" }}>
            <input type={show ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setMsg(null); }} placeholder={t("shared.fiche.pwNewPlaceholder")} autoComplete="new-password" style={inp} />
            <button onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {pwd && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: 4, width: `${(st.score / 7) * 100}%`, background: sCol, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 9.5, color: sCol, marginTop: 3 }}>{st.valid ? t("shared.fiche.pwValid") : t("shared.fiche.pwWeakHint")}</div>
            </div>
          )}
          <input type={show ? "text" : "password"} value={pwd2} onChange={(e) => { setPwd2(e.target.value); setMsg(null); }} placeholder={t("shared.fiche.pwConfirmPlaceholder")} autoComplete="new-password" style={{ ...inp, borderColor: pwd2 && pwd !== pwd2 ? C.coral : C.border }} />
          {msg && <div style={{ fontSize: 11.5, color: msg.ok ? C.green : C.coral, margin: "2px 0 8px", lineHeight: 1.4 }}>{msg.text}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setOpen(false); setPwd(""); setPwd2(""); setMsg(null); }} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("shared.fiche.pwClose")}</button>
            <button onClick={submit} disabled={busy} style={{ flex: 2, background: C.green, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("shared.fiche.pwSave")}</button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* Bouton « Générer le rapport de performance » (PDF). Accessible au staff sur
   n'importe quelle fiche de son équipe et au joueur sur sa propre fiche —
   l'autorisation réelle est vérifiée côté serveur (endpoint report). */
function ReportButton({ player }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true); setErr("");
    try { await openPlayerReport(player.id); }
    catch (e) {
      const msg = e?.status === 403 ? t("shared.fiche.reportForbidden")
        : e?.status === 404 ? t("shared.fiche.reportNotFound")
        : e?.message === "SESSION" ? t("shared.fiche.reportNoSession")
        : t("shared.fiche.reportFail");
      setErr(msg);
    }
    setBusy(false);
  };
  return (
    <div style={sc({ padding: 14, marginBottom: 12 })}>
      <button onClick={run} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: C.viol, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
        <FileText size={15} /> {busy ? t("shared.fiche.reportBusy") : t("shared.fiche.reportBtn")}
      </button>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 8, lineHeight: 1.5 }}>{t("shared.fiche.reportNote")}</div>
      {err && <div style={{ fontSize: 11, color: C.coral, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

// Étiquette de charge hebdo (UA). Libellé résolu via t(lk) au rendu.
const chargeLabel = (v) => (v == null ? { lk: null, c: C.gray } : v < 1500 ? { lk: "shared.fiche.chargeLow", c: C.amb } : v <= 2400 ? { lk: "shared.fiche.chargeNormal", c: C.green } : { lk: "shared.fiche.chargeHigh", c: C.coral });
const triC = (v, good, mid) => (v >= good ? C.green : v >= mid ? C.amb : C.coral);

const num = (v) => (v == null || v === "" ? null : Number(v));
const fmt = (v, unit = "") => (v == null ? "—" : `${v}${unit}`);

/* Éditeur d'initiales pour le joueur (sa propre fiche). RPC set_my_initials
   (SECURITY DEFINER) → ne modifie QUE `initials`. Realtime rafraîchit l'effectif,
   donc l'affichage « Totem (I.F.) » se met à jour partout après enregistrement. */
function SelfInitials({ player }) {
  const { t } = useTranslation();
  const [val, setVal] = useState(player.initials ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setVal(player.initials ?? ""); }, [player.initials]);
  const preview = normalizeInitials(val);
  const dirty = preview !== (player.initials ?? "");

  const save = async () => {
    setBusy(true); setMsg("");
    try { await setMyInitials(preview); setMsg(t("shared.fiche.selfSaved")); }
    catch (e) { setMsg(e.message || t("shared.fiche.selfFail")); }
    setBusy(false);
  };

  return (
    <div style={sc({ padding: 14, marginBottom: 12 })}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 8 }}>{t("shared.fiche.selfTitle")}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: 10 }}>
        {t("shared.fiche.selfDescBefore")}<b style={{ color: "#fff" }}>{player.name} ({preview || "I.F."})</b>{t("shared.fiche.selfDescAfter")}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={val} onChange={(e) => { setVal(e.target.value); setMsg(""); }} placeholder="I.F." maxLength={8}
          style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none" }} />
        <button onClick={save} disabled={busy || !dirty} style={{ background: dirty ? C.green : "rgba(255,255,255,0.08)", border: "none", borderRadius: 9, padding: "10px 16px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: dirty ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("shared.fiche.selfSave")}</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: msg === t("shared.fiche.selfSaved") ? C.green : C.coral, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// Taille lisible d'un fichier (unités internationales — pas de traduction).
function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* PDF de programme du joueur (bucket privé `player-files`, cf. migration 0051).
   - le JOUEUR sur sa fiche (`canAdd`) : ajouter / supprimer / ouvrir ses PDF
   - le STAFF/OWNER du club : consulter (ouvrir/télécharger) ; supprimer si
     `canDelete` (prépa/médical/owner). Accès par URL signée (1 h). */
function PlayerProgramFiles({ player, self, canAdd, canDelete }) {
  const { t } = useTranslation();
  // Dossier cible = <team_id>/<player_id>. Sans joueur valide (fiche d'un compte
  // owner/staff sans player_id), il n'y a AUCUN dossier cible → on masque la
  // section (l'upload se fait en ouvrant la fiche d'un vrai joueur).
  const hasTarget = !!(player?.id && player?.team);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [importResult, setImportResult] = useState(null); // aperçu PDF en attente de validation
  const [pendingFile, setPendingFile] = useState(null);   // PDF choisi (à archiver après validation)
  const [importMsg, setImportMsg] = useState("");

  const refresh = async () => {
    if (!hasTarget) return;
    try { setFiles(await listPlayerFiles(player.team, player.id)); setErr(""); }
    catch (e) { setErr(e.message || String(e)); }
  };
  useEffect(() => { refresh(); }, [player?.id, hasTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajout d'un programme PDF (flux unifié) : on parse d'abord → aperçu/validation
  // → création des séances datées + archivage du fichier. Le joueur crée pour
  // lui-même (RPC), le staff pour le joueur de la fiche (écriture directe).
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (file.type !== "application/pdf") { setErr(t("shared.fiche.pdfOnly")); return; }
    setBusy(true); setErr(""); setImportMsg("");
    setPendingFile(file);
    try { setImportResult(await parseProgramSmart(file, { weeks: 4, filename: file.name })); }
    catch (ex) { setPendingFile(null); setErr(ex.message === "no-pdfjs" ? t("staff.programs.pdfNoLib") : t("staff.programs.pdfUnrecognized")); }
    setBusy(false);
  };
  // Archive (best-effort) le PDF d'origine dans le bucket privé du joueur.
  const archive = async () => {
    if (!pendingFile) return true;
    try { await uploadPlayerPdf(player.team, player.id, pendingFile); return true; }
    catch { return false; }
  };
  const confirmImport = async (sessions, opts, doc) => {
    try {
      // 1) Séances datées (calendrier + anti-surcharge). Peut être vide en mode IA
      // (protocole seul) → on n'écrit alors aucune séance.
      let n = 0;
      if (sessions.length) {
        n = self
          ? await importProgramForSelf(sessions, opts)
          : await importProgramForPlayer(player.id, player.team, sessions, opts);
      }
      // 2) Protocole riche (rendu fidèle, consultable). Réservé au staff écrivain
      // (RLS program_docs) : best-effort, un échec ne bloque pas les séances.
      let docSaved = false;
      if (doc && !self) {
        try {
          await createProgramDoc(player.team, { title: doc?.meta?.title || t("protocols.untitled"), weeks: doc?.meta?.weeks, doc, status: "draft" });
          docSaved = true;
        } catch { /* RLS / réseau : on garde les séances */ }
      }
      const archived = await archive();
      setImportResult(null); setPendingFile(null);
      await refresh();
      const base = self ? t("pdfImport.importedPlayer", { count: n }) : t("pdfImport.importedStaff", { count: n });
      setImportMsg(base
        + (docSaved ? " " + t("pdfImport.alsoProtocol") : "")
        + (archived ? " " + t("pdfImport.alsoArchived") : ""));
    } catch (ex) { setErr(t("pdfImport.importErr", { err: ex.message || "" })); }
  };
  // Archiver seulement (PDF non reconnu comme programme, ou choix explicite).
  const archiveOnly = async () => {
    const ok = await archive();
    setImportResult(null); setPendingFile(null);
    await refresh();
    if (ok) setImportMsg(t("pdfImport.archived")); else setErr(t("shared.fiche.pdfUploadFail", { err: "" }));
  };
  // Rétroactif : extraire les séances d'un PDF DÉJÀ stocké (joueurs existants).
  // Télécharge le fichier → aperçu/validation → création (sans ré-archivage).
  const extractExisting = async (f) => {
    setBusy(true); setErr(""); setImportMsg(""); setPendingFile(null);
    try {
      const url = await playerFileUrl(f.path, { download: true });
      const blob = await (await fetch(url)).blob();
      setImportResult(await parseProgramSmart(blob, { weeks: 4, filename: f.name }));
    } catch (ex) { setErr(ex.message === "no-pdfjs" ? t("staff.programs.pdfNoLib") : t("pdfImport.extractFail", { err: ex.message || "" })); }
    setBusy(false);
  };
  const openFile = async (path, download) => {
    try { const url = await playerFileUrl(path, { download }); window.open(url, "_blank", "noopener"); }
    catch (ex) { setErr(ex.message || String(ex)); }
  };
  const del = async (path) => {
    setBusy(true); setErr("");
    try { await removePlayerFile(path); await refresh(); }
    catch (ex) { setErr(t("shared.fiche.pdfDeleteFail", { err: ex.message || "" })); }
    setBusy(false);
  };
  const cleanName = (n) => n.replace(/^\d{8}_/, "");
  const iconBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", flexShrink: 0 };

  if (!hasTarget) return null; // pas de joueur cible → section masquée (pas de dossier valide)

  return (
    <div style={sc({ padding: 14, marginBottom: 12 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}><FileText size={13} /> {self ? t("shared.fiche.pdfTitleSelf") : t("shared.fiche.pdfTitle")}</div>
        {canAdd && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.green}22`, border: `1px solid ${C.green}66`, borderRadius: 8, padding: "6px 12px", color: C.green, fontSize: 11, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <Upload size={13} /> {busy ? t("shared.fiche.pdfSending") : t("pdfImport.addProgram")}
            <input type="file" accept="application/pdf" onChange={onPick} disabled={busy} style={{ display: "none" }} />
          </label>
        )}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 10, lineHeight: 1.5 }}>{t("pdfImport.ficheNote")}</div>
      {importMsg && <div style={{ fontSize: 11, color: C.green, marginBottom: 8 }}>{importMsg}</div>}
      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      {importResult && <PdfImportReview result={importResult} withPlan onCancel={() => { setImportResult(null); setPendingFile(null); }} onConfirm={confirmImport} onArchiveOnly={archiveOnly} />}
      {files.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("shared.fiche.pdfEmpty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f) => (
            <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cleanName(f.name)}</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{t("shared.fiche.pdfAddedOn", { date: fmtShort(f.created) })}{f.size ? ` · ${fmtBytes(f.size)}` : ""}</div>
              </div>
              {canAdd && <button onClick={() => extractExisting(f)} disabled={busy} title={t("pdfImport.extractExisting")} style={{ ...iconBtn, color: C.green, borderColor: `${C.green}66`, background: `${C.green}18` }}><Calendar size={15} /></button>}
              <button onClick={() => openFile(f.path, false)} title={t("shared.fiche.pdfOpenTitle")} style={iconBtn}><ExternalLink size={15} /></button>
              <button onClick={() => openFile(f.path, true)} title={t("shared.fiche.pdfDownloadTitle")} style={iconBtn}><Download size={15} /></button>
              {canDelete && <button onClick={() => del(f.path)} disabled={busy} title={t("shared.fiche.pdfDeleteTitle")} style={{ ...iconBtn, color: C.coral }}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Fiche joueur détaillée. Lit l'effectif enrichi (aucun recalcul). Éditable par
   le staff (tests physiques). `onClose` → rendu en modal. */
export default function Fiche({ player, canEdit = false, self = false, onClose }) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adv, setAdv] = useState(false);
  const { campaigns, results } = useTestCampaigns(player.team);
  const dated = datedResultsFor(campaigns, results, player.id);
  // Poids « courant » (dernier test OU questionnaire) : affiché + injecté dans le Top 14.
  const bw = currentBodyweight(player, dated);
  const t14 = top14Player(player.pos, withCurrentBodyweight(player, dated));
  const chalPts = useTeamChallengePoints(player.team)[player.id] || [];
  useModalClose(onClose);

  useEffect(() => {
    setD({
      num: player.num ?? "",
      initials: player.initials ?? "",
      bodyweight: player.bodyweight ?? "",
      height_cm: player.heightCm ?? "",
      sessions_per_week: player.sessionsPerWeek ?? "",
      injury_history: player.injuryHistory ?? "",
      mas: player.mas ?? "",
      back_squat: player.backSquat ?? "",
      cmj_g: player.cmjG ?? "",
      cmj_d: player.cmjD ?? "",
      ischios_g: player.ischiosG ?? "",
      ischios_d: player.ischiosD ?? "",
      pp_notes: player.ppNotes ?? "",
    });
  }, [player.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const asym = (() => {
    const g = num(d.ischios_g), dd = num(d.ischios_d);
    if (!g || !dd) return player.asym ?? null;
    return Math.round((Math.abs(g - dd) / Math.max(g, dd)) * 100);
  })();

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const bwNum = num(d.bodyweight);
      await updatePlayer(player.id, {
        num: num(d.num),
        initials: normalizeInitials(d.initials) || null,
        bodyweight: bwNum,
        // Édition staff = mesure du jour → devient le poids le plus récent.
        ...(bwNum !== (player.bodyweight ?? null) ? { bodyweight_at: new Date().toISOString() } : {}),
        height_cm: num(d.height_cm),
        sessions_per_week: num(d.sessions_per_week),
        injury_history: (d.injury_history ?? "").trim() || null,
        mas: num(d.mas),
        back_squat: num(d.back_squat),
        cmj_g: num(d.cmj_g),
        cmj_d: num(d.cmj_d),
        ischios_g: num(d.ischios_g),
        ischios_d: num(d.ischios_d),
        asym,
        pp_notes: (d.pp_notes ?? "").trim() || null,
      });
      setEdit(false); // Realtime rafraîchit l'effectif
    } catch (e) { setErr(e.message || t("shared.fiche.errSave")); }
    setBusy(false);
  };

  const inp = { width: 78, background: "rgba(255,255,255,0.1)", border: `1px solid ${C.viol}66`, borderRadius: 6, padding: "3px 6px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", textAlign: "right" };
  const Row = ({ label, k, unit = "", value, text = false, placeholder }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border2}` }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      {edit ? (
        <input value={d[k] ?? ""} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} inputMode={text ? "text" : "decimal"} placeholder={placeholder} style={inp} />
      ) : (
        <span style={{ fontSize: 14, fontWeight: 800 }}>{fmt(value, unit)}</span>
      )}
    </div>
  );

  const body = (
    <div>
      {/* identité + readiness */}
      <div style={sc({ display: "flex", alignItems: "center", gap: 14, padding: 16, marginBottom: 12 })}>
        <Ring val={readinessReady(player) ? player.readiness : "—"} max={100} color={player.readiness > 70 ? C.green : player.readiness > 50 ? C.amb : C.coral} label={t("shared.fiche.readinessLabel")} size={72} sw={6} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>{edit ? <input value={d.num ?? ""} onChange={(e) => setD((p) => ({ ...p, num: e.target.value }))} style={{ ...inp, width: 44, textAlign: "center" }} /> : (player.num ?? "—")}</span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                {player.name}
                {edit
                  ? <input value={d.initials ?? ""} onChange={(e) => setD((p) => ({ ...p, initials: e.target.value }))} placeholder="I.F." maxLength={8} style={{ ...inp, width: 60, textAlign: "left" }} />
                  : (player.initials && <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>({player.initials})</span>)}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{posDisplay(t, player.pos)} · {grpLabel(player.grp)}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Pill v={player.acwr} /><Tag c={acwrZ(player.acwr).c}>{zoneLabel(t, acwrZ(player.acwr))}</Tag>
            {acwrEstimated(player) && <EstimatedBadge />}
            {player._live && <Tag c={C.green}>{t("shared.fiche.todayCheckin")}</Tag>}
          </div>
        </div>
      </div>

      {/* Rapport de performance PDF : staff sur toute fiche de l'équipe,
          joueur sur la sienne. Autorisation vérifiée côté serveur. */}
      {(canEdit || self) && <ReportButton player={player} />}

      {/* Le joueur saisit / modifie SES initiales (affichées « Totem (I.F.) »
          partout). Réservé à sa propre fiche. */}
      {self && <SelfInitials player={player} />}

      {/* PDF de programme du joueur : gérés par le joueur, consultés par le staff/owner. */}
      <PlayerProgramFiles player={player} self={self} canAdd={self || canEdit} canDelete={self || canEdit} />

      {/* indicateurs clés — lisibles staff & joueur (vert / ambre / rouge) */}
      {(() => {
        const ch = chargeLabel(player.charge7j);
        const z = acwrZ(player.acwr);
        const live = player._live; // bilan du jour encodé ?
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            <KPI label={t("shared.fiche.kpiReadiness")} value={live ? player.readiness : "—"} sub={live ? "/100" : t("shared.fiche.notEncoded")} color={live ? triC(player.readiness, 71, 51) : C.gray} />
            <KPI label={t("shared.fiche.kpiWellness")} value={live ? `${player.wellness}/50` : "—"} sub={live ? "" : t("shared.fiche.notEncoded")} color={live ? triC(player.wellness, 35, 25) : C.gray} />
            <KPI label={t("shared.fiche.kpiSleep")} value={live ? player.sleep : "—"} sub={live ? t("shared.fiche.sleepSub") : t("shared.fiche.notEncoded")} color={live ? triC(player.sleep, 7.5, 6.5) : C.gray} />
            <KPI label={t("shared.fiche.kpiLoad7d")} value={player.charge7j} sub={t("shared.fiche.loadSub", { label: ch.lk ? t(ch.lk) : "—" })} color={ch.c} />
            <KPI label={t("shared.fiche.kpiAcwr")} value={player.acwr.toFixed(2)} sub={acwrEstimated(player) ? `${zoneLabel(t, z)} · ${t("reliability.estimated")}` : zoneLabel(t, z)} color={acwrEstimated(player) ? C.gray : z.c} />
            <KPI label={t("shared.fiche.kpiDispo")} value={`${player.dispo}%`} color={triC(player.dispo, 85, 70)} />
          </div>
        );
      })()}

      {/* Détails avancés — repli (monotonie / strain / risque) */}
      <button onClick={() => setAdv((a) => !a)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 12, textAlign: "left" }}>
        {adv ? "▾" : "▸"} {t("shared.fiche.advDetails")}
      </button>
      {adv && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          <KPI label={t("shared.fiche.kpiMonotony")} value={player.monotonie} color={player.monotonie > 2 ? C.amb : C.green} />
          <KPI label={t("shared.fiche.kpiStrain")} value={player.strain} color={C.viol} />
          <KPI label={t("shared.fiche.kpiRisk")} value={player.risque} sub="/100" color={player.risque >= 60 ? C.coral : player.risque >= 40 ? C.amb : C.green} />
        </div>
      )}

      {/* tests physiques */}
      <Section title={t("shared.fiche.testsTitle")} right={canEdit && !edit ? <button onClick={() => setEdit(true)} style={{ background: "none", border: "none", color: C.viol, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t("shared.fiche.edit")}</button> : null}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border2}` }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            {t("shared.fiche.bodyweight")}
            {bw?.at && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}> · {fmtShort(bw.at)}{bw.source === "profil" ? t("shared.fiche.questionnaireSource") : ""}</span>}
          </span>
          {edit ? (
            <input value={d.bodyweight ?? ""} onChange={(e) => setD((p) => ({ ...p, bodyweight: e.target.value }))} inputMode="decimal" placeholder={t("shared.fiche.kgPlaceholder")} style={inp} />
          ) : (
            <span style={{ fontSize: 14, fontWeight: 800 }}>{bw?.value != null ? `${bw.value} kg` : "—"}</span>
          )}
        </div>
        <Row label={t("shared.fiche.rowHeight")} k="height_cm" unit=" cm" value={player.heightCm} placeholder={t("shared.fiche.cmPlaceholder")} />
        <Row label={t("shared.fiche.rowSessions")} k="sessions_per_week" unit={t("shared.fiche.perWeekUnit")} value={player.sessionsPerWeek} placeholder={t("shared.fiche.sessionsPlaceholder")} />
        <Row label={t("shared.fiche.rowMas")} k="mas" value={player.mas} />
        <Row label={t("shared.fiche.rowSquat")} k="back_squat" value={player.backSquat} />
        <Row label={t("shared.fiche.rowCmjG")} k="cmj_g" value={player.cmjG} />
        <Row label={t("shared.fiche.rowCmjD")} k="cmj_d" value={player.cmjD} />
        <Row label={t("shared.fiche.rowIschiosG")} k="ischios_g" value={player.ischiosG} />
        <Row label={t("shared.fiche.rowIschiosD")} k="ischios_d" value={player.ischiosD} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{t("shared.fiche.asym")}</span>
          <Tag c={asym == null ? C.gray : asym >= 10 ? C.coral : asym >= 6 ? C.amb : C.green}>{asym == null ? "—" : `${asym}%`}</Tag>
        </div>

        <div style={{ paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>{t("shared.fiche.ppNotes")} <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{t("shared.fiche.ppNotesHint")}</span></div>
          {edit ? (
            <textarea value={d.pp_notes ?? ""} onChange={(e) => setD((p) => ({ ...p, pp_notes: e.target.value }))} placeholder={t("shared.fiche.ppPlaceholder")} style={{ width: "100%", minHeight: 70, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.viol}66`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          ) : (
            <div style={{ fontSize: 13, color: player.ppNotes ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{player.ppNotes || "—"}</div>
          )}
        </div>

        {/* Historique blessures & gênes (donnée santé → staff uniquement). Nourrit
            le rapport de performance (carte « surveillance blessures »). */}
        {canEdit && (
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>{t("shared.fiche.injuryHistory")} <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{t("shared.fiche.injuryHistoryHint")}</span></div>
            {edit ? (
              <textarea value={d.injury_history ?? ""} onChange={(e) => setD((p) => ({ ...p, injury_history: e.target.value }))} placeholder={t("shared.fiche.injuryPlaceholder")} style={{ width: "100%", minHeight: 60, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.viol}66`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            ) : (
              <div style={{ fontSize: 13, color: player.injuryHistory ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{player.injuryHistory || "—"}</div>
            )}
          </div>
        )}

        {err && <div style={{ fontSize: 11, color: C.coral, marginTop: 8 }}>{err}</div>}
        {edit && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setEdit(false)} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
            <button onClick={save} disabled={busy} style={{ flex: 2, background: C.green, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}><CheckCircle size={13} /> {t("shared.fiche.save")}</button>
          </div>
        )}
      </Section>

      {/* Tests historisés par campagne (évolution + mini-graphe) */}
      <TestsEvolution player={player} canEdit={canEdit} />

      {/* Comparaison aux normes Top 14 du poste */}
      <Top14Panel t14={t14} />

      {/* Badges défis gagnés (visibles joueur + staff) */}
      {chalPts.length > 0 && (
        <Section title={t("shared.report.chalSection", { count: chalPts.length })}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {challengeBadges(chalPts.length).map((b) => (
              <span key={b.n} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(108,92,224,0.25)", border: `1px solid ${C.viol}66`, borderRadius: 6, padding: "3px 9px" }}>{b.emoji} {challengeBadgeLabel(t, b)}</span>
            ))}
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.viol, alignSelf: "center" }}>{t("shared.fiche.chalPtsSuffix", { pts: chalPts.reduce((a, c) => a + (c.points || 0), 0) })}</span>
          </div>
        </Section>
      )}

      {/* Réponses aux questionnaires (staff — données santé, lien croisé) */}
      {canEdit && <FicheQuestionnaires player={player} />}

      {/* RGPD — le staff gère le consentement / export / effacement du joueur */}
      {canEdit && <Confidentialite player={player} onErased={onClose} />}

      {/* Compte — réinitialisation du mot de passe par le staff (si le joueur
          a un compte). Pas d'auto-service côté joueur. */}
      {canEdit && player.ownerUid && <PasswordReset playerId={player.id} />}
    </div>
  );

  if (!onClose) return body;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4, position: "sticky", top: 0, zIndex: 5 }}><CloseX onClose={onClose} /></div>
        {body}
      </div>
    </div>
  );
}
