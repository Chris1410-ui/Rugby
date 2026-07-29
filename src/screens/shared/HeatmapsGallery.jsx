import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Overlay } from "../../lib/ui.jsx";
import { fmtShort } from "../../lib/metrics.js";
import { useGpsSessions, gpsImageUrl } from "../../data/gps.js";
import { heatmapsOf } from "../../lib/gps.js";

/* Écran « Heatmaps » (GPS-5b) — galerie des cartes de chaleur conservées à chaque
   dépôt GPS. Vignettes triées par date décroissante, filtres (période / type de
   séance / fournisseur), plein écran avec zoom + métriques + navigation.

   Garde-fous : URL signées à durée limitée (gpsImageUrl) ; le nom de séance privé
   n'est affiché QUE si `showNames` (fiche individuelle du joueur / son staff),
   jamais en vue collective ; aucune agrégation inter-joueurs (galerie d'un seul
   joueur ici — le parcours match multi-joueurs viendra en GPS-5c). */

const PROVIDERS = ["pitchero", "catapult", "statsports", "other"];
const fmtDur = (sec) => (sec > 0 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—");
// Type de séance dérivé du rattachement (décision GPS-5 : entraînement si lié à un
// training/convocation, sinon match). Purement indicatif pour le filtre.
const sessionKind = (s) => (s.linkedTrainingId ? "training" : "match");

export default function HeatmapsGallery({ playerId, showNames = false, onClose }) {
  const { t } = useTranslation();
  const { sessions } = useGpsSessions(playerId);
  const [period, setPeriod] = useState("all"); // all | 30 | 90
  const [kind, setKind] = useState("all");      // all | match | training
  const [provider, setProvider] = useState("all");
  const [viewer, setViewer] = useState(null);   // index (dans `items` filtré) ouvert en plein écran
  const [compare, setCompare] = useState(false); // mode sélection pour comparer
  const [sel, setSel] = useState([]);            // clés sélectionnées (max 4)
  const [cmpOpen, setCmpOpen] = useState(false); // vue comparative ouverte

  // Aplatit les heatmaps de toutes les séances → items { session, path, tab }.
  const all = useMemo(
    () => sessions.flatMap((s) => heatmapsOf(s).map((h) => ({ session: s, path: h.path, tab: h.tab }))),
    [sessions],
  );
  const cutoff = period === "all" ? null : new Date(Date.now() - Number(period) * 864e5).toISOString().slice(0, 10);
  const items = useMemo(
    () => all.filter((it) => (!cutoff || it.session.date >= cutoff)
      && (kind === "all" || sessionKind(it.session) === kind)
      && (provider === "all" || it.session.provider === provider)),
    [all, cutoff, kind, provider],
  );

  const providersPresent = useMemo(() => PROVIDERS.filter((p) => all.some((it) => it.session.provider === p)), [all]);

  const keyOf = (it) => `${it.session.id}:${it.path}`;
  const toggleSel = (it) => {
    const k = keyOf(it);
    setSel((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length >= 4 ? cur : [...cur, k]));
  };
  const selItems = useMemo(() => items.filter((it) => sel.includes(keyOf(it))), [items, sel]);
  const onTile = (it, i) => (compare ? toggleSel(it) : setViewer(i));

  const seg = (val, cur, set, label) => (
    <button key={val} onClick={() => set(val)} style={{ padding: "5px 9px", borderRadius: 7, border: cur === val ? `1px solid ${C.teal}` : `1px solid ${C.border}`, background: cur === val ? `${C.teal}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  return (
    <Overlay onClose={onClose} sheet>
      <div style={{ padding: "6px 18px 24px" }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>🗺️ {t("gps.heatmaps.title")}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>{t("gps.heatmaps.subtitle")}</div>

        {/* Filtres */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {seg("all", period, setPeriod, t("gps.heatmaps.periodAll"))}
          {seg("30", period, setPeriod, t("gps.heatmaps.period30"))}
          {seg("90", period, setPeriod, t("gps.heatmaps.period90"))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {seg("all", kind, setKind, t("gps.heatmaps.kindAll"))}
          {seg("match", kind, setKind, t("gps.heatmaps.kindMatch"))}
          {seg("training", kind, setKind, t("gps.heatmaps.kindTraining"))}
        </div>
        {providersPresent.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {seg("all", provider, setProvider, t("gps.heatmaps.providerAll"))}
            {providersPresent.map((p) => seg(p, provider, setProvider, t(`player.gps.provider_${p}`)))}
          </div>
        )}

        {/* Bascule « comparer » : sélectionne 2 à 4 heatmaps → vue côte à côte. */}
        {all.length > 1 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <button onClick={() => { setCompare((c) => !c); setSel([]); }} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${compare ? C.teal : C.border}`, background: compare ? `${C.teal}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{compare ? t("gps.heatmaps.compareCancel") : `⇄ ${t("gps.heatmaps.compare")}`}</button>
            {compare && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)" }}>{t("gps.heatmaps.compareHint", { n: sel.length })}</span>}
            {compare && sel.length >= 2 && <button onClick={() => setCmpOpen(true)} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 7, border: "none", background: C.teal, color: "#fff", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>{t("gps.heatmaps.compareGo", { n: sel.length })}</button>}
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "24px 0" }}>{t("gps.heatmaps.empty")}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {items.map((it, i) => {
              const on = compare && sel.includes(keyOf(it));
              return (
              <button key={keyOf(it)} onClick={() => onTile(it, i)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left", position: "relative", outline: on ? `2px solid ${C.teal}` : "none", outlineOffset: 2, borderRadius: 8 }}>
                {on && <span style={{ position: "absolute", top: 4, right: 4, zIndex: 1, background: C.teal, color: "#fff", borderRadius: 10, width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{sel.indexOf(keyOf(it)) + 1}</span>}
                <Thumb path={it.path} />
                <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 3 }}>{fmtShort(it.session.date)}</div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)", display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {it.tab && <span style={{ color: C.teal }}>{t(`player.gps.tab.${it.tab}`)}</span>}
                  {it.session.provider && <span>{t(`player.gps.provider_${it.session.provider}`)}</span>}
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>

      {viewer != null && items[viewer] && (
        <HeatmapViewer
          items={items}
          index={viewer}
          showNames={showNames}
          onNav={(d) => setViewer((v) => Math.max(0, Math.min(items.length - 1, v + d)))}
          onClose={() => setViewer(null)}
        />
      )}
      {cmpOpen && selItems.length >= 2 && <HeatmapCompare items={selItems} showNames={showNames} onClose={() => setCmpOpen(false)} />}
    </Overlay>
  );
}

// Vignette : résout une URL signée (durée limitée) à la demande.
function Thumb({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let ok = true; gpsImageUrl(path).then((u) => { if (ok) setUrl(u); }); return () => { ok = false; }; }, [path]);
  return (
    <div style={{ width: "100%", aspectRatio: "3 / 4", borderRadius: 8, background: "#000", border: `1px solid ${C.border}`, overflow: "hidden" }}>
      {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
}

/* Comparaison côte à côte de 2 à 4 heatmaps (même joueur, même échelle
   d'affichage) pour comparer l'occupation du terrain entre deux matchs/périodes. */
function HeatmapCompare({ items, showNames, onClose }) {
  const { t } = useTranslation();
  const cols = items.length >= 3 ? 2 : items.length; // 2 → 1 rangée ; 3-4 → grille 2×2
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 410, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>⇄ {t("gps.heatmaps.compareTitle", { n: items.length })}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer" }}>×</button>{/* i18n-ok: symbole fermeture */}
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, overflow: "auto", padding: "0 12px 16px", display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, alignContent: "start" }}>
        {items.map((it) => (
          <div key={`${it.session.id}:${it.path}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800 }}>{fmtShort(it.session.date)}{it.tab ? ` · ${t(`player.gps.tab.${it.tab}`)}` : ""}</div>
            {showNames && it.session.sessionName && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.session.sessionName}</div>}
            <Thumb path={it.path} />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              {[it.session.distanceM != null ? `${it.session.distanceM} m` : null, it.session.vmaxKmh != null ? `${it.session.vmaxKmh} km/h` : null, it.session.hsrM != null ? `HSR ${it.session.hsrM} m` : null].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Plein écran : zoom (molette / pincement via échelle), métriques, précédent/suivant.
function HeatmapViewer({ items, index, showNames, onNav, onClose }) {
  const { t } = useTranslation();
  const it = items[index];
  const g = it.session;
  const [url, setUrl] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => { let ok = true; setZoom(1); setUrl(null); gpsImageUrl(it.path).then((u) => { if (ok) setUrl(u); }); return () => { ok = false; }; }, [it.path]);

  const metric = (label, val) => (val != null && val !== "" ? (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${C.border2}` }}>
      <span style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span><span style={{ fontWeight: 800 }}>{val}</span>
    </div>
  ) : null);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 400, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 10 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{fmtShort(g.date)}{it.tab ? ` · ${t(`player.gps.tab.${it.tab}`)}` : ""}</div>
          {showNames && g.sessionName && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.sessionName}</div>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer" }}>×</button>{/* i18n-ok: symbole fermeture */}
      </div>

      <div onClick={(e) => e.stopPropagation()} onWheel={(e) => setZoom((z) => Math.max(1, Math.min(4, z - e.deltaY * 0.002)))} style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "pan-x pan-y" }}>
        {url && <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.05s linear" }} />}
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderTop: `1px solid ${C.border}`, padding: "10px 16px", maxHeight: "34vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={() => onNav(-1)} disabled={index === 0} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.4 : 1 }}>‹ {t("gps.heatmaps.prev")}</button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{index + 1}/{items.length}</span>
          <button onClick={() => onNav(1)} disabled={index === items.length - 1} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: index === items.length - 1 ? "default" : "pointer", opacity: index === items.length - 1 ? 0.4 : 1 }}>{t("gps.heatmaps.next")} ›</button>
        </div>
        {metric(t("shared.fiche.gps.m_distance_m"), g.distanceM != null ? `${g.distanceM} m` : null)}{/* i18n-ok: unité m */}
        {metric(t("shared.fiche.gps.m_vmax_kmh"), g.vmaxKmh != null ? `${g.vmaxKmh} km/h` : null)}{/* i18n-ok: unité km/h */}
        {metric(t("shared.fiche.gps.m_hsr_m"), g.hsrM != null ? `${g.hsrM} m` : null)}{/* i18n-ok: unité m */}
        {metric(t("shared.fiche.gps.m_m_per_min"), g.mPerMin != null ? `${g.mPerMin}` : null)}
        {metric(t("player.gps.duration"), fmtDur(g.durationSec))}
        {metric(t("player.gps.provider"), g.provider ? t(`player.gps.provider_${g.provider}`) : null)}
      </div>
    </div>
  );
}
