import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { C, FONT, ROLES } from "../lib/tokens.js";
import { LogOut, Users, Search } from "../lib/icons.jsx";
import StaffApp from "./staff/StaffApp.jsx";
import PlayerApp from "./player/PlayerApp.jsx";
import PlayerPreview from "./shared/PlayerPreview.jsx";
import { fetchTeamPlayers } from "../data/players.js";
import { useOwnerAccounts } from "../data/accounts.js";

const roleOf = (id) => ROLES.find((r) => r.id === id) || { l: id, e: "•", c: C.gray };

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
  const [showAccounts, setShowAccounts] = useState(false); // console « Comptes »
  const [impersonate, setImpersonate] = useState(null); // compte regardé « en tant que »

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

  // « Voir comme » : on regarde l'app dans la vue EXACTE du compte, en lecture seule.
  if (impersonate) {
    return <OwnerImpersonate account={impersonate} ownerProfile={profile} onExit={() => setImpersonate(null)} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.coral, letterSpacing: 0.5 }}>PERFORMANCE</div>
            <div style={{ fontSize: 10, color: C.amb, fontWeight: 700 }}>👑 OWNER · {profile.full_name || user?.email}</div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowAccounts(true)} title="Tous les comptes" style={{ background: `${C.amb}22`, border: `1px solid ${C.amb}66`, borderRadius: 9, padding: "7px 11px", color: C.amb, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}>
            <Users size={15} /> Comptes
          </button>
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

      {showAccounts && (
        <AccountsConsole
          onClose={() => setShowAccounts(false)}
          onImpersonate={(acc) => { setShowAccounts(false); setImpersonate(acc); }}
        />
      )}
    </div>
  );
}

/* Console « Comptes » : tous les comptes tous clubs, filtrables par club et par
   rôle, avec « Voir comme ». Modal plein écran. */
function AccountsConsole({ onClose, onImpersonate }) {
  const { accounts, loading, error } = useOwnerAccounts();
  const [club, setClub] = useState("all");
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");

  const clubs = useMemo(() => {
    const m = new Map();
    accounts.forEach((a) => { if (a.teamId) m.set(a.teamId, a.teamLabel || a.teamId); });
    return [...m.entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1])));
  }, [accounts]);
  const roles = useMemo(() => [...new Set(accounts.map((a) => a.role))], [accounts]);

  const filtered = accounts.filter((a) =>
    (club === "all" || a.teamId === club) &&
    (role === "all" || a.role === role) &&
    (!q || (a.fullName || "").toLowerCase().includes(q.toLowerCase()) || (a.email || "").toLowerCase().includes(q.toLowerCase())));

  const sel = { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", colorScheme: "dark" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: C.navy, borderRadius: 18, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${C.border2}` }}>
          <Users size={18} color={C.amb} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Comptes{accounts.length ? ` · ${filtered.length}/${accounts.length}` : ""}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border2}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px", position: "relative" }}>
            <Search size={14} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou email…" style={{ ...sel, width: "100%", padding: "8px 10px 8px 30px", boxSizing: "border-box" }} />
          </div>
          <select value={club} onChange={(e) => setClub(e.target.value)} style={sel} aria-label="Filtrer par club">
            <option value="all">Tous les clubs</option>
            {clubs.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={sel} aria-label="Filtrer par rôle">
            <option value="all">Tous les rôles</option>
            {roles.map((r) => <option key={r} value={r}>{roleOf(r).l}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Chargement…</div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: 24, color: C.coral, fontSize: 12.5 }}>Erreur : {error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Aucun compte pour ces filtres.</div>
          ) : filtered.map((a) => {
            const ro = roleOf(a.role);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ro.c}22`, border: `1px solid ${ro.c}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{ro.e}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.fullName || a.email}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ color: ro.c, fontWeight: 700 }}>{ro.l}</span>{a.teamLabel ? ` · ${a.teamLabel}` : ""}{a.email ? ` · ${a.email}` : ""}
                  </div>
                </div>
                {a.role !== "owner" && (
                  <button onClick={() => onImpersonate(a)} title="Ouvrir sa vue (lecture seule)" style={{ background: `${C.viol}22`, border: `1px solid ${C.viol}66`, borderRadius: 8, padding: "7px 11px", color: C.viol, fontSize: 11.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>👁 Voir comme</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* « Voir comme » : rend l'app dans la vue EXACTE du compte (son club, son rôle)
   en LECTURE SEULE, avec un bandeau owner + retour. */
function OwnerImpersonate({ account, ownerProfile, onExit }) {
  const ro = roleOf(account.role);
  const target = {
    ...ownerProfile,
    id: account.id, role: account.role, full_name: account.fullName,
    team_id: account.teamId, player_id: account.playerId,
  };
  const banner = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: `${C.amb}22`, borderBottom: `1px solid ${C.amb}66` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: C.amb, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        👁 Vue owner — tu regardes en tant que {account.fullName || account.email} · {ro.l}{account.teamLabel ? ` · ${account.teamLabel}` : ""} · lecture seule
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={onExit} style={{ background: "rgba(255,255,255,0.1)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>← Revenir à l'owner</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff", display: "flex", flexDirection: "column" }}>
      {banner}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 760, width: "100%", margin: "0 auto" }}>
        {account.role === "joueur"
          ? <PlayerApp key={account.id} preview profile={{ ...target, role: "joueur" }} />
          : <StaffApp key={account.id} profile={target} readOnly />}
      </div>
    </div>
  );
}
