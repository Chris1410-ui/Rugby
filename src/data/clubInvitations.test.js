import { describe, it, expect, beforeEach } from "vitest";
import { createClubInvitation, inviteLink, isMinor, storePendingInvite, readPendingInvite, clearPendingInvite } from "./clubInvitations.js";

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

describe("invitation en attente (persistance token — filet d'acceptation)", () => {
  // Stub localStorage (environnement Node des tests data/).
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    clearPendingInvite();
  });

  it("store → read restitue token + payload", () => {
    storePendingInvite("tok123", { birthdate: "2000-01-01", consent: true });
    expect(readPendingInvite()).toEqual({ token: "tok123", payload: { birthdate: "2000-01-01", consent: true } });
  });
  it("staff : payload vide par défaut", () => {
    storePendingInvite("tokStaff");
    expect(readPendingInvite()).toEqual({ token: "tokStaff", payload: {} });
  });
  it("clear supprime l'invitation en attente", () => {
    storePendingInvite("tok");
    clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });
  it("ne stocke rien sans token (no-op)", () => {
    storePendingInvite("", { a: 1 });
    expect(readPendingInvite()).toBeNull();
  });
  it("read tolère un stockage vide/corrompu", () => {
    localStorage.setItem("pending_club_invite", "{pas du json");
    expect(readPendingInvite()).toBeNull();
  });
});
