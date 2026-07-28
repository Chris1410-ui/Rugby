/* Protocole de référence du staff-athlète (pré-chargé à la demande).
   Split hebdomadaire : Jambes lun/mer/ven + Jambes·PR le dimanche, Haut du corps
   mar/jeu/sam. Méthode pyramidale 12/10 (montée jusqu'à ~100 %, puis 80 % en 4×10),
   PR le dimanche. Les charges listées sont des CIBLES littérales : elles
   pré-remplissent la série 1 (cf. initSetLikeSets), sans dépendre d'un 1RM.

   Ces constantes ne servent que de MODÈLE : une fois chargé via createProgram, le
   protocole devient un programme normal (séances matérialisées), entièrement
   éditable. Rien n'est codé en dur côté UI.

   NB matérialisation : createProgram → cleanExos ne conserve que
   { name, sets, reps, charge, rest, video } — d'où le choix de charges littérales
   (pas de setPlan/@% ici, qui seraient perdus dans ce chemin). */

// getDay() : 0 = dimanche … 6 = samedi.
export const REF_METHOD = "12/10"; // pyramidale : montée 12→10→8→6 vers ~100 %
export const REF_METHOD_LABEL = "Pyramidal 12/10 · montée ~100 % puis 4×10 @80 % · PR le dimanche";
const PYR = { sets: 4, reps: "12/10/8/6", rest: 120 }; // montée pyramidale vers la cible

// Haut du corps (mar/jeu/sam) — poussée / tirage, charges cibles en kg.
export const REF_HAUT = [
  { name: "Développé couché", ...PYR, charge: 100 },
  { name: "Tirage dos", sets: 4, reps: "20", rest: 90 },
  { name: "Tractions (100 reps < 13 min)", sets: 1, reps: "100", rest: 120 },
  { name: "Biceps haltères", sets: 4, reps: "12/10/8/6", charge: 50, rest: 60 },
  { name: "Triceps haltères", sets: 4, reps: "12/10/8/6", charge: 50, rest: 60 },
  { name: "Shoulder press", ...PYR, charge: 100, rest: 90 },
  { name: "Élévations épaules haltères", sets: 4, reps: "12/10/8/6", charge: 50, rest: 60 },
  { name: "Finition poulie", sets: 3, reps: "20", rest: 45 },
];

// Bas du corps (lun/mer/ven/dim) — appuis lourds, charges cibles en kg.
export const REF_JAMBES = [
  { name: "Leg press", ...PYR, charge: 250 },
  { name: "Squat lourd", sets: 4, reps: "12/10/8/6", charge: 200, rest: 150 },
  { name: "Bulgarian split squat", sets: 3, reps: "12/10/8", charge: 100, rest: 90 },
  { name: "Deadlift", sets: 4, reps: "12/10/8/6", charge: 200, rest: 150 },
  { name: "Ischios (leg curl)", sets: 4, reps: "12/10/8/6", charge: 200, rest: 75 },
  { name: "Mollets", sets: 4, reps: "15/12/12/10", charge: 200, rest: 60 },
  { name: "Finition machine", sets: 3, reps: "20", rest: 45 },
];

/* Modèles par jour de semaine (weekday = getDay()). Jambes lun(1)/mer(3)/ven(5),
   Jambes·PR dim(0) — séance de records —, Haut du corps mar(2)/jeu(4)/sam(6). */
export const REF_TEMPLATES = [
  ...[1, 3, 5].map((weekday) => ({ weekday, code: "RS", nature: "force", titre: "Jambes", exercises: REF_JAMBES })),
  { weekday: 0, code: "RS", nature: "force", titre: "Jambes · PR", exercises: REF_JAMBES },
  ...[2, 4, 6].map((weekday) => ({ weekday, code: "RS", nature: "force", titre: "Haut du corps", exercises: REF_HAUT })),
];

/* Séances du protocole regroupées pour l'AFFICHAGE (vue joueur). `key` → libellé
   traduit ; `days` = jours getDay() de la séance. Le contenu vient des mêmes
   constantes que REF_TEMPLATES (source unique). Le dimanche (0) reste dans le
   groupe « jambes » côté affichage, avec l'emphase PR portée par le titre. */
export const REF_WORKOUTS = [
  { key: "jambes", days: [1, 3, 5, 0], exercises: REF_JAMBES },
  { key: "haut", days: [2, 4, 6], exercises: REF_HAUT },
];

// Ordonne des jours getDay() en semaine lundi → dimanche (0 = dimanche → fin).
export function orderWeekdays(days = []) {
  return [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
}
