import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./auth/useAuth.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import ResetPassword from "./auth/ResetPassword.jsx";
import AppShell from "./screens/AppShell.jsx";
import { hasSupabaseConfig } from "./lib/supabase.js";
import { C, FONT } from "./lib/tokens.js";
import { Shield } from "./lib/icons.jsx";

// Jeton d'invitation présent dans l'URL (?invite=<token>).
const inviteTokenFromUrl = () =>
  (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invite") : null);

/* Lien d'invitation ouvert alors qu'une session existe DÉJÀ. L'acceptation
   (accept_club_invitation) élève le profil de l'APPELANT : l'exécuter en étant
   connecté rattacherait le compte courant à l'invitation — dangereux et
   déroutant. On bloque donc et on guide : se déconnecter pour accepter avec le
   compte destinataire (ou fenêtre privée), ou rester connecté. */
function InviteWhileLoggedIn() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [stay, setStay] = useState(false);

  // « Rester connecté » : on nettoie l'URL pour ne pas ré-afficher l'écran.
  const dismiss = () => {
    try { window.history.replaceState({}, "", window.location.pathname); } catch { /* noop */ }
    setStay(true);
  };
  if (stay) return <AppShell />;

  const btn = { width: "100%", border: "none", borderRadius: 10, padding: "12px 14px", fontWeight: 800, fontSize: 13.5, cursor: "pointer" };
  return (
    <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 26px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Shield size={30} color={C.viol} /></div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{t("auth.inviteLoggedIn.title")}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 22 }}>
          {t("auth.inviteLoggedIn.body", { email: user?.email || "" })}
        </div>
        <button onClick={signOut} style={{ ...btn, background: C.viol, color: "#fff", marginBottom: 10 }}>{t("auth.inviteLoggedIn.logout")}</button>
        <button onClick={dismiss} style={{ ...btn, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}>{t("auth.inviteLoggedIn.stay")}</button>
      </div>
    </div>
  );
}

function Gate() {
  const { session, loading, recovery } = useAuth();
  const { t } = useTranslation();

  // Lien « mot de passe oublié » suivi → écran de réinitialisation prioritaire
  if (recovery) return <ResetPassword />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{t("common.loading")}</span>
      </div>
    );
  }
  // Connecté + lien d'invitation → interstitiel (l'acceptation exige un compte
  // destinataire déconnecté). Sinon l'app. Déconnecté → LoginScreen gère l'invite.
  if (session) return inviteTokenFromUrl() ? <InviteWhileLoggedIn /> : <AppShell />;
  return <LoginScreen />;
}

export default function App() {
  if (!hasSupabaseConfig) {
    return (
      <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.coral, marginBottom: 8 }}>Configuration manquante</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            Renseigne <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans un
            fichier <code>.env</code> (voir <code>.env.example</code>), puis relance <code>npm run dev</code>.
          </div>
        </div>
      </div>
    );
  }
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
