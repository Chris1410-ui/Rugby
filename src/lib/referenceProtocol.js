/* Protocole de référence du staff-athlète (pré-chargé à la demande).
   Split hebdomadaire : Jambes lun/mer/ven/dim, Haut du corps mar/jeu/sam,
   méthode pyramidale 12/10 (séries dégressives en reps, charge montante).
   Ces constantes ne servent que de MODÈLE : une fois chargé, le protocole
   devient un programme normal (séances matérialisées), entièrement éditable.
   Rien n'est codé en dur côté UI — tout passe par createProgram. */

// getDay() : 0 = dimanche … 6 = samedi.
export const REF_METHOD = "12/10"; // pyramidale : 12 → 10 → 8 → 6 reps, charge montante
const PYRAMID = { sets: 4, reps: "12/10/8/6", rest: 120 };

// Bas du corps — force + hypertrophie, appuis lourds.
export const REF_JAMBES = [
  { name: "Squat barre", ...PYRAMID },
  { name: "Presse à cuisses", sets: 4, reps: "12/10/8/6", rest: 90 },
  { name: "Soulevé de terre roumain", sets: 4, reps: "10/10/8/8", rest: 120 },
  { name: "Fentes marchées haltères", sets: 3, reps: "12/12/10", rest: 90 },
  { name: "Leg curl (ischios)", sets: 3, reps: "12/10/10", rest: 75 },
  { name: "Mollets debout", sets: 4, reps: "15/15/12/12", rest: 60 },
];

// Haut du corps — poussée / tirage équilibrés.
export const REF_HAUT = [
  { name: "Développé couché", ...PYRAMID },
  { name: "Tractions pronation", sets: 4, reps: "12/10/8/6", rest: 120 },
  { name: "Développé militaire", sets: 4, reps: "12/10/8/6", rest: 90 },
  { name: "Rowing barre", sets: 4, reps: "12/10/8/6", rest: 90 },
  { name: "Dips", sets: 3, reps: "12/10/8", rest: 90 },
  { name: "Curl biceps + extensions triceps", sets: 3, reps: "12/12/10", rest: 60 },
];

/* Modèles par jour de semaine (weekday = getDay()). Le titre/nature restent
   génériques ; le contenu est le split ci-dessus. Alterne Jambes / Haut :
   - Jambes : lundi(1), mercredi(3), vendredi(5), dimanche(0)
   - Haut   : mardi(2), jeudi(4), samedi(6) */
export const REF_TEMPLATES = [
  ...[1, 3, 5, 0].map((weekday) => ({
    weekday, code: "RS", nature: "force", titre: "Jambes", exercises: REF_JAMBES,
  })),
  ...[2, 4, 6].map((weekday) => ({
    weekday, code: "RS", nature: "force", titre: "Haut du corps", exercises: REF_HAUT,
  })),
];
