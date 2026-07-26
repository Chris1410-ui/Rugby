import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { CloseX, useModalClose, Tag } from "../../lib/ui.jsx";
import { useReadOnly } from "../../lib/readonly.js";
import { Plus, Trash2, CheckCircle, X, Grid } from "../../lib/icons.jsx";
import { CHALLENGE_BANNERS, CHALLENGE_EMOJIS, bannerGradient, defiOfWeek } from "../../lib/challenges.js";
import {
  useTeamChallenges, useTeamChallengeCompletions, useTeamChallengeStats,
  createChallenge, createChallengesBulk, deleteChallenge, confirmChallenge, refuseChallenge, updateChallenge,
  createChallengesRecurring, updateChallengeSeries, deleteChallengeSeries,
} from "../../data/challenges.js";
import { buildAssigned, assignedToSelection, resolveAssignedIds } from "../../data/sessions.js";
import { getRecurrenceSeries, seriesToValue } from "../../data/recurrence.js";
import { getClubId } from "../../data/catalog.js";
import RecipientSelect from "../shared/RecipientSelect.jsx";
import RecurrenceSelector from "../shared/RecurrenceSelector.jsx";
import ChallengeCard from "../shared/ChallengeCard.jsx";
import ChallengeDetail from "../shared/ChallengeDetail.jsx";

const accent = C.coral;
const parseMateriel = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const destToAssigned = (d) => d === "avants" ? { mode: "group", group: "avants" } : d === "arrieres" ? { mode: "group", group: "arrieres" } : d === "open" ? { mode: "open" } : { mode: "all" };

/* « Défis » (staff/owner) : création (formulaire unitaire + grille tableur),
   file de validation en 2 temps (Valider / Refuser), suppression. */
