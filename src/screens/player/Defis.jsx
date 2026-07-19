import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { usePreview } from "../../lib/preview.js";
import { useTeamChallenges, useMyChallengeCompletions, useTeamChallengeStats, markChallengeDone, unmarkChallenge, declineChallenge } from "../../data/challenges.js";
import { defiOfWeek } from "../../lib/challenges.js";
import ChallengeCard from "../shared/ChallengeCard.jsx";
import ChallengeDetail from "../shared/ChallengeDetail.jsx";

/* « Défis » (joueur) : relève les défis assignés ou ouverts, puis attend la
   validation du prépa. Lecture seule en mode aperçu owner/staff. */
export default function Defis({ me, players = [], accent = C.green }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const { challenges } = useTeamChallenges(me.team, players);
  const { statutByChallenge } = useMyChallengeCompletions(me.id);
  const stats = useTeamChallengeStats(me.team);
  const [busy, setBusy] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const today = todayISO();

  // Défis qui me concernent : assignés, ouverts, ou déjà relevés.
  const mine = challenges.filter((c) => c.assigned?.mode === "open" || c.assignedIds.includes(me.id) || statutByChallenge[c.id]);
  // Refusés / manqués → hors du plateau actif, regroupés dans un historique.
  const isArchived = (c) => ["refuse", "manque"].includes(statutByChallenge[c.id]);
  const active = mine.filter((c) => !isArchived(c));
  const archived = mine.filter(isArchived);
  const featured = defiOfWeek(active, today);
  const detail = mine.find((c) => c.id === detailId) || null; // suit le temps réel

  const run = (id, fn) => { if (preview) return; setBusy(id); fn().catch((e) => console.error("[challenge]", e.message)).finally(() => setBusy(null)); };

  const decline = (c) => {
    if (preview) return;
    if (confirm(t("player.defis.declineConfirm", { title: c.titre }))) {
      run(c.id, () => declineChallenge(c.id));
    }
  };

  // Zone d'action selon mon statut — partagée entre la carte et la vue détail.
  const Actions = (c) => {
    const st = statutByChallenge[c.id] || "a_faire";
    const open = c.assigned?.mode === "open";
    return (
      <>
        {st === "a_faire" && (
          <>
            <button onClick={() => run(c.id, () => markChallengeDone(c.id))} disabled={preview || busy === c.id} style={{ width: "100%", background: preview ? "rgba(255,255,255,0.06)" : accent, border: "none", borderRadius: 10, padding: 12, color: preview ? "rgba(255,255,255,0.5)" : "#fff", fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", opacity: busy === c.id ? 0.6 : 1 }}>
              {preview ? t("common.previewReadonly") : open ? t("player.defis.join") : t("player.defis.take")}
            </button>
            {!preview && !open && (
              <button onClick={() => decline(c)} disabled={busy === c.id} style={{ width: "100%", marginTop: 7, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: 9, color: "rgba(255,255,255,0.55)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {t("player.defis.decline")}
              </button>
            )}
          </>
        )}
        {st === "refuse" && <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{t("player.defis.refused")}</div>}
        {st === "manque" && <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{t("player.defis.missed")}</div>}
        {st === "validee_joueur" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.amb }}>{t("player.defis.awaiting", { points: c.points })}</div>
            {!preview && <button onClick={() => run(c.id, () => unmarkChallenge(c.id))} disabled={busy === c.id} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t("common.cancel")}</button>}
          </div>
        )}
        {st === "confirmee" && <div style={{ fontSize: 12.5, fontWeight: 800, color: C.green }}>{t("player.defis.confirmed", { points: c.points })}</div>}
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
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("player.defis.title")}</div>
      </div>
      {active.length === 0 && archived.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          {t("player.defis.empty")}<br />{t("player.defis.emptyHint")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {featured && Card(featured)}
          {active.filter((c) => c.id !== featured?.id).map(Card)}
          {active.length === 0 && <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.55)", fontSize: 12.5 })}>{t("player.defis.noActive")}</div>}
        </div>
      )}

      {archived.length > 0 && <ArchivedList items={archived} statutByChallenge={statutByChallenge} onOpen={setDetailId} />}

      {detail && (
        <ChallengeDetail c={detail} onClose={() => setDetailId(null)}>
          <div style={{ marginTop: 4 }}>{Actions(detail)}</div>
        </ChallengeDetail>
      )}
    </div>
  );
}

/* Historique des défis refusés / manqués (repliable), hors du plateau actif. */
function ArchivedList({ items, statutByChallenge, onOpen }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const meta = (st) => st === "refuse"
    ? { icon: "🚫", label: t("player.defis.refusedLabel"), color: "rgba(255,255,255,0.5)" }
    : { icon: "⌛", label: t("player.defis.missedLabel"), color: C.coral };
  return (
    <div style={{ marginTop: 18 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 800, letterSpacing: 0.4, cursor: "pointer", padding: "4px 2px" }}>
        <span>{open ? "▾" : "▸"}</span>
        <span>{t("player.defis.archivedTitle")} · {items.length}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {items.map((c) => {
            const m = meta(statutByChallenge[c.id]);
            return (
              <button key={c.id} onClick={() => onOpen(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer" }}>
                <span style={{ fontSize: 16, opacity: 0.7 }}>{c.badge || "🏆"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.titre}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: m.color, whiteSpace: "nowrap" }}>{m.icon} {m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
