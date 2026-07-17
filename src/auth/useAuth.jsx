/* eslint-disable react-refresh/only-export-components -- provider + hook cohabitent volontairement */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ────────────────────────────────────────────────────────────────
   Contexte d'authentification.
   - suit la session Supabase (persistée, refresh auto)
   - charge le `profile` (rôle, team_id, player_id) de l'utilisateur
   - remplace intégralement l'ancien flux `pwd:*` / SHA-256 du prototype
   ──────────────────────────────────────────────────────────────── */

const AuthCtx = createContext(null);

/* Capture une éventuelle erreur de lien (mot de passe oublié / confirmation)
   présente dans l'URL au TOUT premier chargement — avant que supabase-js ne
   nettoie le hash. Ex. lien expiré : #error=access_denied&error_code=otp_expired */
function readUrlAuthError() {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
  const q = new URLSearchParams(raw);
  const code = q.get("error_code") || q.get("error");
  if (!code) return "";
  if (/expired/i.test(code)) return "Le lien de réinitialisation a expiré. Redemande un email ci-dessous.";
  const desc = q.get("error_description");
  return desc ? desc.replace(/\+/g, " ") : "Lien invalide ou déjà utilisé. Redemande un email ci-dessous.";
}
const INITIAL_LINK_ERROR = readUrlAuthError();

// Purge la session Supabase persistée (clés « sb-* ») quand elle est illisible/
// corrompue — sinon getSession() peut rejeter/bloquer à CHAQUE chargement et
// figer l'app sur « Chargement… » (bug « seule la navigation privée marche »).
function clearSupabaseAuthStorage() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* noop */ }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // chargement session initial
  const [profileLoading, setProfileLoading] = useState(false);
  const [recovery, setRecovery] = useState(false); // lien « mot de passe oublié » suivi
  const [linkError, setLinkError] = useState(INITIAL_LINK_ERROR); // lien expiré / invalide

  // Récupère le profil métier lié au compte auth
  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, team_id, player_id")
        .eq("id", uid)
        .maybeSingle();
      if (error) console.error("[auth] chargement profil:", error.message);
      setProfile(data ?? null);
    } catch (e) {
      console.error("[auth] chargement profil:", e?.message || e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Filet anti « chargement infini » : si getSession() ne se résout jamais
    // (session persistée corrompue, refresh réseau bloqué…), on bascule vers
    // l'écran de connexion au bout de quelques secondes au lieu de rester figé.
    const safety = setTimeout(() => { if (active) setLoading(false); }, 8000);
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        if (data.session?.user) loadProfile(data.session.user.id);
      })
      .catch((e) => {
        // Session persistée illisible → on la purge pour repartir propre.
        console.error("[auth] getSession:", e?.message || e);
        clearSupabaseAuthStorage();
        if (active) setSession(null);
      })
      .finally(() => { if (active) { clearTimeout(safety); setLoading(false); } });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Clic sur le lien de réinitialisation → écran « nouveau mot de passe »
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next ?? null);
      // ⚠️ NE PAS appeler d'autre fonction supabase directement ici : supabase-js
      // (v2, avec LockManager) tient un verrou d'auth pendant ce callback, et la
      // requête profil — qui a besoin du token — se bloque dessus (deadlock) →
      // « Chargement du profil… » figé APRÈS connexion. On diffère hors du verrou.
      if (next?.user) {
        const uid = next.user.id;
        setTimeout(() => { if (active) loadProfile(uid); }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(() => {
    if (session?.user) return loadProfile(session.user.id);
  }, [session, loadProfile]);

  const endRecovery = useCallback(() => setRecovery(false), []);
  const clearLinkError = useCallback(() => setLinkError(""), []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    recovery,
    endRecovery,
    linkError,
    clearLinkError,
    signOut,
    refreshProfile,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
