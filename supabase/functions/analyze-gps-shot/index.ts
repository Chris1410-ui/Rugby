// Edge Function `analyze-gps-shot` — LECTURE (vision) d'une capture d'écran GPS
// (PitcheroGPS, Catapult, StatSports…) par un LLM, côté serveur. La clé API n'est
// JAMAIS exposée au navigateur. L'IA ne fait que PROPOSER : le joueur valide.
//
// Entrée  (POST JSON) : { images: [{ media_type, data(base64) }], provider? }
//   (le client envoie ≤3 captures DÉJÀ downscalées ; cf. src/data/gpsAI.js)
// Sortie  (JSON)      : { source:"claude", metrics, warnings, confidence }
//                     | { source:"fallback", note, used?, limit? }
//
//   metrics = { distance_m, m_per_min, hsr_m, hsr_count, vmax_kmh, vavg_kmh,
//               duration_sec (int|null), speed_zones:[{zone,sec,pct}],
//               session_name (string|null), provider (string|null),
//               name_detected (bool), confidence:{<field>:0..1} }
//
// Garde-fous :
//  - QUOTA : la fonction appelle gps_ai_quota_consume(5) AVEC le JWT du joueur
//    (migration 0115) AVANT d'appeler Claude. allowed=false → renvoie
//    fallback:"over_quota" sans coût. Plafond incontournable côté client.
//  - N'INVENTE RIEN : toute valeur absente/illisible reste null (le client
//    normalise à nouveau via lib/gps.js). Le nom éventuel n'est JAMAIS recopié
//    hors de session_name ; seul name_detected (booléen) le signale.
//
// Déploiement : supabase functions deploy analyze-gps-shot
// Secrets     : ANTHROPIC_API_KEY (obligatoire), ANTHROPIC_GPS_MODEL (optionnel,
//               défaut sonnet-class), ANTHROPIC_MODEL (repli).
// Sans ANTHROPIC_API_KEY → source:"fallback" (l'écran garde la saisie manuelle).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAILY_LIMIT = 5;
const MAX_IMAGES = 3;
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_B64 = 6_000_000; // ~4.5 Mo décodés par image (garde-fou coût/abus)

const S = { type: "string" };
const NUM = { type: ["number", "null"] };
const INT = { type: ["integer", "null"] };

const zoneSchema = {
  type: "object", additionalProperties: false,
  properties: {
    zone: { type: "string", enum: ["walk", "jog", "run", "sprint"] },
    sec: INT, pct: NUM,
  },
  required: ["zone"],
};
const metricsToolSchema = {
  type: "object", additionalProperties: false,
  properties: {
    distance_m: { ...NUM, description: "Distance totale en MÈTRES (convertis les km)" },
    m_per_min: { ...NUM, description: "Mètres par minute (m·min⁻¹)" },
    hsr_m: { ...NUM, description: "High-Speed Running en mètres" },
    hsr_count: { ...INT, description: "Nombre d'efforts haute vitesse / sprints" },
    vmax_kmh: { ...NUM, description: "Vitesse max en km/h (convertis les m/s)" },
    vavg_kmh: { ...NUM, description: "Vitesse moyenne en km/h" },
    duration_sec: { ...INT, description: "Durée en SECONDES (convertis mm:ss / hh:mm:ss)" },
    speed_zones: { type: "array", items: zoneSchema, description: "Temps/part par zone si un graphe de zones est lisible" },
    session_name: { type: ["string", "null"], description: "Libellé lisible de la séance (ex: 'Match vs X', 'Training'). Peut contenir un nom : c'est le SEUL endroit où un nom est autorisé." },
    provider: { type: ["string", "null"], enum: ["pitchero", "catapult", "statsports", "other", null], description: "Fournisseur GPS identifié d'après l'UI" },
    name_detected: { type: "boolean", description: "true si un NOM/PRÉNOM de joueur est visible sur la capture" },
    confidence: { type: "object", additionalProperties: { type: "number" }, description: "Confiance 0..1 PAR champ renseigné (clé = nom du champ)" },
    warnings: { type: "array", items: S, description: "Ce qui n'a pas pu être lu avec certitude" },
    global_confidence: { type: "number", description: "Confiance globale 0..1 sur la fidélité de lecture" },
  },
  required: ["name_detected", "confidence", "warnings", "global_confidence"],
};

