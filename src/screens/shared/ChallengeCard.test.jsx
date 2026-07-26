// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import ChallengeCard from "./ChallengeCard.jsx";

// Régression : une carte de défi minimal (sans récurrence, sans matériel, sans
// destinataires, sans échéance) doit s'afficher sans déréférencement undefined.
describe("ChallengeCard", () => {
  it("rend un défi minimal sans récurrence ni participants", () => {
    const c = { id: "d1", titre: "Défi simple", points: 10, banner: "flame", badge: "🏆" };
    const { getByText } = render(<ChallengeCard c={c} />);
    expect(getByText("Défi simple")).toBeTruthy();
  });

  it("rend un défi complet (récurrence + matériel) sans planter", () => {
    const c = { id: "d2", titre: "Défi série", points: 20, banner: "flame", badge: "🔥", materiel: ["ballon"], echeance: "2024-03-10", seriesId: "s1", customized: false };
    const { getByText } = render(<ChallengeCard c={c} />);
    expect(getByText("Défi série")).toBeTruthy();
  });
});