// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Les hooks renvoient un OBJET ({ sessions } / { logs }) — le composant doit le
// déstructurer. Régression du crash « la fiche ne se charge pas » : sans
// déstructuration, (sessions || []).filter appelait .filter sur un objet.
vi.mock("../../data/sessions.js", () => ({
  useTeamSessions: () => ({
    sessions: [
      { id: "s1", date: "2024-03-10", assignedIds: ["p1"], titre: "Séance A", code: "RS" },
      { id: "s2", date: null, assignedIds: ["p1"], titre: "Séance sans date", code: "RS" },
    ],
    loading: false,
    refresh: () => {},
  }),
}));
vi.mock("../../data/logs.js", () => ({
  useTeamLogs: () => ({ logs: { s1: { p1: { status: "done", rpe: 6, duration: 60 } } }, refresh: () => {} }),
}));

import PlayerSessionHistory from "./PlayerSessionHistory.jsx";

describe("PlayerSessionHistory", () => {
  it("rend sans planter avec des séances partielles (dont une sans date)", () => {
    const { container } = render(<PlayerSessionHistory player={{ id: "p1", team: "t1" }} players={[]} />);
    expect(container).toBeTruthy();
  });

  it("rend l'état vide pour un joueur sans séance assignée", () => {
    const { container } = render(<PlayerSessionHistory player={{ id: "pX", team: "t1" }} players={[]} />);
    expect(container).toBeTruthy();
  });
});