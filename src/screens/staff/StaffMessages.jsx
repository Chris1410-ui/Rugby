import { useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { MessageSquare, ChevronRight, Search } from "../../lib/icons.jsx";
import { useTeamMessages } from "../../data/messages.js";
import Conversation from "../shared/Conversation.jsx";

const accent = C.coral;

/* Messagerie staff : liste de conversations (un joueur = un fil) → fil.
   Tous les joueurs sont listés pour pouvoir démarrer une conversation même
   sans historique. Tri : non-lus d'abord, puis message le plus récent. */
export default function StaffMessages({ players }) {
  const [selId, setSelId] = useState(null);
  const [q, setQ] = useState("");
  const { threads } = useTeamMessages(players.map((p) => p.id));

  const rows = useMemo(() => {
    const list = players.map((p) => ({ p, t: threads[p.id] || { count: 0, unread: 0, last: null, lastTs: null, lastDir: null } }));
    return list.sort((a, b) => {
      const au = a.t.unread > 0, bu = b.t.unread > 0;
      if (au !== bu) return au ? -1 : 1; // non-lus d'abord
      return (b.t.lastTs || "").localeCompare(a.t.lastTs || "") || a.p.name.localeCompare(b.p.name);
    });
  }, [players, threads]);

  const filtered = q ? rows.filter((r) => r.p.name.toLowerCase().includes(q.toLowerCase())) : rows;
  const sel = players.find((p) => p.id === selId);

  const fmt = (ts) => {
    if (!ts) return "";
    const d = new Date(ts), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  };

  // Fil ouvert
  if (sel) {
    return (
      <section style={{ height: "100%" }}>
        <Conversation playerId={sel.id} title={displayName(sel)} who="staff" accent={accent} onBack={() => setSelId(null)} />
      </section>
    );
  }

  // Liste des conversations
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <MessageSquare size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Messagerie</div>
      </div>

      {players.length > 6 && (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={15} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un joueur…" style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px 10px 34px", color: "#fff", fontSize: 13, outline: "none" }} />
        </div>
      )}

      {players.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>
          Aucun joueur dans l'effectif. Ajoute des joueurs pour leur écrire.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(({ p, t }) => (
            <div key={p.id} onClick={() => setSelId(p.id)} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", cursor: "pointer", borderLeft: `3px solid ${t.unread ? C.coral : "transparent"}` })}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{p.num ?? "—"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(p)}</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.56)", flexShrink: 0 }}>{grpLabel(p.grp)}</span>
                </div>
                <div style={{ fontSize: 11, color: t.unread ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: t.unread ? 600 : 400 }}>
                  {t.last ? (t.lastDir === "staff" ? "Vous : " : "") + t.last : "Démarrer la conversation"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.56)" }}>{fmt(t.lastTs)}</span>
                {t.unread > 0
                  ? <span style={{ background: C.coral, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 9, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>{t.unread}</span>
                  : <ChevronRight size={15} color="rgba(255,255,255,0.25)" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
