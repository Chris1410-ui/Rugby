import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth.jsx";
import { acceptClubInvitation, readPendingInvite, clearPendingInvite } from "../data/clubInvitations.js";
import { C, FONT, ROLES, TEAMS, isStaffRole, isProfileComplete } from "../lib/tokens.js";
import { Bell } from "../lib/icons.jsx";
import { BuildTag } from "../lib/ui.jsx";
import { useNotifications } from "../data/notifications.js";
import LanguageSelector from "../i18n/LanguageSelector.jsx";
import NotificationCenter from "./shared/NotificationCenter.jsx";
import Onboarding from "./shared/Onboarding.jsx";
import { markOnboardingSeen } from "../data/onboarding.js";
import PlayerApp from "./player/PlayerApp.jsx";
import StaffApp from "./staff/StaffApp.jsx";
import OwnerApp from "./OwnerApp.jsx";
import MembershipGate from "./shared/MembershipGate.jsx";

const teamLabel = (id) => TEAMS.rugby.find((t) => t.id === id)?.label || id;
const roleObjOf = (id) => ROLES.find((r) => r.id === id) || { l: id, e: "•", c: C.gray };
// Le titre d'écran est traduit via t(`title.${tab}`) — clé = `tab` (cf. tableaux
// `nav` de PlayerApp/StaffApp). Regroupe joueur + staff (clés communes partagées).

