/* Extraction des SECTIONS-TYPES candidates d'un protocole (`doc = {meta, sections}`).
   Pipeline pur : pour chaque section « signifiante », détecte le type fonctionnel,
   extrait la taxonomie, calcule l'empreinte + le hash de déduplication. Le résultat
   alimente le catalogue du club (data/catalog.js). Rien n'est partagé ici — c'est
   uniquement la normalisation testable. */
import { detectSectionKind } from "./detect.js";
import { extractTaxonomy } from "./taxonomy.js";
import { fingerprint, dedupHash, sectionRefs } from "./fingerprint.js";

// Une section est « signifiante » si elle porte du contenu réutilisable.
export function isMeaningfulSection(section) {
  const s = section || {};
  if (Array.isArray(s.rows)) return s.rows.some((r) => (r?.name || "").trim());
  if (Array.isArray(s.items)) return s.items.some((it) => (typeof it === "string" ? it : it?.name || "").trim());
  if (Array.isArray(s.days)) return s.days.length > 0;
  if (Array.isArray(s.rows) === false && Array.isArray(s.columns)) return s.rows?.length > 0;
  if (typeof s.body === "string") return s.body.trim().length >= 20; // narratif substantiel
  return false;
}

// Libellé de repli quand la section n'a pas de titre (par type fonctionnel).
const KIND_FALLBACK = {
  warmup: "Échauffement", strength: "Renforcement", superset: "Superset",
  cardio: "Cardio", prevention: "Prévention", mobility: "Mobilité",
  recovery: "Récupération", checklist: "Checklist", planning: "Semaine type",
  table: "Tableau", note: "Note", other: "Section",
};

/* Extrait les candidats d'un protocole. Retourne un tableau d'objets :
   { name, kind, sectionType, section, taxonomy, fingerprint, dedupHash }. */
export function extractCandidates(doc, { exerciseIndex } = {}) {
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  const meta = doc?.meta || {};
  const out = [];
  for (const section of sections) {
    if (!isMeaningfulSection(section)) continue;
    const kind = detectSectionKind(section, meta);
    const taxonomy = extractTaxonomy(section, kind, { exerciseIndex });
    const fp = fingerprint(section, kind);
    out.push({
      name: (section.title || "").trim() || KIND_FALLBACK[kind] || "Section",
      kind,
      sectionType: section.type || "narrative",
      section,
      taxonomy,
      fingerprint: fp,
      dedupHash: dedupHash(fp),
      refs: sectionRefs(section),
    });
  }
  return out;
}

/* Déduplication INTERNE d'un lot (un même protocole peut répéter une section) :
   regroupe par dedupHash, garde le 1er, compte les occurrences. Utile avant
   l'écriture pour ne pas incrémenter l'usage plusieurs fois sur un seul import. */
export function dedupeCandidates(candidates) {
  const byHash = new Map();
  for (const c of candidates) {
    const prev = byHash.get(c.dedupHash);
    if (prev) prev.occurrences += 1;
    else byHash.set(c.dedupHash, { ...c, occurrences: 1 });
  }
  return [...byHash.values()];
}
