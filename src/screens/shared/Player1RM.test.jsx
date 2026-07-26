// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && "count" in o ? `${k}:${o.count}` : k) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Évite la chaîne d'import supabase (ExerciseAutocomplete → data/exerciseLibrary).
vi.mock("./ExerciseAutocomplete.jsx", () => ({ default: () => null }));

const entries = [
  // Placeholder « à renseigner » (créé par une demande de 1RM) : value null.
  { id: "a", playerId: "p1", exerciseId: "ex1", movementKey: "squat", movementLabel: "Squat", valueKg: null, kind: "auto" },
  // Mesure testée.
  { id: "b", playerId: "p1", exerciseId: null, movementKey: "bench", movementLabel: "Développé couché", valueKg: 100, kind: "teste", measuredAt: "2024-01-01" },
];
vi.mock("../../data/player1rm.js", () => ({
  usePlayer1RM: () => ({ entries }),
  add1RM: vi.fn(),
}));

import Player1RM from "./Player1RM.jsx";

describe("Player1RM — vue joueur", () => {
  it("met en avant les 1RM à compléter et affiche les mesures", () => {
    const { getByText, queryAllByText } = render(<Player1RM player={{ id: "p1", team: "t1" }} self />);
    // Bandeau « N à compléter » (1 placeholder).
    expect(getByText("oneRM.toComplete:1")).toBeTruthy();
    // Bouton « Compléter » sur la ligne à renseigner.
    expect(queryAllByText("oneRM.complete").length).toBe(1);
    // La mesure testée est affichée.
    expect(getByText("100")).toBeTruthy();
  });

  it("un lecteur sans droit d'édition voit le tag « à renseigner », pas le bouton", () => {
    const { getByText, queryByText } = render(<Player1RM player={{ id: "p1", team: "t1" }} />);
    expect(getByText("oneRM.toSet")).toBeTruthy();
    expect(queryByText("oneRM.complete")).toBeNull();
  });

  it("« Compléter » ouvre le formulaire avec le mouvement fixé (nom verrouillé)", () => {
    const { getByText, getAllByText } = render(<Player1RM player={{ id: "p1", team: "t1" }} self />);
    fireEvent.click(getByText("oneRM.complete"));
    // Le nom du mouvement demandé est affiché en mode verrouillé (formulaire + ligne).
    expect(getByText("oneRM.completing")).toBeTruthy();
    expect(getAllByText("Squat").length).toBeGreaterThanOrEqual(2);
  });
});
