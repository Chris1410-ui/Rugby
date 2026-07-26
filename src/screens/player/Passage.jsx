import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { useReadOnly } from "../../lib/readonly.js";
import { useQueues, useQueueTickets, joinQueue } from "../../data/queues.js";
import { orderTickets, playerQueueStatus, nextUpIds } from "../../lib/queue.js";

/* Ordre de passage — vue JOUEUR. Il voit son totem, son rang (« 3ᵉ · 2 joueurs
   avant toi »), son avancement, l'ordre complet PAR TOTEMS (jamais de nom réel),
   et ce sur quoi le staff travaille. Temps réel. Il peut s'auto-inscrire sur une
   file ouverte (RPC queue_join). Les notifications « prépare-toi » / « ton tour »
   arrivent via le trigger serveur (0100). */
export default function Passage({ me, teamId, players = [], accent = C.green }) {
  const { t } = useTranslation();
  const { queues } = useQueues(teamId);

  if (!queues.length) {
    return (
      <section>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>⏱️ {t("passage.myTitle")}</div>
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("passage.myEmpty")}</div>
      </section>
    );
  }

  return (
    <section>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>⏱️ {t("passage.myTitle")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {queues.map((q) => <QueueCard key={q.id} queue={q} me={me} players={players} accent={accent} />)}
      </div>
    </section>
  );
}

function QueueCard({ queue, me, players, accent }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { tickets } = useQueueTickets(queue.id);
  const nameOf = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const order = useMemo(() => orderTickets(tickets), [tickets]);
  const status = useMemo(() => playerQueueStatus(tickets, me?.id), [tickets, me?.id]);
  const nextUp = useMemo(() => new Set(nextUpIds(tickets, 2)), [tickets]);

  const join = () => joinQueue(queue.id).catch((e) => console.error("[join]", e.message));

  // Bandeau d'état personnel.
  let banner = null;
  if (status.inQueue) {
    if (status.done) banner = { txt: t("passage.doneState"), c: C.green };
    else if (status.absent) banner = { txt: t("passage.absentState"), c: C.amb };
    else if (status.isTurn) banner = { txt: t("passage.yourTurn"), c: accent };
    else banner = { txt: t("passage.rank", { rank: status.rank, ahead: status.ahead }), c: "#fff", sub: status.rank === 2 ? t("passage.soon") : null };
  }

  return (
    <div style={sc({ padding: 14 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{queue.title}</div>
          {queue.lieu && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{queue.lieu}</div>}
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: queue.status === "open" ? C.green : "rgba(255,255,255,0.5)", background: queue.status === "open" ? `${C.green}1e` : "rgba(255,255,255,0.06)", border: `1px solid ${queue.status === "open" ? C.green + "55" : C.border}`, borderRadius: 6, padding: "2px 8px" }}>{t(queue.status === "open" ? "passage.open" : "passage.closed")}</span>
      </div>

      {/* Ce sur quoi le staff travaille */}
      {queue.currentFocus && (
        <div style={{ fontSize: 11.5, color: accent, fontWeight: 700, marginBottom: 10 }}>▶ {t("passage.focusNow", { focus: queue.currentFocus })}</div>
      )}

      {/* Mon état */}
      {banner && (
        <div style={{ background: `${banner.c === "#fff" ? "rgba(255,255,255,0.06)" : banner.c + "1a"}`, border: `1px solid ${banner.c === "#fff" ? C.border : banner.c + "55"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: banner.c }}>{banner.txt}</div>
          {banner.sub && <div style={{ fontSize: 11, color: accent, fontWeight: 700, marginTop: 2 }}>{banner.sub}</div>}
        </div>
      )}

      {/* Auto-inscription */}
      {!status.inQueue && queue.status === "open" && !readOnly && (
        <button onClick={join} style={{ width: "100%", background: accent, border: "none", borderRadius: 10, padding: 11, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>{t("passage.join")}</button>
      )}

      {/* Ordre complet par totems */}
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginBottom: 6 }}>{t("passage.orderTitle")}</div>
      {order.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("passage.noTickets")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {order.map((tk, i) => {
            const p = nameOf[tk.playerId];
            const isMe = tk.playerId === me?.id;
            const soon = nextUp.has(tk.playerId) && tk.progress < 100 && !tk.absent;
            const pc = tk.progress >= 100 ? C.green : tk.progress >= 50 ? C.amb : "rgba(255,255,255,0.4)";
            return (
              <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, background: isMe ? `${accent}18` : soon ? "rgba(255,255,255,0.05)" : "transparent", border: `1px solid ${isMe ? accent + "66" : "transparent"}`, opacity: tk.absent ? 0.5 : 1 }}>
                <span style={{ fontSize: 12, fontWeight: 900, fontStyle: "italic", color: soon ? accent : "rgba(255,255,255,0.6)", width: 20, textAlign: "center" }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: isMe ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isMe ? "⭐ " : ""}{p ? displayName(p) : "—"}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: pc, minWidth: 30, textAlign: "right" }}>{tk.absent ? t("passage.absentShort") : tk.progress >= 100 ? "✓" : `${tk.progress}%`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
