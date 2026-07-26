import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, sc } from "../../lib/tokens.js";
import { parseISO, todayISO } from "../../lib/metrics.js";
import { CloseX, useModalClose, Tag, NatureTag } from "../../lib/ui.jsx";
import { useReadOnly } from "../../lib/readonly.js";
import { Plus, Trash2, Bell } from "../../lib/icons.jsx";
import { NATURES, natureLabel } from "../../lib/nature.js";
import { attendanceCounts } from "../../lib/attendance.js";
import {
  useTeamTrainings, useTeamAttendance,
  createTraining, updateTraining, deleteTraining, markAttendance, remindNonResponders,
  createTrainingsRecurring,
} from "../../data/trainings.js";
import { buildAssigned, assignedToSelection, resolveAssignedIds } from "../../data/sessions.js";
import { getClubId } from "../../data/catalog.js";
import RecipientSelect from "../shared/RecipientSelect.jsx";
import RecurrenceSelector from "../shared/RecurrenceSelector.jsx";

const accent = C.coral;
// Couleur d'un état de présence effectif.
const STATE_COLOR = { present: C.green, late: C.amb, absent: C.coral, pending: "rgba(255,255,255,0.45)" };

/* « Convocations » (staff/owner) : création d'un entraînement collectif avec
   destinataires combinables, écran de présences (réponses joueurs + pointage
   staff = vérité), relance des non-répondants. */
