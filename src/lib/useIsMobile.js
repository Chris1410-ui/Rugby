import { useEffect, useState } from "react";

/* Vrai si l'écran est « mobile » (≤ bp px). Écoute le redimensionnement →
   la nav bascule en barre 4 onglets + hub sous 640 px, desktop inchangé. */
export function useIsMobile(bp = 640) {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    const on = () => setMobile(window.innerWidth <= bp);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return mobile;
}
