import { describe, it, expect } from "vitest";
import { parsePath, resolvePlayerDoc, applySlotOverrides, overrideConflicts } from "./overrides.js";

const socle = () => ({
  meta: { weeks: 3, title: "Nuque" },
  sections: [
    {
      id: "s1", type: "exercises", title: "Force", weekLabels: ["S1", "S2", "S3"],
      rows: [
        { id: "r1", name: "Back Squat", rest: "90", weeks: [{ text: "5x5" }, { text: "5x4" }, { text: "5x3" }] },
        { id: "r2", name: "Bench", rest: "90", weeks: [{ text: "5x5" }, { text: "5x5" }, { text: "5x5" }] },
      ],
    },
    { id: "s2", type: "narrative", title: "Notes", body: "socle" },
  ],
});

describe("parsePath", () => {
  it("décode toutes les formes", () => {
    expect(parsePath("sec/s1")).toEqual({ kind: "section", sectionId: "s1" });
    expect(parsePath("sec/s1/row/r2")).toEqual({ kind: "row", sectionId: "s1", rowId: "r2" });
    expect(parsePath("sec/s1/add")).toEqual({ kind: "addRow", sectionId: "s1" });
    expect(parsePath("add/section")).toEqual({ kind: "addSection" });
    expect(parsePath("slot/Cardio & Course")).toEqual({ kind: "slot", slotKey: "Cardio & Course" });
    expect(parsePath("garbage")).toEqual({ kind: "unknown" });
  });
});

describe("resolvePlayerDoc — socle → surcharge (préséance)", () => {
  it("sans surcharge → le socle normalisé, aucun chemin marqué", () => {
    const { doc, overriddenPaths, orphans } = resolvePlayerDoc(socle(), []);
    expect(doc.sections).toHaveLength(2);
    expect(overriddenPaths.size).toBe(0);
    expect(orphans).toEqual([]);
  });

  it("patch d'une ligne (nom + repos) → la surcharge l'emporte", () => {
    const { doc, overriddenPaths } = resolvePlayerDoc(socle(), [
      { path: "sec/s1/row/r1", op: "patch", value: { name: "Front Squat", rest: "120" } },
    ]);
    const r1 = doc.sections[0].rows[0];
    expect(r1.name).toBe("Front Squat");
    expect(r1.rest).toBe("120");
    expect(overriddenPaths.has("sec/s1/row/r1")).toBe(true);
  });

  it("patch d'UNE cellule de semaine → les autres colonnes intactes", () => {
    const { doc } = resolvePlayerDoc(socle(), [
      { path: "sec/s1/row/r1", op: "patch", value: { weeks: { 1: { text: "5x2 @80%" } } } },
    ]);
    expect(doc.sections[0].rows[0].weeks.map((c) => c.text)).toEqual(["5x5", "5x2 @80%", "5x3"]);
  });

  it("remove d'une ligne / d'une section", () => {
    const r = resolvePlayerDoc(socle(), [{ path: "sec/s1/row/r2", op: "remove", value: {} }]);
    expect(r.doc.sections[0].rows.map((x) => x.id)).toEqual(["r1"]);
    const r2 = resolvePlayerDoc(socle(), [{ path: "sec/s2", op: "remove", value: {} }]);
    expect(r2.doc.sections.map((s) => s.id)).toEqual(["s1"]);
  });

  it("add d'une ligne perso", () => {
    const { doc, overriddenPaths } = resolvePlayerDoc(socle(), [
      { path: "sec/s1/add", op: "add", value: { id: "rX", name: "Gainage", weeks: [{ text: "60s" }] } },
    ]);
    expect(doc.sections[0].rows.map((r) => r.id)).toEqual(["r1", "r2", "rX"]);
    expect(overriddenPaths.has("sec/s1/add")).toBe(true);
  });

  it("surcharge ORPHELINE (ligne inexistante au socle) → ignorée + listée", () => {
    const { doc, orphans } = resolvePlayerDoc(socle(), [
      { path: "sec/s1/row/ZZZ", op: "patch", value: { name: "X" } },
    ]);
    expect(doc.sections[0].rows).toHaveLength(2); // inchangé
    expect(orphans).toEqual(["sec/s1/row/ZZZ"]);
  });

  it("ne mute PAS le socle d'entrée", () => {
    const src = socle();
    resolvePlayerDoc(src, [{ path: "sec/s1/row/r1", op: "patch", value: { name: "Muté ?" } }]);
    expect(src.sections[0].rows[0].name).toBe("Back Squat");
  });

  it("surcharge de jour → slotOverrides (hors doc)", () => {
    const { slotOverrides, overriddenPaths } = resolvePlayerDoc(socle(), [
      { path: "slot/Force", op: "patch", value: { weekday: 3 } },
    ]);
    expect(slotOverrides).toEqual({ Force: { weekday: 3 } });
    expect(overriddenPaths.has("slot/Force")).toBe(true);
  });
});

describe("applySlotOverrides", () => {
  it("applique le weekday perso au bon créneau", () => {
    const slots = [{ label: "Force", weekday: 1 }, { label: "Cardio", weekday: 4 }];
    expect(applySlotOverrides(slots, { Force: { weekday: 3 } })).toEqual([
      { label: "Force", weekday: 3 }, { label: "Cardio", weekday: 4 },
    ]);
  });
});

describe("overrideConflicts — édition du socle vs surcharges (PR-4)", () => {
  it("conflit si le socle change au chemin surchargé, sinon rien", () => {
    const oldD = socle();
    const newD = socle();
    newD.sections[0].rows[0].weeks[0].text = "6x6"; // le coach change r1/S1 au socle
    const ovs = [
      { path: "sec/s1/row/r1", playerId: "p1", op: "patch", value: { name: "Front Squat" } }, // conflit
      { path: "sec/s1/row/r2", playerId: "p1", op: "patch", value: { rest: "60" } },           // pas de changement socle
    ];
    expect(overrideConflicts(oldD, newD, ovs)).toEqual([{ path: "sec/s1/row/r1", playerId: "p1" }]);
  });
});
