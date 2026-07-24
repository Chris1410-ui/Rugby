// Edge Function `parse-program` — analyse SÉMANTIQUE d'un texte de programme
// (extrait d'un PDF côté client) par un LLM, côté serveur. La clé API n'est
// JAMAIS exposée au navigateur : elle vit dans un secret de la fonction.
//
// Entrée  (POST JSON) : { text: string, weeks?: number, filename?: string }
// Sortie  (JSON)      : { doc: {meta, sections[]}, warnings: string[],
//                         confidence: number, source: "claude" | "fallback" }
//
// Le LLM reçoit une consigne stricte « extraire, ne pas inventer, préserver
// l'ordre et les regroupements, signaler ce qui est illisible » et répond via
// un OUTIL forcé dont l'input_schema EST notre modèle de protocole étendu
// (narrative | exercises | checklist | weekcalendar | cardio | table). Le
// rendu fidèle et la matérialisation des séances se font en aval (PR3), après
// APERÇU + VALIDATION manuelle obligatoires (le parse reste faillible).
//
// Déploiement : supabase functions deploy parse-program
// Secrets     : supabase secrets set ANTHROPIC_API_KEY=...   (obligatoire)
//               supabase secrets set ANTHROPIC_MODEL=...      (optionnel)
// Sans ANTHROPIC_API_KEY la fonction renvoie source:"fallback" : le client
// retombe alors sur le parseur regex local (lib/pdf.js).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Garde-fous : on borne la taille du texte (coût / abus) et le nb de semaines.
const MAX_CHARS = 60_000;
const clampWeeks = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(1, Math.min(12, v)) : 4;
};

// Vocabulaire de NATURE (identique à src/lib/nature.js) — guide le LLM.
const NATURES = ["force", "conditioning", "vitesse", "prevention", "recuperation", "technique", "mobilite", "autre"];

// ── input_schema de l'outil = modèle de protocole étendu ──────────────────
// Un objet `section` par type (anyOf), discriminé par `type` (const). Champs
// tête (num/title/subtitle) communs ; le reste est spécifique au type. Le
// client (src/lib/program/model.js → normalizeProgram) répare/complète ensuite.
const S = { type: "string" };
const head = { num: S, title: S, subtitle: S };

const narrativeSchema = {
  type: "object", additionalProperties: false,
  properties: { type: { const: "narrative" }, ...head, body: S },
  required: ["type", "title"],
};
const cellSchema = {
  type: "object", additionalProperties: false,
  properties: { text: S, peak: { type: "boolean" } }, required: ["text"],
};
const rowSchema = {
  type: "object", additionalProperties: false,
  properties: {
    block: { type: "string", description: "Bloc/regroupement, ex: A, A1, B (superset = même lettre)" },
    name: S, tempo: S, rest: S,
    weeks: { type: "array", items: cellSchema, description: "Une cellule par semaine (S1..Sn), dans l'ordre" },
    note: S,
  },
  required: ["name"],
};
const exercisesSchema = {
  type: "object", additionalProperties: false,
  properties: {
    type: { const: "exercises" }, ...head,
    weekLabels: { type: "array", items: S, description: " En-têtes de colonnes semaine, ex: S1,S2,S3,S4" },
    rows: { type: "array", items: rowSchema },
  },
  required: ["type", "title", "rows"],
};
const checklistSchema = {
  type: "object", additionalProperties: false,
  properties: {
    type: { const: "checklist" }, ...head,
    badge: { type: "string", description: "Étiquette courte optionnelle, ex: 10 min, À chaque séance" },
    items: { type: "array", items: S },
  },
  required: ["type", "title", "items"],
};
const daySchema = {
  type: "object", additionalProperties: false,
  properties: {
    weekday: { type: "string", description: "Jour: Lundi..Dimanche (ou 0=dimanche..6=samedi)" },
    label: { type: "string", description: "Contenu du jour, ex: Musculation haut du corps" },
    nature: { type: "string", enum: NATURES, description: "Nature dominante du jour" },
    optional: { type: "boolean" },
    off: { type: "boolean", description: "true = jour de repos" },
  },
  required: ["weekday"],
};
const weekcalendarSchema = {
  type: "object", additionalProperties: false,
  properties: { type: { const: "weekcalendar" }, ...head, days: { type: "array", items: daySchema } },
  required: ["type", "title", "days"],
};
const cardioItemSchema = {
  type: "object", additionalProperties: false,
  properties: {
    name: S, kind: { type: "string", description: "Modalité, ex: Rameur, Vélo, Course, 30-15" },
    target: { type: "string", description: "Cible, ex: 20 min Z2, 8×30\"/30\"" }, note: S,
  },
  required: ["name"],
};
const cardioSchema = {
  type: "object", additionalProperties: false,
  properties: { type: { const: "cardio" }, ...head, items: { type: "array", items: cardioItemSchema } },
  required: ["type", "title", "items"],
};
const tableSchema = {
  type: "object", additionalProperties: false,
  properties: {
    type: { const: "table" }, ...head,
    columns: { type: "array", items: S },
    rows: { type: "array", items: { type: "array", items: S }, description: "Une ligne = tableau de cellules alignées sur columns" },
  },
  required: ["type", "title", "columns", "rows"],
};

