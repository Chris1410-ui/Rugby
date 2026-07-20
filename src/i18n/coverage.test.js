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
      AST signale, écrits en littéral au lieu de passer par t() :
        • le texte JSX (`<span>Bonjour</span>`) ;
        • les props d'UI (placeholder/title/alt/label/aria-label) ;
        • les littéraux en position de SORTIE dans les accolades JSX — chaîne
          nue `{"x"}`, branches de ternaire `{c ? "x" : "y"}`, côté droit d'un
          `{c && "x"}` — que ce soit un enfant d'élément ou une prop de texte.
      Les fichiers pas encore migrés sont listés dans PENDING ; chaque lot en
      retire des entrées. Un fichier NOUVEAU (hors PENDING/EXCLUDE) est couvert
      automatiquement → tout ajout futur doit être traduit.

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
const PENDING = new Set([]);

// Props d'UI dont la valeur littérale doit passer par t().
const TEXT_PROPS = new Set(["placeholder", "title", "alt", "label", "aria-label"]);
const WORD = /\p{L}{2,}/u;

// Un JSXExpressionContainer est en « position texte » s'il rend du texte
// d'élément (enfant d'un JSXElement/JSXFragment) OU s'il est la valeur d'une
// prop de texte (placeholder/title/…). Dans ces positions, un littéral de chaîne
// en sortie (`{"x"}`, `{c ? "x" : "y"}`, `{c && "x"}`) doit passer par t().
function isTextContainer(parent) {
  if (!parent) return false;
  if (parent.type === "JSXElement" || parent.type === "JSXFragment") return true;
  if (parent.type === "JSXAttribute") {
    const n = parent.name?.name;
    return typeof n === "string" && TEXT_PROPS.has(n);
  }
  return false;
}

// Collecte les StringLiteral en POSITION DE SORTIE d'une expression de conteneur
// texte : la chaîne elle-même, les branches d'un ternaire, le côté droit d'un
// `&&` (et les deux d'un `||`). On NE descend PAS dans les appels/objets/JSX
// imbriqués (style, t(), map…) → cible les libellés en dur sans faux positifs.
function collectOutputStrings(node, acc) {
  if (!node) return;
  if (node.type === "StringLiteral") { acc.push(node); return; }
  if (node.type === "ConditionalExpression") {
    collectOutputStrings(node.consequent, acc);
    collectOutputStrings(node.alternate, acc);
  } else if (node.type === "LogicalExpression") {
    collectOutputStrings(node.right, acc);
    if (node.operator === "||") collectOutputStrings(node.left, acc);
  }
}

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
  return scanCode(readFileSync(absPath, "utf8"));
}

function scanCode(code) {
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
    JSXExpressionContainer(path) {
      if (!isTextContainer(path.parent)) return;
      const lits = [];
      collectOutputStrings(path.node.expression, lits);
      for (const lit of lits) {
        if (!WORD.test(lit.value)) continue;
        const line = lit.loc?.start.line ?? 0;
        if (okLine(line)) continue;
        violations.push({ line, text: `{…"${lit.value.slice(0, 50)}"}` });
      }
    },
  });
  return violations;
}

describe("i18n — le scanner détecte bien les littéraux (méta-test)", () => {
  const texts = (code) => scanCode(code).map((v) => v.text);
  const wrap = (jsx) => `const C = () => <div>${jsx}</div>;`;

  it("signale une chaîne nue en enfant JSX", () => {
    expect(texts(wrap(`{"Bonjour"}`))).toContain(`{…"Bonjour"}`);
  });
  it("signale les deux branches d'un ternaire", () => {
    const v = texts(wrap(`{on ? "Activé" : "Désactivé"}`));
    expect(v).toContain(`{…"Activé"}`);
    expect(v).toContain(`{…"Désactivé"}`);
  });
  it("signale le côté droit d'un &&", () => {
    expect(texts(wrap(`{flag && "Nouveau"}`))).toContain(`{…"Nouveau"}`);
  });
  it("signale un ternaire dans une prop de texte", () => {
    expect(texts(`const C = () => <input title={on ? "Ouvrir" : "Fermer"} />;`))
      .toEqual(expect.arrayContaining([`{…"Ouvrir"}`, `{…"Fermer"}`]));
  });
  it("ignore t(), les valeurs de style, les conditions et les non-mots", () => {
    expect(texts(wrap(`{t("player.hello")}`))).toEqual([]);
    expect(texts(`const C = () => <div style={{ color: on ? "red" : "blue" }} />;`)).toEqual([]);
    expect(texts(wrap(`{status === "done" ? icon : null}`))).toEqual([]); // "done" est dans la condition
    expect(texts(wrap(`{n > 1 ? "s" : ""}`))).toEqual([]); // 1 lettre → pas un mot
    expect(texts(wrap(`{ok ? "✓" : "✗"}`))).toEqual([]); // symboles
  });
  it("respecte l'échappatoire i18n-ok", () => {
    expect(texts(`const C = () => <div>{/* i18n-ok */}{"Marque"}</div>;`)).toEqual([]);
  });
});

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
