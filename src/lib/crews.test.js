import { describe, it, expect } from "vitest";
import { CREW_BANNERS, bannerOf, bannerGradient, randomBannerKey } from "./crews.js";

describe("crews banners", () => {
  it("bannerOf retombe sur une bannière valide pour une clé inconnue", () => {
    expect(bannerOf("nope")).toBe(CREW_BANNERS[0]);
    expect(bannerOf("flame").key).toBe("flame");
  });
  it("bannerGradient produit un dégradé CSS", () => {
    expect(bannerGradient("wave")).toMatch(/^linear-gradient/);
  });
  it("randomBannerKey renvoie toujours une clé du jeu prédéfini", () => {
    const keys = new Set(CREW_BANNERS.map((b) => b.key));
    for (let i = 0; i < 40; i++) {
      expect(keys.has(randomBannerKey())).toBe(true);
    }
  });
  it("les clés de bannière sont uniques", () => {
    const keys = CREW_BANNERS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
