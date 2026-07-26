/* Détection best-effort d'exercices dans un message texte libre (staff → joueur).
   PURE + testable. On NE décide PAS ici de la correspondance bibliothèque : on
   extrait des PHRASES CANDIDATES que l'appelant confronte ensuite à
   search_exercises (fuzzy serveur) et fait CONFIRMER au staff avant envoi. Aucun
   exercice n'est inventé — au pire on propose une phrase qui ne matchera rien.

   Méthode : on découpe le message sur des mots « outils » (verbes de consigne,
   articles, unités, « 1RM/5RM »…) qui ne font jamais partie d'un nom d'exercice,
   ce qui isole des segments = noms candidats. Les mots INTÉRIEURS utiles (« de »
   dans « soulevé de terre ») sont préservés. */

// Mots-outils = séparateurs de segments (jamais un nom d'exercice à eux seuls).
// Volontairement SANS « de » (fait partie de « soulevé de terre »).
const FILLER = new Set([
  // consignes / politesse
  "renseigne", "renseigner", "renseignez", "complete", "completer", "completez", "complète", "complétez", "compléter",
  "fais", "faire", "faites", "envoie", "envoyer", "envoyez", "donne", "donner", "donnez", "teste", "tester", "testez",
  "peux", "peut", "pouvez", "merci", "stp", "svp", "salut", "bonjour", "coucou", "hello", "besoin", "veux", "veuillez",
  // possessifs / articles / liaisons
  "ton", "ta", "tes", "mon", "ma", "mes", "vos", "votre", "notre", "nos", "le", "la", "les", "un", "une",
  "des", "du", "au", "aux", "et", "ou", "pour", "avec", "sur", "dans", "ce", "cette", "ces", "que", "qui",
  // temps / contexte séance
  "avant", "apres", "après", "semaine", "seance", "séance", "seances", "séances", "entrainement", "entraînement",
  "prochain", "prochaine", "aujourdhui", "demain", "vendredi", "lundi", "mardi", "mercredi", "jeudi", "samedi", "dimanche",
  // mesure / unités
  "1rm", "5rm", "rm", "max", "maxi", "maximum", "kg", "kilos", "charge", "charges", "poids", "rep", "reps", "repetitions", "répétitions",
]);

const MAX_WORDS = 4;   // un nom d'exercice tient en ≤ 4 mots
const MAX_CANDIDATES = 12;
const HAS_LETTER = /[a-zàâäçéèêëîïôöùûüœ]/i;

// Séparateurs FORTS de segments (liste, ponctuation de fin) → chaque élément est
// un candidat distinct. La ponctuation faible (tiret, apostrophe) devient espace.
function toSegments(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[,;/\n\r.!?•·:]+/g, "|")     // forts → coupe
    .replace(/[^0-9a-zàâäçéèêëîïôöùûüœ|]+/gi, " ") // faibles → espace
    .split("|");
}

/* Renvoie une liste de phrases candidates (dédupliquées, ordre d'apparition).
   Chaque candidat fait ≥ 3 caractères, contient au moins une lettre, et compte
   au plus MAX_WORDS mots. L'appelant les passe à search_exercises pour proposer
   des correspondances à confirmer par le staff. */
export function extractExerciseCandidates(text, { max = MAX_CANDIDATES } = {}) {
  const out = [];
  const seen = new Set();

  const push = (words) => {
    if (!words.length) return;
    const phrase = words.slice(0, MAX_WORDS).join(" ");
    if (phrase.length < 3 || !HAS_LETTER.test(phrase) || seen.has(phrase)) return;
    seen.add(phrase);
    out.push(phrase);
  };

  for (const seg of toSegments(text)) {
    let run = [];
    for (const tk of seg.split(/\s+/).filter(Boolean)) {
      if (FILLER.has(tk)) { push(run); run = []; }
      else run.push(tk);
    }
    push(run);
  }

  return out.slice(0, max);
}