export default function Defis({ teamId, players = [], openNew = false }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { challenges } = useTeamChallenges(teamId, players);
  const { byChallenge } = useTeamChallengeCompletions(teamId);
  const stats = useTeamChallengeStats(teamId);
  const [form, setForm] = useState(openNew);
  const [grid, setGrid] = useState(false);
  const [detailId, setDetailId] = useState(null); // défi ouvert en grand
  const [edit, setEdit] = useState(null);          // défi en cours d'édition
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const today = todayISO();
  const featured = defiOfWeek(challenges, today);
  const detail = challenges.find((c) => c.id === detailId) || null; // suit le temps réel

  const del = (id) => {
    if (confirm(t("staff.challenges.delConfirm"))) {
      deleteChallenge(id).then(() => setDetailId(null)).catch((e) => console.error(e.message));
    }
  };
  const openEdit = (c) => { setDetailId(null); setEdit(c); };

  const Footer = ({ c }) => {
    const comps = byChallenge[c.id] || {};
    const pending = Object.values(comps).filter((x) => x.statut === "validee_joueur");
    const confirmed = Object.values(comps).filter((x) => x.statut === "confirmee").length;
    return (
      <div>
        {confirmed > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: pending.length ? 8 : 0 }}>{t("staff.challenges.validatedCount", { count: confirmed, points: c.points })}</div>}
        {readOnly ? (
          pending.length > 0 && <div style={{ fontSize: 11, color: C.amb, fontWeight: 700 }}>{t("staff.challenges.pendingReadOnly", { count: pending.length })}</div>
        ) : pending.length === 0 ? (
          confirmed === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("staff.challenges.noPending")}</div>
        ) : (
          <>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: C.amb, letterSpacing: 0.5, marginBottom: 6 }}>{t("staff.challenges.toValidate", { count: pending.length })}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pending.map((x) => (
                <div key={x.playerId} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 9px" }}>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameById[x.playerId] || t("staff.challenges.playerFallback")}</div>
                  <button onClick={() => confirmChallenge(c.id, x.playerId, teamId).catch((e) => console.error(e.message))} style={{ background: `${C.green}1f`, border: `1px solid ${C.green}66`, borderRadius: 8, padding: "5px 10px", color: C.green, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{t("staff.challenges.validateBtn", { points: c.points })}</button>
                  <button onClick={() => refuseChallenge(c.id, x.playerId).catch((e) => console.error(e.message))} title={t("staff.challenges.refuseTitle")} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex" }}><X size={13} /></button>
                </div>
              ))}
            </div>
          </>
        )}
        {!readOnly && <button onClick={() => del(c.id)} style={{ marginTop: 10, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Trash2 size={12} /> {t("staff.challenges.deleteChallenge")}</button>}
      </div>
    );
  };

  // Liste des participants + statut (relevé / en attente / validé) — vue détail.
  const Participants = ({ c }) => {
    const comps = byChallenge[c.id] || {};
    const open = c.assigned?.mode === "open";
    // Ouvert : ceux qui ont relevé ; sinon : les assignés.
    const ids = open ? Object.keys(comps) : c.assignedIds;
    if (ids.length === 0) {
      return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{open ? t("staff.challenges.openNobody") : t("staff.challenges.noRecipient")}</div>;
    }
    const rank = (st) => (st === "confirmee" ? 0 : st === "validee_joueur" ? 1 : st === "refuse" || st === "manque" ? 3 : 2);
    const sorted = [...ids].sort((a, b) => rank(comps[a]?.statut) - rank(comps[b]?.statut));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((pid) => {
          const st = comps[pid]?.statut;
          const chip = st === "confirmee" ? { t: t("staff.challenges.chipConfirmed"), c: C.green }
            : st === "validee_joueur" ? { t: t("staff.challenges.chipPending"), c: C.amb }
            : st === "refuse" ? { t: t("staff.challenges.chipRefused"), c: "rgba(255,255,255,0.5)" }
            : st === "manque" ? { t: t("staff.challenges.chipMissed"), c: C.coral }
            : { t: t("staff.challenges.chipWaiting"), c: "rgba(255,255,255,0.45)" };
          return (
            <div key={pid} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameById[pid] || t("staff.challenges.playerFallback")}</div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: chip.c }}>{chip.t}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const Card = (c) => {
    const open = c.assigned?.mode === "open";
    const s = stats[c.id] || { releves: 0 };
    const participants = open ? s.releves : (c.assignedIds.length || 0);
    return <ChallengeCard key={c.id} c={c} releves={s.releves} participants={participants} open={open} highlight={featured?.id === c.id} onOpen={() => setDetailId(c.id)}><Footer c={c} /></ChallengeCard>;
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🏆</span>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.challenges.title", { count: challenges.length })}</div>
        {!readOnly && <button onClick={() => setGrid(true)} title={t("staff.challenges.gridTitle")} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 9, color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex" }}><Grid size={16} /></button>}
        {!readOnly && <button onClick={() => setForm(true)} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("staff.challenges.addBtn")}</button>}
      </div>

      {challenges.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          {t("staff.challenges.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {featured && Card(featured)}
          {challenges.filter((c) => c.id !== featured?.id).map(Card)}
        </div>
      )}

      {detail && (
        <ChallengeDetail
          c={detail}
          onClose={() => setDetailId(null)}
          topRight={readOnly ? null : (
            <>
              <button onClick={() => openEdit(detail)} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 9, padding: "8px 14px", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>{t("staff.challenges.edit")}</button>
              <button onClick={() => del(detail.id)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 14px", color: C.coral, fontWeight: 800, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={13} /> {t("staff.challenges.delete")}</button>
            </>
          )}
        >
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 8 }}>{t("staff.challenges.participants")}</div>
            <Participants c={detail} />
          </div>
        </ChallengeDetail>
      )}

      {(form || edit) && <DefiForm teamId={teamId} players={players} initial={edit} onClose={() => { setForm(false); setEdit(null); }} />}
      {grid && <DefiGrid teamId={teamId} onClose={() => setGrid(false)} />}
    </section>
  );
}

/* Formulaire unitaire complet (tous les champs + bannière + badge + destinataires
   fins). `initial` (défi existant) → mode ÉDITION : pré-remplissage + mise à jour. */
