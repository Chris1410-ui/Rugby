// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

afterEach(cleanup);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && "count" in o ? `${k}:${o.count}` : k) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import AthleteProfile from "./AthleteProfile.jsx";

const player = { id: "sa1", name: "Aigle", initials: "IF", isStaffAthlete: true };
const stats = { div: { e: "🥉", min: 0 }, rank: 4, pts: 120, badges: [], top14: 0, chalCount: 0 };
const athlete = { sessionsDone: 3, natures: { force: 2 }, routineToday: true };

describe("AthleteProfile — profil public du staff-athlète", () => {
  it("montre l'activité publique (séances + nature + routine) et le badge staff", () => {
    const { getByText, container } = render(<AthleteProfile player={player} athlete={athlete} stats={stats} onClose={() => {}} />);
    expect(getByText("shared.leaderboard.staffAthleteBadge")).toBeTruthy();
    expect(getByText("shared.leaderboard.athleteSessionsDone:3")).toBeTruthy();
    expect(getByText("shared.leaderboard.athleteRoutineDone")).toBeTruthy();
    expect(container.textContent).toContain("data.nature.force"); // pastille de nature
  });

  it("ne montre JAMAIS le journal des points (confidentialité)", () => {
    const { queryByText } = render(<AthleteProfile player={player} athlete={athlete} stats={stats} onClose={() => {}} />);
    expect(queryByText("shared.leaderboard.journalTitle")).toBeNull();
  });

  it("fonctionne sans classement (vue staff dans l'effectif) : activité seule", () => {
    const { getByText, queryByText } = render(<AthleteProfile player={player} athlete={athlete} onClose={() => {}} />);
    expect(getByText("shared.leaderboard.athleteSessionsDone:3")).toBeTruthy();
    // Sans `stats`, pas de section badges/classement.
    expect(queryByText("shared.leaderboard.athleteBadges")).toBeNull();
  });
});
