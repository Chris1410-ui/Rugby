/* Questionnaires — banque de questions de base + types + helpers d'affichage.
   Pur (aucun accès réseau) → testable. Les réponses sont des données santé
   sensibles : jamais injectées dans le moteur de points / la comparaison. */

export const QTYPES = {
  scale:  { label: "Échelle 1–10" },
  yesno:  { label: "Oui / Non" },
  choice: { label: "Choix multiple" },
  text:   { label: "Texte" },
  number: { label: "Nombre" },
  repeat: { label: "Liste répétable" },
};

export const QCATS = [
  { key: "physique", label: "État physique" },
  { key: "mental", label: "État mental" },
  { key: "blessures", label: "Blessures précédentes" },
  { key: "entrainement", label: "Entraînement" },
  { key: "vie", label: "Mode de vie" },
];

// Banque réutilisable (ids stables → réponses cohérentes d'un envoi à l'autre).
export const QUESTION_BANK = [
  { id: "ressenti", cat: "physique", type: "scale", label: "Ressenti physique" },
  { id: "poids", cat: "physique", type: "number", label: "Poids", unit: "kg" },
  { id: "taille", cat: "physique", type: "number", label: "Taille", unit: "cm" },
  { id: "douleurs", cat: "physique", type: "text", label: "Douleurs / gênes (zone + description)" },

  { id: "moral", cat: "mental", type: "scale", label: "Moral" },
  { id: "stress", cat: "mental", type: "scale", label: "Stress" },
  { id: "sommeil", cat: "mental", type: "scale", label: "Qualité de sommeil habituelle" },

  { id: "blessures", cat: "blessures", type: "repeat", label: "Blessures précédentes", fields: [
    { key: "type", label: "Type", type: "text" },
    { key: "zone", label: "Zone", type: "text" },
    { key: "annee", label: "Année", type: "number" },
    { key: "opere", label: "Opéré ?", type: "yesno" },
    { key: "sequelles", label: "Séquelles", type: "text" },
  ] },

  { id: "salle_sem", cat: "entrainement", type: "number", label: "Séances de salle / semaine" },
  { id: "autres_sports", cat: "entrainement", type: "text", label: "Autres sports pratiqués" },

  { id: "alcool", cat: "vie", type: "choice", label: "Alcool", options: ["Jamais", "Occasionnel", "Hebdomadaire", "Quotidien"] },
  { id: "alcool_qte", cat: "vie", type: "text", label: "Alcool — quantité (optionnel)" },
  { id: "tabac", cat: "vie", type: "yesno", label: "Tabac (optionnel)" },
];

export const bankById = Object.fromEntries(QUESTION_BANK.map((q) => [q.id, q]));

// Identifiant de question (custom). crypto au runtime navigateur ; repli simple.
export const newQid = () => (globalThis.crypto?.randomUUID?.() || `q${Math.random().toString(36).slice(2, 10)}`);

// Valeur → texte lisible (affichage staff + CSV). Gère tous les types.
// `t` (i18next, optionnel) traduit les valeurs oui/non ; sans lui, repli FR.
// Les libellés de questions/champs (q.label / f.label) restent des données.
export function formatAnswer(q, val, t) {
  const yes = t ? t("common.yes") : "Oui";
  const no = t ? t("common.no") : "Non";
  if (val == null || val === "") return "";
  switch (q.type) {
    case "yesno": return val === true || val === "oui" ? yes : val === false || val === "non" ? no : String(val);
    case "scale": return `${val}/10`;
    case "number": return `${val}${q.unit ? " " + q.unit : ""}`;
    case "repeat": {
      const rows = Array.isArray(val) ? val : [];
      if (!rows.length) return "—";
      return rows.map((r) => (q.fields || []).map((f) => {
        const v = r?.[f.key];
        if (v == null || v === "") return null;
        return `${f.label}: ${f.type === "yesno" ? (v === true || v === "oui" ? yes : no) : v}`;
      }).filter(Boolean).join(", ")).join(" | ");
    }
    default: return String(val);
  }
}

const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;

// CSV : lignes = joueurs, colonnes = questions (+ statut). `rows` = [{ name, statut, reponses }].
// `t` = i18next : colonnes fixes et statut traduits (les libellés de questions
// restent des données saisies).
export function questionnaireCSV(questionnaire, rows, t) {
  const qs = questionnaire.questions || [];
  const header = [t("csv.questionnaire.player"), t("csv.questionnaire.status"), ...qs.map((q) => q.label)];
  const lines = [header.map(csvCell).join(",")];
  (rows || []).forEach((r) => {
    const cells = [r.name, r.statut === "rempli" ? t("csv.questionnaire.filled") : t("csv.questionnaire.pending"),
      ...qs.map((q) => formatAnswer(q, (r.reponses || {})[q.id], t))];
    lines.push(cells.map(csvCell).join(","));
  });
  return lines.join("\r\n");
}
