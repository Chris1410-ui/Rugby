import { useAuth } from "../auth/useAuth.jsx";
import { C, FONT, ROLES, TEAMS, isStaffRole } from "../lib/tokens.js";
import { LogOut } from "../lib/icons.jsx";
import PlayerApp from "./player/PlayerApp.jsx";
import StaffApp from "./staff/StaffApp.jsx";

const teamLabel = (id) => TEAMS.rugby.find((t) => t.id === id)?.label || id;
const roleObjOf = (id) => ROLES.find((r) => r.id === id) || { l: id, e: "•", c: C.gray };

export default function AppShell() {
  const { profile, user, signOut, profileLoading } = useAuth();

  if (profileLoading && !profile) return <Centered>Chargement du profil…</Centered>;
  if (!profile) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Profil introuvable</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            Ton compte est authentifié ({user?.email}) mais aucun profil métier n'est associé.
            Reconnecte-toi ou contacte le staff.
          </div>
          <button onClick={signOut} style={{ marginTop: 16, background: C.coral, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Se déconnecter</button>
        </div>
      </Centered>
    );
  }

  const roleObj = roleObjOf(profile.role);
  const staff = isStaffRole(profile.role);

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.coral, letterSpacing: 0.5 }}>PERFORMANCE</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{teamLabel(profile.team_id)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{profile.full_name || user?.email}</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: roleObj.c }}>{roleObj.e} {roleObj.l}</span>
          </div>
          <button onClick={signOut} title="Se déconnecter" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
            <LogOut size={16} />
          </button>
        </header>

        {staff ? <StaffApp profile={profile} /> : <PlayerApp profile={profile} />}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {children}
    </div>
  );
}
