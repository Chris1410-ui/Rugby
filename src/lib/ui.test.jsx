// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import { useModalClose } from "./ui.jsx";

function Modal({ onClose }) { useModalClose(onClose); return null; }

/* Régression du bug « Modifier un défi ne fait rien » : lors d'un enchaînement
   modale→modale, le history.back() de la modale fermée émet un popstate qui
   arrivait juste après le montage de la nouvelle et la refermait aussitôt. On
   ignore désormais cet écho dans une courte fenêtre après le montage. */
describe("useModalClose", () => {
  it("ignore le popstate écho juste après le montage, mais ferme sur un vrai retour arrière", () => {
    let now = 1000;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => now);
    const onClose = vi.fn();
    render(<Modal onClose={onClose} />);

    // Écho immédiat (même instant que le montage) → doit être ignoré.
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(onClose).not.toHaveBeenCalled();

    // Vrai retour arrière, bien plus tard → doit fermer.
    now = 2000;
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(onClose).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});