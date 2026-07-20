import { describe, it, expect } from "vitest";
import { mapHeaders, parseDecimal, matchPoste, matchGrp, buildPreview } from "./importPlayers.js";

describe("mapHeaders — matching tolérant (accents / unités / variantes)", () => {
  it("reconnaît en-têtes avec unités et ponctuation", () => {
    const m = mapHeaders(["Totem", "N°", "Poste", "Ligne", "MAS (m/s)", "Yo-Yo IR (m)", "Poids (kg)", "Squat 5RM"]);
    expect(m.name).toBe("Totem");
    expect(m.num).toBe("N°");
    expect(m.pos).toBe("Poste");
    expect(m.grp).toBe("Ligne");
    expect(m.mas).toBe("MAS (m/s)");
    expect(m.yoyo).toBe("Yo-Yo IR (m)");
    expect(m.bodyweight).toBe("Poids (kg)");
    expect(m.squat_5rm).toBe("Squat 5RM");
  });
  it("ne confond pas « masse » (poids) avec « mas »", () => {
    const m = mapHeaders(["Masse", "MAS"]);
    expect(m.bodyweight).toBe("Masse");
    expect(m.mas).toBe("MAS");
  });
});

describe("parseDecimal — virgule ou point", () => {
  it("accepte les deux séparateurs", () => {
    expect(parseDecimal("4,72")).toBe(4.72);
    expect(parseDecimal("4.72")).toBe(4.72);
    expect(parseDecimal(" 18 ")).toBe(18);
    expect(parseDecimal("")).toBe(null);
    expect(parseDecimal("abc")).toBe(null);
  });
});

describe("matchPoste / matchGrp", () => {
  it("résout des postes écrits librement + déduit la ligne", () => {
    expect(matchPoste("Ouvreur")).toEqual({ pos: "Demi d'ouverture", grp: "arrieres" });
    expect(matchPoste("pilier gauche").grp).toBe("avants");
    expect(matchPoste("flanker").grp).toBe("avants");
    expect(matchPoste("inconnu xyz")).toBe(null);
  });
  it("résout la ligne (override)", () => {
    expect(matchGrp("Avants")).toBe("avants");
    expect(matchGrp("arrières")).toBe("arrieres");
    expect(matchGrp("")).toBe(null);
  });
});

describe("buildPreview — plan create/update sans écriture", () => {
  const roster = [{ id: "p1", name: "Aigle royal", num: 5 }];

  it("met à jour un joueur existant (clé totem) et parse ses tests", () => {
    const { rows, counts } = buildPreview([{ Totem: "aigle royal", "MAS (m/s)": "4,5", "Poids (kg)": "98" }], roster);
    expect(counts.update).toBe(1);
    expect(rows[0].action).toBe("update");
    expect(rows[0].matchId).toBe("p1");
    expect(rows[0].metrics).toEqual({ mas: 4.5, bodyweight: 98 });
  });

  it("crée un nouveau joueur avec poste → ligne déduite", () => {
    const { rows, counts } = buildPreview([{ Totem: "Nouveau", Poste: "Ouvreur" }], roster);
    expect(counts.create).toBe(1);
    expect(rows[0]).toMatchObject({ action: "create", pos: "Demi d'ouverture", grp: "arrieres" });
  });

  it("propose un totem alternatif en cas de collision à la création", () => {
    const { rows } = buildPreview([
      { Totem: "Faucon", Poste: "Ailier" },
      { Totem: "Faucon", Poste: "Ailier" },
    ], roster);
    expect(rows[0].name).toBe("Faucon");
    expect(rows[1].name).not.toBe("Faucon");
    expect(rows[1].warnings.join()).toMatch(/déjà pris/);
  });

  it("erreur si ligne vide ou création sans poste", () => {
    const { rows, counts } = buildPreview([
      { "MAS (m/s)": "4" },                 // ni totem ni numéro
      { Totem: "SansPoste" },               // création sans poste
    ], roster);
    expect(counts.errors).toBe(2);
    expect(rows[0].action).toBe("error");
    expect(rows[1].action).toBe("error");
  });

  it("apparie par numéro quand le totem est absent", () => {
    const { rows } = buildPreview([{ "N°": "5", "CMJ (cm)": "42" }], roster);
    expect(rows[0].action).toBe("update");
    expect(rows[0].matchId).toBe("p1");
    expect(rows[0].metrics).toEqual({ cmj_overall: 42 });
  });
});

