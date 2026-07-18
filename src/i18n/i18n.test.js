import { describe, it, expect, beforeEach } from "vitest";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";
import { setLocaleTag, localeTag } from "./locale.js";

// Aplatis un objet imbriqué en clés « a.b.c » (pour comparer les catalogues).
const flatKeys = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  ).sort();

describe("i18n — catalogues FR/EN/NL", () => {
  const kFr = flatKeys(fr);

  it("les 3 langues ont EXACTEMENT le même jeu de clés (aucune traduction manquante)", () => {
    expect(flatKeys(en)).toEqual(kFr);
    expect(flatKeys(nl)).toEqual(kFr);
  });

  it("aucune valeur vide", () => {
    const empties = (obj) => flatKeys(obj).filter((path) => {
      const val = path.split(".").reduce((o, k) => o?.[k], obj);
      return !String(val ?? "").trim();
    });
    expect(empties(fr)).toEqual([]);
    expect(empties(en)).toEqual([]);
    expect(empties(nl)).toEqual([]);
  });

  it("l'interpolation {{email}} est présente dans les 3 langues où le FR l'utilise", () => {
    for (const cat of [fr, en, nl]) {
      expect(cat.shell.profileNotFoundBody).toContain("{{email}}");
      expect(cat.shell.profileIncompleteBody).toContain("{{email}}");
    }
  });
});

describe("i18n — locale BCP47 (dates)", () => {
  beforeEach(() => setLocaleTag("fr"));

  it("mappe la langue → locale régionale", () => {
    setLocaleTag("fr"); expect(localeTag()).toBe("fr-BE");
    setLocaleTag("en"); expect(localeTag()).toBe("en-GB");
    setLocaleTag("nl"); expect(localeTag()).toBe("nl-BE");
  });

  it("langue inconnue → repli fr-BE", () => {
    setLocaleTag("xx");
    expect(localeTag()).toBe("fr-BE");
  });
});