function DefiForm({ teamId, players, initial = null, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const editing = Boolean(initial);
  const [d, setD] = useState(() => initial
    ? { titre: initial.titre || "", description: initial.description || "", points: initial.points ?? 10, heure: initial.heure || "", lieu: initial.lieu || "", materiel: (initial.materiel || []).join(", "), echeance: initial.echeance || "", banner: initial.banner || "flame", badge: initial.badge || "🏆" }
    : { titre: "", description: "", points: 10, heure: "", lieu: "", materiel: "", echeance: "", banner: "flame", badge: "🏆" });
  // Destinataires : sélection ADDITIVE (lignes + joueurs) OU « inscription libre »
  // (open) — cette dernière n'est pas cumulable, d'où un interrupteur distinct.
  const [open, setOpen] = useState(initial?.assigned?.mode === "open");
  const [rec, setRec] = useState(() => assignedToSelection(initial?.assigned));
  const [recur, setRecur] = useState(() => ({ mode: "once", date: initial?.echeance || "", time: initial?.heure || "", weekdays: [], times: {}, start: initial?.echeance || todayISO(), end: "", exclusions: [] }));
  const [scope, setScope] = useState("occurrence");
  const [clubId, setClubId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setErr(""); };
  useEffect(() => { let a = true; getClubId(teamId).then((id) => { if (a) setClubId(id); }); return () => { a = false; }; }, [teamId]);

  const assignedNow = () => (open ? { mode: "open" } : buildAssigned(rec));
  const recipientCount = open ? players.length : resolveAssignedIds(buildAssigned(rec), players).length;
  const payload = () => ({
    titre: d.titre.trim(), description: d.description?.trim() || null,
    points: Math.max(0, Math.min(500, Math.round(+d.points) || 0)),
    lieu: d.lieu?.trim() || null, materiel: parseMateriel(d.materiel), banner: d.banner, badge: d.badge,
  });

  const toSeriesScope = async () => {
    try {
      const s = await getRecurrenceSeries(initial.seriesId);
      setRecur(seriesToValue(s));
      const p = s.payload || {};
      setD((cur) => ({ ...cur, titre: p.titre || "", description: p.description || "", points: p.points ?? 10, lieu: p.lieu || "", materiel: (p.materiel || []).join(", "), banner: p.banner || "flame", badge: p.badge || "🏆" }));
      setRec(assignedToSelection(s.assigned)); setOpen(s.assigned?.mode === "open"); setScope("series"); setErr("");
    } catch (e) { setErr(t("staff.challenges.errSave", { err: e.message || "" })); }
  };
  const toOccurrenceScope = () => {
    setRecur({ mode: "once", date: initial.echeance || "", time: initial.heure || "", weekdays: [], times: {}, start: initial.echeance || todayISO(), end: "", exclusions: [] });
    setScope("occurrence"); setErr("");
  };
  const delSeries = async () => {
    if (!confirm(t("recurrence.delSeriesConfirm"))) return;
    setBusy(true); setErr("");
    try { await deleteChallengeSeries(initial.seriesId, { today: todayISO() }); onClose(); }
    catch (e) { setErr(t("staff.challenges.errSave", { err: e.message || "" })); setBusy(false); }
  };

  const save = async () => {
    if (!d.titre.trim()) return setErr(t("staff.challenges.errTitle"));
    const assigned = assignedNow();
    setBusy(true); setErr("");
    try {
      if (editing && scope === "series") {
        await updateChallengeSeries(initial.seriesId, teamId, { value: recur, assigned, payload: payload() }, { today: todayISO() });
      } else if (!editing && recur.mode === "recurring") {
        const r = await createChallengesRecurring(teamId, clubId, { value: recur, assigned, payload: payload() });
        if (!r.count) throw new Error("no_occurrences");
      } else if (editing) {
        await updateChallenge(initial.id, {
          ...payload(), heure: recur.time?.trim() || null, echeance: recur.date || null, assigned,
          ...(initial.seriesId ? { customized: true } : {}),
        });
      } else {
        await createChallenge(teamId, { ...payload(), heure: recur.time?.trim() || null, echeance: recur.date || null, assigned });
      }
      onClose();
    } catch (e) {
      setErr(e.message === "no_occurrences" ? t("recurrence.errNoOcc") : t("staff.challenges.errSave", { err: e.message || "" }));
      setBusy(false);
    }
  };
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" };
  const pill = (on) => ({ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: on ? accent : "rgba(255,255,255,0.07)", color: "#fff" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{editing ? t("staff.challenges.editTitle") : t("staff.challenges.newTitle")}</div>
          <CloseX onClose={onClose} />
        </div>

        {/* Aperçu bannière */}
        <div style={{ background: bannerGradient(d.banner), borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.badge}</div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 900, color: "#fff" }}>{d.titre || t("staff.challenges.titlePreview")}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>+{d.points || 0}</div>
        </div>

        <input value={d.titre} onChange={(e) => set("titre", e.target.value)} placeholder={t("staff.challenges.titlePlaceholder")} maxLength={90} style={inp} />
        <textarea value={d.description} onChange={(e) => set("description", e.target.value)} placeholder={t("staff.challenges.descPlaceholder")} style={{ ...inp, minHeight: 54, resize: "vertical" }} />
        <div style={{ maxWidth: 160 }}><div style={lbl}>{t("staff.challenges.lblPoints")}</div><input type="number" value={d.points} onChange={(e) => set("points", e.target.value)} min={0} max={500} style={inp} /></div>

        {editing && initial.seriesId && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={toOccurrenceScope} style={scopeBtn(scope === "occurrence")}>{t("recurrence.scopeOne")}</button>
            <button type="button" onClick={toSeriesScope} style={scopeBtn(scope === "series")}>{t("recurrence.scopeSeries")}</button>
          </div>
        )}
        {scope === "series" && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginBottom: 8, lineHeight: 1.5 }}>{t("recurrence.seriesHint")}</div>}
        <div style={{ marginBottom: 10 }}>
          <RecurrenceSelector value={recur} onChange={(nv) => { setRecur(nv); setErr(""); }} recipientCount={recipientCount} allowRecurring={!editing || scope === "series"} accent={accent} />
        </div>

        <div style={lbl}>{t("staff.challenges.lblLieu")}</div>
        <input value={d.lieu} onChange={(e) => set("lieu", e.target.value)} placeholder={t("staff.challenges.lieuPlaceholder")} style={inp} />
        <div style={lbl}>{t("staff.challenges.lblMateriel")}</div>
        <input value={d.materiel} onChange={(e) => set("materiel", e.target.value)} placeholder={t("staff.challenges.materielPlaceholder")} style={inp} />

        <div style={lbl}>{t("staff.challenges.lblBanner")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {CHALLENGE_BANNERS.map((b) => (
            <button key={b.key} onClick={() => set("banner", b.key)} title={b.label} style={{ width: 34, height: 34, borderRadius: 9, background: bannerGradient(b.key), border: d.banner === b.key ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", fontSize: 15 }}>{b.emoji}</button>
          ))}
        </div>
        <div style={lbl}>{t("staff.challenges.lblBadge")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {CHALLENGE_EMOJIS.map((e) => (
            <button key={e} onClick={() => set("badge", e)} style={{ width: 34, height: 34, borderRadius: 9, background: d.badge === e ? `${accent}33` : "rgba(255,255,255,0.06)", border: `1px solid ${d.badge === e ? accent : C.border}`, cursor: "pointer", fontSize: 17 }}>{e}</button>
          ))}
        </div>

        <div style={lbl}>{t("staff.challenges.lblRecipients")}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => setOpen((o) => !o)} style={pill(open)}>{t("staff.challenges.destOpen")}</button>
        </div>
        {!open && <div style={{ marginBottom: 10 }}><RecipientSelect players={players} value={rec} onChange={setRec} accent={accent} /></div>}

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : scope === "series" ? t("recurrence.updateSeries") : !editing && recur.mode === "recurring" ? t("recurrence.saveRecurring") : editing ? t("staff.challenges.saveEdit") : t("staff.challenges.saveNew")}</button>
        {scope === "series" && <button onClick={delSeries} disabled={busy} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: C.coral, fontSize: 11.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{t("recurrence.deleteSeries")}</button>}
      </div>
    </div>
  );
}