const SYSTEM =
  "Tu LIS une ou plusieurs captures d'écran d'un rapport GPS de sport collectif " +
  "(PitcheroGPS, Catapult, StatSports…) et tu renvoies UNIQUEMENT les métriques " +
  "réellement affichées, via l'outil fourni. Règles STRICTES :\n" +
  "1. N'INVENTE RIEN. Si une valeur est absente, illisible ou ambiguë, laisse-la " +
  "à null et ajoute une ligne dans `warnings`. Ne devine pas.\n" +
  "2. CONVERTIS vers les unités demandées : distances en mètres, vitesses en km/h, " +
  "durées en secondes (mm:ss ou hh:mm:ss → secondes).\n" +
  "3. `name_detected` = true si un nom/prénom de joueur apparaît. Ne recopie JAMAIS " +
  "un nom ailleurs que dans `session_name` (libellé de séance) ; aucun autre champ " +
  "ne doit contenir de donnée nominative.\n" +
  "4. `confidence` : un score honnête 0..1 par champ que tu remplis (clé = nom du " +
  "champ, ex: distance_m). Sois prudent sur les chiffres partiellement masqués.\n" +
  "5. Si plusieurs captures montrent la même séance, fusionne sans double compter. " +
  "Si tu ne lis presque rien, renvoie surtout des null + des warnings — ne force rien.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let images: Array<{ media_type: string; data: string }> = [];
  try {
    const body = await req.json();
    const raw = Array.isArray(body?.images) ? body.images : [];
    images = raw.slice(0, MAX_IMAGES).map((im: { media_type?: string; data?: string }) => ({
      media_type: ALLOWED_MEDIA.includes(String(im?.media_type)) ? String(im.media_type) : "image/jpeg",
      data: String(im?.data ?? ""),
    })).filter((im: { data: string }) => im.data && im.data.length <= MAX_B64);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!images.length) return json({ error: "no_image" }, 400);

  // ── Quota par joueur/jour (JWT du joueur → auth.uid côté RPC) ────────────────
  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey || !authHeader) return json({ source: "fallback", note: "no_auth" });
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: quota, error: qErr } = await supabase.rpc("gps_ai_quota_consume", { p_limit: DAILY_LIMIT });
  if (qErr) return json({ source: "fallback", note: "quota_error" });
  const row = Array.isArray(quota) ? quota[0] : quota;
  if (!row?.allowed) return json({ source: "fallback", note: "over_quota", used: row?.used ?? DAILY_LIMIT, limit: row?.lim ?? DAILY_LIMIT });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_GPS_MODEL") || Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";
  if (!apiKey) return json({ source: "fallback", note: "no_api_key" });

  const content = [
    ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
    { type: "text", text: "Lis ces captures GPS et renvoie les métriques via l'outil. N'invente rien." },
  ];

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        tools: [{ name: "emit_gps_metrics", description: "Renvoie les métriques GPS lues sur la capture, fidèles à l'écran.", input_schema: metricsToolSchema }],
        tool_choice: { type: "tool", name: "emit_gps_metrics" },
        messages: [{ role: "user", content }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return json({ source: "fallback", note: `api_${resp.status}`, detail: detail.slice(0, 300) });
    }
    const data = await resp.json();
    if (data.stop_reason === "refusal") return json({ source: "fallback", note: "refusal" });
    const toolBlock = (data.content ?? []).find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "emit_gps_metrics");
    if (!toolBlock?.input) return json({ source: "fallback", note: "no_tool_use" });

    const o = toolBlock.input as Record<string, unknown>;
    const metrics = {
      distance_m: o.distance_m ?? null, m_per_min: o.m_per_min ?? null, hsr_m: o.hsr_m ?? null,
      hsr_count: o.hsr_count ?? null, vmax_kmh: o.vmax_kmh ?? null, vavg_kmh: o.vavg_kmh ?? null,
      duration_sec: o.duration_sec ?? null,
      speed_zones: Array.isArray(o.speed_zones) ? o.speed_zones : [],
      session_name: typeof o.session_name === "string" ? o.session_name : null,
      provider: typeof o.provider === "string" ? o.provider : null,
      name_detected: o.name_detected === true,
      confidence: o.confidence && typeof o.confidence === "object" ? o.confidence : {},
    };
    return json({
      source: "claude",
      metrics,
      warnings: Array.isArray(o.warnings) ? o.warnings.map(String) : [],
      confidence: typeof o.global_confidence === "number" ? o.global_confidence : null,
    });
  } catch (e) {
    return json({ source: "fallback", note: "exception", detail: String(e).slice(0, 200) });
  }
});
