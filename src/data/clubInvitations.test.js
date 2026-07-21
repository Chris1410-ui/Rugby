import { describe, it, expect } from "vitest";
import { createClubInvitation, inviteLink } from "./clubInvitations.js";

describe("invitations de club (helpers)", () => {
  it("refuse une cible incomplète AVANT tout accès réseau", async () => {
    await expect(createClubInvitation(null, { role: "coach" })).rejects.toThrow("NO_TARGET");
    await expect(createClubInvitation("r_namur", { role: "" })).rejects.toThrow("NO_TARGET");
  });
  it("une invitation joueur exige une carte roster (player_id)", async () => {
    await expect(createClubInvitation("r_namur", { role: "joueur" })).rejects.toThrow("PLAYER_REQUIRED");
  });
  it("inviteLink construit un lien ?invite=<token>", () => {
    const prev = globalThis.window;
    globalThis.window = { location: { origin: "https://app.test" } };
    expect(inviteLink("abc123")).toBe("https://app.test/?invite=abc123");
    globalThis.window = prev;
  });
});
