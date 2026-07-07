// Supabase Edge Function — recommandations de charge/prévention pour un joueur.
//
// L'appel au modèle Claude se fait ICI, côté serveur : la clé API n'est jamais
// exposée au navigateur (cf. handoff §10). Configuration via secrets de la
// fonction (jamais commités) :
//   - ANTHROPIC_API_KEY : clé API Anthropic
//   - ANTHROPIC_MODEL   : identifiant du modèle à utiliser
// Si l'un des deux est absent, la fonction renvoie une recommandation de repli
// déterministe basée sur les indicateurs (aucune dépendance externe requise).
//
// Déploiement : supabase functions deploy recommendations
// Secrets :     supabase secrets set ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=...

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Zones ACWR (mêmes seuils que lib/metrics.js)
function acwrLabel(v: number) {
  if (v < 0.8) return "sous-charge";
  if (v <= 1.3) return "cible";
  if (v <= 1.5) return "vigilance";
  return "surcharge";
}

// Repli déterministe : construit une reco à partir des indicateurs
function fallbackReco(p: Record<string, number | string>) {
  const acwr = Number(p.acwr) || 0;
  const risque = Number(p.risque) || 0;
  const wellness = Number(p.wellness) || 0;
  const monotonie = Number(p.monotonie) || 0;
  const tips: string[] = [];
  const zone = acwrLabel(acwr);
  if (zone === "surcharge") tips.push(`ACWR ${acwr} en surcharge — réduire le volume 20-30% cette semaine et prioriser la récupération.`);
  else if (zone === "vigilance") tips.push(`ACWR ${acwr} en vigilance — stabiliser la charge, éviter toute progression brutale.`);
  else if (zone === "sous-charge") tips.push(`ACWR ${acwr} en sous-charge — réintroduire progressivement du volume pour éviter le désentraînement.`);
  else tips.push(`ACWR ${acwr} en cible — maintenir la progression actuelle.`);
  if (monotonie > 2) tips.push(`Monotonie ${monotonie} élevée — varier l'intensité jour à jour (alterner dur/facile).`);
  if (wellness < 30) tips.push(`Bien-être ${wellness}/50 bas — surveiller sommeil et fatigue, envisager une séance allégée.`);
  if (risque >= 60) tips.push(`Indice de risque ${risque} élevé — contrôle prévention (ischios, asymétries) recommandé.`);
  return tips.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let player: Record<string, number | string> = {};
  try {
    const body = await req.json();
    player = body?.player ?? {};
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!player || !player.name) return json({ error: "player_required" }, 400);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_MODEL");

  // Pas de configuration IA → repli déterministe (fonctionnel, sans clé)
  if (!apiKey || !model) {
    return json({ recommendation: fallbackReco(player), source: "fallback" });
  }

  const system =
    "Tu es préparateur physique pour une équipe de rugby U18 (mineurs). " +
    "À partir des indicateurs d'un joueur (ACWR, bien-être/50, readiness/100, " +
    "indice de risque, monotonie, charge sRPE), donne 2 à 4 recommandations " +
    "CONCISES et actionnables pour le staff (gestion de charge et prévention). " +
    "Pas de diagnostic médical. Français, une puce par ligne, sans préambule.";

  const userContent =
    `Joueur : ${player.name} (${player.pos ?? "?"}).\n` +
    `ACWR ${player.acwr} (${acwrLabel(Number(player.acwr) || 0)}), ` +
    `bien-être ${player.wellness}/50, readiness ${player.readiness}/100, ` +
    `risque ${player.risque}/100, monotonie ${player.monotonie}, ` +
    `charge 7j ${player.charge7j} UA.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      return json({ recommendation: fallbackReco(player), source: "fallback", note: `api_${resp.status}` });
    }
    const data = await resp.json();
    if (data.stop_reason === "refusal") {
      return json({ recommendation: fallbackReco(player), source: "fallback", note: "refusal" });
    }
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    return json({ recommendation: text || fallbackReco(player), source: text ? "claude" : "fallback" });
  } catch (_e) {
    return json({ recommendation: fallbackReco(player), source: "fallback", note: "exception" });
  }
});
