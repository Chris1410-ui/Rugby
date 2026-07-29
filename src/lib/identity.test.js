import { describe, it, expect } from "vitest";
import { displayName, normalizeInitials, searchNorm, playerMatchesQuery } from "./identity.js";

describe("identity — normalizeInitials", () => {
  it("formate en « I.F. » quelle que soit la saisie", () => {
    expect(normalizeInitials("if")).toBe("I.F.");
    expect(normalizeInitials("I.F.")).toBe("I.F.");
    expect(normalizeInitials("i f")).toBe("I.F.");
    expect(normalizeInitials("I-F")).toBe("I.F.");
  });
  it("une seule lettre → « J. »", () => {
    expect(normalizeInitials("j")).toBe("J.");
  });
  it("vide / non-lettres → chaîne vide", () => {
    expect(normalizeInitials("")).toBe("");
    expect(normalizeInitials("   ")).toBe("");
    expect(normalizeInitials("123")).toBe("");
    expect(normalizeInitials(null)).toBe("");
  });
  it("gère les lettres accentuées", () => {
    expect(normalizeInitials("é.b")).toBe("É.B.");
  });
});

describe("identity — displayName (Totem (I.F.))", () => {
  it("totem + initiales", () => {
    expect(displayName({ name: "Kangourou", initials: "I.F." })).toBe("Kangourou (I.F.)");
  });
  it("sans initiales → totem seul", () => {
    expect(displayName({ name: "Kangourou" })).toBe("Kangourou");
    expect(displayName({ name: "Kangourou", initials: "" })).toBe("Kangourou");
  });
  it("forme (name, initials) séparée", () => {
    expect(displayName("Loup", "A.B.")).toBe("Loup (A.B.)");
  });
  it("valeurs manquantes → chaîne vide (jamais « undefined »)", () => {
    expect(displayName(null)).toBe("");
    expect(displayName({})).toBe("");
  });
});

describe("identity — recherche joueur (insensible casse/accents)", () => {
  it("searchNorm : minuscule, sans accents, alphanumérique", () => {
    expect(searchNorm("Éléonore #10")).toBe("eleonore10");
    expect(searchNorm("I.F.")).toBe("if");
    expect(searchNorm("")).toBe("");
  });

  const p = { name: "Kangourou", initials: "I.F.", num: 10, pos: "pilier" };

  it("match par totem (accents/casse ignorés)", () => {
    expect(playerMatchesQuery(p, "kang")).toBe(true);
    expect(playerMatchesQuery(p, "KANGOUROU")).toBe(true);
    expect(playerMatchesQuery({ ...p, name: "Éléonore" }, "eleo")).toBe(true);
  });
  it("match par initiales, numéro, poste (extra)", () => {
    expect(playerMatchesQuery(p, "if")).toBe(true);      // initiales I.F.
    expect(playerMatchesQuery(p, "10")).toBe(true);      // numéro
    expect(playerMatchesQuery(p, "pilier", "Pilier · Avants")).toBe(true); // poste via extra
  });
  it("requête vide → tout passe ; sans correspondance → faux", () => {
    expect(playerMatchesQuery(p, "")).toBe(true);
    expect(playerMatchesQuery(p, "  ")).toBe(true);
    expect(playerMatchesQuery(p, "zzz")).toBe(false);
  });
});
