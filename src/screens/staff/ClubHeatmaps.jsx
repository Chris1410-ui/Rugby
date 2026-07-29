import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { fmtShort } from "../../lib/metrics.js";
import { displayName } from "../../lib/identity.js";
import { useClubGps, gpsImageUrl } from "../../data/gps.js";
import { heatmapsOf } from "../../lib/gps.js";
import HeatmapsGallery from "../shared/HeatmapsGallery.jsx";

/* Parcours match — heatmaps du CLUB regroupées par date (GPS-5c, staff). Une
   vignette par joueur ayant déposé une heatmap ce jour-là ; clic → galerie
   individuelle du joueur (contexte individuel : noms de séance autorisés).

   Garde-fous : lecture RLS (staff même équipe), URL signées à durée limitée. Vue
   COLLECTIVE → le nom de séance privé n'est JAMAIS affiché ici ; seule l'identité
   du joueur (connue de son staff) sert de repère. Aucune agrégation de heatmaps
   entre joueurs (juxtaposition de vignettes individuelles). */

export default function ClubHeatmaps({ teamId, players = [] }) {
  const { t } = useTranslation();
  const { sessions } = useClubGps(teamId);
  const [period, setPeriod] = useState("all");
  const [playerFilter, setPlayerFilter] = useState("all");
  const [drill, setDrill] = useState(null); // joueur ouvert en galerie individuelle

  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const cutoff = period === "all" ? null : new Date(Date.now() - Number(period) * 864e5).toISOString().slice(0, 10);

  // items { session, player, path, tab } filtrés, groupés par date décroissante.
  const groups = useMemo(() => {
    const items = sessions
      .filter((s) => (!cutoff || s.date >= cutoff) && (playerFilter === "all" || s.playerId === playerFilter))
      .flatMap((s) => heatmapsOf(s).map((h) => ({ session: s, player: byId[s.playerId], path: h.path, tab: h.tab })))
      .filter((it) => it.player);
    const map = new Map();
    for (const it of items) { if (!map.has(it.session.date)) map.set(it.session.date, []); map.get(it.session.date).push(it); }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sessions, cutoff, playerFilter, byId]);

  const withHeat = useMemo(() => {
    const ids = new Set(sessions.filter((s) => heatmapsOf(s).length).map((s) => s.playerId));
    return players.filter((p) => ids.has(p.id));
  }, [sessions, players]);

  const seg = (val, cur, set, label) => (
    <button key={val} onClick={() => set(val)} style={{ padding: "5px 9px", borderRadius: 7, border: cur === val ? `1px solid ${C.teal}` : `1px solid ${C.border}`, background: cur === val ? `${C.teal}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>🗺️ {t("gps.heatmaps.clubTitle")}</div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>{t("gps.heatmaps.clubSubtitle")}</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {seg("all", period, setPeriod, t("gps.heatmaps.periodAll"))}
        {seg("30", period, setPeriod, t("gps.heatmaps.period30"))}
        {seg("90", period, setPeriod, t("gps.heatmaps.period90"))}
      </div>
      {withHeat.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {seg("all", playerFilter, setPlayerFilter, t("gps.heatmaps.allPlayers"))}
          {withHeat.map((p) => seg(p.id, playerFilter, setPlayerFilter, displayName(p)))}
        </div>
      )}

      {groups.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "24px 0" }}>{t("gps.heatmaps.clubEmpty")}</div>
      ) : (
        groups.map(([date, items]) => (
          <div key={date} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "rgba(255,255,255,0.85)" }}>{fmtShort(date)} · {t("gps.heatmaps.nPlayers", { count: new Set(items.map((i) => i.player.id)).size })}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
              {items.map((it) => (
                <button key={`${it.session.id}:${it.path}`} onClick={() => setDrill(it.player)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
                  <Thumb path={it.path} />
                  <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(it.player)}</div>
                  {it.tab && <div style={{ fontSize: 8.5, color: C.teal }}>{t(`player.gps.tab.${it.tab}`)}</div>}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {drill && <HeatmapsGallery playerId={drill.id} showNames onClose={() => setDrill(null)} />}
    </div>
  );
}

function Thumb({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let ok = true; gpsImageUrl(path).then((u) => { if (ok) setUrl(u); }); return () => { ok = false; }; }, [path]);
  return (
    <div style={{ width: "100%", aspectRatio: "3 / 4", borderRadius: 8, background: "#000", border: `1px solid ${C.border}`, overflow: "hidden" }}>
      {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
}
