import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./styles.css";

/* Chunk manquant après (re)déploiement : un onglet ouvert garde l'ancien
   index.html en mémoire et pointe vers des chunks hashés qui n'existent plus
   (« Failed to fetch dynamically imported module » → 404). Vite émet alors
   `vite:preloadError` : on recharge UNE fois pour récupérer les nouveaux hash
   (cooldown anti-boucle). */
window.addEventListener("vite:preloadError", (event) => {
  const now = Date.now();
  const last = Number(sessionStorage.getItem("vite-preload-reload-ts") || 0);
  if (now - last > 10000) {
    sessionStorage.setItem("vite-preload-reload-ts", String(now));
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Signale à la sentinelle d'index.html que le bundle a bien été évalué et le
// rendu lancé — sinon elle affiche l'écran « L'application n'a pas pu démarrer ».
window.__appMounted = true;
