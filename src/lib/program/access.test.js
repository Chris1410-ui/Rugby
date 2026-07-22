import { describe, it, expect } from "vitest";
import { canReadProgram, canEditProgram } from "./access.js";

describe("protocole — canReadProgram", () => {
  it("owner : lecture partout, tous clubs, même brouillon", () => {
    expect(canReadProgram({ role: "owner", requesterTeamId: null, programTeamId: "T1", status: "draft" })).toBe(true);
  });
  it("staff : brouillons + publiés de SON club", () => {
    expect(canReadProgram({ role: "coach", requesterTeamId: "T1", programTeamId: "T1", status: "draft" })).toBe(true);
    expect(canReadProgram({ role: "preparateur", requesterTeamId: "T1", programTeamId: "T1", status: "published" })).toBe(true);
  });
  it("staff : rien d'un autre club", () => {
    expect(canReadProgram({ role: "medical", requesterTeamId: "T1", programTeamId: "T2", status: "published" })).toBe(false);
  });
  it("joueur : seulement les publiés de son club", () => {
    expect(canReadProgram({ role: "joueur", requesterTeamId: "T1", programTeamId: "T1", status: "published" })).toBe(true);
    expect(canReadProgram({ role: "joueur", requesterTeamId: "T1", programTeamId: "T1", status: "draft" })).toBe(false);
    expect(canReadProgram({ role: "joueur", requesterTeamId: "T1", programTeamId: "T2", status: "published" })).toBe(false);
  });
  it("sans club : refusé", () => {
    expect(canReadProgram({ role: "joueur", requesterTeamId: null, programTeamId: "T1", status: "published" })).toBe(false);
  });
});

describe("protocole — canEditProgram", () => {
  it("owner : édition partout", () => {
    expect(canEditProgram({ role: "owner", requesterTeamId: null, programTeamId: "T9" })).toBe(true);
  });
  it("prépa / médical : édition sur SON club", () => {
    expect(canEditProgram({ role: "preparateur", requesterTeamId: "T1", programTeamId: "T1" })).toBe(true);
    expect(canEditProgram({ role: "medical", requesterTeamId: "T1", programTeamId: "T1" })).toBe(true);
  });
  it("coach : lecture seule → pas d'édition", () => {
    expect(canEditProgram({ role: "coach", requesterTeamId: "T1", programTeamId: "T1" })).toBe(false);
  });
  it("joueur : pas d'édition", () => {
    expect(canEditProgram({ role: "joueur", requesterTeamId: "T1", programTeamId: "T1" })).toBe(false);
  });
  it("écrivain d'un autre club : refusé", () => {
    expect(canEditProgram({ role: "preparateur", requesterTeamId: "T1", programTeamId: "T2" })).toBe(false);
  });
});
