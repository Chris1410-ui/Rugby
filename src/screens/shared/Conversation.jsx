import { useEffect, useRef, useState } from "react";
import { C } from "../../lib/tokens.js";
import { MessageSquare, Send, ChevronLeft, X } from "../../lib/icons.jsx";
import { useThread, sendMessage, markRead } from "../../data/messages.js";
import { usePreview } from "../../lib/preview.js";

/* Fil de discussion réutilisable (staff ↔ joueur).
   - `who` = point de vue courant ('staff' | 'joueur').
   - Rendu INLINE par défaut (remplit la zone) ; passe `onClose` pour un rendu
     en modal (action rapide depuis les alertes).
   - `onBack` (staff) → flèche retour vers la liste des conversations.
   À l'ouverture et à chaque nouveau message, marque comme lus ceux de l'autre
   partie (accusé de réception). Toujours possible d'écrire, même fil vide. */
export default function Conversation({ playerId, title, who, accent = C.coral, selfName, onBack, onClose }) {
  const preview = usePreview(); // aperçu owner/staff → lecture seule
  const { msgs } = useThread(playerId);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { markRead(playerId, who); }, [playerId, who]);
  // Re-marque quand de nouveaux messages arrivent pendant que le fil est ouvert
  useEffect(() => { markRead(playerId, who); }, [playerId, who, msgs.length]);
  // Défile en bas à l'arrivée d'un message
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    if (preview) return; // lecture seule : aucun envoi sous l'identité du joueur
    const t = txt.trim();
    if (!t || busy) return;
    setBusy(true);
    setTxt("");
    try {
      await sendMessage(playerId, { dir: who, text: t, author: who === "staff" ? "Staff" : (selfName || "Joueur") });
    } catch (e) {
      console.error("[send]", e.message);
      setTxt(t); // restaure en cas d'échec
    }
    setBusy(false);
  };

  const fmt = (ts) => new Date(ts).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const body = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 380 }}>
      {/* en-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${C.border2}`, marginBottom: 10 }}>
        {onBack && (
          <button onClick={onBack} title="Retour" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 7, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={16} />
          </button>
        )}
        <div style={{ width: 34, height: 34, borderRadius: 17, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MessageSquare size={17} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{who === "staff" ? "Conversation avec le joueur" : "Conversation avec le staff"}</div>
        </div>
        {onClose && <X size={20} color="rgba(255,255,255,0.5)" onClick={onClose} style={{ cursor: "pointer" }} />}
      </div>

      {/* fil */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, minHeight: 160 }}>
        {msgs.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6, padding: "24px 12px" }}>
            <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.8 }}>💬</div>
            {who === "staff" ? "Aucun message. Écris le premier message à ce joueur." : "Aucun message. Écris au staff — ils te répondront ici."}
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.dir === who;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <div style={{ background: mine ? accent : "rgba(255,255,255,0.08)", color: "#fff", borderRadius: mine ? "13px 13px 3px 13px" : "13px 13px 13px 3px", padding: "9px 12px", fontSize: 13, lineHeight: 1.45, wordBreak: "break-word" }}>{m.text}</div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.56)", marginTop: 3, textAlign: mine ? "right" : "left" }}>
                  {fmt(m.ts)}{mine && (m.read ? " · Lu" : " · Envoyé")}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* saisie */}
      {preview ? (
        <div style={{ textAlign: "center", padding: "11px 13px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700 }}>
          👁 Mode aperçu — lecture seule (envoi désactivé)
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Écrire un message…"
            style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 13, outline: "none" }}
          />
          <button onClick={send} disabled={busy || !txt.trim()} title="Envoyer" style={{ background: txt.trim() ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "0 16px", color: "#fff", cursor: txt.trim() ? "pointer" : "default", display: "flex", alignItems: "center", opacity: busy ? 0.6 : 1 }}>
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );

  if (!onClose) return body;
  // Variante modale (action rapide depuis les alertes)
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, margin: "0 auto", background: C.panel, borderRadius: 18, padding: 18, height: "72vh", maxHeight: "72vh" }}>
        {body}
      </div>
    </div>
  );
}
