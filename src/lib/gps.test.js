import { describe, it, expect } from "vitest";
import { normalizeGpsMetrics, normalizeSpeedZones, hasAnyMetric, gpsRecords, pbMetrics, gpsSeries, gpsWindowLoad, gpsPlayerAgg, normalizeImages, heatmapsOf } from "./gps.js";

describe("gps — normalizeGpsMetrics", () => {
  it("nettoie et convertit ; absent/illisible → null (jamais inventé)", () => {
    const m = normalizeGpsMetrics({
      distance_m: "6820.4", m_per_min: 78, hsr_m: "540", vmax_kmh: "31.4",
      duration_sec: "5220", hsr_count: "22", vavg_kmh: "", provider: "PITCHERO",
      confidence: { distance_m: 0.95, vmax_kmh: 1.4, bad: "x" }, name_detected: true, session_name: "  Match A  ",
    });
    expect(m.distanceM).toBe(6820); // int arrondi
    expect(m.mPerMin).toBe(78);
    expect(m.vmaxKmh).toBeCloseTo(31.4, 5);
    expect(m.durationSec).toBe(5220);
    expect(m.vavgKmh).toBeNull();        // "" → null
    expect(m.provider).toBe("pitchero"); // whitelist + lowercase
    expect(m.confidence).toEqual({ distance_m: 0.95, vmax_kmh: 1 }); // clamp 0..1 ; 'bad' écarté
    expect(m.nameDetected).toBe(true);
    expect(m.sessionName).toBe("Match A");
    expect(m.source).toBe("ai");
  });

  it("0 lu est conservé (≠ non lu) ; négatif/NaN → null ; provider inconnu → null", () => {
    const m = normalizeGpsMetrics({ hsr_m: 0, distance_m: -5, vmax_kmh: "abc", provider: "garmin", source: "manual" });
    expect(m.hsrM).toBe(0);
    expect(m.distanceM).toBeNull();
    expect(m.vmaxKmh).toBeNull();
    expect(m.provider).toBeNull();
    expect(m.source).toBe("manual");
  });
});

describe("gps — normalizeSpeedZones", () => {
  it("garde les zones connues, ordonne, borne pct, dédoublonne", () => {
    const z = normalizeSpeedZones([
      { zone: "sprint", sec: "30", pct: 120 },
      { zone: "WALK", sec: 1200, pct: 23 },
      { zone: "bogus", sec: 10 },
      { zone: "walk", sec: 999 }, // doublon → ignoré
    ]);
    expect(z.map((x) => x.zone)).toEqual(["walk", "sprint"]);
    expect(z[0]).toEqual({ zone: "walk", sec: 1200, pct: 23 });
    expect(z[1].pct).toBe(100); // borné
  });
});

describe("gps — hasAnyMetric", () => {
  it("vrai si au moins une métrique, faux si tout null", () => {
    expect(hasAnyMetric(normalizeGpsMetrics({ vmax_kmh: 30 }))).toBe(true);
    expect(hasAnyMetric(normalizeGpsMetrics({}))).toBe(false);
  });
});

describe("gps — records / PB / séries", () => {
  const sessions = [
    { id: "a", date: "2026-07-01", distanceM: 6000, vmaxKmh: 29, hsrM: 400 },
    { id: "b", date: "2026-07-10", distanceM: 7200, vmaxKmh: 31.5, hsrM: 380 },
    { id: "c", date: "2026-07-20", distanceM: 6800, vmaxKmh: 30, hsrM: null },
  ];

  it("gpsRecords : max par métrique avec date/id", () => {
    const r = gpsRecords(sessions);
    expect(r.vmax_kmh).toEqual({ value: 31.5, date: "2026-07-10", id: "b" });
    expect(r.distance_m.value).toBe(7200);
    expect(r.hsr_m.value).toBe(400);
  });

  it("pbMetrics : ce que la session bat vs l'historique", () => {
    const prior = sessions.slice(0, 2); // a, b
    expect(pbMetrics({ distanceM: 7500, vmaxKmh: 30 }, prior)).toEqual(["distance_m"]); // 7500>7200 ; 30<31.5
    expect(pbMetrics({ vmaxKmh: 32 }, prior)).toEqual(["vmax_kmh"]);
  });

  it("gpsSeries : triée, sans les trous", () => {
    expect(gpsSeries(sessions, "hsr_m")).toEqual([
      { date: "2026-07-01", value: 400 }, { date: "2026-07-10", value: 380 },
    ]);
  });

  it("gpsWindowLoad : cumule sur la fenêtre, trous = 0", () => {
    const r = gpsWindowLoad(sessions, 7, "2026-07-22"); // fenêtre 16→22 juil → seule c (20/07)
    expect(r).toEqual({ n: 1, distanceM: 6800, hsrM: 0 }); // c.hsrM = null → 0
    const all = gpsWindowLoad(sessions, 60, "2026-07-22");
    expect(all.n).toBe(3);
    expect(all.distanceM).toBe(20000);
  });

  it("gpsPlayerAgg : avg distance/hsr/m·min⁻¹, MAX vmax (aligné RPC k-anon)", () => {
    const a = gpsPlayerAgg(sessions);
    expect(a.vmax_kmh).toBe(31.5);           // max
    expect(a.distance_m).toBe(20000 / 3);    // avg
    expect(a.hsr_m).toBe(390);               // avg des non-null (400,380)
  });
});

describe("gps — images / heatmaps (GPS-5)", () => {
  it("normalizeImages : borne kind/tab, complète via image_paths, dédoublonne", () => {
    const out = normalizeImages(
      [
        { path: "a.jpg", kind: "heatmap", tab: "speed" },
        { path: "b.jpg", kind: "stats", tab: "speed" },   // tab ignoré (pas heatmap)
        { path: "c.jpg", kind: "bogus" },                  // kind inconnu → null
        { path: "a.jpg", kind: "chart" },                  // doublon → ignoré
      ],
      ["a.jpg", "d.jpg"], // d.jpg absent des images → ajouté en kind null
    );
    expect(out).toEqual([
      { path: "a.jpg", kind: "heatmap", tab: "speed" },
      { path: "b.jpg", kind: "stats", tab: null },
      { path: "c.jpg", kind: null, tab: null },
      { path: "d.jpg", kind: null, tab: null },
    ]);
  });

  it("heatmapsOf : ne renvoie que les captures marquées heatmap", () => {
    const session = {
      images: [
        { path: "hm1.jpg", kind: "heatmap", tab: "distance" },
        { path: "st.jpg", kind: "stats" },
        { path: "hm2.jpg", kind: "heatmap", tab: "intensity" },
      ],
      imagePaths: ["hm1.jpg", "st.jpg", "hm2.jpg"],
    };
    expect(heatmapsOf(session)).toEqual([
      { path: "hm1.jpg", tab: "distance" },
      { path: "hm2.jpg", tab: "intensity" },
    ]);
    expect(heatmapsOf({ imagePaths: ["x.jpg"] })).toEqual([]); // aucune marquée → vide
  });
});
