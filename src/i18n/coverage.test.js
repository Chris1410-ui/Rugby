import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";

const traverse = _traverse.default || _traverse;
const SRC = fileURLToPath(new URL("..", import.meta.url)); // .../src

/* ════════════════════════════════════════════════════════════════
   Test de couverture i18n (garde-fou). Deux garanties :

   1) PARITÉ des catalogues : fr / en / nl ont EXACTEMENT le même jeu de clés
      → échoue si une clé manque (ou est en trop) dans une langue.

   2) AUCUNE chaîne d'interface EN DUR dans les fichiers COUVERTS : un scanner
      AST signale le texte JSX et les props d'UI (placeholder/title/alt/label/
      aria-label) écrits en littéral au lieu de passer par t(). Les fichiers pas
      encore migrés sont listés dans PENDING ; chaque lot d'internationalisation
      en retire des entrées. Un fichier NOUVEAU (hors PENDING/EXCLUDE) est
      couvert automatiquement → tout ajout futur doit être traduit.

   Échappatoire ponctuelle : suffixer la ligne d'un `// i18n-ok` (texte
   volontairement non traduisible : sigle, marque, unité isolée…).
   ════════════════════════════════════════════════════════════════ */

// Fichiers sans texte d'interface (SVG, providers, points d'entrée).
const EXCLUDE = new Set([
  "lib/icons.jsx",
  "lib/charts.jsx",
  "main.jsx",
  "App.jsx",
]);

// Fichiers d'UI PAS ENCORE migrés (à vider lot par lot). Tout .jsx absent de
// cette liste ET d'EXCLUDE est scanné.
const PENDING = new Set([
  "auth/useAuth.jsx",
  "lib/ui.jsx",
  "screens/OwnerApp.jsx",
  "screens/shared/Calendrier.jsx",
]);

// Props d'UI dont la valeur littérale doit passer par t().
const TEXT_PROPS = new Set(["placeholder", "title", "alt", "label", "aria-label"]);
const WORD = /\p{L}{2,}/u;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".jsx") && !name.includes(".test.")) out.push(p);
  }
  return out;
}

function keyPaths(obj, prefix = "", acc = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keyPaths(v, key, acc);
    else acc.add(key);
  }
  return acc;
}

function scanFile(absPath) {
  const code = readFileSync(absPath, "utf8");
  const lines = code.split("\n");
  const okLine = (n) => (lines[n - 1] || "").includes("i18n-ok");
  const violations = [];
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch (e) {
    violations.push({ line: 0, text: `parse error: ${e.message}` });
    return violations;
  }
  traverse(ast, {
    JSXText(path) {
      const raw = path.node.value;
      if (!WORD.test(raw)) return;
      const line = path.node.loc?.start.line ?? 0;
      if (okLine(line)) return;
      violations.push({ line, text: raw.trim().replace(/\s+/g, " ").slice(0, 60) });
    },
    JSXAttribute(path) {
      const name = path.node.name?.name;
      if (typeof name !== "string" || !TEXT_PROPS.has(name)) return;
      const v = path.node.value;
      if (!v || v.type !== "StringLiteral" || !WORD.test(v.value)) return;
      const line = path.node.loc?.start.line ?? 0;
      if (okLine(line)) return;
      violations.push({ line, text: `${name}="${v.value.slice(0, 50)}"` });
    },
  });
  return violations;
}

describe("i18n — parité des catalogues", () => {
  const kfr = keyPaths(fr), ken = keyPaths(en), knl = keyPaths(nl);
  const diff = (a, b) => [...a].filter((k) => !b.has(k)).sort();
  it("en couvre toutes les clés fr (et inversement)", () => {
    expect({ manquantEnEN: diff(kfr, ken), enTropEnEN: diff(ken, kfr) })
      .toEqual({ manquantEnEN: [], enTropEnEN: [] });
  });
  it("nl couvre toutes les clés fr (et inversement)", () => {
    expect({ manquantEnNL: diff(kfr, knl), enTropEnNL: diff(knl, kfr) })
      .toEqual({ manquantEnNL: [], enTropEnNL: [] });
  });
});

describe("i18n — aucune chaîne d'interface en dur (fichiers couverts)", () => {
  const files = walk(SRC).map((p) => relative(SRC, p).split("\\").join("/"));
  const covered = files.filter((f) => !EXCLUDE.has(f) && !PENDING.has(f));

  it("liste PENDING à jour (pas de fichier fantôme)", () => {
    const known = new Set(files);
    expect([...PENDING].filter((f) => !known.has(f))).toEqual([]);
  });

  for (const f of covered) {
    it(`${f} — pas de texte en dur`, () => {
      const v = scanFile(join(SRC, f));
      expect(v.map((x) => `L${x.line}: ${x.text}`)).toEqual([]);
    });
  }
});