export default function Convocations({ teamId, players = [], openNew = false }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { trainings } = useTeamTrainings(teamId, players);
  const { byTraining } = useTeamAttendance(teamId);
  const [form, setForm] = useState(openNew);
  const [edit, setEdit] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const today = todayISO();
  const detail = trainings.find((tr) => tr.id === detailId) || null;

  const del = (id) => {
    if (confirm(t("staff.convocations.delConfirm"))) {
      deleteTraining(id).then(() => setDetailId(null)).catch((e) => console.error(e.message));
    }
  };

  const stateLabel = (st) => t(`staff.convocations.state.${st}`);

  const Card = (tr) => {
    const c = attendanceCounts(tr.assignedIds, byTraining[tr.id] || {});
    const d = parseISO(tr.date);
    const isPast = tr.date < today;
    return (
      <div key={tr.id} onClick={() => setDetailId(tr.id)} style={sc({ padding: 14, cursor: "pointer", opacity: isPast ? 0.75 : 1 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ textAlign: "center", width: 42, flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString(localeTag(), { month: "short" })}</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{d.getDate()}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {tr.nature && <NatureTag nature={tr.nature} />}
              <span style={{ fontSize: 14, fontWeight: 800 }}>{tr.titre || t("staff.convocations.untitled")}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {[tr.heure, tr.lieu].filter(Boolean).join(" · ") || t("staff.convocations.noTimePlace")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Tag c={C.green}>{t("staff.convocations.cntPresent", { count: c.present })}</Tag>
          {c.late > 0 && <Tag c={C.amb}>{t("staff.convocations.cntLate", { count: c.late })}</Tag>}
          <Tag c={C.coral}>{t("staff.convocations.cntAbsent", { count: c.absent })}</Tag>
          <Tag c={"rgba(255,255,255,0.45)"}>{t("staff.convocations.cntPending", { count: c.pending })}</Tag>
        </div>
      </div>
    );
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📣</span>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.convocations.title", { count: trainings.length })}</div>
        {!readOnly && <button onClick={() => setForm(true)} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("staff.convocations.addBtn")}</button>}
      </div>

      {trainings.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>{t("staff.convocations.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{trainings.map(Card)}</div>
      )}

      {detail && (
        <ConvocationDetail
          tr={detail} nameById={nameById} attendance={byTraining[detail.id] || {}}
          readOnly={readOnly} onClose={() => setDetailId(null)}
          onEdit={() => { setDetailId(null); setEdit(detail); }}
          onDelete={() => del(detail.id)}
          stateLabel={stateLabel}
        />
      )}
      {(form || edit) && <ConvocationForm teamId={teamId} players={players} initial={edit} onClose={() => { setForm(false); setEdit(null); }} />}
    </section>
  );
}

/* Détail d'une convocation : liste des convoqués avec leur réponse (annonce) et
   le pointage staff (la vérité) réglable en un tap, compteurs, relance. */
function ConvocationDetail({ tr, nameById, attendance, readOnly, onClose, onEdit, onDelete, stateLabel }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const c = attendanceCounts(tr.assignedIds, attendance);

  const point = (pid, status) => {
    const cur = attendance[pid]?.staffStatus;
    markAttendance(tr.id, pid, tr.teamId, cur === status ? null : status).catch((e) => console.error(e.message));
  };
  const relance = async () => {
    setBusy(true); setNote("");
    try { const n = await remindNonResponders(tr.id); setNote(t("staff.convocations.remindDone", { count: n })); }
    catch (e) { setNote(e.message || ""); }
    setBusy(false);
  };

  const btn = (pid, status, label, col) => {
    const on = attendance[pid]?.staffStatus === status;
    return (
      <button onClick={() => point(pid, status)} disabled={readOnly} style={{
        padding: "4px 8px", borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: readOnly ? "default" : "pointer",
        background: on ? col : "rgba(255,255,255,0.06)", color: on ? "#fff" : "rgba(255,255,255,0.6)",
        border: `1px solid ${on ? col : C.border}`,
      }}>{label}</button>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{tr.titre || t("staff.convocations.untitled")}</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {parseISO(tr.date).toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long" })}
              {tr.heure ? ` · ${tr.heure}` : ""}{tr.lieu ? ` · ${tr.lieu}` : ""}
            </div>
          </div>
          <CloseX onClose={onClose} />
        </div>

        {tr.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", marginBottom: 12, lineHeight: 1.5 }}>{tr.notes}</div>}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <Tag c={C.green}>{t("staff.convocations.cntPresent", { count: c.present })}</Tag>
          <Tag c={C.amb}>{t("staff.convocations.cntLate", { count: c.late })}</Tag>
          <Tag c={C.coral}>{t("staff.convocations.cntAbsent", { count: c.absent })}</Tag>
          <Tag c={"rgba(255,255,255,0.45)"}>{t("staff.convocations.cntPending", { count: c.pending })}</Tag>
        </div>

        {!readOnly && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={relance} disabled={busy || c.pending === 0} style={{ background: `${C.blue}22`, border: `1px solid ${C.blue}66`, borderRadius: 9, padding: "8px 12px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: c.pending === 0 ? "default" : "pointer", opacity: busy || c.pending === 0 ? 0.55 : 1, display: "flex", alignItems: "center", gap: 6 }}><Bell size={13} /> {t("staff.convocations.remindBtn")}</button>
            {note && <span style={{ fontSize: 11, color: C.green }}>{note}</span>}
          </div>
        )}

        <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 8 }}>{t("staff.convocations.roster")}</div>
        {tr.assignedIds.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("staff.convocations.noRecipient")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tr.assignedIds.map((pid) => {
              const row = attendance[pid];
              const resp = row?.playerResponse;
              return (
                <div key={pid} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "7px 10px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 90, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {nameById[pid] || "—"}
                    {resp && <span style={{ fontSize: 9.5, fontWeight: 700, color: STATE_COLOR[resp], marginLeft: 6 }}>· {t("staff.convocations.announced", { state: stateLabel(resp) })}</span>}
                    {resp === "absent" && row?.absenceReason && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>({row.absenceReason})</span>}
                    {resp === "late" && row?.eta && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>({row.eta})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {btn(pid, "present", t("staff.convocations.state.present"), C.green)}
                    {btn(pid, "late", t("staff.convocations.state.late"), C.amb)}
                    {btn(pid, "absent", t("staff.convocations.state.absent"), C.coral)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!readOnly && (
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={onEdit} style={{ flex: 1, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 9, padding: "9px 12px", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>{t("staff.convocations.edit")}</button>
            <button onClick={onDelete} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", color: C.coral, fontWeight: 800, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={13} /> {t("staff.convocations.delete")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Formulaire de convocation. `initial` → mode ÉDITION (pré-remplissage + update). */
function ConvocationForm({ teamId, players, initial = null, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const editing = Boolean(initial);
  const [d, setD] = useState(() => initial
    ? { titre: initial.titre || "", lieu: initial.lieu || "", nature: initial.nature || "", notes: initial.notes || "" }
    : { titre: "", lieu: "", nature: "", notes: "" });
  const [recur, setRecur] = useState(() => ({
    mode: "once", date: initial?.date || todayISO(), time: initial?.heure || "",
    weekdays: [], times: {}, start: initial?.date || todayISO(), end: "", exclusions: [],
  }));
  const [rec, setRec] = useState(() => assignedToSelection(initial?.assigned));
  const [clubId, setClubId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setErr(""); };
  useEffect(() => { let a = true; getClubId(teamId).then((id) => { if (a) setClubId(id); }); return () => { a = false; }; }, [teamId]);

  const recipientCount = resolveAssignedIds(buildAssigned(rec), players).length;
  const payload = () => ({ titre: d.titre.trim() || null, lieu: d.lieu?.trim() || null, nature: d.nature || null, notes: d.notes?.trim() || null });

  const save = async () => {
    const assigned = buildAssigned(rec);
    setBusy(true); setErr("");
    try {
      if (!editing && recur.mode === "recurring") {
        const r = await createTrainingsRecurring(teamId, clubId, { value: recur, assigned, payload: payload() });
        if (!r.count) throw new Error("no_occurrences");
      } else if (editing) {
        if (!recur.date) { setBusy(false); return setErr(t("staff.convocations.errDate")); }
        // Édition d'une occurrence : si elle appartient à une série, on la marque
        // « personnalisée » → une mise à jour de série ne l'écrasera plus.
        await updateTraining(initial.id, {
          ...payload(), date: recur.date, heure: recur.time?.trim() || null, assigned,
          ...(initial.seriesId ? { customized: true } : {}),
        });
      } else {
        if (!recur.date) { setBusy(false); return setErr(t("staff.convocations.errDate")); }
        await createTraining(teamId, { ...payload(), date: recur.date, heure: recur.time?.trim() || null, assigned });
      }
      onClose();
    } catch (e) {
      setErr(e.message === "no_occurrences" ? t("staff.convocations.errNoOcc") : t("staff.convocations.errSave", { err: e.message || "" }));
      setBusy(false);
    }
  };
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{editing ? t("staff.convocations.editTitle") : t("staff.convocations.newTitle")}</div>
          <CloseX onClose={onClose} />
        </div>

        <input value={d.titre} onChange={(e) => set("titre", e.target.value)} placeholder={t("staff.convocations.titlePlaceholder")} maxLength={90} style={inp} />

        {/* Récurrence partagée : ponctuel (défaut) ou récurrent (jours + heures + période) */}
        <div style={{ marginBottom: 10 }}>
          <RecurrenceSelector value={recur} onChange={(nv) => { setRecur(nv); setErr(""); }} recipientCount={recipientCount} allowRecurring={!editing} accent={accent} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><div style={lbl}>{t("staff.convocations.lblLieu")}</div><input value={d.lieu} onChange={(e) => set("lieu", e.target.value)} placeholder={t("staff.convocations.lieuPlaceholder")} style={inp} /></div>
          <div style={{ flex: 1 }}><div style={lbl}>{t("staff.convocations.lblNature")}</div>
            <select value={d.nature} onChange={(e) => set("nature", e.target.value)} style={{ ...inp, colorScheme: "dark" }}>
              <option value="">{t("staff.convocations.natureNone")}</option>
              {NATURES.map((n) => <option key={n} value={n}>{natureLabel(t, n)}</option>)}
            </select>
          </div>
        </div>
        <textarea value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("staff.convocations.notesPlaceholder")} style={{ ...inp, minHeight: 54, resize: "vertical" }} />

        <div style={lbl}>{t("staff.convocations.lblRecipients")}</div>
        <div style={{ marginBottom: 10 }}><RecipientSelect players={players} value={rec} onChange={setRec} accent={accent} /></div>

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : editing ? t("staff.convocations.saveEdit") : t("staff.convocations.saveNew")}</button>
      </div>
    </div>
  );
}

const lbl = { fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 4 };