export default function AppShell() {
  const { profile, user, signOut, profileLoaded, profileError, refreshProfile, hardReset } = useAuth();
  const { t } = useTranslation();
  // Notifications joueur (hook appelé inconditionnellement ; vide pour staff/owner).
  const notifs = useNotifications(profile?.player_id);
  const [navTab, setNavTab] = useState(null); // onglet actif (piloté ici pour cloche/hub/avatar)
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [tourReplay, setTourReplay] = useState(false);   // « Revoir le tutoriel » (menu)
  const [tourDismissed, setTourDismissed] = useState(false); // masque immédiat le temps du refresh profil
  // Filet d'acceptation d'invitation : true tant qu'une invitation stockée reste à
  // finaliser (évite un flash « Profil introuvable » avant que l'effet ne tourne).
  const [inviteFinalizing, setInviteFinalizing] = useState(() => !!readPendingInvite());

  // Compte authentifié SANS profil + invitation en attente stockée → (re)tente
  // l'acceptation puis recharge le profil. Rattrape les cas où le chemin
  // signUp→session→accept a été rompu (email déjà inscrit, reconnexion, 1er essai
  // raté). Aucune boucle : succès → profil présent ; échec terminal → token purgé.
  useEffect(() => {
    if (!profileLoaded || profile) { setInviteFinalizing(false); return; }
    const pend = readPendingInvite();
    if (!pend) { setInviteFinalizing(false); return; }
    let alive = true;
    setInviteFinalizing(true);
    (async () => {
      try {
        await acceptClubInvitation(pend.token, pend.payload || {});
        clearPendingInvite();
        if (alive) await refreshProfile();
      } catch (e) {
        // Terminal (invite invalide/mismatch/déjà prise, données joueur manquantes)
        // → on purge le token et on laisse l'écran d'aide s'afficher.
        if (["INVITE_INVALID", "INVITE_EMAIL_MISMATCH", "ALREADY_CLAIMED", "BIRTHDATE_REQUIRED", "GUARDIAN_REQUIRED", "CONSENT_REQUIRED"].includes(e?.message)) clearPendingInvite();
      } finally {
        if (alive) setInviteFinalizing(false);
      }
    })();
    return () => { alive = false; };
  }, [profileLoaded, profile, refreshProfile]);

  // Échec de chargement du profil (timeout + retries épuisés) : écran d'erreur
  // explicite avec des issues de secours — JAMAIS un spinner infini.
  if (profileError && !profile) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{t("shell.profileErrorTitle")}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            {t("shell.profileErrorBody")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <button onClick={refreshProfile} style={{ background: C.coral, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("common.retry")}</button>
            <button onClick={hardReset} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("shell.resetApp")}</button>
            <button onClick={signOut} style={{ background: "none", border: "none", padding: "6px", color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.logout")}</button>
          </div>
        </div>
      </Centered>
    );
  }
  if (!profile && !profileLoaded) return <Centered>{t("shell.loadingProfile")}</Centered>;
  // Acceptation d'invitation en cours de finalisation → spinner dédié (pas « introuvable »).
  if (!profile && inviteFinalizing) return <Centered>{t("shell.finalizingInvite")}</Centered>;
  if (!profile) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{t("shell.profileNotFoundTitle")}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            {t("shell.profileNotFoundBody", { email: user?.email })}
          </div>
          <button onClick={signOut} style={{ marginTop: 16, background: C.coral, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("common.logout")}</button>
        </div>
      </Centered>
    );
  }

  // Auto-inscription (0061) : un joueur « pending » / « rejected » est authentifié
  // mais bloqué sur un écran dédié. À TESTER AVANT isProfileComplete : un pending a
  // volontairement team_id nul (aucun accès club tant qu'il n'est pas validé).
  if (profile.role === "joueur" && profile.membership_status && profile.membership_status !== "active") {
    return <MembershipGate status={profile.membership_status} email={user?.email} onSignOut={signOut} onRefresh={refreshProfile} />;
  }

  // Profil présent mais incomplet pour son rôle (ex. joueur sans club/fiche,
  // staff sans club, rôle non reconnu) : écran clair au lieu d'un chargement
  // infini ou d'un crash plus loin. Ne bloque JAMAIS l'owner (team_id null OK).
  if (!isProfileComplete(profile)) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{t("shell.profileIncompleteTitle")}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            {t("shell.profileIncompleteBody", { email: user?.email })}
          </div>
          <button onClick={signOut} style={{ marginTop: 16, background: C.coral, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("common.logout")}</button>
        </div>
      </Centered>
    );
  }

  // Owner (Head of Performance) : espace multi-clubs dédié
  if (profile.role === "owner") return <OwnerApp profile={profile} user={user} signOut={signOut} />;

  const roleObj = roleObjOf(profile.role);
  const staff = isStaffRole(profile.role);
  const tab = navTab ?? (staff ? "effectif" : "bilan");
  const goTab = (tk) => { setNavTab(tk); notifs.markRouteRead(tk); setAvatarOpen(false); };
  const name = profile.full_name || user?.email || "Moi";
  const initial = (name.trim()[0] || "?").toUpperCase();

  // Tour guidé : auto au 1er lancement (par rôle) OU à la demande via le menu.
  const showTour = tourReplay || (!profile.onboarding_seen_at && !tourDismissed);
  const closeTour = async () => {
    setTourReplay(false);
    if (!profile.onboarding_seen_at) {
      setTourDismissed(true); // persiste « vu » (une fois) — masque en attendant le refresh
      try { await markOnboardingSeen(); refreshProfile(); } catch { /* réessai au prochain lancement */ }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header compact : titre + cloche (joueur) + avatar (menu) */}
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(`title.${tab}`, "Performance")}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.coral, letterSpacing: 0.4 }}>{t("header.brand")} · <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 0 }}>{teamLabel(profile.team_id)}</span></div>
          </div>
          {!staff && (
            <button onClick={() => setNotifOpen(true)} title={t("shell.notifications")} style={{ position: "relative", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
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
                    <div style={{ fontSize: 10, fontWeight: 700, color: roleObj.c }}>{roleObj.e} {t(`roles.${profile.role}`, roleObj.l)}</div>
                  </div>
                  {/* Sélecteur de langue 🇫🇷 🇬🇧 🇳🇱 (applique + persiste immédiatement). */}
                  <LanguageSelector compact />
                  <div style={{ height: 1, background: C.border2, margin: "6px 0 4px" }} />
                  {/* Navigation retirée du header : « Ma fiche » / « Vue joueur » sont
                     déjà dans la barre du bas + hub « Plus » (un seul système). */}
                  <MenuItem label={t("common.replayTutorial")} onClick={() => { setAvatarOpen(false); setTourReplay(true); }} />
                  <MenuItem label={t("common.logout")} danger onClick={() => { setAvatarOpen(false); signOut(); }} />
                  <div style={{ height: 1, background: C.border2, margin: "4px 0 0" }} />
                  <BuildTag />
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
      {showTour && <Onboarding role={staff ? "staff" : "joueur"} onClose={closeTour} />}
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
