/* Routine du matin du staff-athlète — logique pure (testable).
   La liste et le shake ne sont PAS codés en dur dans l'UI : ces constantes ne
   servent que de SEED (valeurs par défaut pré-remplies) à la première ouverture ;
   ensuite tout est éditable et stocké par athlète (athlete_routine). */

const uid = (p) => `${p}${Math.random().toString(36).slice(2, 8)}`;

// Items de routine par défaut (cases à cocher + horaires indicatifs), éditables.
export const DEFAULT_ROUTINE_ITEMS = () => [
  { id: uid("it"), label: "Réveil · dents · tenue", time: "4h50–5h00" },
  { id: uid("it"), label: "Shake + créatine + protéine", time: "5h00–5h30" },
  { id: uid("it"), label: "Séance salle (jambes lun/mer/ven/dim · haut mar/jeu/sam)", time: "5h30–7h00" },
  { id: uid("it"), label: "Admin + plan de la journée", time: "7h00–7h30" },
  { id: uid("it"), label: "Petit-déjeuner (œufs, crêpes + confiture)", time: "" },
  { id: uid("it"), label: "Hydratation", time: "" },
  { id: uid("it"), label: "5 min de méditation / recentrage", time: "" },
  { id: uid("it"), label: "Prises alimentaires réparties (≥ 500 g, ~1/3 sur la journée)", time: "" },
  { id: uid("it"), label: "Étirements + échauffement élastique", time: "tous les jours" },
];

// Shake du matin par défaut (quantités éditables + protéines par unité).
export const DEFAULT_SHAKE = () => [
  { id: uid("sh"), label: "Miel", qty: 4, unit: "cc", proteinPer: 0 },
  { id: uid("sh"), label: "Banane", qty: 1, unit: "", proteinPer: 1.3 },
  { id: uid("sh"), label: "Cacao", qty: 2, unit: "càs", proteinPer: 1 },
  { id: uid("sh"), label: "Créatine", qty: 5, unit: "g", proteinPer: 0 },
  { id: uid("sh"), label: "Protéine", qty: 30, unit: "g", proteinPer: 0.8 },
];

// Total protéines du shake (g) = Σ quantité × protéines/unité. Null-safe.
export function shakeProtein(shake) {
  return Math.round((shake || []).reduce((a, x) => a + (Number(x?.qty) || 0) * (Number(x?.proteinPer) || 0), 0));
}

// Routine « complétée » = tous les items cochés (déclenche le +10). `checked` =
// liste d'ids cochés ; `items` = config courante.
export function routineComplete(checked, items) {
  const done = new Set(checked || []);
  const list = items || [];
  return list.length > 0 && list.every((it) => done.has(it.id));
}
