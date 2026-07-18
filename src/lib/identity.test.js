import { describe, it, expect } from "vitest";
import { displayName, normalizeInitials } from "./identity.js";

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
