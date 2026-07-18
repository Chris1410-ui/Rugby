import { useEffect, useState } from "react";
import { C } from "../../lib/tokens.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { Bell, ClipboardList, Dumbbell, MessageSquare, FileText, Flag, Flame, Shield, Film } from "../../lib/icons.jsx";
import { pushSupported, getPushState, enablePush, disablePush } from "../../data/push.js";

/* Centre de notifications (joueur). Liste datée, non-lus en surbrillance,
   clic → écran concerné + marqué lu, « tout lu ». Rendu en modal. */
const ICON = { task: ClipboardList, session: Dumbbell, message: MessageSquare, questionnaire: FileText, camp: Flag, test: Shield, challenge: Flame, media: Film };

const fmtWhen = (iso) => {
  try {
    const d = new Date(iso), now = new Date();
    const diff = Math.round((now - d) / 60000); // minutes
    if (diff < 1) return "à l'instant";
    if (diff < 60) return `il y a ${diff} min`;
    if (diff < 1440) return `il y a ${Math.round(diff / 60)} h`;
    return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

/* Opt-in Web Push (joueur) : autorise et abonne l'appareil courant. La sécurité
   et l'envoi sont côté serveur ; ici on ne gère que l'état d'abonnement local. */
function PushToggle({ playerId, teamId, accent }) {
  const [state, setState] = useState("loading"); // loading|unsupported|denied|default|granted|subscribed
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    getPushState().then((s) => { if (active) setState(s); }).catch(() => { if (active) setState("unsupported"); });
    return () => { active = false; };
  }, []);

  if (!pushSupported() || state === "unsupported") {
    return (
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border2}`, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
        🔔 Notifications push non disponibles sur ce navigateur. Sur iPhone, ajoute d'abord l'app à l'écran d'accueil.
      </div>
    );
  }

  const act = async (fn) => {
    setBusy(true); setErr("");
    try { setState(await fn()); }
    catch (e) { setErr(e?.message || "Échec."); }
    setBusy(false);
  };

  const subscribed = state === "subscribed";
  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border2}`, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>Notifications push</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>
          {state === "denied" ? "Bloquées — autorise-les dans les réglages du navigateur."
            : subscribed ? "Activées sur cet appareil."
            : "Reçois défis, tâches et messages même app fermée."}
          {err && <span style={{ color: C.coral }}> · {err}</span>}
        </div>
      </div>
      {state !== "denied" && (
        subscribed ? (
          <button onClick={() => act(disablePush)} disabled={busy} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 11px", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, opacity: busy ? 0.6 : 1 }}>Désactiver</button>
        ) : (
          <button onClick={() => act(() => enablePush(playerId, teamId))} disabled={busy || !playerId} style={{ background: accent, border: "none", borderRadius: 8, padding: "7px 12px", color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", flexShrink: 0, opacity: busy || !playerId ? 0.6 : 1 }}>{busy ? "…" : "Activer"}</button>
        )
      )}
    </div>
  );
}

export default function NotificationCenter({ notifs, onNavigate, onClose, accent = C.green, playerId, teamId }) {
  useModalClose(onClose);
  const { list, unread, markRead, markAllRead } = notifs;

  const open = (n) => {
    markRead(n.id);
    if (n.route) onNavigate?.(n.route);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, height: "100%", background: C.navy, borderLeft: `1px solid ${C.border2}`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border2}` }}>
          <Bell size={18} color={accent} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Notifications{unread > 0 ? ` · ${unread}` : ""}</div>
          {unread > 0 && <button onClick={markAllRead} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Tout lu</button>}
          <CloseX onClose={onClose} />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <PushToggle playerId={playerId} teamId={teamId} accent={accent} />
          {list.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>🔔</div>
              Aucune notification pour l'instant.
            </div>
          ) : list.map((n) => {
            const Icon = ICON[n.type] || Bell;
            return (
              <div key={n.id} onClick={() => open(n)} style={{ display: "flex", gap: 11, padding: "12px 16px", borderBottom: `1px solid ${C.border2}`, cursor: "pointer", background: n.read ? "transparent" : `${accent}12` }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={n.read ? "rgba(255,255,255,0.6)" : accent} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: 4, background: accent, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: n.read ? 600 : 800 }}>{n.titre}</span>
                  </div>
                  {n.body && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>}
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{fmtWhen(n.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
