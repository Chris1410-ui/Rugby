import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { Activity, ChevronDown, AlertTriangle } from "../../lib/icons.jsx";
import { displayName } from "../../lib/identity.js";
import { todayISO } from "../../lib/metrics.js";
import { teamAdherence } from "../../lib/adherence.js";

const accent = C.teal;
const pct = (r) => (r == null ? "—" : `${Math.round(r * 100)} %`);
const rateColor = (r) => (r == null ? "rgba(255,255,255,0.4)" : r >= 0.85 ? C.green : r >= 0.7 ? C.amb : C.coral);

/* « Respect du prescrit » (staff) — PR-2 de la couche d'analyse. Mesure la part
   des séances PRESCRITES qui ont été réalisées (done / manquée / oubli de saisie)
   par joueur et pour l'équipe, sur 28 jours, plus la qualité d'exécution (séries
   réalisées vs prescrites). Ne modifie aucune formule : couche AU-DESSUS des logs.
   L'agrégat d'équipe est masqué sous le seuil de k-anonymat ; les lignes
   individuelles restent visibles côté staff. */
export default function Adherence({ players = [], sessions = [], logs = {} }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(null);

  const a = useMemo(
    () => teamAdherence({ players, sessions, logs, today: todayISO() }),
    [players, sessions, logs],
  );
  const belowSet = useMemo(() => new Set(a.belowIds), [a.belowIds]);

  if (!players.length) {
    return (
      <section>
        <Header t={t} win={a.window} />
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>{t("staff.adherence.noPlayers")}</div>
      </section>
    );
  }

  return (
    <section>
      <Header t={t} win={a.window} />

      {/* Agrégat d'équipe (k-anon) */}
      <div style={sc({ marginBottom: 12, padding: 14 })}>
        {a.kAnon ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: rateColor(a.team.rate) }}>{pct(a.team.rate)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{t("staff.adherence.teamRate")}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("staff.adherence.teamDetail", { done: a.team.done, presc: a.team.prescribed, n: a.team.nReliable })}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            <AlertTriangle size={13} color={C.amb} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {t("staff.adherence.kAnonHidden", { n: a.team.nReliable })}
          </div>
        )}
      </div>

      {/* Lignes joueurs (plus faibles en tête) */}
      {a.rows.map((r) => {
        const isOpen = expanded === r.id;
        const below = belowSet.has(r.id);
        return (
          <div key={r.id} style={sc({ marginBottom: 8, padding: 0, overflow: "hidden", borderColor: below ? `${C.coral}55` : C.border })}>
            <div onClick={() => setExpanded(isOpen ? null : r.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", cursor: "pointer" }}>
              <div style={{ width: 46, textAlign: "center", fontSize: 16, fontWeight: 900, color: rateColor(r.rate) }}>{pct(r.rate)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(r.player)}</div>
                {r.reliable ? (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("staff.adherence.rowDetail", { done: r.done, presc: r.prescribed })}</div>
                ) : (
                  <div style={{ fontSize: 10, color: C.amb, marginTop: 2 }}>{t("staff.adherence.insufficient", { n: r.prescribed, min: r.min })}</div>
                )}
              </div>
              <ChevronDown size={16} color="rgba(255,255,255,0.4)" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
            </div>
            {isOpen && (
              <div style={{ padding: "0 13px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Stat c={C.green} label={t("staff.adherence.done")} v={r.done} />
                  <Stat c={C.coral} label={t("staff.adherence.missed")} v={r.missed} />
                  <Stat c={C.amb} label={t("staff.adherence.skipped")} v={r.skipped} />
                </div>
                {r.exercisePresc > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    <span style={{ fontWeight: 800, color: rateColor(r.exerciseRate) }}>{pct(r.exerciseRate)}</span> · {t("staff.adherence.exerciseRate", { adhered: r.exerciseAdhered, total: r.exercisePresc })}
                  </div>
                )}
                {r.skipped > 0 && <div style={{ fontSize: 10.5, color: C.amb }}>{t("staff.adherence.skippedHint", { count: r.skipped })}</div>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Header({ t, win }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Activity size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("staff.adherence.title")}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 12 }}>{t("staff.adherence.hint", { days: win })}</div>
    </>
  );
}

function Stat({ c, label, v }) {
  return (
    <div style={{ background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: c }}>
      {v} · {label}
    </div>
  );
}
