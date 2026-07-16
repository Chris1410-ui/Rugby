import { useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { bannerOf, bannerGradient } from "../../lib/crews.js";
import { Section } from "../../lib/ui.jsx";
import { Users, Plus, X, CheckCircle } from "../../lib/icons.jsx";
import { createCrew, inviteToCrew, acceptInvite, removeMember, dissolveCrew } from "../../data/crews.js";
import { usePreview } from "../../lib/preview.js";

/* « Mon équipe » (crew) côté joueur : créer, inviter des coéquipiers du même
   club, accepter/refuser, quitter, voir les membres + bannière. L'isolation par
   club est garantie par la RLS + les contraintes DB ; l'UI ne propose que des
   joueurs du club (props `players` déjà scopé par team). */
export default function Crew({ me, teamId, players, crews = [], accent = C.green }) {
  const preview = usePreview(); // aperçu owner/staff → lecture seule
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");

  const nameOf = (pid) => players.find((p) => p.id === pid)?.name || "Joueur";

  const myActive = useMemo(
    () => crews.find((c) => c.members.some((m) => m.playerId === me.id && m.status === "active")),
    [crews, me.id]
  );
  const myInvites = useMemo(
    () => crews.filter((c) => c.members.some((m) => m.playerId === me.id && m.status === "invited")),
    [crews, me.id]
  );

  const run = async (fn, okMsg) => {
    if (preview) return; // lecture seule : aucune action crew sous l'identité du joueur
    setBusy(true); setNote("");
    try { await fn(); if (okMsg) setNote(okMsg); }
    catch (e) { setNote(err(e)); }
    setBusy(false);
  };
  const err = (e) => {
    const m = e?.message || "";
    if (/duplicate|unique/i.test(m) && /active/i.test(m)) return "Ce joueur fait déjà partie d'une équipe.";
    if (/duplicate|unique/i.test(m)) return "Déjà invité / déjà membre.";
    if (/row-level|policy/i.test(m)) return "Action non autorisée (isolation par club).";
    return "Échec : " + (m || "réessaie.");
  };

  const banner = (key, size = 56) => {
    const b = bannerOf(key);
    return (
      <div style={{ width: size, height: size, borderRadius: 14, background: bannerGradient(key), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, boxShadow: "inset 0 0 20px rgba(0,0,0,0.25)" }}>{b.emoji}</div>
    );
  };

  const noteBox = note && (
    <div style={sc({ marginBottom: 12, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.85)", background: `${accent}1a`, borderColor: `${accent}55` })}>{note}</div>
  );
  const previewBox = preview && (
    <div style={sc({ marginBottom: 12, fontSize: 11.5, lineHeight: 1.5, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)", borderColor: C.border, fontWeight: 700, textAlign: "center" })}>👁 Mode aperçu — lecture seule (actions équipe désactivées)</div>
  );

  // ── J'ai une équipe active ──
  if (myActive) {
    const isFounder = myActive.ownerPlayerId === me.id;
    const active = myActive.members.filter((m) => m.status === "active");
    const invited = myActive.members.filter((m) => m.status === "invited");
    const memberIds = new Set(myActive.members.map((m) => m.playerId));
    const candidates = players.filter((p) => p.id !== me.id && !memberIds.has(p.id));

    return (
      <div>
        {previewBox}
        {noteBox}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, background: bannerGradient(myActive.banner), marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 40 }}>{bannerOf(myActive.banner).emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{myActive.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{active.length} membre{active.length > 1 ? "s" : ""}{invited.length ? ` · ${invited.length} invité${invited.length > 1 ? "s" : ""}` : ""}</div>
          </div>
        </div>

        <Section title={`MEMBRES · ${active.length}`}>
          {active.map((m) => (
            <div key={m.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{nameOf(m.playerId).slice(0, 1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.playerId === me.id ? nameOf(m.playerId) + " (toi)" : nameOf(m.playerId)}</div>
                {myActive.ownerPlayerId === m.playerId && <div style={{ fontSize: 9.5, color: accent, fontWeight: 700 }}>👑 Capitaine</div>}
              </div>
              {isFounder && m.playerId !== me.id && (
                <button onClick={() => run(() => removeMember(myActive.id, m.playerId), "Membre retiré.")} disabled={busy} title="Retirer du crew" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4 }}><X size={15} /></button>
              )}
            </div>
          ))}
          {invited.map((m) => (
            <div key={m.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border2}`, opacity: 0.6 }}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{nameOf(m.playerId).slice(0, 1)}</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{nameOf(m.playerId)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>invité…</span>
              {isFounder && (
                <button onClick={() => run(() => removeMember(myActive.id, m.playerId))} disabled={busy} title="Annuler l'invitation" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4 }}><X size={15} /></button>
              )}
            </div>
          ))}
        </Section>

        <Section title="INVITER UN COÉQUIPIER" right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>même club</span>}>
          {candidates.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Tous tes coéquipiers sont déjà dans l'équipe ou invités.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {candidates.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px" }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <button onClick={() => run(() => inviteToCrew(myActive, me.id, p.id), `${p.name} invité.`)} disabled={busy} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "6px 12px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Inviter</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {isFounder ? (
          <button onClick={() => run(() => dissolveCrew(myActive.id), "Équipe dissoute.")} disabled={busy} style={{ width: "100%", background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 10, padding: 12, color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 20 }}>Dissoudre l'équipe</button>
        ) : (
          <button onClick={() => run(() => removeMember(myActive.id, me.id), "Tu as quitté l'équipe.")} disabled={busy} style={{ width: "100%", background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 10, padding: 12, color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 20 }}>Quitter l'équipe</button>
        )}
      </div>
    );
  }

  // ── Pas d'équipe active : invitations en attente + création ──
  return (
    <div>
      {previewBox}
      {noteBox}

      {myInvites.length > 0 && (
        <Section title={`INVITATIONS · ${myInvites.length}`}>
          {myInvites.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
              {banner(c.banner, 44)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{c.members.filter((m) => m.status === "active").length} membre(s)</div>
              </div>
              <button onClick={() => run(() => acceptInvite(c.id, me.id), `Bienvenue chez ${c.name} !`)} disabled={busy} style={{ background: accent, border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><CheckCircle size={13} /> Rejoindre</button>
              <button onClick={() => run(() => removeMember(c.id, me.id))} disabled={busy} title="Refuser" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4 }}><X size={16} /></button>
            </div>
          ))}
        </Section>
      )}

      <div style={sc({ padding: 18, textAlign: "center", marginBottom: 12 })}>
        <Users size={26} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>Crée ton équipe</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginTop: 4, marginBottom: 14 }}>
          Forme une équipe avec tes amis du club. Une bannière est tirée au hasard,
          et vos points s'additionnent au classement par équipe.
        </div>
        <input value={name} onChange={(e) => { setName(e.target.value); setNote(""); }} placeholder="Nom de l'équipe (ex. Les Sangliers)" maxLength={40} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, fontWeight: 600, outline: "none", marginBottom: 10, textAlign: "center" }} />
        <button
          onClick={() => name.trim() && run(async () => { await createCrew(teamId, me.id, name); setName(""); }, "Équipe créée 🎉")}
          disabled={busy || !name.trim()}
          style={{ width: "100%", background: name.trim() ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: name.trim() ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Création…" : "Créer mon équipe"}
        </button>
      </div>
    </div>
  );
}
