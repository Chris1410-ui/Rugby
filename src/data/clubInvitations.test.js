import { describe, it, expect } from "vitest";
import { createClubInvitation, inviteLink, isMinor } from "./clubInvitations.js";

describe("invitations de club (helpers)", () => {
  it("refuse une cible incomplète AVANT tout accès réseau", async () => {
    await expect(createClubInvitation(null, { role: "coach" })).rejects.toThrow("NO_TARGET");
    await expect(createClubInvitation("r_namur", { role: "" })).rejects.toThrow("NO_TARGET");
  });
  it("une invitation joueur exige une carte roster (player_id)", async () => {
    await expect(createClubInvitation("r_namur", { role: "joueur" })).rejects.toThrow("PLAYER_REQUIRED");
  });
  it("isMinor : < 18 ans = mineur, ≥ 18 ans = majeur", () => {
    const y = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
    expect(isMinor(y(15))).toBe(true);
    expect(isMinor(y(25))).toBe(false);
    expect(isMinor("")).toBe(true); // prudence tant que non saisi
  });
  it("inviteLink construit un lien ?invite=<token>", () => {
    const prev = globalThis.window;
    globalThis.window = { location: { origin: "https://app.test" } };
    expect(inviteLink("abc123")).toBe("https://app.test/?invite=abc123");
    globalThis.window = prev;
  });
});
