import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* Garde-fou anti « page blanche ».
   Une icône utilisée en JSX (`<Upload …/>`) mais NON importée est une
   ReferenceError au runtime qui blanchit tout l'écran (cf. bug #49 : <Upload>
   ajouté dans StaffApp sans l'import). ESLint ne l'attrape pas ici (pas de
   eslint-plugin-react → pas de react/jsx-no-undef). Ce test scanne donc tout
   `src/` et échoue si une icône connue est utilisée sans être disponible dans
   le fichier (importée OU déclarée localement). */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

const ICON_NAMES = [
  ...readFileSync(join(here, "icons.jsx"), "utf8").matchAll(/export const ([A-Z][A-Za-z0-9]*)/g),
].map((m) => m[1]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".jsx")) out.push(full);
  }
  return out;
}

// Identifiants disponibles dans un fichier : importés (nommés, défaut, namespace,
// « X as Y ») + déclarés localement (const/let/function Name).
function availableNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["']/g)) {
    const clause = m[1];
    for (const braces of clause.matchAll(/\{([^}]*)\}/g)) {
      for (const part of braces[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) names.add(name);
      }
    }
    for (const bare of clause.replace(/\{[^}]*\}/g, "").matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      names.add(bare[0]);
    }
  }
  for (const m of src.matchAll(/(?:const|let|function)\s+([A-Z][A-Za-z0-9]*)/g)) names.add(m[1]);
  return names;
}

describe("icônes importées avant usage (anti page blanche)", () => {
  it("expose bien une liste d'icônes non vide", () => {
    expect(ICON_NAMES.length).toBeGreaterThan(10);
    expect(ICON_NAMES).toContain("Upload");
  });

  it("aucune icône utilisée en JSX sans être importée/déclarée", () => {
    const iconSet = new Set(ICON_NAMES);
    const problems = [];
    for (const file of walk(srcRoot)) {
      const src = readFileSync(file, "utf8");
      const available = availableNames(src);
      const usedTags = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]));
      for (const tag of usedTags) {
        if (iconSet.has(tag) && !available.has(tag)) {
          problems.push(`${file.replace(srcRoot, "src")} : <${tag}> utilisé sans import`);
        }
      }
    }
    expect(problems, `Icônes non importées :\n${problems.join("\n")}`).toEqual([]);
  });
});
