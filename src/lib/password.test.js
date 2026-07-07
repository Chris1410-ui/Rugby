import { describe, it, expect } from "vitest";
import { pwdStrength } from "./password.js";

describe("pwdStrength — robustesse mot de passe", () => {
  it("rejette un mot de passe faible", () => {
    const r = pwdStrength("azerty");
    expect(r.valid).toBe(false);
  });
  it("rejette un mot de passe courant même complexe", () => {
    const r = pwdStrength("Rugby2026!");
    expect(r.checks.notCommon).toBe(false);
    expect(r.valid).toBe(false);
  });
  it("accepte un mot de passe fort (10+, casse, chiffre, spécial, non courant)", () => {
    const r = pwdStrength("Tigres!Belg7k");
    expect(r.valid).toBe(true);
    expect(r.checks.len && r.checks.upper && r.checks.lower && r.checks.digit && r.checks.special).toBe(true);
  });
});