const metaSchema = {
  type: "object", additionalProperties: false,
  properties: {
    eyebrow: { type: "string", description: "Sur-titre court, ex: Protocole de force" },
    title: { type: "string", description: "Titre du protocole" },
    lede: { type: "string", description: "Chapô / résumé 1-2 phrases" },
    badge: {
      type: "object", additionalProperties: false,
      properties: { big: S, tag: S }, required: [],
    },
    facts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { n: S, label: S }, required: ["n", "label"],
      },
      description: "Chiffres-clés, ex: {n:'4', label:'semaines'}",
    },
    sessionsPerWeek: { type: ["integer", "null"] },
    nature: { type: "string", enum: NATURES, description: "Nature dominante du protocole" },
    weeks: { type: "integer", description: "Nombre de semaines du cycle (1-12)" },
    sources: { type: "string", description: "Auteur / source si mentionnés" },
    mantra: { type: "string", description: "Devise/citation si présente" },
  },
  required: ["title"],
};

const programToolSchema = {
  type: "object", additionalProperties: false,
  properties: {
    meta: metaSchema,
    sections: {
      type: "array",
      description: "Sections dans l'ORDRE du document",
      items: {
        anyOf: [narrativeSchema, exercisesSchema, checklistSchema, weekcalendarSchema, cardioSchema, tableSchema],
      },
    },
    warnings: {
      type: "array", items: S,
      description: "Ce qui n'a pas pu être lu/interprété avec certitude (texte tronqué, tableau ambigu…)",
    },
    confidence: {
      type: "number",
      description: "Confiance globale 0..1 sur la fidélité de l'extraction",
    },
  },
  required: ["meta", "sections", "warnings", "confidence"],
};

const SYSTEM =
  "Tu es un assistant qui STRUCTURE le texte brut d'un programme d'entraînement " +
  "(extrait d'un PDF) en un document JSON fidèle, via l'outil fourni. Règles :\n" +
  "1. EXTRAIS, n'INVENTE RIEN. N'ajoute aucun exercice, jour, charge ou consigne " +
  "absent du texte. Si une valeur est illisible ou incertaine, laisse-la vide et " +
  "ajoute une note dans `warnings`.\n" +
  "2. PRÉSERVE l'ordre des sections et les regroupements (blocs, supersets A1/A2, " +
  "colonnes de semaines S1..Sn) tels qu'ils apparaissent.\n" +
  "3. CHOISIS le bon type de section :\n" +
  "   - narrative : objectifs, règles, consignes en texte.\n" +
  "   - exercises : tableau de muscu avec progression par semaine (Bloc/Exercice/" +
  "Tempo/Repos/S1..Sn/Note). Un `peak:true` sur la cellule marquée d'une étoile.\n" +
  "   - checklist : échauffement / liste de points à cocher.\n" +
  "   - weekcalendar : « semaine type » (répartition Lundi→Dimanche).\n" +
  "   - cardio : blocs de conditioning / filières.\n" +
  "   - table : tout autre tableau (ex: paliers par poste).\n" +
  "4. Renseigne `meta` (titre, semaines, nature dominante) et une `confidence` " +
  "honnête. Reproduis le document le plus fidèlement possible.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let text = "";
  let weeks = 4;
  let filename = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "");
    weeks = clampWeeks(body?.weeks);
    filename = String(body?.filename ?? "").slice(0, 200);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const trimmed = text.trim();
  if (!trimmed) return json({ error: "empty_text" }, 400);
  const overLimit = trimmed.length > MAX_CHARS;
  const input = overLimit ? trimmed.slice(0, MAX_CHARS) : trimmed;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";

  // Sans clé → le client retombe sur le parseur regex local.
  if (!apiKey) return json({ source: "fallback", note: "no_api_key" });

  const userContent =
    (filename ? `Fichier : ${filename}\n` : "") +
    `Cycle attendu : ${weeks} semaine(s).\n\n` +
    `Texte brut extrait du PDF (peut contenir du bruit de mise en page) :\n\n${input}`;

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
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system: SYSTEM,
        tools: [{
          name: "emit_program",
          description: "Renvoie le programme structuré fidèle au texte source.",
          input_schema: programToolSchema,
        }],
        tool_choice: { type: "tool", name: "emit_program" },
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return json({ source: "fallback", note: `api_${resp.status}`, detail: detail.slice(0, 400) });
    }
    const data = await resp.json();
    if (data.stop_reason === "refusal") return json({ source: "fallback", note: "refusal" });

    const toolBlock = (data.content ?? []).find(
      (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "emit_program",
    );
    if (!toolBlock?.input) return json({ source: "fallback", note: "no_tool_use" });

    const out = toolBlock.input as { meta?: unknown; sections?: unknown; warnings?: unknown; confidence?: unknown };
    const warnings = Array.isArray(out.warnings) ? out.warnings.map(String) : [];
    if (overLimit) warnings.push(`Texte tronqué à ${MAX_CHARS} caractères — la fin du document n'a pas été analysée.`);

    return json({
      doc: { meta: out.meta ?? {}, sections: Array.isArray(out.sections) ? out.sections : [] },
      warnings,
      confidence: typeof out.confidence === "number" ? out.confidence : null,
      source: "claude",
    });
  } catch (e) {
    return json({ source: "fallback", note: "exception", detail: String(e).slice(0, 200) });
  }
});
