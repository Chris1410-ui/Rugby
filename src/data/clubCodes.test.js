import { describe, it, expect } from "vitest";
import { joinLink } from "./clubCodes.js";

describe("clubCodes — joinLink", () => {
  it("construit un lien ?join=<code> sur l'origine courante", () => {
    const prev = globalThis.window;
    globalThis.window = { location: { origin: "https://app.test" } };
    expect(joinLink("ABC123")).toBe("https://app.test/?join=ABC123");
    globalThis.window = prev;
  });
});
