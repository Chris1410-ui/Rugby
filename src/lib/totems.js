/* Totems — pseudonymes affichés à la place du nom réel des joueurs (mineurs).
   Confidentialité : le totem est l'identité visible partout (effectif,
   classement, comparaison, fiche, messagerie). Liste indicative + champ libre. */

export const TOTEMS = [
  "Minotaure", "Renard futé", "Sanglier", "Aigle royal", "Bison", "Panthère",
  "Faucon", "Loup gris", "Taureau", "Lynx", "Rhinocéros", "Cobra",
  "Grizzly", "Guépard", "Bélier", "Corbeau", "Requin", "Tigre",
  "Élan", "Blaireau", "Buffle", "Jaguar",
];

// Totem aléatoire (avec un index optionnel pour éviter de répéter le même)
export function randomTotem(seedIndex) {
  const i = Number.isInteger(seedIndex)
    ? Math.abs(seedIndex) % TOTEMS.length
    : Math.floor(Math.random() * TOTEMS.length);
  return TOTEMS[i];
}
