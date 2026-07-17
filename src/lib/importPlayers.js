/* Import Excel/CSV — logique PURE (parsing tolérant + aperçu create/update).
   Aucune écriture ici : buildPreview() produit un plan relu par le staff avant
   toute écriture (cf. data/importer.js). Réutilise postes (positions.js) et
   l'unicité des totems (totems.js / migration 0027). */

import { RUGBY_POS } from "./positions.js";
import { freeTotem } from "./totems.js";

/* Colonnes du modèle (ordre = modèle téléchargeable + aperçu).
   `metric: true` → va dans test_results ; sinon → identité (players). */
export const IMPORT_COLUMNS = [
  { key: "name", header: "Totem" },
  { key: "num", header: "Numéro" },
  { key: "pos", header: "Poste" },
  { key: "grp", header: "Ligne" },
  { key: "club", header: "Club" },
  { key: "mas", header: "MAS (m/s)", metric: true, type: "num" },
  { key: "bronco", header: "Bronco", metric: true, type: "text" },
  { key: "yoyo", header: "Yo-Yo IR (m)", metric: true, type: "num" },
  { key: "squat_5rm", header: "Squat 5RM", metric: true, type: "text" },
  { key: "bench_5rm", header: "Bench 5RM (kg)", metric: true, type: "num" },
  { key: "deadlift", header: "Deadlift (kg)", metric: true, type: "num" },
  { key: "hang_clean_2rm", header: "Hang Clean 2RM (kg)", metric: true, type: "num" },
  { key: "tractions", header: "Tractions (+kg)", metric: true, type: "num" },
  { key: "cmj_overall", header: "CMJ (cm)", metric: true, type: "num" },
  { key: "bodyweight", header: "Poids (kg)", metric: true, type: "num" },
];

export const METRIC_KEYS = IMPORT_COLUMNS.filter((c) => c.metric).map((c) => c.key);

// Normalise un en-tête / libellé : minuscule, sans accent, alphanumérique seul.
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Variantes d'en-têtes acceptées (déjà normalisées) par colonne canonique.
const ALIASES = {
  name: ["totem", "pseudo", "nom", "joueur", "name"],
  num: ["numero", "num", "n", "no", "maillot", "dossard", "number"],
  pos: ["poste", "position", "pos"],
  grp: ["ligne", "groupe", "grp", "categorie"],
  club: ["club"],
  mas: ["mas", "vma"],
  bronco: ["bronco"],
  yoyo: ["yoyo", "yoyoir", "yoyoir1", "yoyoir2"],
  squat_5rm: ["squat", "squat5rm", "backsquat"],
  bench_5rm: ["bench", "bench5rm", "benchpress", "developpecouche", "dc"],
  deadlift: ["deadlift", "souleveedeterre", "sdt"],
  hang_clean_2rm: ["hangclean", "hangclean2rm", "epaulejete"],
  tractions: ["tractions", "traction", "pullup", "pullups", "tractionslestees"],
  cmj_overall: ["cmj", "cmjoverall", "detente"],
  bodyweight: ["poids", "poidsdecorps", "bodyweight", "masse", "pdc", "bw"],
};

// Toutes les paires (alias, key), triées par alias décroissant (pour startsWith).
const ALIAS_PAIRS = Object.entries(ALIASES)
  .flatMap(([key, list]) => list.map((a) => ({ a, key })))
  .sort((x, y) => y.a.length - x.a.length);

/* Associe les en-têtes réels du fichier → colonnes canoniques.
   `headers` = tableau des en-têtes bruts. Renvoie { [key]: headerBrut }. */
export function mapHeaders(headers = []) {
  const map = {};
  const used = new Set();
  const normed = headers.map((h) => ({ raw: h, n: norm(h) }));
  // Passe 1 : égalité exacte (lève l'ambiguïté masse↔mas avant startsWith).
  normed.forEach(({ raw, n }) => {
    if (!n || used.has(raw)) return;
    const hit = ALIAS_PAIRS.find((p) => p.a === n);
    if (hit && !map[hit.key]) { map[hit.key] = raw; used.add(raw); }
  });
  // Passe 2 : préfixe (gère les suffixes d'unité « (m/s) », « (kg) »…).
  normed.forEach(({ raw, n }) => {
    if (!n || used.has(raw)) return;
    const hit = ALIAS_PAIRS.find((p) => n.startsWith(p.a) && !map[p.key]);
    if (hit) { map[hit.key] = raw; used.add(raw); }
  });
  return map;
}

