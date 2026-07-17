import { C } from "../../lib/tokens.js";
import { bannerGradient, bannerOf } from "../../lib/challenges.js";
import { fmtShort } from "../../lib/metrics.js";
import { ChevronRight } from "../../lib/icons.jsx";

/* Carte de défi gamifiée : bannière colorée + badge/emoji, points en gros, barre
   de progression (relevés / participants), logistique. `children` = actions
   selon le rôle (relever / annuler côté joueur ; file de validation côté staff).
   `highlight` → mise en avant « Défi de la semaine ». `onOpen` → la bannière
   devient cliquable (ouvre la vue détail plein écran). */
export default function ChallengeCard({ c, releves = 0, participants = 0, open = false, highlight = false, onOpen, children }) {
  const grad = bannerGradient(c.banner);
  const pct = participants > 0 ? Math.min(100, Math.round((releves / participants) * 100)) : 0;

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${highlight ? "#ffffff55" : C.border}`, background: C.panel, boxShadow: highlight ? "0 0 0 2px rgba(255,255,255,0.12), 0 6px 20px rgba(0,0,0,0.35)" : "none" }}>
      {/* Bannière (cliquable si onOpen → détail) */}
      <div
        onClick={onOpen}
        role={onOpen ? "button" : undefined}
        title={onOpen ? "Voir le détail" : undefined}
        style={{ background: grad, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: onOpen ? "pointer" : "default" }}
      >
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "inset 0 0 12px rgba(0,0,0,0.25)" }}>{c.badge || bannerOf(c.banner).emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {highlight && <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>🔥 DÉFI DE LA SEMAINE</div>}
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.titre}</div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1, textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}>+{c.points}</div>
          <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: 1 }}>PTS</div>
        </div>
        {onOpen && <ChevronRight size={18} color="rgba(255,255,255,0.85)" />}
      </div>

      <div style={{ padding: "12px 14px" }}>
        {c.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.45, marginBottom: 10 }}>{c.description}</div>}

        {/* Logistique */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {c.heure && <span style={tag(C.teal)}>🕒 {c.heure}</span>}
          {c.lieu && <span style={tag(C.blue)}>📍 {c.lieu}</span>}
          {c.echeance && <span style={tag(C.amb)}>📅 {fmtShort(c.echeance)}</span>}
          {(c.materiel || []).map((m, i) => <span key={i} style={tag(C.gray)}>🎒 {m}</span>)}
          {open && <span style={tag(C.viol)}>Ouvert</span>}
        </div>

        {/* Progression */}
        <div style={{ marginBottom: children ? 12 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
            <span>{open ? `${releves} joueur${releves > 1 ? "s" : ""} ont relevé` : "Relevés"}</span>
            {!open && <span>{releves}/{participants}</span>}
          </div>
          {!open && (
            <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: 6, width: `${pct}%`, background: grad, borderRadius: 3, transition: "width .4s" }} />
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

const tag = (c) => ({ fontSize: 10, fontWeight: 700, color: c, background: `${c}1e`, border: `1px solid ${c}44`, borderRadius: 6, padding: "2px 8px" });
