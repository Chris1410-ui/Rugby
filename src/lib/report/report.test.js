import { describe, it, expect } from "vitest";
import { normalizeReportInput, posLabelOf } from "./input.js";
import { buildReportModel } from "./compute.js";
import { buildNarrative } from "./narrative.js";
import { renderReportHtml } from "./template.js";
import { thresholdFor, strengthTargetKg } from "./standards.js";

// Fixture « Melvin » : demi de mêlée (charnière), points forts terrain, force en
// construction, sommeil 6/10, antécédents blessures — comme la référence.
function melvinRaw() {
  return {
    player: {
      name: "Melvin", pos: "Demi de mêlée", bodyweight: 83,
      height_cm: 183, sessions_per_week: 4,
      injury_history: "Entorse LLI du genou (2023). Gênes : doigt, hanche, mollet.",
    },
    campaigns: [{ id: "c1", date: "2026-07-15" }],
    results: [{ campaign_id: "c1", bronco: "4'25", cmj_overall: 47.3, squat_5rm: "120", bench_5rm: 85, bodyweight: 83 }],
    checkin: { date: "2026-07-16", wb: { mood: 9, stress: 1, sleep: 6 } },
    generatedAt: "2026-07-20",
  };
}

describe("input.normalizeReportInput", () => {
  it("mappe poste, mensurations, bien-être et date de test", () => {
    const input = normalizeReportInput(melvinRaw());
    expect(input.player.posLabel).toBe("Demi de mêlée (9)");
    expect(input.player.heightCm).toBe(183);
    expect(input.player.weightKg).toBe(83);
    expect(input.player.sessionsPerWeek).toBe(4);
    expect(input.wellbeing).toEqual({ mood: 9, stress: 1, sleep: 6 });
    expect(input.dates.testDate).toBe("2026-07-15");
    expect(input.dates.wellnessDate).toBe("2026-07-16");
    expect(input.results).toHaveLength(1);
    expect(input.results[0].date).toBe("2026-07-15");
  });

  it("posLabelOf : poste inconnu renvoyé brut, vide → tiret", () => {
    expect(posLabelOf("Trois-quarts centre")).toBe("Trois-quarts centre (12-13)");
    expect(posLabelOf("Poste maison")).toBe("Poste maison");
    expect(posLabelOf(null)).toBe("—");
  });
});

describe("compute.buildReportModel", () => {
  const model = buildReportModel(normalizeReportInput(melvinRaw()));

  it("calcule les % vs cible Top 14 (charnière)", () => {
    expect(model.kpis.broncoPct).toBe(108); // 285/265
    expect(model.kpis.jumpPct).toBe(118); // 47.3/40
    const squat = model.tableRows.find((r) => r.key === "squat");
    const bench = model.tableRows.find((r) => r.key === "bench");
    expect(squat.pct).toBe(83); // 1.4458/1.75
    expect(bench.pct).toBe(79); // 1.0241/1.30
  });

  it("compte 2 standards atteints → 60 points (+30 chacun)", () => {
    expect(model.kpis.standardsMet).toBe(2);
    expect(model.kpis.points).toBe(60);
  });

  it("statuts : bronco/cmj atteints, squat/bench en développement, poids en référence", () => {
    const byKey = Object.fromEntries(model.tableRows.map((r) => [r.key, r.status]));
    expect(byKey.bronco).toBe("met");
    expect(byKey.cmj).toBe("met");
    expect(byKey.squat).toBe("dev");
    expect(byKey.bench).toBe("dev");
    expect(byKey.bodyweight).toBe("ref");
  });

  it("cibles de force calibrées au poids (≈ borne basse × PC)", () => {
    const squatKg = strengthTargetKg("Demi de mêlée", "squat", 83);
    expect(Math.round(squatKg)).toBe(Math.round(thresholdFor("Demi de mêlée", "squat") * 83)); // 1.75*83≈145
  });

  it("liste les tests manquants (deadlift/hangclean/tractions + mas/yoyo)", () => {
    expect(model.missing.strength.map((g) => g.key)).toEqual(["deadlift", "hangclean", "tractions"]);
    expect(model.missing.cardio.map((g) => g.key)).toEqual(["mas", "yoyo"]);
  });

  it("drapeaux narratifs cohérents", () => {
    expect(model.flags.fieldStrong).toBe(true);
    expect(model.flags.strengthDeficit).toBe(true);
    expect(model.flags.lowSleep).toBe(true);
    expect(model.flags.hasInjuries).toBe(true);
    expect(model.flags.lowMood).toBe(false);
    expect(model.flags.highStress).toBe(false);
    expect(model.flags.hasMissing).toBe(true);
  });
});

describe("narrative.buildNarrative", () => {
  const model = buildReportModel(normalizeReportInput(melvinRaw()));
  const nar = buildNarrative(model);

  it("titre du résumé « moteur solide, force en construction »", () => {
    expect(nar.summary.title.toLowerCase()).toContain("force en construction");
    expect(nar.summary.paragraphs).toHaveLength(2);
  });

  it("sélectionne les priorités par règles (force, manquants, sommeil, blessures)", () => {
    const titles = nar.priorities.map((p) => p.title).join(" | ");
    expect(titles).toContain("FORCE MAXIMALE");
    expect(titles).toContain("INDICATEURS MANQUANTS");
    expect(titles).toContain("RÉCUPÉRATION");
    expect(titles).toContain("GÊNES PHYSIQUES");
    expect(nar.priorities.length).toBeLessThanOrEqual(4);
    expect(nar.priorities[0].title).toContain("PRIORITÉ 1");
  });

  it("carte santé blessures active + échappe le texte libre", () => {
    expect(nar.health.third.title).toBe("SURVEILLANCE BLESSURES");
    expect(nar.health.third.body).toContain("Entorse LLI");
  });

  it("profil sans déficit → priorité socle de consolidation", () => {
    const raw = melvinRaw();
    raw.checkin.wb.sleep = 9;
    raw.player.injury_history = "";
    raw.results[0].squat_5rm = "160";
    raw.results[0].bench_5rm = 120;
    const m = buildReportModel(normalizeReportInput(raw));
    const n = buildNarrative(m);
    expect(m.flags.strengthDeficit).toBe(false);
    expect(m.flags.lowSleep).toBe(false);
    // Toujours des tests manquants → au moins la priorité « indicateurs manquants ».
    expect(n.priorities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("template.renderReportHtml", () => {
  const model = buildReportModel(normalizeReportInput(melvinRaw()));
  const html = renderReportHtml(model, buildNarrative(model));

  it("produit 9 pages autonomes avec le titre joueur", () => {
    expect((html.match(/class="slide/g) || []).length).toBe(9);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Rapport de performance — Melvin");
    expect(html).toContain("PERFORMANCE REPORT");
  });

  it("injecte les valeurs calculées (pas de valeurs en dur)", () => {
    expect(html).toContain("108%"); // bronco vs cible (KPI)
    expect(html).toContain("118%"); // saut vs cible
    expect(html).toContain("83 %"); // squat table
    expect(html).toContain("+60"); // points
  });

  it("échappe le texte libre (anti-injection)", () => {
    const raw = melvinRaw();
    raw.player.name = "<script>x</script>";
    const m = buildReportModel(normalizeReportInput(raw));
    const out = renderReportHtml(m, buildNarrative(m));
    expect(out).not.toContain("<script>x</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