const scopeBtn = (on) => ({ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.04)", color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, cursor: "pointer" });

/* Grille tableur : plusieurs défis d'un coup (titre, points, heure, lieu,
   matériel, destinataires), ajout de ligne, puis « Publier ». */
function DefiGrid({ teamId, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const empty = () => ({ titre: "", points: 10, heure: "", lieu: "", materiel: "", dest: "all" });
  const [rows, setRows] = useState([empty(), empty(), empty()]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const setCell = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const publish = async () => {
    const list = rows.filter((r) => r.titre.trim()).map((r) => ({
      titre: r.titre, points: r.points, heure: r.heure, lieu: r.lieu,
      materiel: parseMateriel(r.materiel), assigned: destToAssigned(r.dest),
    }));
    if (!list.length) return setNote(t("staff.challenges.errNoTitle"));
    setBusy(true); setNote("");
    try { await createChallengesBulk(teamId, list); setNote(t("staff.challenges.published", { count: list.length })); setTimeout(onClose, 700); }
    catch (e) { setNote(t("staff.challenges.errSave", { err: e.message || "" })); setBusy(false); }
  };

  const cell = { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 7px", color: "#fff", fontSize: 12, outline: "none" };
  const th = { fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.6)", padding: "4px 6px", textAlign: "left", whiteSpace: "nowrap" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, background: C.navy, borderRadius: 18, padding: 18, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("staff.challenges.gridTitle")}</div>
          <CloseX onClose={onClose} />
        </div>
        <div style={{ overflow: "auto", flex: 1, marginBottom: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
            <thead><tr>
              {[t("staff.challenges.colTitre"), t("staff.challenges.colPoints"), t("staff.challenges.colHeure"), t("staff.challenges.colLieu"), t("staff.challenges.colMateriel"), t("staff.challenges.colDest"), ""].map((h, i) => <th key={i} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: 3 }}><input value={r.titre} onChange={(e) => setCell(i, "titre", e.target.value)} placeholder={t("staff.challenges.colTitre")} style={{ ...cell, width: 180 }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={r.points} onChange={(e) => setCell(i, "points", e.target.value)} min={0} max={500} style={{ ...cell, width: 64, textAlign: "right" }} /></td>
                  <td style={{ padding: 3 }}><input value={r.heure} onChange={(e) => setCell(i, "heure", e.target.value)} placeholder={t("staff.challenges.heurePlaceholder")} style={{ ...cell, width: 70 }} /></td>
                  <td style={{ padding: 3 }}><input value={r.lieu} onChange={(e) => setCell(i, "lieu", e.target.value)} placeholder={t("staff.challenges.gridLieuPlaceholder")} style={{ ...cell, width: 120 }} /></td>
                  <td style={{ padding: 3 }}><input value={r.materiel} onChange={(e) => setCell(i, "materiel", e.target.value)} placeholder={t("staff.challenges.gridMaterielPlaceholder")} style={{ ...cell, width: 150 }} /></td>
                  <td style={{ padding: 3 }}>
                    <select value={r.dest} onChange={(e) => setCell(i, "dest", e.target.value)} style={{ ...cell, colorScheme: "dark" }}>
                      <option value="all">{t("staff.challenges.destAll")}</option>
                      <option value="avants">{t("staff.challenges.destAvants")}</option>
                      <option value="arrieres">{t("staff.challenges.destArrieres")}</option>
                      <option value="open">{t("staff.challenges.destOpen")}</option>
                    </select>
                  </td>
                  <td style={{ padding: 3 }}>{rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", display: "flex" }}><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setRows((rs) => [...rs, empty()])} style={{ background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 9, padding: "9px 13px", color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> {t("staff.challenges.addRow")}</button>
          <div style={{ flex: 1 }} />
          {note && <span style={{ fontSize: 12, color: note.includes("✓") ? C.green : C.amb }}>{note}</span>}
          <button onClick={publish} disabled={busy} style={{ background: accent, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", gap: 7 }}><CheckCircle size={15} /> {t("staff.challenges.publish")}</button>
        </div>
      </div>
    </div>
  );
}

const lbl = { fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 4 };
