import { useState } from "react";
import { useAuth } from "../auth/useAuth.jsx";
import { C, FONT, ROLES, TEAMS, isStaffRole, isProfileComplete } from "../lib/tokens.js";
import { Bell } from "../lib/icons.jsx";
import { useNotifications } from "../data/notifications.js";
import NotificationCenter from "./shared/NotificationCenter.jsx";
import PlayerApp from "./player/PlayerApp.jsx";
import StaffApp from "./staff/StaffApp.jsx";
import OwnerApp from "./OwnerApp.jsx";

const teamLabel = (id) => TEAMS.rugby.find((t) => t.id === id)?.label || id;
const roleObjOf = (id) => ROLES.find((r) => r.id === id) || { l: id, e: "•", c: C.gray };

export default function AppShell() {
  const { profile, user, signOut, profileLoaded, profileError, refreshProfile, hardReset } = useAuth();
  // Notifications joueur (hook appelé inconditionnellement ; vide pour staff/owner).
  const notifs = useNotifications(profile?.player_id);
  const [navTab, setNavTab] = useState(null); // onglet actif (piloté ici pour cloche/hub/avatar)
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  // Échec de chargement du profil (timeout + retries épuisés) : écran d'erreur
  // explicite avec des issues de secours — JAMAIS un spinner infini.
  if (profileError && !profile) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Impossible de charger le profil</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            La connexion au serveur a échoué ou expiré. Vérifie ta connexion internet,
            puis réessaie.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <button onClick={refreshProfile} style={{ background: C.coral, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Réessayer</button>
            <button onClick={hardReset} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Réinitialiser l'app</button>
            <button onClick={signOut} style={{ background: "none", border: "none", padding: "6px", color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Se déconnecter</button>
          </div>
        </div>
      </Centered>
    );
  }
  if (!profile && !profileLoaded) return <Centered>Chargement du profil…</Centered>;
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

  // Profil présent mais incomplet pour son rôle (ex. joueur sans club/fiche,
  // staff sans club, rôle non reconnu) : écran clair au lieu d'un chargement
  // infini ou d'un crash plus loin. Ne bloque JAMAIS l'owner (team_id null OK).
  if (!isProfileComplete(profile)) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Profil incomplet</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            Ton compte ({user?.email}) est bien authentifié, mais sa configuration
            est incomplète (rôle ou rattachement à un club manquant). Contacte le
            staff pour finaliser ton accès.
          </div>
          <button onClick={signOut} style={{ marginTop: 16, background: C.coral, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Se déconnecter</button>
        </div>
      </Centered>
    );
  }

  // Owner (Head of Performance) : espace multi-clubs dédié
  if (profile.role === "owner") return <OwnerApp profile={profile} user={user} signOut={signOut} />;

  const roleObj = roleObjOf(profile.role);
  const staff = isStaffRole(profile.role);
  const tab = navTab ?? (staff ? "effectif" : "bilan");
  const goTab = (t) => { setNavTab(t); notifs.markRouteRead(t); setAvatarOpen(false); };
  const name = profile.full_name || user?.email || "Moi";
  const initial = (name.trim()[0] || "?").toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header compact : titre + cloche (joueur) + avatar (menu) */}
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.coral, letterSpacing: 0.5 }}>PERFORMANCE</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{teamLabel(profile.team_id)}</div>
          </div>
          {!staff && (
            <button onClick={() => setNotifOpen(true)} title="Notifications" style={{ position: "relative", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
              <Bell size={16} />
              {notifs.unread > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: C.coral, color: "#fff", fontSize: 8.5, fontWeight: 800, borderRadius: 8, padding: "0 4px", minWidth: 14, textAlign: "center", lineHeight: "14px" }}>{notifs.unread > 9 ? "9+" : notifs.unread}</span>}
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button onClick={() => setAvatarOpen((v) => !v)} title={name} style={{ width: 36, height: 36, borderRadius: 18, background: staff ? `${C.coral}33` : `${C.green}33`, border: `1px solid ${staff ? C.coral : C.green}66`, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{initial}</button>
            {avatarOpen && (
              <>
                <div onClick={() => setAvatarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 35 }} />
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 36, width: 210, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border2}`, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: roleObj.c }}>{roleObj.e} {roleObj.l}</div>
                  </div>
                  {!staff && <MenuItem label="Ma fiche" onClick={() => goTab("fiche")} />}
                  {staff && <MenuItem label="👁 Vue joueur" onClick={() => goTab("effectif")} />}
                  <MenuItem label="Se déconnecter" danger onClick={() => { setAvatarOpen(false); signOut(); }} />
                </div>
              </>
            )}
          </div>
        </header>

        {staff
          ? <StaffApp profile={profile} tab={tab} onTab={goTab} />
          : <PlayerApp profile={profile} tab={tab} onTab={goTab} />}
      </div>
      {!staff && notifOpen && <NotificationCenter notifs={notifs} onNavigate={goTab} onClose={() => setNotifOpen(false)} accent={C.green} playerId={profile.player_id} teamId={profile.team_id} />}
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 8, padding: "9px 10px", color: danger ? C.coral : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {children}
    </div>
  );
}
