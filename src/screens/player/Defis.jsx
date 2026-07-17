import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { usePreview } from "../../lib/preview.js";
import { useTeamChallenges, useMyChallengeCompletions, useTeamChallengeStats, markChallengeDone, unmarkChallenge } from "../../data/challenges.js";
import { defiOfWeek } from "../../lib/challenges.js";
import ChallengeCard from "../shared/ChallengeCard.jsx";
import ChallengeDetail from "../shared/ChallengeDetail.jsx";

/* « Défis » (joueur) : relève les défis assignés ou ouverts, puis attend la
   validation du prépa. Lecture seule en mode aperçu owner/staff. */
export default function Defis({ me, players = [], accent = C.green }) {
  const preview = usePreview();
  const { challenges } = useTeamChallenges(me.team, players);
  const { statutByChallenge } = useMyChallengeCompletions(me.id);
  const stats = useTeamChallengeStats(me.team);
  const [busy, setBusy] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const today = todayISO();

  // Défis qui me concernent : assignés, ouverts, ou déjà relevés.
  const mine = challenges.filter((c) => c.assigned?.mode === "open" || c.assignedIds.includes(me.id) || statutByChallenge[c.id]);
  const featured = defiOfWeek(mine, today);
  const detail = mine.find((c) => c.id === detailId) || null; // suit le temps réel

  const run = (id, fn) => { if (preview) return; setBusy(id); fn().catch((e) => console.error("[challenge]", e.message)).finally(() => setBusy(null)); };

  // Zone d'action selon mon statut — partagée entre la carte et la vue détail.
  const Actions = (c) => {
    const st = statutByChallenge[c.id] || "a_faire";
    const open = c.assigned?.mode === "open";
    return (
      <>
        {st === "a_faire" && (
          <button onClick={() => run(c.id, () => markChallengeDone(c.id))} disabled={preview || busy === c.id} style={{ width: "100%", background: preview ? "rgba(255,255,255,0.06)" : accent, border: "none", borderRadius: 10, padding: 12, color: preview ? "rgba(255,255,255,0.5)" : "#fff", fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", opacity: busy === c.id ? 0.6 : 1 }}>
            {preview ? "👁 Aperçu — lecture seule" : open ? "Rejoindre & relever ✋" : "Défi relevé ✋"}
          </button>
        )}
        {st === "validee_joueur" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.amb }}>✓ Relevé — en attente de validation (+{c.points} en attente)</div>
            {!preview && <button onClick={() => run(c.id, () => unmarkChallenge(c.id))} disabled={busy === c.id} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Annuler</button>}
          </div>
        )}
        {st === "confirmee" && <div style={{ fontSize: 12.5, fontWeight: 800, color: C.green }}>🏅 Validé par le coach · +{c.points} points</div>}
      </>
    );
  };

  const Card = (c) => {
    const open = c.assigned?.mode === "open";
    const s = stats[c.id] || { releves: 0 };
    const participants = open ? s.releves : (c.assignedIds.length || 0);
    return (
      <ChallengeCard key={c.id} c={c} releves={s.releves} participants={participants} open={open} highlight={featured?.id === c.id} onOpen={() => setDetailId(c.id)}>
        {Actions(c)}
      </ChallengeCard>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🏆</span>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Défis</div>
      </div>
      {mine.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          Aucun défi pour le moment.<br />Ton staff en lancera ici — relève-les pour gagner des points et des badges.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {featured && Card(featured)}
          {mine.filter((c) => c.id !== featured?.id).map(Card)}
        </div>
      )}

      {detail && (
        <ChallengeDetail c={detail} onClose={() => setDetailId(null)}>
          <div style={{ marginTop: 4 }}>{Actions(detail)}</div>
        </ChallengeDetail>
      )}
    </div>
  );
}
