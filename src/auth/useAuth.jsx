import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ────────────────────────────────────────────────────────────────
   Contexte d'authentification.
   - suit la session Supabase (persistée, refresh auto)
   - charge le `profile` (rôle, team_id, player_id) de l'utilisateur
   - remplace intégralement l'ancien flux `pwd:*` / SHA-256 du prototype
   ──────────────────────────────────────────────────────────────── */

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // chargement session initial
  const [profileLoading, setProfileLoading] = useState(false);

  // Récupère le profil métier lié au compte auth
  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, team_id, player_id")
      .eq("id", uid)
      .maybeSingle();
    if (error) console.error("[auth] chargement profil:", error.message);
    setProfile(data ?? null);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
      if (data.session?.user) loadProfile(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (next?.user) loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
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

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
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
