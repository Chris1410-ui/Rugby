import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { useReadOnly } from "../../lib/readonly.js";
import { ChevronLeft, Plus, X } from "../../lib/icons.jsx";
import { CloseX } from "../../lib/ui.jsx";
import { resolveAssignedIds, buildAssigned } from "../../data/sessions.js";
import { orderTickets, nextProgress, nextUpIds } from "../../lib/queue.js";
import {
  useQueues, useQueueTickets, createQueue, updateQueue, setQueueStatus, deleteQueue,
  addQueueTickets, reorderQueueTickets, setTicketProgress, setTicketAbsent, removeQueueTicket,
} from "../../data/queues.js";
import RecipientSelect from "../shared/RecipientSelect.jsx";

const ACCENT = C.teal;

/* Ordre de passage (staff). Liste des files → détail d'une file avec ajout de
   joueurs, réordonnancement au GLISSER-DÉPOSER (pointer events, mobile + desktop)
   validé en un lot, avancement 0/50/100 en un geste, et « ce sur quoi je
   travaille ». Temps réel : tout changement se propage aux joueurs sans refresh. */
export default function OrdrePassage({ teamId, players = [] }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { queues } = useQueues(teamId);
  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);
  const sel = queues.find((q) => q.id === selId) || null;

  if (sel) return <QueueDetail queue={sel} teamId={teamId} players={players} readOnly={readOnly} onBack={() => setSelId(null)} />;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>⏱️ {t("passage.title")}</div>
        {!readOnly && <button onClick={() => setCreating(true)} style={{ background: ACCENT, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("passage.new")}</button>}
      </div>

      {queues.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("passage.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {queues.map((q) => (
            <button key={q.id} onClick={() => setSelId(q.id)} style={sc({ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", border: "none", width: "100%" })}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.title}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{[q.lieu, q.currentFocus && `▶ ${q.currentFocus}`].filter(Boolean).join(" · ") || t("passage.noFocus")}</div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: q.status === "open" ? C.green : "rgba(255,255,255,0.5)", background: q.status === "open" ? `${C.green}1e` : "rgba(255,255,255,0.06)", border: `1px solid ${q.status === "open" ? C.green + "55" : C.border}`, borderRadius: 6, padding: "2px 8px" }}>{t(q.status === "open" ? "passage.open" : "passage.closed")}</span>
            </button>
          ))}
        </div>
      )}

      {creating && <CreateQueue teamId={teamId} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelId(id); }} />}
    </section>
  );
}

function CreateQueue({ teamId, onClose, onCreated }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [lieu, setLieu] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, colorScheme: "dark", boxSizing: "border-box" };
  const save = async () => {
    if (!title.trim()) return setErr(t("passage.errTitle"));
    setBusy(true); setErr("");
    try {
      const q = await createQueue(teamId, { title, lieu, scheduledAt: when ? new Date(when).toISOString() : null });
      onCreated(q.id);
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("passage.newTitle")}</div>
          <CloseX onClose={onClose} />
        </div>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setErr(""); }} placeholder={t("passage.titlePh")} style={inp} />
        <input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder={t("passage.lieuPh")} style={inp} />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={inp} />
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: ACCENT, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("passage.create")}</button>
      </div>
    </div>
  );
}

