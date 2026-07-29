/* Identité affichée d'un joueur = TOTEM + INITIALES, jamais le nom complet.
   L'app ne connaît que le totem (players.name) et les initiales saisies par le
   joueur (players.initials). La correspondance totem → nom civil vit uniquement
   dans un fichier Excel du staff, hors application.

   Rendu : « Totem (I.F.) » si des initiales existent, sinon « Totem » seul. */

// Normalise des initiales saisies (« i.f », « I F » → « I.F. »). Vide → "".
export function normalizeInitials(raw) {
  const letters = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-ZÀ-Ÿ]/g, "");        // ne garde que les lettres
  if (!letters) return "";
  return letters.split("").join(".") + ".";   // « IF » → « I.F. »
}

// Libellé affiché partout : accepte un objet joueur { name, initials } OU
// (name, initials) séparés. Tolérant aux valeurs manquantes.
export function displayName(playerOrName, initials) {
  const isObj = playerOrName && typeof playerOrName === "object";
  const name = String((isObj ? playerOrName.name : playerOrName) ?? "").trim();
  const ini = String((isObj ? playerOrName.initials : initials) ?? "").trim();
  if (!name) return "";
  return ini ? `${name} (${ini})` : name;
}

/* Normalisation de recherche : minuscule, sans accents, alphanumérique seul.
   « Éléonore #10 » → « eleonore10 ». Rend la recherche insensible à la casse et
   aux accents ; les séparateurs (points d'initiales, espaces, #) sont ignorés. */
export const searchNorm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/* Un joueur correspond-il à la requête ? Cherche dans totem + initiales + numéro,
   plus un texte additionnel `extra` (libellés poste/ligne, déjà traduits par
   l'appelant). Requête vide → vrai (aucun filtre). PUR. */
export function playerMatchesQuery(p, query, extra = "") {
  const q = searchNorm(query);
  if (!q) return true;
  const hay = searchNorm([p?.name, p?.initials, p?.num, extra].filter((x) => x != null && x !== "").join(" "));
  return hay.includes(q);
}
