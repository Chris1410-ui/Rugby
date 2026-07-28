// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Fiche from "./Fiche.jsx";

/* Test de non-régression : la fiche joueur DOIT se rendre sans planter avec des
   données PARTIELLES (joueur sans 1RM, sans tests, sans bilan, sans séance, sans
   acwr). Régression d'origine : `player.acwr.toFixed(2)` déréférencé sans garde
   → tout l'app blanchissait. On isole le rendu propre de la fiche : les hooks de
   données et les composants enfants (qui font leurs propres fetch) sont mockés. */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && o.count != null ? `${k}:${o.count}` : k), i18n: { language: "fr" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Client Supabase neutralisé (aucun accès réseau depuis un hook résiduel).
vi.mock("../../lib/supabase.js", () => ({ supabase: {} }));

// Hooks de données appelés au rendu de la fiche.
vi.mock("../../data/tests.js", () => ({ useTestCampaigns: () => ({ campaigns: [], results: [] }) }));
vi.mock("../../data/challenges.js", () => ({ useTeamChallengePoints: () => ({}) }));
vi.mock("../../data/questionnaires.js", () => ({ useMyQuestionnaires: () => ({ list: [] }) }));

// Composants enfants (fetch propres) neutralisés — la régression était dans le
// rendu PROPRE de la fiche (grille de KPI), pas dans les enfants.
vi.mock("./PlayerPrograms.jsx", () => ({ default: () => null }));
vi.mock("./PlayerSessionHistory.jsx", () => ({ default: () => null }));
vi.mock("./PlayerAttendance.jsx", () => ({ default: () => null }));
vi.mock("./Player1RM.jsx", () => ({ default: () => null }));
vi.mock("./GpsFicheSection.jsx", () => ({ default: () => null }));
vi.mock("./PdfImportReview.jsx", () => ({ default: () => null }));
vi.mock("./TotemPicker.jsx", () => ({ default: () => null }));
vi.mock("./TestsEvolution.jsx", () => ({ default: () => null }));
vi.mock("./Top14Panel.jsx", () => ({ default: () => null }));
vi.mock("./Confidentialite.jsx", () => ({ default: () => null }));
vi.mock("../staff/QuestionnaireResponses.jsx", () => ({ PlayerAnswers: () => null, default: () => null }));

const base = { id: "p1", team: "t1", name: "Jean Dupont", pos: "Pilier", initials: "J.D." };

describe("Fiche — rendu défensif avec données partielles", () => {
  it("joueur minimal (sans acwr, 1RM, tests, bilan, séance) → se rend sans planter", () => {
    const { container } = render(<Fiche player={base} canEdit={false} />);
    expect(container.textContent).toContain("Jean Dupont");
    // Pas d'écran d'erreur du boundary local.
    expect(container.textContent).not.toContain("shared.error.title");
    cleanup();
  });

  it("acwr absent → pas de crash (régression toFixed)", () => {
    const { container } = render(<Fiche player={{ ...base, acwr: undefined, readiness: undefined }} canEdit />);
    expect(container.textContent).toContain("Jean Dupont");
    cleanup();
  });

  it("player null → rend null sans jeter", () => {
    const { container } = render(<Fiche player={null} />);
    expect(container).toBeTruthy();
    cleanup();
  });

  it("joueur enrichi complet → se rend aussi", () => {
    const rich = { ...base, acwr: 1.4, readiness: 72, wellness: 38, sleep: 7.5, charge7j: 320, dispo: 90, _live: true };
    const { container } = render(<Fiche player={rich} canEdit />);
    expect(container.textContent).toContain("Jean Dupont");
    cleanup();
  });
});
