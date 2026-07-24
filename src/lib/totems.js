/* Totems — pseudonymes affichés à la place du nom réel des joueurs (mineurs).
   Confidentialité : le totem est l'identité visible partout (effectif,
   classement, comparaison, fiche, messagerie). Liste indicative + champ libre.
   Unicité par club : garantie en base (index players_team_name_uq + fonction
   unique_totem, migration 0027). Côté client : suggestions + repli local. */

export const TOTEMS = [
  "Minotaure", "Renard futé", "Sanglier", "Aigle royal", "Bison", "Panthère",
  "Faucon", "Loup gris", "Taureau", "Lynx", "Rhinocéros", "Cobra",
  "Grizzly", "Guépard", "Bélier", "Corbeau", "Requin", "Tigre",
  "Élan", "Blaireau", "Buffle", "Jaguar", "Léopard", "Puma",
  "Gorille", "Hyène", "Ours brun", "Étalon", "Mustang", "Condor",
  "Vautour", "Scorpion", "Python", "Caïman", "Orque", "Griffon",
  "Sphinx", "Wapiti", "Carcajou", "Serval", "Ocelot", "Fennec",
  "Chacal", "Dingo", "Bouquetin", "Mouflon", "Yak", "Léviathan",
  "Aigle noir", "Morse",
];

// Totem aléatoire (avec un index optionnel pour éviter de répéter le même)
export function randomTotem(seedIndex) {
  const i = Number.isInteger(seedIndex)
    ? Math.abs(seedIndex) % TOTEMS.length
    : Math.floor(Math.random() * TOTEMS.length);
  return TOTEMS[i];
}

/* Totem aléatoire DISPONIBLE : le tirage ne pioche QUE parmi les totems non pris
   (insensible casse/espaces). Si la banque est épuisée pour ce club, repli sur
   freeTotem (suffixe numéroté unique) → ne renvoie jamais un totem déjà pris. */
export function randomFreeTotem(taken = []) {
  const used = new Set([...taken].map((x) => String(x).trim().toLowerCase()).filter(Boolean));
  const pool = TOTEMS.filter((x) => !used.has(x.toLowerCase()));
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return freeTotem(taken);
}

/* Renvoie un totem libre par rapport à un ensemble de totems déjà pris
   (comparaison insensible à la casse). Essaie le souhait, puis un totem inutilisé
   de la banque, puis un suffixe numéroté. Miroir client de la fonction SQL
   unique_totem — utilisé pour proposer une alternative sans aller-retour réseau. */
export function freeTotem(taken = [], wanted = "") {
  const used = new Set([...taken].map((t) => String(t).trim().toLowerCase()).filter(Boolean));
  const w = String(wanted).trim();
  if (w && !used.has(w.toLowerCase())) return w;
  for (const t of TOTEMS) {
    if (!used.has(t.toLowerCase())) return t;
  }
  const base = w || "Joueur";
  let i = 2;
  while (used.has(`${base} ${i}`.toLowerCase())) i += 1;
  return `${base} ${i}`;
}

// Le totem est-il déjà pris dans l'effectif (insensible à la casse) ?
export function isTotemTaken(taken = [], wanted = "") {
  const w = String(wanted).trim().toLowerCase();
  if (!w) return false;
  return [...taken].some((t) => String(t).trim().toLowerCase() === w);
}
