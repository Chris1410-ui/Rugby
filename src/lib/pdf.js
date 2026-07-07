import { newExo } from "./exlib.js";

/* Import PDF → modèles de séances éditables. Porté du prototype (heuristique
   ligne-par-ligne). pdf.js est chargé dynamiquement (chunk séparé, à la demande). */
export async function parsePDFtoTemplates(file) {
  let pdfjsLib, workerUrl;
  try {
    pdfjsLib = await import("pdfjs-dist");
    workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    throw new Error("no-pdfjs");
  }

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const page = await pdf.getPage(pg);
    const tc = await page.getTextContent();
    const byY = {};
    tc.items.forEach((it) => {
      const y = Math.round(it.transform[5]);
      (byY[y] = byY[y] || []).push(it.str);
    });
    Object.keys(byY)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((y) => {
        const t = byY[y].join(" ").replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
      });
  }

  const WDre = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i;
  const WDmap = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
  const schemeRe = /(\d+)\s*[x×]\s*([\d\-–à]+)/i;
  const templates = [];
  let cur = null;

  const pushExo = (line) => {
    const m = line.match(schemeRe);
    const exo = newExo();
    if (m) {
      exo.sets = parseInt(m[1], 10) || 3;
      exo.reps = m[2].replace(/–/g, "-");
      exo.name = line.slice(0, m.index).replace(/^[-•·\d.)\s]+/, "").trim() || line;
      const after = line.slice(m.index + m[0].length).trim();
      const cm = after.match(/(\d+\s*%|\d+\s*kg|PDC|\d+kg)/i);
      if (cm) exo.charge = cm[0];
    } else {
      exo.name = line.replace(/^[-•·\d.)\s]+/, "").trim();
    }
    if (exo.name.length > 1) {
      cur = cur || templates[templates.length - 1] || { weekday: 1, code: "RS", titre: "Séance importée", exercises: [] };
      cur.exercises.push(exo);
      if (!templates.includes(cur)) templates.push(cur);
    }
  };

  lines.forEach((line) => {
    const wm = line.match(WDre);
    if (wm && line.length < 40) {
      cur = { weekday: WDmap[wm[1].toLowerCase()], code: "RS", titre: line, exercises: [] };
      templates.push(cur);
      return;
    }
    if (/^\d+\s*[x×]|séries|reps|squat|press|hip|sprint|nordic|gainage|fente|traction|développ|soulev|jump|sauté|mobilit|plaquage/i.test(line)) {
      pushExo(line);
    }
  });

  const clean = templates
    .filter((t) => t && t.exercises.length)
    .map((t) => ({ weekday: t.weekday, code: t.code || "RS", titre: t.titre || "Séance importée", exercises: t.exercises }));
  if (!clean.length) throw new Error("empty");
  return clean;
}
