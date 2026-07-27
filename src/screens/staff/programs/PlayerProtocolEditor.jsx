import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { WD_ORDER, wdLabel } from "../../../lib/exlib.js";
import { todayISO } from "../../../lib/metrics.js";
import { displayName } from "../../../lib/identity.js";
import { uid, emptyRow } from "../../../lib/program/model.js";
import { deriveSlots } from "../../../lib/program/planMaterialize.js";
import { getProgramDoc } from "../../../data/programDocs.js";
import { overridesForPlayer, setOverride, resetOverride, resetAllOverrides } from "../../../data/protocolOverrides.js";
import { regeneratePlayerSessions } from "../../../data/programPlans.js";
import { parsePath } from "../../../lib/program/overrides.js";

const ACCENT = C.viol;

/* Édition d'un protocole « AU NOM D'UN JOUEUR » : on part du socle collectif et on
   stocke uniquement des SURCHARGES (protocol_player_overrides) pour ce joueur —
   jamais une copie. Chaque changement régénère ses séances futures (socle + ses
   surcharges), sans toucher les autres joueurs ni ses séances déjà validées. Un
   badge « modifié » signale les lignes/sections personnalisées ; on peut tout
   réinitialiser au socle. */
export default function PlayerProtocolEditor({ programDocId, teamId, player, players = [], onClose }) {
  const { t } = useTranslation();
  const [socle, setSocle] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let a = true;
    (async () => {
      try {
        const [sd, ov] = await Promise.all([getProgramDoc(programDocId), overridesForPlayer(programDocId, player.id)]);
        if (a) { setSocle(sd.doc); setOverrides(ov); }
      } catch (e) { if (a) setErr(e.message || String(e)); }
    })();
    return () => { a = false; };
  }, [programDocId, player.id]);

  const ovByPath = useMemo(() => Object.fromEntries(overrides.map((o) => [o.path, o])), [overrides]);
  const addedBySection = useMemo(() => {
    const m = {};
    overrides.forEach((o) => { const p = parsePath(o.path); if (p.kind === "addRow") (m[p.sectionId] ||= []).push(o); });
    return m;
  }, [overrides]);

  // Toute mutation régénère les séances futures du joueur puis recharge l'état.
  const mutate = async (fn) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      await fn();
      await regeneratePlayerSessions(teamId, programDocId, player.id, players, { today: todayISO() });
      setOverrides(await overridesForPlayer(programDocId, player.id));
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const save = (path, op, value) => mutate(() => setOverride(teamId, { programDocId, playerId: player.id, path, op, value }));
  const reset = (path) => mutate(() => resetOverride(programDocId, player.id, path));
  const resetAll = () => mutate(() => resetAllOverrides(programDocId, player.id));

  // Patch d'une ligne du socle (fusion avec la surcharge existante).
  const patchRow = (sectionId, rowId, patch) => {
    const path = `sec/${sectionId}/row/${rowId}`;
    const cur = ovByPath[path]?.op === "patch" ? ovByPath[path].value : {};
    const value = { ...cur, ...patch };
    if (patch.weeks) value.weeks = { ...(cur.weeks || {}), ...patch.weeks };
    save(path, "patch", value);
  };
  const patchAdded = (path, patch) => {
    const cur = ovByPath[path]?.value || {};
    const value = { ...cur, ...patch };
    save(path, "add", value);
  };
  const addRow = (sectionId) => {
    const r = emptyRow(socle?.meta?.weeks || 4);
    r.id = uid();
    save(`sec/${sectionId}/add/${r.id}`, "add", r);
  };
  const setSlotDay = (label, weekday) => save(`slot/${label}`, "patch", { weekday: Number(weekday) });

  const removed = (path) => ovByPath[path]?.op === "remove";
  const patched = (path) => ovByPath[path]?.op === "patch";

  const slots = useMemo(() => (socle ? deriveSlots(socle).slots : []), [socle]);
  const weeksN = socle?.meta?.weeks || 4;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{t("playerProto.title", { player: displayName(player) })}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{socle?.meta?.title || t("protocols.untitled")}{player.totem ? ` · ${player.totem}` : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: "6px 0 12px" }}>{t("playerProto.intro")}</div>

        {overrides.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 10px", background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`, borderRadius: 9 }}>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: ACCENT }}>{t("playerProto.customCount", { count: overrides.length })}</span>
            <button onClick={resetAll} disabled={busy} style={ghostBtn}>{t("playerProto.resetAll")}</button>
          </div>
        )}
        {err && <div style={{ fontSize: 11.5, color: C.coral, marginBottom: 10 }}>{err}</div>}
        {!socle ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("protocols.loading")}</div>
        ) : (
          <>
            {/* Jours (créneaux) personnalisables pour ce joueur */}
            {slots.length > 0 && (
              <Section title={t("playerProto.days")}>
                {slots.map((s, i) => {
                  const path = `slot/${s.label}`;
                  const cur = ovByPath[path]?.value?.weekday;
                  return (
                    <div key={i} style={rowBox}>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.label} {patched(path) && <Badge t={t} />}
                      </span>
                      <select value={cur ?? s.weekday} disabled={busy} onChange={(e) => setSlotDay(s.label, e.target.value)} style={selBox}>
                        {WD_ORDER.map((v) => <option key={v} value={v}>{wdLabel(v)}</option>)}
                      </select>
                      {patched(path) && <button onClick={() => reset(path)} disabled={busy} style={ghostBtn}>{t("playerProto.restore")}</button>}
                    </div>
                  );
                })}
              </Section>
            )}

            {/* Sections du socle */}
            {(socle.sections || []).map((sec) => {
              const secPath = `sec/${sec.id}`;
              const hidden = removed(secPath);
              return (
                <Section key={sec.id} title={`${sec.num ? sec.num + " · " : ""}${sec.title || t("playerProto.section")}`}
                  right={
                    hidden
                      ? <button onClick={() => reset(secPath)} disabled={busy} style={ghostBtn}>{t("playerProto.restore")}</button>
                      : <button onClick={() => save(secPath, "remove", {})} disabled={busy} style={ghostBtn}>{t("playerProto.removeSection")}</button>
                  }
                  badge={hidden ? t("playerProto.hidden") : null}>
                  {hidden ? null : (
                    <>
                      {sec.type === "exercises" ? (
                        <>
                          {(sec.rows || []).map((row) => (
                            <ExoRow key={row.id} row={row} weeksN={weeksN} t={t} busy={busy}
                              ov={ovByPath[`sec/${sec.id}/row/${row.id}`]}
                              onPatch={(patch) => patchRow(sec.id, row.id, patch)}
                              onRemove={() => save(`sec/${sec.id}/row/${row.id}`, "remove", {})}
                              onReset={() => reset(`sec/${sec.id}/row/${row.id}`)} />
                          ))}
                          {(addedBySection[sec.id] || []).map((o) => (
                            <AddedRow key={o.path} value={o.value} weeksN={weeksN} t={t} busy={busy}
                              onPatch={(patch) => patchAdded(o.path, patch)} onRemove={() => reset(o.path)} />
                          ))}
                          <button onClick={() => addRow(sec.id)} disabled={busy} style={{ ...ghostBtn, marginTop: 6 }}>+ {t("playerProto.addRow")}</button>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", padding: "2px 0" }}>{t("playerProto.sectionKeepOrRemove")}</div>
                      )}
                    </>
                  )}
                </Section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function Badge({ t }) {
  return <span style={{ fontSize: 8.5, fontWeight: 800, color: ACCENT, background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 5, padding: "1px 5px", marginLeft: 6, verticalAlign: "middle" }}>{t("playerProto.modified")}</span>;
}

function Section({ title, right, badge, children }) {
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: children ? 8 : 0 }}>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}{badge && <span style={{ fontSize: 9, fontWeight: 700, color: C.amb, marginLeft: 6 }}>· {badge}</span>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// Ligne d'exercice du socle : nom + repos + cellules de semaine, avec surcharges.
function ExoRow({ row, weeksN, ov, onPatch, onRemove, onReset, busy, t }) {
  const rm = ov?.op === "remove";
  const val = ov?.op === "patch" ? ov.value : {};
  const cell = (i) => val.weeks?.[i]?.text ?? (row.weeks?.[i]?.text ?? "");
  const name = val.name ?? (row.name || "");
  const rest = val.rest ?? (row.rest || "");
  return (
    <div style={{ ...rowBox, flexDirection: "column", alignItems: "stretch", gap: 6, opacity: rm ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input defaultValue={name} disabled={busy || rm} onBlur={(e) => e.target.value !== name && onPatch({ name: e.target.value })}
          placeholder={t("playerProto.exoName")} style={{ ...inp, flex: 1 }} />
        {ov && <Badge t={t} />}
        {rm
          ? <button onClick={onReset} disabled={busy} style={ghostBtn}>{t("playerProto.restore")}</button>
          : <button onClick={onRemove} disabled={busy} style={ghostBtn}>{t("playerProto.removeRow")}</button>}
      </div>
      {!rm && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          <span style={miniLbl}>{t("playerProto.rest")}</span>
          <input defaultValue={rest} disabled={busy} onBlur={(e) => e.target.value !== rest && onPatch({ rest: e.target.value })} style={{ ...inp, width: 64 }} />
          {Array.from({ length: weeksN }, (_, i) => (
            <input key={i} defaultValue={cell(i)} disabled={busy} title={`S${i + 1}`}
              onBlur={(e) => e.target.value !== cell(i) && onPatch({ weeks: { [i]: { text: e.target.value } } })}
              placeholder={`S${i + 1}`} style={{ ...inp, width: 78 }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Ligne AJOUTÉE spécifiquement pour ce joueur (weeks = tableau).
function AddedRow({ value, weeksN, onPatch, onRemove, busy, t }) {
  const cells = Array.isArray(value.weeks) ? value.weeks : [];
  const setCell = (i, text) => {
    const weeks = Array.from({ length: weeksN }, (_, k) => ({ text: cells[k]?.text || "", peak: !!cells[k]?.peak }));
    weeks[i] = { text, peak: !!weeks[i]?.peak };
    onPatch({ weeks });
  };
  return (
    <div style={{ ...rowBox, flexDirection: "column", alignItems: "stretch", gap: 6, borderColor: `${ACCENT}55` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input defaultValue={value.name || ""} disabled={busy} onBlur={(e) => e.target.value !== (value.name || "") && onPatch({ name: e.target.value })}
          placeholder={t("playerProto.exoName")} style={{ ...inp, flex: 1 }} />
        <span style={{ fontSize: 8.5, fontWeight: 800, color: ACCENT, background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 5, padding: "1px 5px" }}>{t("playerProto.added")}</span>
        <button onClick={onRemove} disabled={busy} style={ghostBtn}>{t("playerProto.removeRow")}</button>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {Array.from({ length: weeksN }, (_, i) => (
          <input key={i} defaultValue={cells[i]?.text || ""} disabled={busy} onBlur={(e) => setCell(i, e.target.value)} placeholder={`S${i + 1}`} style={{ ...inp, width: 78 }} />
        ))}
      </div>
    </div>
  );
}

const rowBox = { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px", marginBottom: 6 };
const inp = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" };
const selBox = { ...inp, width: 130, colorScheme: "dark" };
const miniLbl = { fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.3 };
const ghostBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 };
