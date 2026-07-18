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
