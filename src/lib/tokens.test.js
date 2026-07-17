import { describe, it, expect } from "vitest";
import { isProfileComplete, isStaffRole } from "./tokens.js";

describe("isProfileComplete", () => {
  it("owner est complet même sans team_id ni player_id", () => {
    expect(isProfileComplete({ role: "owner", team_id: null, player_id: null })).toBe(true);
  });

  it("joueur exige team_id ET player_id", () => {
    expect(isProfileComplete({ role: "joueur", team_id: "t1", player_id: "p1" })).toBe(true);
    expect(isProfileComplete({ role: "joueur", team_id: "t1", player_id: null })).toBe(false);
    expect(isProfileComplete({ role: "joueur", team_id: null, player_id: "p1" })).toBe(false);
  });

  it("staff exige team_id (player_id facultatif)", () => {
    expect(isStaffRole("medical")).toBe(true);
    expect(isProfileComplete({ role: "medical", team_id: "t1", player_id: null })).toBe(true);
    expect(isProfileComplete({ role: "preparateur", team_id: null })).toBe(false);
    expect(isProfileComplete({ role: "coach", team_id: "t1" })).toBe(true);
  });

  it("profil absent, sans rôle ou rôle inconnu → incomplet", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
    expect(isProfileComplete({ team_id: "t1" })).toBe(false);
    expect(isProfileComplete({ role: "wizard", team_id: "t1" })).toBe(false);
  });
});
