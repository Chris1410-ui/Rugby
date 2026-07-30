// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mocks des dépendances réseau/hooks (le test cible la LOGIQUE du hook, pas l'IO).
const saveLogMock = vi.fn(() => Promise.resolve());
vi.mock("../../data/logs.js", () => ({ saveLog: (...a) => saveLogMock(...a) }));
vi.mock("../../data/player1rm.js", () => ({ usePlayer1RM: () => ({ entries: [] }) }));
vi.mock("../../lib/preview.js", () => ({ usePreview: () => false }));

import { useSessionLogging } from "./useSessionLogging.js";

const me = { id: "p1", team: "t1", mas: null, risque: 30 };
const baseArgs = (over = {}) => ({
  s: {
    id: "s1", date: "2020-01-01", code: "RS", nature: "force",
    exercises: [
      { id: "e1", name: "Développé couché", sets: 3, reps: "8", charge: 60 },
      { id: "e2", name: "Rowing", sets: 2, reps: "10" },
    ],
  },
  me, log: null, sessions: [], logs: {}, onSaved: vi.fn(), active: true,
  ...over,
});

describe("useSessionLogging — invariants critiques du lecteur", () => {
  beforeEach(() => saveLogMock.mockClear());

  it("pré-remplissage reps/charge : série 1 reçoit la charge prescrite, sans écraser", () => {
    const { result } = renderHook(() => useSessionLogging(baseArgs()));
    const e1 = result.current.ex.e1;
    expect(e1.sets).toHaveLength(3);
    expect(e1.sets[0].w).toBe("60");   // charge prescrite en série 1
    expect(e1.sets[0].reps).toBe("8"); // reps prescrites en série 1
    expect(result.current.totSets).toBe(5); // 3 + 2
  });

  it("ISOLATION par (exercice, série) : cocher e1[0] n'affecte pas e2", () => {
    const { result } = renderHook(() => useSessionLogging(baseArgs()));
    act(() => result.current.toggleSet(result.current.exos[0], 0));
    expect(result.current.ex.e1.sets[0].done).toBe(true);
    expect(result.current.ex.e1.sets[1].done).toBe(false); // autre série intacte
    expect(result.current.ex.e2.sets.every((x) => !x.done)).toBe(true); // autre exo intact
    expect(result.current.doneSets).toBe(1);
  });

  it("repli d'id x{i} pour des exercices sans id (pas de collision d'état)", () => {
    const args = baseArgs({ s: { id: "s2", date: "2020-01-01", code: "RS", nature: "force", exercises: [{ name: "A", sets: 1, reps: "5" }, { name: "B", sets: 1, reps: "5" }] } });
    const { result } = renderHook(() => useSessionLogging(args));
    expect(Object.keys(result.current.ex).sort()).toEqual(["x0", "x1"]);
  });

  it("SOUVERAINETÉ : une saisie non enregistrée (dirty) n'est pas écrasée par une resync", () => {
    const initial = baseArgs();
    const { result, rerender } = renderHook((p) => useSessionLogging(p), { initialProps: initial });
    act(() => result.current.setSet("e1", 0, { w: "72" })); // saisie joueur → dirty
    expect(result.current.ex.e1.sets[0].w).toBe("72");
    // Une nouvelle version persistée arrive (log différent) → resync tentée…
    rerender(baseArgs({ log: { status: "pending", rpe: null, perExercise: { e1: { sets: [{ w: "1", reps: "1", done: false }] } } } }));
    // …mais la saisie en cours prime : la valeur du joueur reste.
    expect(result.current.ex.e1.sets[0].w).toBe("72");
  });

  it("valider('done') persiste via saveLog avec le statut et les séries réalisées", async () => {
    const { result } = renderHook(() => useSessionLogging(baseArgs()));
    act(() => result.current.toggleSet(result.current.exos[0], 0));
    await act(async () => { await result.current.valider("done"); });
    expect(saveLogMock).toHaveBeenCalledTimes(1);
    const [sid, pid, payload] = saveLogMock.mock.calls[0];
    expect(sid).toBe("s1");
    expect(pid).toBe("p1");
    expect(payload.status).toBe("done");
    expect(payload.perExercise.e1.sets[0].done).toBe(true);
  });
});
