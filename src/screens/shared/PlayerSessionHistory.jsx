import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { Section, Tag, NatureTag } from "../../lib/ui.jsx";
import { parseISO, todayISO, statusOfLog, sessionDisplayState } from "../../lib/metrics.js";
import { useTeamSessions } from "../../data/sessions.js";
import { useTeamLogs } from "../../data/logs.js";

const STATE_COLOR = { done: C.green, missed: C.coral, todo: C.amb, postponed: C.gray };

/* Section « Historique des séances » de la fiche joueur : la trace réelle
   d'activité (réalisée ✓ + RPE / manquée ✗ / à faire ◦ / reportée). Même
   lecture pour le staff (depuis la fiche) et le joueur (self). Se sert des
   données déjà scopées RLS ; aucune écriture. */
export default function PlayerSessionHistory({ player, players = [] }) {
  const { t } = useTranslation();
  const sessions = useTeamSessions(player?.team, players);
  const logs = useTeamLogs(player?.team);
  const today = todayISO();
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const mine = (sessions || [])
      .filter((s) => (s.assignedIds || []).includes(player?.id))
      .map((s) => ({ s, st: sessionDisplayState(statusOfLog(logs, s.id, player?.id), s.date, today), rpe: logs?.[s.id]?.[player?.id]?.rpe, dur: logs?.[s.id]?.[player?.id]?.duration }))
      .sort((a, b) => b.s.date.localeCompare(a.s.date)); // plus récent d'abord
    return mine;
  }, [sessions, logs, player?.id, today]);

  const counts = useMemo(() => {
    const c = { done: 0, missed: 0, todo: 0, postponed: 0 };
    rows.forEach((r) => { c[r.st] = (c[r.st] || 0) + 1; });
    return c;
  }, [rows]);

  const past = rows.filter((r) => r.st !== "todo");
  const rate = past.length ? Math.round((counts.done / past.length) * 100) : null;
  const shown = showAll ? rows : rows.slice(0, 8);

  return (
    <Section title={t("shared.fiche.sessHistTitle")}>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: "4px 0" }}>{t("shared.fiche.sessHistEmpty")}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, fontSize: 10 }}>
            {rate != null && <Tag c={rate >= 80 ? C.green : rate >= 50 ? C.amb : C.coral}>{t("shared.fiche.sessHistRate", { rate })}</Tag>}
            <Tag c={C.green}>{t("shared.fiche.sessHistDone", { count: counts.done })}</Tag>
            <Tag c={C.coral}>{t("shared.fiche.sessHistMissed", { count: counts.missed })}</Tag>
            <Tag c={C.amb}>{t("shared.fiche.sessHistTodo", { count: counts.todo })}</Tag>
          </div>
          {shown.map(({ s, st, rpe, dur }) => {
            const d = parseISO(s.date);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ textAlign: "center", width: 38, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString(localeTag(), { month: "short" })}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{d.getDate()}</div>
                </div>
                <div style={{ width: 3, height: 26, borderRadius: 2, background: STATE_COLOR[st] }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    {s.code && <Tag c={CODES[s.code] || C.viol} title={sessionCodeLabel(t, s.code)}>{s.code}</Tag>}
                    <NatureTag nature={s.nature} code={s.code} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.titre}</span>
                  </div>
                </div>
                {st === "done" && dur > 0 && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{dur} {t("player.session.min")}</span>}
                {st === "done" ? <Tag c={C.green}>{t("shared.calendar.tagDone")}{rpe ? ` · ${t("shared.calendar.rpe", { rpe })}` : ""}</Tag>
                  : st === "missed" ? <Tag c={C.coral}>{t("shared.calendar.tagMissed")}</Tag>
                  : st === "postponed" ? <Tag c={C.gray}>{t("shared.calendar.tagPostponed")}</Tag>
                  : <Tag c={C.amb}>{t("shared.calendar.tagTodo")}</Tag>}
              </div>
            );
          })}
          {rows.length > 8 && (
            <button onClick={() => setShowAll((v) => !v)} style={{ marginTop: 8, background: "none", border: "none", color: C.viol, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {showAll ? t("shared.fiche.sessHistLess") : t("shared.fiche.sessHistMore", { count: rows.length - 8 })}
            </button>
          )}
        </>
      )}
    </Section>
  );
}
