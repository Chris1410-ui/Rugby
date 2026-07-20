import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { fmtShort } from "../../lib/metrics.js";
import { useTeamPushSubscriptions } from "../../data/push.js";
import { Bell } from "../../lib/icons.jsx";

/* Abonnements notifications (staff/owner, lecture seule). Pour chaque joueur
   réel du club : abonné / non, nombre d'appareils, date du dernier abonnement.
   Sert à repérer d'un coup qui ne recevra pas les push et à le relancer.
   Scopé au club courant (RLS push_staff_read). */

const FILTERS = [
  { key: "all", labelKey: "staff.subs.filterAll" },
  { key: "off", labelKey: "staff.subs.filterOff" },
  { key: "on", labelKey: "staff.subs.filterOn" },
];

export default function Abonnements({ teamId, players }) {
  const { t } = useTranslation();
  const { subs, loading } = useTeamPushSubscriptions(teamId);
  const [filter, setFilter] = useState("all");

  // Agrège les abonnements par joueur.
  const byPlayer = useMemo(() => {
    const m = {};
    for (const s of subs) {
      const e = m[s.player_id] || { count: 0, last: null };
      e.count += 1;
      const d = s.updated_at || s.created_at;
      if (d && (!e.last || d > e.last)) e.last = d;
      m[s.player_id] = e;
    }
    return m;
  }, [subs]);

  // Joueurs réels + statut, triés : non-abonnés d'abord (à relancer), puis nom.
  const rows = useMemo(() => {
    return players
      .filter((p) => !p.isDemo)
      .map((p) => { const info = byPlayer[p.id] || { count: 0, last: null }; return { p, on: info.count > 0, count: info.count, last: info.last }; })
      .sort((a, b) => (a.on === b.on ? displayName(a.p).localeCompare(displayName(b.p), "fr", { sensitivity: "base" }) : a.on ? 1 : -1));
  }, [players, byPlayer]);

  const shown = rows.filter((r) => filter === "all" || (filter === "on" ? r.on : !r.on));
  const onCount = rows.filter((r) => r.on).length;
  const total = rows.length;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Bell size={18} color={C.coral} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.subs.title")}</div>
      </div>

      {/* Résumé */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
        <Stat label={t("staff.subs.statOn")} value={onCount} color={C.green} />
        <Stat label={t("staff.subs.statOff")} value={total - onCount} color={C.amb} />
        <Stat label={t("staff.subs.statDevices")} value={subs.length} color={C.teal} />
      </div>

      {/* Filtre */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: filter === f.key ? C.coral : "rgba(255,255,255,0.07)", color: "#fff" }}>
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading && !subs.length ? (
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.55)", fontSize: 12 })}>{t("staff.subs.loading")}</div>
      ) : shown.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>{t("staff.subs.emptyFilter")}</div>
      ) : (
        <div style={sc({ padding: 0, overflow: "hidden" })}>
          {shown.map((r, i) => (
            <div key={r.p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderTop: i ? `1px solid ${C.border2}` : "none" }}>
              <span style={{ width: 9, height: 9, borderRadius: 5, background: r.on ? C.green : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(r.p)}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                  {r.on
                    ? t("staff.subs.devices", { count: r.count }) + (r.last ? t("staff.subs.lastSuffix", { date: fmtShort(r.last) }) : "")
                    : t("staff.subs.noDevice")}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: r.on ? C.green : C.amb, background: `${r.on ? C.green : C.amb}1e`, border: `1px solid ${(r.on ? C.green : C.amb)}55`, borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
                {r.on ? t("staff.subs.badgeOn") : t("staff.subs.badgeOff")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={sc({ padding: 12 })}>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