// Décimale tolérante : « 4,72 » ou « 4.72 » → 4.72 ; sinon null.
export function parseDecimal(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Synonymes courts de postes → index RUGBY_POS.
const POS_SYNONYMS = {
  pilierg: 0, pilliergauche: 0, pilier1: 0,
  talonneur: 1, talon: 1, hooker: 1,
  pilierd: 2, pilierdroit: 2, pilier3: 2,
  deuxiemeligne: 3, secondeligne: 3, deuxligne: 3, lock: 3, serreur: 3,
  troisiemeligneaile: 4, flanker: 4, flank: 4, aile: 4, troisiemeaile: 4,
  troisiemelignecentre: 5, n8: 5, numero8: 5, huit: 5, troisiemecentre: 5,
  demidemelee: 6, melee: 6, scrumhalf: 6, neuf: 6, demi9: 6,
  demidouverture: 7, ouvreur: 7, ouverture: 7, flyhalf: 7, dix: 7, demi10: 7,
  ailier: 8, wing: 8, winger: 8,
  troisquartscentre: 9, centre: 9, treisquartcentre: 9, center: 9,
  arriere: 10, fullback: 10, quinze: 10,
};

/* Résout un poste écrit librement → { pos (nom exact), grp } ou null.
   Essaie : synonyme court, puis correspondance de sous-chaîne sur le nom. */
export function matchPoste(str) {
  const n = norm(str);
  if (!n) return null;
  if (POS_SYNONYMS[n] != null) { const p = RUGBY_POS[POS_SYNONYMS[n]]; return { pos: p.name, grp: p.grp }; }
  const p = RUGBY_POS.find((rp) => { const rn = norm(rp.name); return rn === n || rn.includes(n) || n.includes(rn); });
  return p ? { pos: p.name, grp: p.grp } : null;
}

// Résout une ligne écrite librement → 'avants' | 'arrieres' | null.
export function matchGrp(str) {
  const n = norm(str);
  if (!n) return null;
  if (n.startsWith("avant") || n === "fwd" || n.startsWith("pack")) return "avants";
  if (n.startsWith("arrier") || n.startsWith("back") || n.startsWith("trois")) return "arrieres";
  return null;
}

/* Construit le plan d'import (create/update) à partir des lignes brutes du
   fichier (objets en-tête→valeur, cf. SheetJS) et de l'effectif existant.
   NE FAIT AUCUNE ÉCRITURE. Renvoie { rows, counts, columnMap }.
   Chaque row : { index, action, matchId, name(résolu), num, pos, grp, club,
   metrics, warnings[], errors[], hasData }. */
export function buildPreview(rawRows = [], roster = []) {
  const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
  const columnMap = mapHeaders(headers);
  const get = (row, key) => (columnMap[key] != null ? row[columnMap[key]] : undefined);
  const cell = (row, key) => { const v = get(row, key); return v == null ? "" : String(v).trim(); };

  const byName = new Map();
  const byNum = new Map();
  roster.forEach((p) => {
    if (p.name) byName.set(p.name.trim().toLowerCase(), p);
    if (p.num != null) byNum.set(String(p.num), p);
  });

  // Totems occupés (effectif + créations déjà planifiées) → unicité intra-fichier.
  const taken = roster.map((p) => p.name).filter(Boolean);
  const seenNameKeys = new Set();

  const rows = rawRows.map((raw, index) => {
    const warnings = [];
    const errors = [];
    const wantedName = cell(raw, "name");
    const numStr = cell(raw, "num").replace(/[^\d]/g, "");
    const num = numStr ? parseInt(numStr, 10) : null;

    // Clé d'appariement : totem sinon numéro.
    let match = null;
    if (wantedName) match = byName.get(wantedName.toLowerCase()) || null;
    if (!match && num != null) match = byNum.get(String(num)) || null;

    // Poste / ligne (ligne = override si fournie).
    const posMatch = matchPoste(cell(raw, "pos"));
    const grpOverride = matchGrp(cell(raw, "grp"));
    const grp = grpOverride || posMatch?.grp || null;
    const pos = posMatch?.pos || null;
    if (cell(raw, "pos") && !posMatch) warnings.push(`Poste « ${cell(raw, "pos")} » non reconnu`);
    if (cell(raw, "grp") && !grpOverride) warnings.push(`Ligne « ${cell(raw, "grp")} » non reconnue`);

    // Métriques fournies (colonnes optionnelles absentes = ignorées).
    const metrics = {};
    let hasData = false;
    IMPORT_COLUMNS.filter((c) => c.metric).forEach((c) => {
      const rawv = cell(raw, c.key);
      if (rawv === "") return;
      if (c.type === "num") {
        const v = parseDecimal(rawv);
        if (v == null) { warnings.push(`${c.header} : « ${rawv} » ignoré (nombre attendu)`); return; }
        metrics[c.key] = v;
      } else {
        metrics[c.key] = rawv;
      }
      hasData = true;
    });

    const club = cell(raw, "club") || null;

    // Ligne vide (ni totem, ni numéro) → erreur.
    if (!wantedName && num == null) {
      errors.push("Ni totem ni numéro — ligne ignorée");
      return { index, action: "error", matchId: null, name: wantedName, num, pos, grp, club, metrics, warnings, errors, hasData: false };
    }

    if (match) {
      // Doublon intra-fichier ciblant le même joueur.
      const nk = `id:${match.id}`;
      if (seenNameKeys.has(nk)) warnings.push("Doublon dans le fichier (même joueur)");
      seenNameKeys.add(nk);
      return { index, action: "update", matchId: match.id, name: match.name, num, pos, grp, club, metrics, warnings, errors, hasData };
    }

    // Création : il faut un totem ET un poste résolu (sinon erreur).
    if (!wantedName) { errors.push("Création impossible sans totem (numéro seul non trouvé)"); }
    if (!pos || !grp) { errors.push("Création impossible sans poste valide"); }
    if (errors.length) {
      return { index, action: "error", matchId: null, name: wantedName, num, pos, grp, club, metrics, warnings, errors, hasData: false };
    }
    // Totem unique par club (propose un alternatif si déjà pris).
    const resolved = freeTotem([...taken], wantedName);
    if (resolved.toLowerCase() !== wantedName.toLowerCase()) warnings.push(`Totem « ${wantedName} » déjà pris → « ${resolved} »`);
    taken.push(resolved);
    return { index, action: "create", matchId: null, name: resolved, num, pos, grp, club, metrics, warnings, errors, hasData };
  });

  const counts = {
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    errors: rows.filter((r) => r.action === "error").length,
    warnings: rows.reduce((a, r) => a + r.warnings.length, 0),
  };
  return { rows, counts, columnMap };
}
