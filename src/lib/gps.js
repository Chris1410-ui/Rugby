/* Données GPS (charge externe) — helpers PURS : normalisation, records, séries.
   AUCUNE formule existante (playerLoad/ACWR/points) n'en dépend. Règle d'or de
   l'extraction : on ne fabrique JAMAIS une valeur — absent/illisible → null. */

// Zones de vitesse canoniques (ordre marche → sprint).
export const SPEED_ZONES = ["walk", "jog", "run", "sprint"];

// Métriques suivies. `dir:'up'` = plus c'est haut, mieux c'est (tous ici).
export const GPS_METRICS = [
  { key: "distance_m", unit: "m", int: true },
  { key: "m_per_min", unit: "m/min", int: false },
  { key: "hsr_m", unit: "m", int: true },
  { key: "hsr_count", unit: "", int: true },
  { key: "vmax_kmh", unit: "km/h", int: false },
  { key: "vavg_kmh", unit: "km/h", int: false },
  { key: "duration_sec", unit: "s", int: true },
];

const PROVIDERS = ["pitchero", "catapult", "statsports", "other"];

// Nombre ≥ 0 lisible, sinon null (0 lu = valeur ; absent/vide/négatif/NaN = null).
const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const int = (v) => { const n = num(v); return n == null ? null : Math.round(n); };
const clamp01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null; };

/* Normalise une entrée (IA vision ou saisie manuelle) → objet métriques propre.
   Champs numériques null si non lus (jamais inventés). Conserve confiance,
   zones, provenance et le drapeau PII (name_detected). PUR. */
export function normalizeGpsMetrics(raw = {}) {
  const conf = {};
  if (raw.confidence && typeof raw.confidence === "object") {
    for (const [k, v] of Object.entries(raw.confidence)) { const c = clamp01(v); if (c != null) conf[k] = c; }
  }
  const provider = PROVIDERS.includes(String(raw.provider || "").toLowerCase()) ? String(raw.provider).toLowerCase() : null;
  return {
    date: raw.date || null,
    sessionName: (raw.session_name ?? raw.sessionName) ? String(raw.session_name ?? raw.sessionName).trim() : null,
    provider,
    source: raw.source === "manual" ? "manual" : "ai",
    distanceM: int(raw.distance_m ?? raw.distanceM),
    mPerMin: num(raw.m_per_min ?? raw.mPerMin),
    hsrM: int(raw.hsr_m ?? raw.hsrM),
    hsrCount: int(raw.hsr_count ?? raw.hsrCount),
    vmaxKmh: num(raw.vmax_kmh ?? raw.vmaxKmh),
    vavgKmh: num(raw.vavg_kmh ?? raw.vavgKmh),
    durationSec: int(raw.duration_sec ?? raw.durationSec),
    speedZones: normalizeSpeedZones(raw.speed_zones ?? raw.speedZones),
    confidence: conf,
    nameDetected: !!(raw.name_detected ?? raw.nameDetected),
  };
}

/* Zones de vitesse → [{zone, sec, pct}] ; on ne garde que les zones connues,
   sec ≥ 0, pct borné 0–100 ; une zone n'apparaît qu'une fois. PUR. */
export function normalizeSpeedZones(zones) {
  const out = [];
  const seen = new Set();
  for (const z of Array.isArray(zones) ? zones : []) {
    const zone = String(z?.zone || "").toLowerCase();
    if (!SPEED_ZONES.includes(zone) || seen.has(zone)) continue;
    seen.add(zone);
    const sec = int(z?.sec);
    const p = num(z?.pct);
    out.push({ zone, sec, pct: p == null ? null : Math.min(100, p) });
  }
  return out.sort((a, b) => SPEED_ZONES.indexOf(a.zone) - SPEED_ZONES.indexOf(b.zone));
}

// Au moins une métrique renseignée ? (garde-fou avant enregistrement). PUR.
export function hasAnyMetric(m) {
  return GPS_METRICS.some(({ key }) => {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return m && m[camel] != null;
  });
}

const METRIC_FIELDS = { distance_m: "distanceM", m_per_min: "mPerMin", hsr_m: "hsrM", hsr_count: "hsrCount", vmax_kmh: "vmaxKmh", vavg_kmh: "vavgKmh", duration_sec: "durationSec" };

/* Records personnels par métrique (max), depuis une liste de sessions GPS
   normalisées (chaque session porte les champs camelCase + id/date). Renvoie
   { metricKey: { value, date, id } }. La vmax est le record phare. PUR. */
export function gpsRecords(sessions = []) {
  const rec = {};
  for (const [metric, field] of Object.entries(METRIC_FIELDS)) {
    let best = null;
    for (const s of sessions) {
      const v = s?.[field];
      if (v == null) continue;
      if (!best || v > best.value) best = { value: v, date: s.date || null, id: s.id || null };
    }
    if (best) rec[metric] = best;
  }
  return rec;
}

/* Métriques pour lesquelles `session` bat toutes les `prior` (PB). PUR. */
export function pbMetrics(session, prior = []) {
  const out = [];
  for (const [metric, field] of Object.entries(METRIC_FIELDS)) {
    const v = session?.[field];
    if (v == null) continue;
    const priorMax = prior.reduce((mx, s) => (s?.[field] != null && s[field] > mx ? s[field] : mx), -Infinity);
    if (v > priorMax) out.push(metric);
  }
  return out;
}

/* Synthèse « charge externe » sur une fenêtre de `days` jours se terminant à
   `today` (ISO) : nombre de séances GPS + distance et HSR cumulés (les trous
   comptent pour 0). Sert à juxtaposer charge externe (GPS) et interne (sRPE),
   SANS métrique combinée. PUR. */
export function gpsWindowLoad(sessions = [], days = 7, today = "") {
  const end = today || "";
  const from = end ? new Date(new Date(end).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10) : "";
  let n = 0, distanceM = 0, hsrM = 0;
  for (const s of sessions) {
    if (!s?.date) continue;
    if (from && (s.date < from || s.date > end)) continue;
    n += 1;
    if (s.distanceM != null) distanceM += s.distanceM;
    if (s.hsrM != null) hsrM += s.hsrM;
  }
  return { n, distanceM, hsrM };
}

/* Agrégat personnel aligné sur les RPC k-anon (avg pour distance/hsr/m·min⁻¹,
   MAX pour vmax) → { metricKey: number|null }, pour la comparaison ligne/équipe. PUR. */
export function gpsPlayerAgg(sessions = []) {
  const avg = (field) => {
    const vs = sessions.map((s) => s?.[field]).filter((v) => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const max = (field) => {
    const vs = sessions.map((s) => s?.[field]).filter((v) => v != null);
    return vs.length ? Math.max(...vs) : null;
  };
  return { distance_m: avg("distanceM"), hsr_m: avg("hsrM"), m_per_min: avg("mPerMin"), vmax_kmh: max("vmaxKmh") };
}

/* Série temporelle d'une métrique → [{date, value}] triée (pour les courbes).
   Ignore les sessions sans valeur. PUR. */
export function gpsSeries(sessions = [], metricKey) {
  const field = METRIC_FIELDS[metricKey];
  if (!field) return [];
  return sessions
    .filter((s) => s?.[field] != null && s?.date)
    .map((s) => ({ date: s.date, value: s[field] }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
