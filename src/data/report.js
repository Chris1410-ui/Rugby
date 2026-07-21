import { supabase } from "../lib/supabase.js";

/* Déclenche la génération + l'ouverture du rapport de performance PDF d'un joueur.
   Appelle la fonction serverless (api/players/:id/report) avec le JWT de la
   session (Authorization) — le contrôle d'accès (staff = son équipe ; joueur =
   lui-même) est appliqué côté serveur. Ouvre le PDF dans un nouvel onglet.
   Lève une erreur porteuse d'un message lisible en cas d'échec (403/404/500). */
export async function openPlayerReport(playerId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("SESSION");

  const res = await fetch(`/api/players/${playerId}/report`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // Corps JSON { error } attendu ; on retombe sur le statut sinon.
    let detail = "";
    try { detail = (await res.json())?.error || ""; } catch { /* corps non-JSON */ }
    const err = new Error(detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  // Ouvre dans un nouvel onglet ; révoque l'URL après un délai (laisse le temps au rendu).
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
