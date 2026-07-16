import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { C, FONT } from "../lib/tokens.js";
import { LogOut } from "../lib/icons.jsx";
import StaffApp from "./staff/StaffApp.jsx";
import PlayerPreview from "./shared/PlayerPreview.jsx";
import { fetchTeamPlayers } from "../data/players.js";

/* Espace OWNER (Head of Performance) : voit TOUS les clubs. Sélecteur de club
   dans l'en-tête → vue staff complète du club choisi (accès accordé par le
   bypass RLS `is_owner()`). Peut aussi OUVRIR LA VUE JOUEUR de N'IMPORTE QUEL
   joueur du club (réel ou démo) en LECTURE SEULE — pour tester l'expérience
   joueur sans se déconnecter (cf. PlayerPreview + usePreview). */
export default function OwnerApp({ profile, user, signOut }) {
  const [clubs, setClubs] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [preview, setPreview] = useState(null); // id joueur en aperçu (lecture seule)

  useEffect(() => {
    let active = true;
    supabase.from("teams").select("id, label").eq("sport", "rugby").order("label")
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

  // Effectif du club sélectionné (réels + démo) pour le sélecteur « Vue joueur ».
  // Reset de l'aperçu au changement de club.
  useEffect(() => {
    setPreview(null);
    if (!team) { setTeamPlayers([]); return; }
    let active = true;
    const load = () => fetchTeamPlayers(team).then((d) => { if (active) setTeamPlayers(d); }).catch(() => {});
    load();
    const ch = supabase
      .channel(`owner-roster:${team}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `team_id=eq.${team}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [team]);

  const selectSt = {
    background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9,
    padding: "7px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", maxWidth: 170,
  };
  const previewName = teamPlayers.find((p) => p.id === preview)?.name;
  const realPlayers = teamPlayers.filter((p) => !p.is_demo);
  const demoOnes = teamPlayers.filter((p) => p.is_demo);

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.coral, letterSpacing: 0.5 }}>PERFORMANCE</div>
            <div style={{ fontSize: 10, color: C.amb, fontWeight: 700 }}>👑 OWNER · {profile.full_name || user?.email}</div>
          </div>
          <div style={{ flex: 1 }} />
          {teamPlayers.length > 0 && (
            <select value={preview ?? ""} onChange={(e) => setPreview(e.target.value || null)} style={{ ...selectSt, maxWidth: 150 }} aria-label="Ouvrir la vue d'un joueur (lecture seule)">
              <option value="">👁 Vue joueur…</option>
              {realPlayers.length > 0 && (
                <optgroup label="Joueurs">
                  {realPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              )}
              {demoOnes.length > 0 && (
                <optgroup label="Démo">
                  {demoOnes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              )}
            </select>
          )}
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
        ) : !team ? (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Aucun club rugby trouvé.</div>
        ) : preview ? (
          <PlayerPreview profile={profile} teamId={team} playerId={preview} playerName={previewName} onExit={() => setPreview(null)} />
        ) : (
          <StaffApp key={team} profile={{ ...profile, team_id: team }} />
        )}
      </div>
    </div>
  );
}
