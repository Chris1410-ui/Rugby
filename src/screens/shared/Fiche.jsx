import { useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { acwrZ } from "../../lib/metrics.js";
import { Ring, Section, Pill, Tag, KPI, CloseX, useModalClose } from "../../lib/ui.jsx";
import { CheckCircle, Eye, EyeOff, Lock } from "../../lib/icons.jsx";
import { pwdStrength } from "../../lib/password.js";
import { updatePlayer, resetPlayerPassword } from "../../data/players.js";
import { useTestCampaigns } from "../../data/tests.js";
import { useMyQuestionnaires } from "../../data/questionnaires.js";
import { useTeamChallengePoints } from "../../data/challenges.js";
import { challengeBadges } from "../../lib/challenges.js";
import { top14Player, datedResultsFor } from "../../lib/top14.js";
import TestsEvolution from "./TestsEvolution.jsx";
import Top14Panel from "./Top14Panel.jsx";
import { PlayerAnswers } from "../staff/QuestionnaireResponses.jsx";
import Confidentialite from "./Confidentialite.jsx";

/* Réponses aux questionnaires du joueur (vue staff, lien croisé depuis la fiche).
   Données santé : staff du club uniquement (RLS). */
function FicheQuestionnaires({ player }) {
  const { list } = useMyQuestionnaires(player.id);
  const [sel, setSel] = useState(null);
  if (!list.length) return null;
  return (
    <Section title={`QUESTIONNAIRES · ${list.length}`}>
      {list.map((a) => (
        <div key={a.questionnaire.id} onClick={() => setSel(a)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border2}`, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.questionnaire.nom}</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{a.questionnaire.questions.length} question(s)</div>
          </div>
          {a.statut === "rempli" ? <Tag c={C.green}>rempli</Tag> : <Tag c={C.amb}>en attente</Tag>}
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
    if (!st.valid) return setMsg({ ok: false, text: "Mot de passe trop faible (10+, majuscule, minuscule, chiffre, spécial)." });
    if (pwd !== pwd2) return setMsg({ ok: false, text: "Les mots de passe ne correspondent pas." });
    setBusy(true);
    try {
      await resetPlayerPassword(playerId, pwd);
      setMsg({ ok: true, text: "Mot de passe réinitialisé ✓ — communique-le au joueur." });
      setPwd(""); setPwd2("");
    } catch (e) { setMsg({ ok: false, text: e.message || "Échec de la réinitialisation." }); }
    setBusy(false);
  };

  return (
    <Section title="COMPTE">
      {!open ? (
        <button onClick={() => { setOpen(true); setMsg(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Lock size={14} /> Réinitialiser le mot de passe
        </button>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 10 }}>
            Définis un nouveau mot de passe pour ce joueur, puis communique-le-lui. Aucun email n'est envoyé.
          </div>
          <div style={{ position: "relative" }}>
            <input type={show ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setMsg(null); }} placeholder="Nouveau mot de passe" autoComplete="new-password" style={inp} />
            <button onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {pwd && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: 4, width: `${(st.score / 7) * 100}%`, background: sCol, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 9.5, color: sCol, marginTop: 3 }}>{st.valid ? "✓ valide" : "10+ caractères, majuscule, minuscule, chiffre, spécial"}</div>
            </div>
          )}
          <input type={show ? "text" : "password"} value={pwd2} onChange={(e) => { setPwd2(e.target.value); setMsg(null); }} placeholder="Confirmer le mot de passe" autoComplete="new-password" style={{ ...inp, borderColor: pwd2 && pwd !== pwd2 ? C.coral : C.border }} />
          {msg && <div style={{ fontSize: 11.5, color: msg.ok ? C.green : C.coral, margin: "2px 0 8px", lineHeight: 1.4 }}>{msg.text}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setOpen(false); setPwd(""); setPwd2(""); setMsg(null); }} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Fermer</button>
            <button onClick={submit} disabled={busy} style={{ flex: 2, background: C.green, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Enregistrer le mot de passe"}</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// Étiquette de charge hebdo (UA).
const chargeLabel = (v) => (v == null ? { l: "—", c: C.gray } : v < 1500 ? { l: "Faible", c: C.amb } : v <= 2400 ? { l: "Normale", c: C.green } : { l: "Élevée", c: C.coral });
const triC = (v, good, mid) => (v >= good ? C.green : v >= mid ? C.amb : C.coral);

const num = (v) => (v == null || v === "" ? null : Number(v));
const fmt = (v, unit = "") => (v == null ? "—" : `${v}${unit}`);

/* Fiche joueur détaillée. Lit l'effectif enrichi (aucun recalcul). Éditable par
   le staff (tests physiques). `onClose` → rendu en modal. */
export default function Fiche({ player, canEdit = false, onClose }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adv, setAdv] = useState(false);
  const { campaigns, results } = useTestCampaigns(player.team);
  const t14 = top14Player(player.pos, datedResultsFor(campaigns, results, player.id));
  const chalPts = useTeamChallengePoints(player.team)[player.id] || [];
  useModalClose(onClose);

  useEffect(() => {
    setD({
      num: player.num ?? "",
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
      await updatePlayer(player.id, {
        num: num(d.num),
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

      {/* indicateurs clés — lisibles staff & joueur (vert / ambre / rouge) */}
      {(() => {
        const ch = chargeLabel(player.charge7j);
        const z = acwrZ(player.acwr);
        const live = player._live; // bilan du jour encodé ?
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            <KPI label="READINESS" value={live ? player.readiness : "—"} sub={live ? "/100" : "pas encore encodé"} color={live ? triC(player.readiness, 71, 51) : C.gray} />
            <KPI label="BIEN-ÊTRE" value={live ? `${player.wellness}/50` : "—"} sub={live ? "" : "pas encore encodé"} color={live ? triC(player.wellness, 35, 25) : C.gray} />
            <KPI label="SOMMEIL" value={live ? player.sleep : "—"} sub={live ? "h · dernier bilan" : "pas encore encodé"} color={live ? triC(player.sleep, 7.5, 6.5) : C.gray} />
            <KPI label="CHARGE 7J" value={player.charge7j} sub={`UA · ${ch.l}`} color={ch.c} />
            <KPI label="ACWR" value={player.acwr.toFixed(2)} sub={z.l} color={z.c} />
            <KPI label="DISPONIBILITÉ" value={`${player.dispo}%`} color={triC(player.dispo, 85, 70)} />
          </div>
        );
      })()}

      {/* Détails avancés — repli (monotonie / strain / risque) */}
      <button onClick={() => setAdv((a) => !a)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 12, textAlign: "left" }}>
        {adv ? "▾" : "▸"} Détails avancés
      </button>
      {adv && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          <KPI label="MONOTONIE" value={player.monotonie} color={player.monotonie > 2 ? C.amb : C.green} />
          <KPI label="STRAIN" value={player.strain} color={C.viol} />
          <KPI label="RISQUE" value={player.risque} sub="/100" color={player.risque >= 60 ? C.coral : player.risque >= 40 ? C.amb : C.green} />
        </div>
      )}

      {/* tests physiques */}
      <Section title="TESTS PHYSIQUES" right={canEdit && !edit ? <button onClick={() => setEdit(true)} style={{ background: "none", border: "none", color: C.viol, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Éditer</button> : null}>
        <Row label="MAS (m/min)" k="mas" value={player.mas} />
        <Row label="Back Squat (×PDC)" k="back_squat" value={player.backSquat} />
        <Row label="CMJ gauche (cm)" k="cmj_g" value={player.cmjG} />
        <Row label="CMJ droit (cm)" k="cmj_d" value={player.cmjD} />
        <Row label="Ischios G (N)" k="ischios_g" value={player.ischiosG} />
        <Row label="Ischios D (N)" k="ischios_d" value={player.ischiosD} />
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

      {/* Tests historisés par campagne (évolution + mini-graphe) */}
      <TestsEvolution player={player} canEdit={canEdit} />

      {/* Comparaison aux normes Top 14 du poste */}
      <Top14Panel t14={t14} />

      {/* Badges défis gagnés (visibles joueur + staff) */}
      {chalPts.length > 0 && (
        <Section title={`🎯 DÉFIS · ${chalPts.length} relevé${chalPts.length > 1 ? "s" : ""}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {challengeBadges(chalPts.length).map((b) => (
              <span key={b.n} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(108,92,224,0.25)", border: `1px solid ${C.viol}66`, borderRadius: 6, padding: "3px 9px" }}>{b.emoji} {b.label}</span>
            ))}
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.viol, alignSelf: "center" }}>· +{chalPts.reduce((a, c) => a + (c.points || 0), 0)} pts</span>
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
