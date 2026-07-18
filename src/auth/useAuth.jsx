/* eslint-disable react-refresh/only-export-components -- provider + hook cohabitent volontairement */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { applyProfileLocale } from "../i18n/useLocale.js";

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
  const [profileLoaded, setProfileLoaded] = useState(false); // au moins une lecture aboutie
  const [profileError, setProfileError] = useState(false);   // échec après retries → écran d'erreur
  const [recovery, setRecovery] = useState(false); // lien « mot de passe oublié » suivi
  const [linkError, setLinkError] = useState(INITIAL_LINK_ERROR); // lien expiré / invalide

  /* Récupère le profil métier lié au compte auth — RÉSILIENT : la requête est
     bornée par un timeout (sinon un token bloqué la fige indéfiniment → « Chargement
     du profil… » infini sur certains appareils) et retentée. En dernier recours,
     on passe en état d'ERREUR (jamais de chargement infini). */
  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setProfileLoaded(true); setProfileError(false); return; }
    setProfileLoading(true);
    setProfileError(false);
    const withTimeout = (p, ms) => Promise.race([
      p,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout requête profil")), ms)),
    ]);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error } = await withTimeout(
          supabase.from("profiles").select("id, role, full_name, team_id, player_id, locale").eq("id", uid).maybeSingle(),
          9000,
        );
        if (error) throw new Error(error.message);
        // Langue du compte prioritaire : appliquée dès le chargement du profil.
        applyProfileLocale(data?.locale);
        setProfile(data ?? null);
        setProfileLoaded(true);
        setProfileError(false);
        setProfileLoading(false);
        return;
      } catch (e) {
        console.error(`[auth] chargement profil (tentative ${attempt}/3):`, e?.message || e);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * attempt)); // backoff
      }
    }
    // Échec définitif → l'UI montre un écran d'erreur avec « Réessayer », pas un spinner sans fin.
    setProfileError(true);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    // On NE fait PLUS d'appel getSession() séparé : onAuthStateChange émet
    // « INITIAL_SESSION » au montage (session courante) PUIS toutes les
    // transitions. Un seul chemin → aucune contention de verrou d'auth.
    // Filet : si aucun événement n'arrive (SDK bloqué), on débloque après 8 s.
    const safety = setTimeout(() => { if (active) setLoading(false); }, 8000);
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next ?? null);
      setLoading(false);
      clearTimeout(safety);
      // ⚠️ NE JAMAIS appeler d'autre fonction supabase DIRECTEMENT ici : supabase-js
      // (v2, LockManager) tient un verrou d'auth pendant ce callback → la requête
      // profil se bloquerait dessus (deadlock). On diffère hors du callback.
      if (next?.user) {
        const uid = next.user.id;
        setTimeout(() => { if (active) loadProfile(uid); }, 0);
      } else {
        setProfile(null);
        setProfileLoaded(false);
        setProfileError(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch { /* réseau : on nettoie quand même en local */ }
    clearSupabaseAuthStorage();
    setSession(null);
    setProfile(null);
    setProfileLoaded(false);
    setProfileError(false);
  }, []);

  const refreshProfile = useCallback(() => {
    if (session?.user) return loadProfile(session.user.id);
  }, [session, loadProfile]);

  // Escape hatch pour un appareil coincé : purge la session locale + recharge.
  const hardReset = useCallback(() => {
    clearSupabaseAuthStorage();
    try { window.location.reload(); } catch { /* noop */ }
  }, []);

  const endRecovery = useCallback(() => setRecovery(false), []);
  const clearLinkError = useCallback(() => setLinkError(""), []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    profileLoaded,
    profileError,
    recovery,
    endRecovery,
    linkError,
    clearLinkError,
    signOut,
    refreshProfile,
    hardReset,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