describe("i18n — en-têtes & valeurs traduits (EN/NL) reconnus", () => {
  it("mapHeaders reconnaît les en-têtes EN du modèle", () => {
    const m = mapHeaders(["Totem", "Number", "Position", "Line", "Weight (kg)", "Pull-ups (+kg)"]);
    expect(m.num).toBe("Number");
    expect(m.pos).toBe("Position");
    expect(m.grp).toBe("Line");
    expect(m.bodyweight).toBe("Weight (kg)");
    expect(m.tractions).toBe("Pull-ups (+kg)");
  });
  it("mapHeaders reconnaît les en-têtes NL du modèle", () => {
    const m = mapHeaders(["Nummer", "Positie", "Linie", "Gewicht (kg)"]);
    expect(m.num).toBe("Nummer");
    expect(m.pos).toBe("Positie");
    expect(m.grp).toBe("Linie");
    expect(m.bodyweight).toBe("Gewicht (kg)");
  });
  it("matchPoste résout les noms EN/NL → nom canonique FR (valeur stockée)", () => {
    expect(matchPoste("Number 8").pos).toBe("Troisième ligne centre (n°8)");
    expect(matchPoste("Fullback").pos).toBe("Arrière");
    expect(matchPoste("Vleugel").pos).toBe("Ailier");   // NL
    expect(matchPoste("Hoeker").pos).toBe("Talonneur"); // NL
  });
  it("matchGrp résout les lignes EN/NL", () => {
    expect(matchGrp("Forwards")).toBe("avants");
    expect(matchGrp("Backs")).toBe("arrieres");
    expect(matchGrp("Voorwaartsen")).toBe("avants");     // NL
    expect(matchGrp("Achterspelers")).toBe("arrieres");  // NL
  });
  it("buildPreview : modèle EN rempli → poste canonique FR stocké", () => {
    const { rows, counts } = buildPreview([{ Totem: "NouvelEN", Position: "Fly-half", Line: "Backs" }], []);
    expect(counts.create).toBe(1);
    expect(rows[0]).toMatchObject({ action: "create", pos: "Demi d'ouverture", grp: "arrieres" });
  });
});

describe("import — POSTE CONSERVÉ (joueur existant jamais écrasé)", () => {
  const roster = [{ id: "p1", name: "Lion", num: 5, pos: "Pilier gauche", grp: "avants" }];

  it("update : garde le poste/ligne du joueur, ignore le fichier (reconnu)", () => {
    const { rows } = buildPreview([{ Totem: "Lion", Poste: "Ailier", Ligne: "Arrières" }], roster);
    const r = rows[0];
    expect(r.action).toBe("update");
    expect(r.pos).toBe("Pilier gauche");   // valeur du joueur, PAS « Ailier »
    expect(r.grp).toBe("avants");           // pas « arrieres »
    expect(r.posKept).toBe(true);
    expect(r.warnings.some((w) => /Poste conservé/.test(w))).toBe(true);
  });

  it("update : poste fichier NON reconnu ou vide → toujours conservé, aucun blocage/alerte", () => {
    const bad = buildPreview([{ Totem: "Lion", Poste: "ZZZ" }], roster).rows[0];
    expect(bad.action).toBe("update");
    expect(bad.pos).toBe("Pilier gauche");
    expect(bad.errors).toEqual([]);                       // jamais bloqué pour motif de poste
    expect(bad.warnings.some((w) => /non reconnu/.test(w))).toBe(false); // pas d'alerte poste sur un existant

    const empty = buildPreview([{ Totem: "Lion" }], roster).rows[0];
    expect(empty.action).toBe("update");
    expect(empty.pos).toBe("Pilier gauche");
  });
});
