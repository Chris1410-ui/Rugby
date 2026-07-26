/* Analyse légère d'un PDF à l'upload (côté client) pour RÉDUIRE le coût de la
   bonne saisie de provenance : lire les métadonnées (auteur/producteur/date/titre)
   et détecter l'absence de couche texte (PDF scanné/images). But : transformer
   la certification d'auteur d'une case machinale en une question à laquelle on
   répond, en pré-remplissant ce qui est déductible et en orientant vers la bonne
   provenance. Les helpers purs sont testables ; `analyzePdf` charge pdf.js. */

// Date PDF « D:YYYYMMDDHHmmSS... » → « YYYY-MM-DD » (ou null si illisible).
export function parsePdfDate(raw) {
  const m = String(raw || "").match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

/* Provenance SUGGÉRÉE (jamais imposée) depuis les indices du fichier. On ne
   propose JAMAIS « création propre » par défaut : si un auteur/producteur tiers
   est présent, on oriente vers « adapté d'une source » ; sinon vers « origine
   inconnue » (cas normal du PDF tiers non attribué). Retourne null quand rien
   n'est déductible → l'utilisateur doit choisir activement. */
export function suggestProvenance({ author, producer, creator } = {}) {
  const third = [author, producer, creator].some((x) => x && String(x).trim());
  if (third) return "adapte_source";
  return "origine_inconnue";
}

export async function analyzePdf(file) {
  let pdfjsLib, workerUrl;
  try {
    pdfjsLib = await import("pdfjs-dist");
    workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch { return { ok: false }; }
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const meta = await pdf.getMetadata().catch(() => null);
    const info = meta?.info || {};
    const clean = (v) => (v && String(v).trim()) || null;

    // Couche texte : on échantillonne les premières pages ; texte quasi nul =
    // PDF composé d'images (scan/capture) → analyse IA impossible sans OCR.
    let textLen = 0;
    const sample = Math.min(pdf.numPages || 1, 3);
    for (let i = 1; i <= sample; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      textLen += tc.items.reduce((n, it) => n + (it.str ? it.str.trim().length : 0), 0);
    }
    return {
      ok: true,
      author: clean(info.Author),
      producer: clean(info.Producer),
      creator: clean(info.Creator),
      title: clean(info.Title),
      creationDate: parsePdfDate(info.CreationDate),
      hasTextLayer: textLen > 20, // au moins quelques mots
      pages: pdf.numPages,
    };
  } catch { return { ok: false }; }
}
