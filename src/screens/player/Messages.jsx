import { useState } from "react";
import { C } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { MessageSquare } from "../../lib/icons.jsx";
import { useThread } from "../../data/messages.js";
import Thread from "../shared/Thread.jsx";

/* Boîte de réception du joueur. */
export default function Messages({ me, accent }) {
  const { msgs } = useThread(me.id);
  const [open, setOpen] = useState(false);
  const unread = msgs.filter((m) => m.dir === "staff" && !m.read).length;
  const last = msgs[msgs.length - 1];

  return (
    <div>
      <Section title="MESSAGES DU STAFF" right={unread > 0 ? <span style={{ background: C.coral, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "2px 8px" }}>{unread} non lu{unread > 1 ? "s" : ""}</span> : null}>
        {msgs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "34px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 10, opacity: 0.8 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>Aucun message</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }}>Le staff t'enverra ici ses consignes et retours personnalisés.</div>
          </div>
        ) : (
          <div onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "4px 0" }}>
            <div style={{ width: 42, height: 42, borderRadius: 21, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MessageSquare size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Préparateur physique</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {last.dir === "staff" ? "" : "Toi : "}{last.text}
              </div>
            </div>
            {unread > 0 && <span style={{ width: 9, height: 9, borderRadius: 5, background: C.coral, flexShrink: 0 }} />}
          </div>
        )}
      </Section>
      {open && <Thread playerId={me.id} name={me.name} who="joueur" accent={accent} onClose={() => setOpen(false)} />}
    </div>
  );
}