function QueueDetail({ queue, teamId, players, readOnly, onBack }) {
  const { t } = useTranslation();
  const { tickets } = useQueueTickets(queue.id);
  const nameOf = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const [order, setOrder] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [focus, setFocus] = useState(queue.currentFocus || "");
  const [addSel, setAddSel] = useState({ all: false, groups: [], ids: [] });
  const [addOpen, setAddOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const dragId = useRef(null);
  const draggingRef = useRef(false);
  const rowRefs = useRef({});

  // Sync ordre local depuis le serveur SAUF pendant un glisser ou un réordo non validé.
  useEffect(() => {
    if (!draggingRef.current && !dirty) setOrder(orderTickets(tickets));
  }, [tickets, dirty]);
  useEffect(() => { setFocus(queue.currentFocus || ""); }, [queue.currentFocus]);

  const nextUp = useMemo(() => new Set(nextUpIds(order, 2)), [order]);

  const saveFocus = () => { if ((focus || "") !== (queue.currentFocus || "")) updateQueue(queue.id, { currentFocus: focus }).catch((e) => console.error(e.message)); };

  const addPlayers = async () => {
    const ids = resolveAssignedIds(buildAssigned(addSel), players);
    if (!ids.length) return;
    try { await addQueueTickets(queue.id, teamId, ids); setAddSel({ all: false, groups: [], ids: [] }); setAddOpen(false); }
    catch (e) { console.error("[queue add]", e.message); }
  };

  // ── Glisser-déposer (pointer events) ──
  const onPointerDown = (e, id) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragId.current = id; draggingRef.current = true;
    setOrder((o) => [...o]); // force re-render marker
  };
  const onPointerMove = (e) => {
    if (!dragId.current) return;
    const y = e.clientY;
    setOrder((cur) => {
      const from = cur.findIndex((tk) => tk.id === dragId.current);
      if (from < 0) return cur;
      let target = 0;
      for (const tk of cur) {
        if (tk.id === dragId.current) continue;
        const el = rowRefs.current[tk.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y > r.top + r.height / 2) target += 1;
      }
      if (target === from) return cur;
      const next = [...cur];
      const [m] = next.splice(from, 1);
      next.splice(target, 0, m);
      return next;
    });
    setDirty(true);
  };
  const onPointerUp = () => { dragId.current = null; draggingRef.current = false; };

  const validateOrder = async () => {
    setSavingOrder(true);
    try { await reorderQueueTickets(order.map((tk) => tk.id)); setDirty(false); }
    catch (e) { console.error("[reorder]", e.message); }
    setSavingOrder(false);
  };

  const progLabel = (p) => (p >= 100 ? "✓" : `${p}%`);
  const progColor = (p) => (p >= 100 ? C.green : p >= 50 ? C.amb : "rgba(255,255,255,0.5)");

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 7, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}><ChevronLeft size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{queue.title}</div>
          {queue.lieu && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{queue.lieu}</div>}
        </div>
        {!readOnly && (
          <>
            <button onClick={() => setQueueStatus(queue.id, queue.status === "open" ? "closed" : "open").catch((e) => console.error(e.message))} style={{ background: queue.status === "open" ? `${C.green}18` : "rgba(255,255,255,0.06)", border: `1px solid ${queue.status === "open" ? C.green + "55" : C.border}`, borderRadius: 8, padding: "6px 10px", color: queue.status === "open" ? C.green : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{t(queue.status === "open" ? "passage.open" : "passage.closed")}</button>
            <button onClick={() => { if (window.confirm(t("passage.deleteConfirm"))) deleteQueue(queue.id).then(onBack).catch((e) => console.error(e.message)); }} style={{ background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 8, padding: 7, color: C.coral, cursor: "pointer", display: "flex" }}><X size={15} /></button>
          </>
        )}
      </div>

      {/* Ce sur quoi je travaille */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 5 }}>{t("passage.focusLabel")}</div>
        {readOnly ? (
          <div style={{ fontSize: 13, color: "#fff" }}>{queue.currentFocus || "—"}</div>
        ) : (
          <input value={focus} onChange={(e) => setFocus(e.target.value)} onBlur={saveFocus} placeholder={t("passage.focusPh")} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        )}
      </div>

      {/* Ajout de joueurs */}
      {!readOnly && (
        <div style={{ marginBottom: 12 }}>
          {addOpen ? (
            <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <RecipientSelect players={players} value={addSel} onChange={setAddSel} accent={ACCENT} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={addPlayers} style={{ flex: 1, background: ACCENT, border: "none", borderRadius: 9, padding: "9px 0", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{t("passage.addToQueue")}</button>
                <button onClick={() => setAddOpen(false)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddOpen(true)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: "10px 0", color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={14} /> {t("passage.addPlayers")}</button>
          )}
        </div>
      )}

      {/* Bandeau « valider l'ordre » */}
      {dirty && !readOnly && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`, borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: ACCENT }}>{t("passage.orderChanged")}</span>
          <button onClick={validateOrder} disabled={savingOrder} style={{ background: ACCENT, border: "none", borderRadius: 8, padding: "7px 12px", color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", opacity: savingOrder ? 0.6 : 1 }}>{savingOrder ? "…" : t("passage.validateOrder")}</button>
        </div>
      )}

      {/* File */}
      {order.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("passage.noTickets")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {order.map((tk, i) => {
            const p = nameOf[tk.playerId];
            const dragging = dragId.current === tk.id;
            const soon = nextUp.has(tk.playerId) && tk.progress < 100 && !tk.absent;
            return (
              <div key={tk.id} ref={(el) => { rowRefs.current[tk.id] = el; }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, background: dragging ? "rgba(39,232,214,0.14)" : soon ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${dragging ? ACCENT : soon ? ACCENT + "40" : "transparent"}`, opacity: tk.absent ? 0.5 : 1, touchAction: "none" }}>
              {!readOnly && (
                <span onPointerDown={(e) => onPointerDown(e, tk.id)} title={t("passage.dragTitle")} style={{ cursor: "grab", color: "rgba(255,255,255,0.4)", fontSize: 16, padding: "0 2px", touchAction: "none", userSelect: "none" }}>⠿</span>
              )}
              <span style={{ fontSize: 13, fontWeight: 900, fontStyle: "italic", color: tk.absent ? "rgba(255,255,255,0.4)" : soon ? ACCENT : "rgba(255,255,255,0.7)", width: 22, textAlign: "center" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p ? displayName(p) : "—"}</div>
                {p?.grp && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}>{grpLabel(p.grp)}</div>}
              </div>
              <button
                onClick={() => !readOnly && setTicketProgress(tk.id, nextProgress(tk.progress)).catch((e) => console.error(e.message))}
                disabled={readOnly}
                title={t("passage.progressTitle")}
                style={{ background: `${progColor(tk.progress)}1f`, border: `1px solid ${progColor(tk.progress)}66`, borderRadius: 7, padding: "5px 9px", color: progColor(tk.progress), fontSize: 12, fontWeight: 800, cursor: readOnly ? "default" : "pointer", minWidth: 42 }}
              >{progLabel(tk.progress)}</button>
              {!readOnly && (
                <>
                  <button onClick={() => setTicketAbsent(tk.id, !tk.absent).catch((e) => console.error(e.message))} title={t("passage.absentTitle")} style={{ background: tk.absent ? `${C.amb}22` : "rgba(255,255,255,0.05)", border: `1px solid ${tk.absent ? C.amb + "66" : C.border}`, borderRadius: 7, padding: "5px 8px", color: tk.absent ? C.amb : "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>{t("passage.absentShort")}</button>
                  <button onClick={() => removeQueueTicket(tk.id).catch((e) => console.error(e.message))} title={t("passage.removeTitle")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", padding: 2 }}><X size={14} /></button>
                </>
              )}
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
