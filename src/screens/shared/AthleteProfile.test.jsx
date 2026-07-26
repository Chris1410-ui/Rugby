// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

afterEach(cleanup);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && "count" in o ? `${k}:${o.count}` : k) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import AthleteProfile from "./AthleteProfile.jsx";

const sel = {
  p: { id: "sa1", name: "Aigle", initials: "IF", isStaffAthlete: true },
  div: { e: "🥉", min: 0 }, rank: 4, pts: 120, streak: 0,
  badges: [], top14: 0, top14Tests: [], chalCount: 0,
  ev: [{ v: 15, key: "bilan", date: "2024-01-01" }], // journal NE DOIT PAS fuiter
  athlete: { sessionsDone: 3, natures: { force: 2 }, routineToday: true },
};

describe("AthleteProfile — vue joueur du staff-athlète", () => {
  it("montre l'activité publique (séances + nature + routine) et le badge staff", () => {
    const { getByText, container } = render(<AthleteProfile sel={sel} onClose={() => {}} />);
    expect(getByText("shared.leaderboard.staffAthleteBadge")).toBeTruthy();
    expect(getByText("shared.leaderboard.athleteSessionsDone:3")).toBeTruthy();
    expect(getByText("shared.leaderboard.athleteRoutineDone")).toBeTruthy();
    expect(container.textContent).toContain("data.nature.force"); // pastille de nature
  });

  it("ne montre JAMAIS le journal des points (confidentialité)", () => {
    const { queryByText } = render(<AthleteProfile sel={sel} onClose={() => {}} />);
    expect(queryByText("shared.leaderboard.journalTitle")).toBeNull();
  });
});
