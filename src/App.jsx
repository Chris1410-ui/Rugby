import { AuthProvider, useAuth } from "./auth/useAuth.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import AppShell from "./screens/AppShell.jsx";
import { hasSupabaseConfig } from "./lib/supabase.js";
import { C, FONT } from "./lib/tokens.js";

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Chargement…</span>
      </div>
    );
  }
  return session ? <AppShell /> : <LoginScreen />;
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
