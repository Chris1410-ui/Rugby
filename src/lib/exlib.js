/* Constantes bibliothèque d'exercices + helpers programmes (portés du prototype). */
import { C } from "./tokens.js";
import i18n from "../i18n/config.js";

export const EXCATS = ["Force", "Puissance", "Vitesse", "Prévention", "Conditionnement", "Mobilité"];
export const EXCATC = {
  Force: C.coral,
  Puissance: C.viol,
  Vitesse: C.blue,
  Prévention: C.green,
  Conditionnement: C.amb,
  Mobilité: C.teal,
};

// Ordre des jours de la semaine (valeurs getDay(), lundi → dimanche). Le libellé
// n'est plus stocké ici : il est traduit à l'affichage via wdLabel (data.weekday.*).
export const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const wdLabel = (v) => i18n.t(`data.weekday.wd${v}`);

let _c = 0;
export const newExo = () => ({
  id: `e${Date.now().toString(36)}${_c++}`,
  name: "",
  sets: 3,
  reps: "8",
  charge: "",
  rest: 90,
  video: "",
});

// clé normalisée d'un exercice (pour retrouver les cues)
export const exKey = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
