import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { localeTag } from "../../i18n/locale.js";
import { useTeamActivityFeed } from "../../data/teamFeed.js";

/* Mur d'activité du club — fil pseudonymisé (totem + initiales) des FAITS
   d'activité : qui a validé sa séance, fait son check-in, relevé un défi, été
   présent·e, déposé ses données GPS. Aucune donnée de santé (cf. RPC 0119).
   Réutilisé en tête de l'onglet Équipe, au-dessus du classement existant. */
export default function TeamWall({ teamId, players = [], accent = C.green }) {
  const { t } = useTranslation();
  const { items, loading } = useTeamActivityFeed(teamId);
  const byId = useMemo(() => Object.fromEntries((players || []).map((p) => [p.id, p])), [players]);

  const rtf = useMemo(() => {
    try { return new Intl.RelativeTimeFormat(localeTag(), { numeric: "auto" }); } catch { return null; }
  }, []);
  const rel = (iso) => {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (!rtf) return "";
    if (mins < 1) return rtf.format(0, "minute");
    if (mins < 60) return rtf.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return rtf.format(-hrs, "hour");
    return rtf.format(-Math.round(hrs / 24), "day");
  };

  const factText = (it) => {
    switch (it.kind) {
      case "session": return it.subject ? t("player.wall.factSession", { subject: it.subject }) : t("player.wall.factSessionPlain");
      case "checkin": return t(it.subject === "soir" ? "player.wall.factCheckinEvening" : "player.wall.factCheckinMorning");
      case "challenge": return it.subject ? t("player.wall.factChallenge", { subject: it.subject }) : t("player.wall.factChallengePlain");
      case "convocation": return it.subject ? t("player.wall.factConvocation", { subject: it.subject }) : t("player.wall.factConvocationPlain");
      case "gps": return t("player.wall.factGps");
      default: return "";
    }
  };
  const avatarText = (p) => (p?.initials || (p?.name || "?").slice(0, 2)).toUpperCase();

  const visible = (items || []).filter((it) => byId[it.playerId]); // RLS club : joueurs connus uniquement

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{t("player.wall.title")}</div>

      {loading && !visible.length ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "12px 2px" }}>{t("common.loading")}</div>
      ) : !visible.length ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
          {t("player.wall.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((it, i) => {
            const p = byId[it.playerId];
            return (
              <div key={`${it.kind}-${it.playerId}-${it.at}-${i}`} style={{ display: "flex", alignItems: "center", gap: 11, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "11px 13px" }}>
                <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 17, background: `${accent}2e`, border: `1px solid ${accent}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                  {avatarText(p)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 800 }}>{displayName(p)}</span>{" "}
                    <span style={{ color: "rgba(255,255,255,0.8)" }}>{factText(it)}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{rel(it.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
