import { describe, it, expect } from "vitest";
import { buildReportModel, clubLabel } from "./wellnessReport.js";

const t = (k, opts) => (opts && "count" in opts ? `${opts.count} ${k}` : k);

describe("buildReportModel", () => {
  const roster = [
    { id: "p1", name: "Lion", initials: "B.R." },
    { id: "p2", name: "Aigle", initials: "M.D." },
    { id: "p3", name: "Ours", initials: "T.W." },
  ];
  const byId = Object.fromEntries(roster.map((p) => [p.id, p]));
  const selDate = "2026-11-06";
  const rows = [
    { playerId: "p1", date: selDate, createdAt: "2026-11-06T06:40:00Z", wb: { sleep: 8, fatigue: 2, stress: 3, mood: 9, genWell: 7, willTrain: 6, rpePrev: 4, remark: "mal au cou" } },
    { playerId: "p2", date: selDate, createdAt: "2026-11-06T06:20:00Z", wb: { sleep: 3, fatigue: 8, stress: 8, mood: 3, genWell: 3 } },
    { playerId: "p1", date: "2026-11-05", createdAt: "2026-11-05T06:30:00Z", wb: { sleep: 7, fatigue: 3, stress: 3, mood: 8, genWell: 6 } },
  ];
  const civilNames = { p1: "LION ROUX" };

  const m = buildReportModel({ roster, byId, rows, selDate, civilNames, teamId: "r_u18", t });

  it("KPIs : réponses, wellness, à surveiller", () => {
    expect(m.kpis.responses).toBe(2);
    expect(m.kpis.total).toBe(3);
    expect(m.kpis.wellness).toBe(5); // mean(7,3)
    expect(m.kpis.watch).toBeGreaterThanOrEqual(1); // p2 faible + p1 remarque
  });

  it("répondants triés par heure, nom civil si connu", () => {
    expect(m.responders.map((r) => r.name)).toEqual(["Aigle", "LION ROUX"]); // p2 (06:20) avant p1 (06:40)
    expect(m.responders[1].time).toMatch(/\d{2}[:h]\d{2}/);
  });

  it("non-répondants = effectif sans bilan du jour", () => {
    expect(m.missing.map((x) => x.name)).toEqual(["Ours"]);
  });

  it("alertes incluent le joueur faible et celui avec remarque", () => {
    const names = m.alerts.map((a) => a.name);
    expect(names).toContain("Aigle");
    expect(names).toContain("LION ROUX");
    expect(m.alerts.find((a) => a.name === "LION ROUX").remark).toBe("mal au cou");
  });

  it("tendance chronologique sur les jours présents", () => {
    expect(m.trend.map((d) => d.date)).toEqual(["2026-11-05", "2026-11-06"]);
  });

  it("profil : 7 marqueurs dont RPE marqué", () => {
    expect(m.profile).toHaveLength(7);
    expect(m.profile.at(-1).rpe).toBe(true);
  });

  it("clubLabel résout le libellé du club", () => {
    expect(typeof clubLabel("r_u18")).toBe("string");
  });
});
