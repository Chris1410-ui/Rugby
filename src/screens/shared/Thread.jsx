import { useEffect, useState } from "react";
import { C } from "../../lib/tokens.js";
import { MessageSquare, Send, X } from "../../lib/icons.jsx";
import { useThread, sendMessage, markRead } from "../../data/messages.js";

/* Fil de discussion (modal). `who` = point de vue courant ('staff' | 'joueur').
   À l'ouverture, marque comme lus les messages de l'autre partie. */
export default function Thread({ playerId, name, who, accent, onClose }) {
  const { msgs } = useThread(playerId);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { markRead(playerId, who); }, [playerId, who]);
  // Re-marque quand de nouveaux messages arrivent pendant que le fil est ouvert
  useEffect(() => { markRead(playerId, who); }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const t = txt.trim();
    if (!t || busy) return;
    setBusy(true);
    setTxt("");
    try {
      await sendMessage(playerId, { dir: who, text: t, author: who === "staff" ? "Staff" : name });
    } catch (e) {
      console.error("[send]", e.message);
      setTxt(t);
    }
    setBusy(false);
  };

  const fmt = (ts) => new Date(ts).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, margin: "0 auto", background: C.panel, borderRadius: "18px 18px 0 0", padding: 18, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <MessageSquare size={18} color={accent} />
            <div style={{ fontSize: 15, fontWeight: 800 }}>{who === "staff" ? name : "Préparateur physique"}</div>
          </div>
          <X size={20} color="rgba(255,255,255,0.5)" onClick={onClose} style={{ cursor: "pointer" }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, minHeight: 120 }}>
          {msgs.length === 0 && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "30px 0" }}>Aucun message. Démarre la conversation.</div>
          )}
          {msgs.map((m) => {
            const mine = m.dir === who;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <div style={{ background: mine ? accent : "rgba(255,255,255,0.08)", color: "#fff", borderRadius: mine ? "12px 12px 3px 12px" : "12px 12px 12px 3px", padding: "9px 12px", fontSize: 13, lineHeight: 1.4 }}>{m.text}</div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)", marginTop: 3, textAlign: mine ? "right" : "left" }}>
                  {fmt(m.ts)}{mine && (m.read ? " · Lu" : " · Envoyé")}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Écrire un message…" style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 13, outline: "none" }} />
          <button onClick={send} disabled={busy} style={{ background: accent, border: "none", borderRadius: 10, padding: "0 16px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", opacity: busy ? 0.6 : 1 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
