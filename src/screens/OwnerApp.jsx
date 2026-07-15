import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { C, FONT } from "../lib/tokens.js";
import { LogOut } from "../lib/icons.jsx";
import StaffApp from "./staff/StaffApp.jsx";

/* Espace OWNER (Head of Performance) : voit TOUS les clubs. Sélecteur de club
   dans l'en-tête → vue staff complète du club choisi (accès accordé par le
   bypass RLS `is_owner()`). Le remount (`key={team}`) repart proprement à
   chaque changement de club. */
export default function OwnerApp({ profile, user, signOut }) {
  const [clubs, setClubs] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("teams")
      .select("id, label")
      .eq("sport", "rugby")
      .order("label")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("[owner clubs]", error.message);
        const c = data ?? [];
        setClubs(c);
        setTeam(c[0]?.id ?? null);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectSt = {
    background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9,
    padding: "7px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", maxWidth: 190,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.coral, letterSpacing: 0.5 }}>PERFORMANCE</div>
            <div style={{ fontSize: 10, color: C.amb, fontWeight: 700 }}>👑 OWNER · {profile.full_name || user?.email}</div>
          </div>
          <div style={{ flex: 1 }} />
          <select value={team ?? ""} onChange={(e) => setTeam(e.target.value)} style={selectSt} aria-label="Choisir un club">
            {clubs.length === 0 && <option value="">—</option>}
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={signOut} title="Se déconnecter" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
            <LogOut size={16} />
          </button>
        </header>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Chargement des clubs…</div>
        ) : team ? (
          <StaffApp key={team} profile={{ ...profile, team_id: team }} />
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Aucun club rugby trouvé.</div>
        )}
      </div>
    </div>
  );
}
