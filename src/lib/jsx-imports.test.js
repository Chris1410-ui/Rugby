import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default || _traverse;

/* Garde-fou anti « page blanche » (généralisé).
   Un composant utilisé en JSX (`<BuildTag/>`, `<Upload/>`…) mais NON importé ni
   déclaré est une ReferenceError au runtime qui blanchit l'écran (régression
   observée : <BuildTag/> ajouté dans OwnerApp sans l'import). ESLint ne l'attrape
   pas ici (pas d'eslint-plugin-react → pas de react/jsx-no-undef), et le bundler
   ne bronche pas (identifiant traité comme un global au runtime). L'ancien test
   ne couvrait QUE les icônes → il a raté BuildTag. Ce test scanne TOUS les
   composants JSX en PascalCase et vérifie, via l'analyse de portée Babel, qu'ils
   sont bien LIÉS dans le fichier : import, déclaration locale, paramètre, ou
   destructuration (ex. `items.map(([, , Icon]) => <Icon/>)` — pas un faux positif). */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

// Composants « globaux » autorisés sans import (rares). Vide par défaut.
const ALLOW = new Set([]);

function walkJsx(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsx(full));
    else if (entry.name.endsWith(".jsx")) out.push(full);
  }
  return out;
}

// Composants PascalCase utilisés en JSX sans binding en portée (import/décl/param).
export function undefinedComponents(src) {
  const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });
  const bad = new Set();
  traverse(ast, {
    JSXOpeningElement(path) {
      const n = path.node.name;
      if (n.type !== "JSXIdentifier") return;   // ignore <Foo.Bar/> (member expr)
      const name = n.name;
      if (!/^[A-Z]/.test(name)) return;         // ignore les éléments html (div, span…)
      if (ALLOW.has(name)) return;
      if (!path.scope.hasBinding(name)) bad.add(name);
    },
  });
  return [...bad];
}

describe("composants JSX importés avant usage (anti page blanche)", () => {
  it("auto-test : détecte un composant non défini", () => {
    expect(undefinedComponents("export default () => <Missing />;")).toEqual(["Missing"]);
    // pas de faux positif : composant local, import, ou param destructuré
    expect(undefinedComponents("import X from 'x'; export default () => <X/>;")).toEqual([]);
    expect(undefinedComponents("function Y(){return <div/>;} export default () => <Y/>;")).toEqual([]);
    expect(undefinedComponents("export default ({items}) => items.map(([,,Icon]) => <Icon/>);")).toEqual([]);
  });

  it("aucun composant PascalCase utilisé en JSX sans import/déclaration dans src/", () => {
    const problems = [];
    for (const file of walkJsx(srcRoot)) {
      const src = readFileSync(file, "utf8");
      let bad;
      try { bad = undefinedComponents(src); }
      catch (e) { problems.push(`src/${relative(srcRoot, file)} : erreur d'analyse — ${e.message}`); continue; }
      for (const name of bad) problems.push(`src/${relative(srcRoot, file)} : <${name}> utilisé sans import/déclaration`);
    }
    expect(problems, `Composants non importés :\n${problems.join("\n")}`).toEqual([]);
  });
});
