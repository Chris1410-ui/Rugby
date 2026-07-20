import { describe, it, expect } from "vitest";
import { playerFilesFolder, uploadPlayerPdf, PLAYER_BUCKET } from "./storage.js";

describe("player-files storage (helpers purs)", () => {
  it("bucket dédié + chemin <team_id>/<player_id>", () => {
    expect(PLAYER_BUCKET).toBe("player-files");
    expect(playerFilesFolder("r_namur", "p-123")).toBe("r_namur/p-123");
  });
  it("uploadPlayerPdf refuse tout non-PDF AVANT tout accès réseau", async () => {
    await expect(uploadPlayerPdf("t", "p", { type: "image/png", name: "x.png" })).rejects.toThrow("PDF_ONLY");
    await expect(uploadPlayerPdf("t", "p", { type: "", name: "x" })).rejects.toThrow("PDF_ONLY");
    await expect(uploadPlayerPdf("t", "p", null)).rejects.toThrow("PDF_ONLY");
  });
  it("uploadPlayerPdf refuse une cible incomplète (owner/staff sans player_id)", async () => {
    const pdf = { type: "application/pdf", name: "prog.pdf" };
    await expect(uploadPlayerPdf(null, "p", pdf)).rejects.toThrow("NO_TARGET");
    await expect(uploadPlayerPdf("t", null, pdf)).rejects.toThrow("NO_TARGET");
    await expect(uploadPlayerPdf(undefined, undefined, pdf)).rejects.toThrow("NO_TARGET");
  });
});
