import { useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { acwrZ } from "../../lib/metrics.js";
import { Ring, Section, Pill, Tag, KPI } from "../../lib/ui.jsx";
import { CheckCircle, X } from "../../lib/icons.jsx";
import { updatePlayer } from "../../data/players.js";
import Confidentialite from "./Confidentialite.jsx";

const num = (v) => (v == null || v === "" ? null : Number(v));
// Numérique tolérant à la virgule décimale (ex. « 54,2 »).
const numFR = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const fmt = (v, unit = "") => (v == null ? "—" : `${v}${unit}`);

/* Fiche joueur détaillée. Lit l'effectif enrichi (aucun recalcul). Éditable par
   le staff (tests physiques). `onClose` → rendu en modal. */
export default function Fiche({ player, canEdit = false, onClose }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setD({
      num: player.num ?? "",
      mas: player.mas ?? "",
      back_squat: player.backSquat ?? "",
      cmj_g: player.cmjG ?? "",
      cmj_d: player.cmjD ?? "",
      ischios_g: player.ischiosG ?? "",
      ischios_d: player.ischiosD ?? "",
      bronco: player.bronco ?? "",
      yoyo: player.yoyo ?? "",
      squat_5rm: player.squat5rm ?? "",
      cmj_overall: player.cmjOverall ?? "",
      bench_5rm: player.bench5rm ?? "",
      hang_clean_2rm: player.hangClean2rm ?? "",
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
      await updatePlayer(player.id, {
        num: num(d.num),
        mas: num(d.mas),
        back_squat: num(d.back_squat),
        cmj_g: num(d.cmj_g),
        cmj_d: num(d.cmj_d),
        ischios_g: num(d.ischios_g),
        ischios_d: num(d.ischios_d),
        asym,
        bronco: (d.bronco ?? "").trim() || null,
        yoyo: num(d.yoyo),
        squat_5rm: (d.squat_5rm ?? "").trim() || null,
        cmj_overall: numFR(d.cmj_overall),
        bench_5rm: numFR(d.bench_5rm),
        hang_clean_2rm: numFR(d.hang_clean_2rm),
        pp_notes: (d.pp_notes ?? "").trim() || null,
      });
      setEdit(false); // Realtime rafraîchit l'effectif
    } catch (e) { setErr(e.message || "Échec de l'enregistrement."); }
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
        <Ring val={player.readiness} max={100} color={player.readiness > 70 ? C.green : player.readiness > 50 ? C.amb : C.coral} label="readiness" size={72} sw={6} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>{edit ? <input value={d.num ?? ""} onChange={(e) => setD((p) => ({ ...p, num: e.target.value }))} style={{ ...inp, width: 44, textAlign: "center" }} /> : (player.num ?? "—")}</span>
            <div><div style={{ fontSize: 17, fontWeight: 800 }}>{player.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{player.pos} · {grpLabel(player.grp)}</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Pill v={player.acwr} /><Tag c={acwrZ(player.acwr).c}>{acwrZ(player.acwr).l}</Tag>
            {player._live && <Tag c={C.green}>bilan du jour</Tag>}
          </div>
        </div>
      </div>

      {/* indicateurs (enrichis) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
        <KPI label="BIEN-ÊTRE" value={`${player.wellness}/50`} color={C.blue} />
        <KPI label="RISQUE" value={`${player.risque}`} sub="/100" color={player.risque >= 60 ? C.coral : player.risque >= 40 ? C.amb : C.green} />
        <KPI label="CHARGE 7J" value={player.charge7j} sub="UA" color={C.coral} />
        <KPI label="ACWR" value={player.acwr.toFixed(2)} color={acwrZ(player.acwr).c} />
        <KPI label="MONOTONIE" value={player.monotonie} color={player.monotonie > 2 ? C.amb : C.green} />
        <KPI label="STRAIN" value={player.strain} color={C.viol} />
      </div>

      {/* tests physiques */}
      <Section title="TESTS PHYSIQUES" right={canEdit && !edit ? <button onClick={() => setEdit(true)} style={{ background: "none", border: "none", color: C.viol, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Éditer</button> : null}>
        <Row label="MAS (m/min)" k="mas" value={player.mas} />
        <Row label="Back Squat (×PDC)" k="back_squat" value={player.backSquat} />
        <Row label="CMJ gauche (cm)" k="cmj_g" value={player.cmjG} />
        <Row label="CMJ droit (cm)" k="cmj_d" value={player.cmjD} />
        <Row label="Ischios G (N)" k="ischios_g" value={player.ischiosG} />
        <Row label="Ischios D (N)" k="ischios_d" value={player.ischiosD} />
        <Row label="Bronco (temps)" k="bronco" value={player.bronco} text placeholder="5'15" />
        <Row label="Yo-Yo IR (m)" k="yoyo" unit=" m" value={player.yoyo} placeholder="1720" />
        <Row label="Squat 5RM (kg)" k="squat_5rm" value={player.squat5rm} text placeholder="3x170" />
        <Row label="CMJ / Overall Jump (cm)" k="cmj_overall" value={player.cmjOverall} placeholder="54,2" />
        <Row label="Bench 5RM (kg)" k="bench_5rm" value={player.bench5rm} placeholder="112.5" />
        <Row label="Hang Clean 2RM (kg)" k="hang_clean_2rm" value={player.hangClean2rm} placeholder="90" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Asymétrie ischios</span>
          <Tag c={asym == null ? C.gray : asym >= 10 ? C.coral : asym >= 6 ? C.amb : C.green}>{asym == null ? "—" : `${asym}%`}</Tag>
        </div>

        <div style={{ paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Remarques PP <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>(objectifs / consignes)</span></div>
          {edit ? (
            <textarea value={d.pp_notes ?? ""} onChange={(e) => setD((p) => ({ ...p, pp_notes: e.target.value }))} placeholder="Objectifs, consignes, points de vigilance…" style={{ width: "100%", minHeight: 70, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.viol}66`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          ) : (
            <div style={{ fontSize: 13, color: player.ppNotes ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{player.ppNotes || "—"}</div>
          )}
        </div>

        {err && <div style={{ fontSize: 11, color: C.coral, marginTop: 8 }}>{err}</div>}
        {edit && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setEdit(false)} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={busy} style={{ flex: 2, background: C.green, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}><CheckCircle size={13} /> Enregistrer</button>
          </div>
        )}
      </Section>

      {/* RGPD — le staff gère le consentement / export / effacement du joueur */}
      {canEdit && <Confidentialite player={player} onErased={onClose} />}
    </div>
  );

  if (!onClose) return body;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: C.navy, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}><X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} /></div>
        {body}
      </div>
    </div>
  );
}
