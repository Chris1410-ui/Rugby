/* Normalisation des lignes brutes Supabase → « ReportInput » pour compute.js.
   Pur et testable : la récupération réseau (avec RLS) vit dans l'endpoint ;
   ici on ne fait que remettre en forme (dates, poids courant, bien-être). */

// Numéro de maillot par nom de poste stocké (players.pos). Local au rapport pour
// ne pas coupler le bundle serverless au runtime i18n (positions.js importe i18n).
const POS_NUM = {
  "Pilier gauche": "1",
  "Talonneur": "2",
  "Pilier droit": "3",
  "Deuxième ligne": "4-5",
  "Troisième ligne aile (flanker)": "6-7",
  "Troisième ligne centre (n°8)": "8",
  "Demi de mêlée": "9",
  "Demi d'ouverture": "10",
  "Ailier": "11-14",
  "Trois-quarts centre": "12-13",
  "Arrière": "15",
};

// « Demi de mêlée (9) », ou le poste brut si inconnu.
export function posLabelOf(pos) {
  if (!pos) return "—";
  const num = POS_NUM[pos];
  return num ? `${pos} (${num})` : pos;
}

// Colonnes de test transmises TELLES QUELLES : top14.js fait lui-même le parsing
// (broncoToSec pour « 4'25 », parseKg pour « 3x170 », numOrNull sinon). Toute
// coercition Number() ici casserait les champs texte (bronco/squat) → NaN.
const TEST_COLS = ["mas", "bronco", "yoyo", "squat_5rm", "cmj_overall", "bench_5rm", "hang_clean_2rm", "deadlift", "tractions", "bodyweight"];

// Un résultat brut (test_results) daté par sa campagne → ligne pour top14Player.
function toResult(row, campDate) {
  const out = { date: campDate || row.date || null };
  for (const c of TEST_COLS) out[c] = row[c] ?? null;
  return out;
}

/* raw = {
     player,     // ligne players (snake_case)
     campaigns,  // lignes test_campaigns [{ id, date }]
     results,    // lignes test_results du joueur [{ campaign_id, …cols }]
     checkin,    // dernier daily_checkins { date, wb:{mood,stress,sleep} } | null
     generatedAt // 'YYYY-MM-DD' (injecté par l'appelant : pas d'horloge ici)
   } */
export function normalizeReportInput(raw) {
  const player = raw.player || {};
  const campById = new Map((raw.campaigns || []).map((c) => [c.id, c.date]));

  // Résultats datés, triés du + ancien au + récent (attendu par top14Player).
  const results = (raw.results || [])
    .map((r) => toResult(r, campById.get(r.campaign_id)))
    .filter((r) => r.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const testDate = results.length ? results[results.length - 1].date : null;

  const wb = (raw.checkin && raw.checkin.wb) || {};
  const num = (v) => (v == null || v === "" ? null : Number(v));

  return {
    player: {
      name: player.name || "—",
      pos: player.pos || null,
      posLabel: posLabelOf(player.pos),
      heightCm: num(player.height_cm),
      weightKg: num(player.bodyweight),
      sessionsPerWeek: num(player.sessions_per_week),
      injuryHistory: (player.injury_history || "").trim(),
    },
    wellbeing: { mood: num(wb.mood), stress: num(wb.stress), sleep: num(wb.sleep) },
    results,
    dates: {
      testDate,
      wellnessDate: raw.checkin?.date || null,
      generatedAt: raw.generatedAt || null,
    },
  };
}
