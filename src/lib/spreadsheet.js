/* Lecture de tableurs pour l'import de joueurs. Remplace `xlsx` (SheetJS npm
   0.18.5, non maintenu, CVE prototype-pollution + ReDoS sur fichiers non fiables)
   par deux libs maintenues, sans dépendances vulnérables, chargées à la demande :
     • read-excel-file  → .xlsx (unzip + SAX, pas d'éval)
     • papaparse        → .csv  (délimiteur auto : Excel FR exporte en « ; »)
   L'écriture du modèle se fait en CSV (lib/csv.js), sans dépendance. */

// Tableau de lignes (ligne 0 = en-têtes) → tableau d'objets clés=en-têtes.
// Ignore les lignes entièrement vides ; cellules absentes → "" (comme defval).
export function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = (rows[0] || []).map((h) => String(h ?? "").trim());
  return rows
    .slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== ""))
    .map((r) => {
      const o = {};
      headers.forEach((h, i) => { if (h) o[h] = r[i] == null ? "" : r[i]; });
      return o;
    });
}

// Lit un fichier .xlsx OU .csv (déposé par le staff) → tableau d'objets. Les
// libs lourdes sont importées dynamiquement (code-split : hors bundle principal).
export async function parseSpreadsheetFile(file) {
  const isCsv = /\.csv$/i.test(file.name || "") || file.type === "text/csv";
  if (isCsv) {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const res = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    return Array.isArray(res.data) ? res.data : [];
  }
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const rows = await readXlsxFile(file); // première feuille, lignes = tableaux
  return rowsToObjects(rows);
}
