import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { localeTag } from "../../i18n/locale.js";
import { Trophy, Plus, Flame } from "../../lib/icons.jsx";
import { useMyDuels, createDuel, respondDuel, cancelDuel, fetchDuelStanding } from "../../data/duels.js";

/* Duels 1-contre-1 entre coéquipiers (même club) sur 7 jours, métrique
   « séances validées ». Invitation → acceptation → résultat. Pseudonymisé
   (totem + initiales). Le score met en scène des faits déjà comptés — aucune
   monnaie parallèle (barème computePoints inchangé). */
export default function Duels({ me, players = [], accent = C.coral }) {
  const { t } = useTranslation();
  const { duels } = useMyDuels(me?.id);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const byId = useMemo(() => Object.fromEntries((players || []).map((p) => [p.id, p])), [players]);
  const opponents = useMemo(
    () => (players || []).filter((p) => p.id !== me?.id && p.membership_status !== "rejected" && !p.is_demo),
    [players, me],
  );

  // On n'affiche que les duels actifs (en attente / en cours) ; l'historique
  // (refusés / annulés) reste hors écran pour garder le fil lisible.
  const active = duels.filter((d) => d.status === "pending" || d.status === "accepted");

  const challenge = async (oppId) => {
    setBusy(true); setErr("");
    try { await createDuel(oppId, 7); setPicking(false); }
    catch (e) {
      const code = e?.message || "";
      setErr(code.includes("active_duel_exists") ? t("player.duel.errActive") : t("player.duel.errCreate"));
    }
    setBusy(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{t("player.duel.title")}</div>
        <button onClick={() => { setErr(""); setPicking((v) => !v); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 34, padding: "0 12px", borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}66`, color: accent, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          <Plus size={14} /> {t("player.duel.challenge")}
        </button>
      </div>

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}

      {/* Sélecteur d'adversaire */}
      {picking && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "2px 4px 8px" }}>{t("player.duel.pickTitle")}</div>
          {opponents.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 4px" }}>{t("player.duel.noOpponents")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {opponents.map((p) => (
                <button key={p.id} onClick={() => !busy && challenge(p.id)} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: "#fff", cursor: busy ? "default" : "pointer", textAlign: "left" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 15, background: `${accent}2e`, border: `1px solid ${accent}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800 }}>{(p.initials || (p.name || "?").slice(0, 2)).toUpperCase()}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{displayName(p)}</span>
                  <Flame size={15} color={accent} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Liste des duels actifs */}
      {active.length === 0 && !picking ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{t("player.duel.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((d) => (
            <DuelCard key={d.id} d={d} me={me} byId={byId} accent={accent} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function DuelCard({ d, me, byId, accent, t }) {
  const iAmChallenger = d.challenger_id === me?.id;
  const opp = byId[iAmChallenger ? d.opponent_id : d.challenger_id];
  const [busy, setBusy] = useState(false);

  const respond = async (accept) => { setBusy(true); try { await respondDuel(d.id, accept); } catch (e) { console.error("[duel respond]", e.message); } setBusy(false); };
  const cancel = async () => { setBusy(true); try { await cancelDuel(d.id); } catch (e) { console.error("[duel cancel]", e.message); } setBusy(false); };

  return (
    <div style={{ background: C.card, border: `1px solid ${d.status === "accepted" ? `${accent}44` : C.border}`, borderRadius: 14, padding: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: d.status === "accepted" ? 10 : 8 }}>
        <Flame size={15} color={accent} />
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>
          {t("player.duel.vs", { name: displayName(opp) })}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("player.duel.metricLabel")}</span>
      </div>

      {d.status === "pending" && !iAmChallenger && (
        <>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>{t("player.duel.youChallenge", { name: displayName(opp) })}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => !busy && respond(true)} disabled={busy} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "none", background: C.green, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("player.duel.accept")}</button>
            <button onClick={() => !busy && respond(false)} disabled={busy} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("player.duel.decline")}</button>
          </div>
        </>
      )}

      {d.status === "pending" && iAmChallenger && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("player.duel.waiting", { name: displayName(opp) })}</span>
          <button onClick={() => !busy && cancel()} disabled={busy} style={{ minHeight: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("player.duel.cancel")}</button>
        </div>
      )}

      {d.status === "accepted" && <DuelScore d={d} me={me} opp={opp} accent={accent} t={t} />}
    </div>
  );
}

function DuelScore({ d, me, opp, accent, t }) {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let active = true;
    fetchDuelStanding(d.id).then((r) => { if (active) setSt(r); }).catch((e) => console.error("[duel standing]", e.message));
    return () => { active = false; };
  }, [d.id, d.status]);

  const iAmChallenger = d.challenger_id === me?.id;
  const myN = st ? (iAmChallenger ? st.challengerN : st.opponentN) : 0;
  const oppN = st ? (iAmChallenger ? st.opponentN : st.challengerN) : 0;
  const total = Math.max(1, myN + oppN);
  const myPct = Math.round((myN / total) * 100);

  const endsStr = st?.endsAt ? new Date(st.endsAt + "T00:00:00").toLocaleDateString(localeTag(), { day: "numeric", month: "short" }) : "";
  const winnerText = () => {
    if (!st?.isOver) return null;
    if (!st.winnerId) return t("player.duel.draw");
    return t("player.duel.win", { name: st.winnerId === me?.id ? t("player.duel.you") : displayName(opp) });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{t("player.duel.you")}</span>
        <div style={{ flex: 1, height: 22, borderRadius: 8, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${myPct}%`, background: accent, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 8, fontSize: 12, fontWeight: 800, color: "#fff" }}>{myN}</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{oppN}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)", maxWidth: 90, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(opp)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {st?.isOver ? (
          <span style={{ fontSize: 11.5, fontWeight: 800, color: st?.winnerId === me?.id ? C.green : st?.winnerId ? C.coral : C.amb, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Trophy size={13} /> {winnerText()}
          </span>
        ) : (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)" }}>{endsStr ? t("player.duel.ends", { date: endsStr }) : ""}</span>
        )}
      </div>
    </div>
  );
}
