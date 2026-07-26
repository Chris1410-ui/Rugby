// Edge Function `analyze-reference-doc` — analyse SÉMANTIQUE d'un PDF de
// référence (« PDF nourricier » : méthodo, article, doctrine ; texte extrait
// côté client) par un LLM, côté serveur. La clé API n'est JAMAIS exposée au
// navigateur : elle vit dans un secret de la fonction.
//
// Entrée  (POST JSON) : { text: string, title?: string, theme?: string,
//                         filename?: string }
// Sortie  (JSON)      : { sections: CandidateSection[], notes: CandidateNote[],
//                         warnings: string[], confidence: number,
//                         source: "claude" | "fallback" }
//
//   CandidateSection = section-type RÉUTILISABLE (versable dans section_templates)
//     { name, kind:"narrative"|"exercises", section:<obj normalisé>,
//       objective?, equipment?[], ageCategory?, pageRef?, confidence }
//   CandidateNote    = conseil / doctrine indexé par thème (→ knowledge_notes)
//     { theme, title, body(markdown), tags[], pageRef?, confidence }
//
// Le LLM reçoit une consigne stricte « EXTRAIS, n'invente rien ; cite la page
// quand c'est dérivable ; classe en section réutilisable vs conseil ; confidence
// honnête » et répond via un OUTIL forcé dont l'input_schema EST le contrat de
// sortie. RIEN n'est versé au catalogue automatiquement : les candidats sont
// persistés en BROUILLON côté client puis validés manuellement (le parse reste
// faillible).
//
// Déploiement : supabase functions deploy analyze-reference-doc
// Secrets     : supabase secrets set ANTHROPIC_API_KEY=...   (obligatoire)
//               supabase secrets set ANTHROPIC_MODEL=...      (optionnel)
// Sans ANTHROPIC_API_KEY la fonction renvoie source:"fallback" : l'écran de
// dépôt affiche « analyse IA non configurée » et ne verse rien.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Garde-fou : on borne la taille du texte (coût / abus).
const MAX_CHARS = 60_000;

const S = { type: "string" };

// ── input_schema de l'outil = contrat de sortie ──────────────────────────────
// Sections candidates : uniquement narrative | exercises (les deux kinds que
// section_templates sait accueillir). La forme `section` reste volontairement
// libre (jsonb) ; le client normalise avant aperçu.
const rowSchema = {
  type: "object", additionalProperties: false,
  properties: {
    block: { type: "string", description: "Bloc/regroupement, ex: A, A1 (superset = même lettre)" },
    name: S, tempo: S, rest: S,
    scheme: { type: "string", description: "Prescription, ex: 4×8, 3×12, AMRAP" },
    note: S,
  },
  required: ["name"],
};
const narrativeSectionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    type: { const: "narrative" },
    title: S, subtitle: S,
    body: { type: "string", description: "Corps en texte (consignes, principes)" },
  },
  required: ["type", "title", "body"],
};
const exercisesSectionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    type: { const: "exercises" },
    title: S, subtitle: S,
    rows: { type: "array", items: rowSchema },
  },
  required: ["type", "title", "rows"],
};
const candidateSectionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    name: { type: "string", description: "Nom court et réutilisable de la section-type" },
    kind: { type: "string", enum: ["narrative", "exercises"] },
    section: { anyOf: [narrativeSectionSchema, exercisesSectionSchema] },
    objective: { type: "string", description: "Objectif visé, ex: prévention nuque, gainage" },
    equipment: { type: "array", items: S, description: "Matériel requis" },
    ageCategory: { type: "string", description: "Catégorie d'âge si précisée, ex: U16, senior" },
    pageRef: { type: ["integer", "null"], description: "N° de page source si dérivable" },
    confidence: { type: "number", description: "Confiance 0..1 sur cette section" },
  },
  required: ["name", "kind", "section", "confidence"],
};

const candidateNoteSchema = {
  type: "object", additionalProperties: false,
  properties: {
    theme: { type: "string", description: "Thème, ex: prevention_nuque, intersaison, nutrition, recuperation" },
    title: { type: "string", description: "Titre court du conseil" },
    body: { type: "string", description: "Conseil en markdown (principes, points-clés)" },
    tags: { type: "array", items: S },
    pageRef: { type: ["integer", "null"], description: "N° de page source si dérivable" },
    confidence: { type: "number", description: "Confiance 0..1 sur ce conseil" },
  },
  required: ["theme", "title", "body", "confidence"],
};

