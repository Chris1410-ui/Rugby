import { describe, it, expect } from "vitest";
import { createStaffInvite, inviteLink } from "./staffInvites.js";

describe("invitations staff (helpers)", () => {
  it("createStaffInvite refuse une cible incomplète AVANT tout accès réseau", async () => {
    await expect(createStaffInvite(null, { role: "coach" })).rejects.toThrow("NO_TARGET");
    await expect(createStaffInvite("r_namur", { role: "" })).rejects.toThrow("NO_TARGET");
  });
  it("inviteLink construit un lien ?invite=<token>", () => {
    const prev = globalThis.window;
    globalThis.window = { location: { origin: "https://app.test" } };
    expect(inviteLink("abc123")).toBe("https://app.test/?invite=abc123");
    globalThis.window = prev;
  });
});
