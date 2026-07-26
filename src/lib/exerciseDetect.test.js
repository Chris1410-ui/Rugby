import { describe, it, expect } from "vitest";
import { extractExerciseCandidates } from "./exerciseDetect.js";

/* Le détecteur isole des PHRASES candidates entre les mots-outils (consignes,
   articles, unités). Il ne matche pas la bibliothèque — c'est best-effort et
   confirmé ensuite par le staff. On vérifie surtout qu'il ne perd pas les mots
   intérieurs utiles (« de ») et qu'il jette le bruit pur. */
describe("extractExerciseCandidates", () => {
  it("isole les exercices séparés par des mots-outils", () => {
    const c = extractExerciseCandidates("Peux-tu renseigner ton squat et ton développé couché stp");
    expect(c).toContain("squat");
    expect(c).toContain("développé couché");
  });

  it("préserve « de » à l'intérieur d'un nom composé", () => {
    const c = extractExerciseCandidates("complète ton soulevé de terre avant vendredi");
    expect(c).toContain("soulevé de terre");
  });

  it("gère une liste séparée par des virgules", () => {
    const c = extractExerciseCandidates("Squat, Bench, Deadlift");
    expect(c).toEqual(["squat", "bench", "deadlift"]);
  });

  it("ne renvoie rien quand le message n'est que des mots-outils / unités", () => {
    expect(extractExerciseCandidates("merci de faire vos 1RM cette semaine")).toEqual([]);
    expect(extractExerciseCandidates("renseignez vos max svp")).toEqual([]);
  });

  it("déduplique et borne le nombre de candidats", () => {
    const c = extractExerciseCandidates("squat, squat, squat");
    expect(c).toEqual(["squat"]);
    const many = extractExerciseCandidates(Array.from({ length: 30 }, (_, i) => `mouvementx${i}`).join(", "));
    expect(many.length).toBeLessThanOrEqual(12);
  });

  it("tronque un segment trop long et ignore le bruit purement numérique", () => {
    expect(extractExerciseCandidates("100 120 90")).toEqual([]);
    const c = extractExerciseCandidates("gainage ventral latéral dynamique contrôlé lent");
    expect(c[0].split(" ").length).toBeLessThanOrEqual(4);
  });
});