const analysisToolSchema = {
  type: "object", additionalProperties: false,
  properties: {
    sections: {
      type: "array",
      description: "Sections-types RÉUTILISABLES extraites (échauffements, blocs de renfo, protocoles). Vide si le document n'en contient pas.",
      items: candidateSectionSchema,
    },
    notes: {
      type: "array",
      description: "Conseils / doctrine indexés par thème (principes, recommandations). Vide si aucun.",
      items: candidateNoteSchema,
    },
    warnings: {
      type: "array", items: S,
      description: "Ce qui n'a pas pu être lu/interprété avec certitude (texte tronqué, tableau ambigu…)",
    },
    confidence: {
      type: "number",
      description: "Confiance globale 0..1 sur la fidélité de l'analyse",
    },
  },
  required: ["sections", "notes", "warnings", "confidence"],
};

const SYSTEM =
  "Tu es un assistant qui ANALYSE le texte d'un document de référence " +
  "d'entraînement (méthodo, article, doctrine — extrait d'un PDF) pour en tirer " +
  "deux choses réutilisables, via l'outil fourni. Règles :\n" +
  "1. EXTRAIS, n'INVENTE RIEN. N'ajoute aucun exercice, principe, charge ou " +
  "consigne absent du texte. Si une valeur est illisible ou incertaine, laisse-la " +
  "vide et ajoute une note dans `warnings`.\n" +
  "2. `sections` = sections-types RÉUTILISABLES dans un protocole (un échauffement, " +
  "un bloc de renforcement, un protocole de prévention). Choisis `kind` :\n" +
  "   - narrative : consignes / principes en texte (title + body).\n" +
  "   - exercises : liste d'exercices structurée (rows: nom, bloc, tempo, repos, " +
  "schéma de séries).\n" +
  "   N'invente pas de séance complète : n'extrais que ce qui est explicitement " +
  "décrit et réutilisable tel quel.\n" +
  "3. `notes` = CONSEILS / doctrine indexés par `theme` (prévention, nutrition, " +
  "récupération, périodisation…). Corps en markdown court et actionnable.\n" +
  "4. Renseigne `pageRef` UNIQUEMENT si le n° de page est clairement dérivable du " +
  "texte (marqueur de page), sinon null. Donne une `confidence` HONNÊTE par item " +
  "et globale.\n" +
  "5. Si le document ne contient ni section réutilisable ni conseil clair, renvoie " +
  "des tableaux vides — ne force rien.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let text = "";
  let title = "";
  let theme = "";
  let filename = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "");
    title = String(body?.title ?? "").slice(0, 200);
    theme = String(body?.theme ?? "").slice(0, 80);
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

  // Sans clé → l'écran affiche « analyse IA non configurée », rien n'est versé.
  if (!apiKey) return json({ source: "fallback", note: "no_api_key" });

  const userContent =
    (title ? `Titre : ${title}\n` : "") +
    (theme ? `Thème déclaré : ${theme}\n` : "") +
    (filename ? `Fichier : ${filename}\n` : "") +
    `\nTexte brut extrait du PDF (peut contenir du bruit de mise en page) :\n\n${input}`;

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
          name: "emit_reference_analysis",
          description: "Renvoie les sections-types et conseils extraits, fidèles au texte source.",
          input_schema: analysisToolSchema,
        }],
        tool_choice: { type: "tool", name: "emit_reference_analysis" },
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
      (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "emit_reference_analysis",
    );
    if (!toolBlock?.input) return json({ source: "fallback", note: "no_tool_use" });

    const out = toolBlock.input as {
      sections?: unknown; notes?: unknown; warnings?: unknown; confidence?: unknown;
    };
    const warnings = Array.isArray(out.warnings) ? out.warnings.map(String) : [];
    if (overLimit) warnings.push(`Texte tronqué à ${MAX_CHARS} caractères — la fin du document n'a pas été analysée.`);

    return json({
      sections: Array.isArray(out.sections) ? out.sections : [],
      notes: Array.isArray(out.notes) ? out.notes : [],
      warnings,
      confidence: typeof out.confidence === "number" ? out.confidence : null,
      source: "claude",
    });
  } catch (e) {
    return json({ source: "fallback", note: "exception", detail: String(e).slice(0, 200) });
  }
});
