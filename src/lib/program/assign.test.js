import { describe, it, expect } from "vitest";
import { isTargeted, applicableTo, isVisibleToPlayer, mergeTargets } from "./assign.js";

const team = { scope: "team", track: "Base", targets: [{ label: "Séances", value: "4" }] };
const avants = { scope: "group", groupKey: "avants", track: "Puissance", targets: [{ label: "Distance", value: "40-70 m" }, { label: "Palier Yo-Yo", value: "15.5" }] };
const arrieres = { scope: "group", groupKey: "arrieres", track: "Vitesse", targets: [{ label: "Distance", value: "50-90 m" }] };
const joueur = { scope: "player", playerId: "P1", track: "Vitesse+", targets: [{ label: "Palier Yo-Yo", value: "18.5" }] };

describe("assign — isTargeted", () => {
  it("faux si uniquement team", () => { expect(isTargeted([team])).toBe(false); });
  it("vrai dès qu'un groupe/joueur est ciblé", () => { expect(isTargeted([team, avants])).toBe(true); });
  it("vrai avec un joueur", () => { expect(isTargeted([joueur])).toBe(true); });
});

describe("assign — applicableTo", () => {
  it("un avant reçoit team + groupe avants, pas arrières", () => {
    const a = applicableTo([team, avants, arrieres], { playerId: "P9", group: "avants" });
    expect(a).toContain(team); expect(a).toContain(avants); expect(a).not.toContain(arrieres);
  });
  it("un joueur ciblé reçoit son assignation perso", () => {
    const a = applicableTo([arrieres, joueur], { playerId: "P1", group: "arrieres" });
    expect(a).toContain(joueur); expect(a).toContain(arrieres);
  });
});

describe("assign — isVisibleToPlayer", () => {
  it("collectif (aucune cible) → visible par tous", () => {
    expect(isVisibleToPlayer([team], { playerId: "PX", group: "avants" })).toBe(true);
    expect(isVisibleToPlayer([], { playerId: "PX", group: "avants" })).toBe(true);
  });
  it("ciblé avants → un arrière ne le voit pas", () => {
    expect(isVisibleToPlayer([avants], { playerId: "PX", group: "arrieres" })).toBe(false);
    expect(isVisibleToPlayer([avants], { playerId: "PX", group: "avants" })).toBe(true);
  });
  it("ciblé joueur → seul ce joueur le voit", () => {
    expect(isVisibleToPlayer([joueur], { playerId: "P1", group: "arrieres" })).toBe(true);
    expect(isVisibleToPlayer([joueur], { playerId: "P2", group: "arrieres" })).toBe(false);
  });
  it("une assignation team au milieu de cibles rend visible à tous", () => {
    expect(isVisibleToPlayer([team, avants], { playerId: "PX", group: "arrieres" })).toBe(true);
  });
});

describe("assign — mergeTargets (précédence joueur > groupe > club)", () => {
  it("fusionne et laisse le plus spécifique gagner", () => {
    const { track, items } = mergeTargets([team, arrieres, joueur], { playerId: "P1", group: "arrieres" });
    expect(track).toBe("Vitesse+"); // joueur l'emporte
    const yo = items.find((i) => i.label === "Palier Yo-Yo");
    expect(yo.value).toBe("18.5"); // joueur écrase le groupe
    const dist = items.find((i) => i.label === "Distance");
    expect(dist.value).toBe("50-90 m"); // vient du groupe arrières
    expect(items.find((i) => i.label === "Séances").value).toBe("4"); // du club
  });
  it("aucune applicable → cibles vides", () => {
    const r = mergeTargets([avants], { playerId: "PX", group: "arrieres" });
    expect(r.items).toHaveLength(0); expect(r.track).toBe("");
  });
});
