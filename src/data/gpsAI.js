import { supabase } from "../lib/supabase.js";
import { normalizeGpsMetrics, normalizeSpeedZones } from "../lib/gps.js";

/* Analyse IA d'une capture GPS — invoque l'Edge Function `analyze-gps-shot`.
   L'appel à Claude et la clé API restent CÔTÉ SERVEUR (jamais exposés au
   navigateur). L'IA ne fait que PROPOSER : le joueur valide avant enregistrement.

   Les images sont DOWNSCALÉES côté client (coût + payload bornés) puis envoyées
   en base64. Le retour est re-normalisé via lib/gps.js (garantit « absent→null »,
   jamais de valeur fabriquée) — la même normalisation qu'à l'enregistrement.

   Renvoie :
   - { source:"claude", metrics, confidence, warnings } en cas de succès ;
   - { source:"fallback", note, used?, limit? } sinon (IA non configurée, quota
     atteint, réseau…) → l'appelant garde la saisie manuelle.
   Ne LÈVE PAS : la validation manuelle reste la garantie. */

const MAX_AI_IMAGES = 3;
const MAX_EDGE = 1568; // longest side (recommandation vision)
const JPEG_Q = 0.82;

// Downscale une image (File/Blob) en JPEG base64 (sans le préfixe data:). En cas
// d'échec (canvas indispo, décodage KO), renvoie null → l'image est ignorée.
async function fileToDownscaledB64(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_Q);
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? { media_type: "image/jpeg", data: dataUrl.slice(comma + 1) } : null;
  } catch (e) {
    console.error("[gps ai downscale]", e?.message || e);
    return null;
  }
}

export async function analyzeGpsShot(files) {
  const list = (files || []).filter(Boolean).slice(0, MAX_AI_IMAGES);
  if (!list.length) return { source: "fallback", note: "no_image" };

  const images = (await Promise.all(list.map(fileToDownscaledB64))).filter(Boolean);
  if (!images.length) return { source: "fallback", note: "encode_failed" };

  let data;
  try {
    const res = await supabase.functions.invoke("analyze-gps-shot", { body: { images } });
    if (res.error) return { source: "fallback", note: "invoke_error" };
    data = res.data;
  } catch {
    return { source: "fallback", note: "network" };
  }

  if (!data || data.source !== "claude") {
    return { source: "fallback", note: data?.note || "no_result", used: data?.used, limit: data?.limit };
  }

  // Re-normalisation défensive : on ne fait jamais confiance aveuglément au LLM.
  const raw = data.metrics || {};
  const metrics = normalizeGpsMetrics({ ...raw, source: "ai" });
  metrics.speedZones = normalizeSpeedZones(raw.speed_zones);
  // Classement par capture : index → {kind, tab}. Le tab n'a de sens que pour une
  // heatmap. L'appelant mappe `index` sur le fichier correspondant (même ordre).
  const KINDS = ["heatmap", "stats", "chart"];
  const TABS = ["speed", "distance", "intensity", "other"];
  const imageKinds = (Array.isArray(data.images) ? data.images : [])
    .filter((im) => Number.isInteger(im?.index) && KINDS.includes(im?.kind))
    .map((im) => ({ index: im.index, kind: im.kind, tab: im.kind === "heatmap" && TABS.includes(im.tab) ? im.tab : null }));
  return {
    source: "claude",
    metrics,
    imageKinds,
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}
