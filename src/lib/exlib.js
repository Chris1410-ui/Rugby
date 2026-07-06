/* Constantes bibliothèque d'exercices + helpers programmes (portés du prototype). */
import { C } from "./tokens.js";

export const EXCATS = ["Force", "Puissance", "Vitesse", "Prévention", "Conditionnement", "Mobilité"];
export const EXCATC = {
  Force: C.coral,
  Puissance: C.viol,
  Vitesse: C.blue,
  Prévention: C.green,
  Conditionnement: C.amb,
  Mobilité: C.teal,
};

// Jours de la semaine ([valeur getDay(), label])
export const WD = [
  [1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [0, "Dim"],
];
export const wdLabel = (v) => (WD.find((w) => w[0] === v) || [])[1] || "";

let _c = 0;
export const newExo = () => ({
  id: `e${Date.now().toString(36)}${_c++}`,
  name: "",
  sets: 3,
  reps: "8",
  charge: "",
  rest: 90,
});

// clé normalisée d'un exercice (pour retrouver les cues)
export const exKey = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
