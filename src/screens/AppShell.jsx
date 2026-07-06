import { useState } from "react";
import { useAuth } from "../auth/useAuth.jsx";
import { useRoster, addPlayer } from "../data/players.js";
import { C, FONT, sc, ROLES, TEAMS, isStaffRole } from "../lib/tokens.js";
import { RUGBY_POS, grpLabel } from "../lib/positions.js";
import { LogOut, Users, Plus, X, Shield } from "../lib/icons.jsx";

const teamLabel = (id) => TEAMS.rugby.find((t) => t.id === id)?.label || id;
const roleObjOf = (id) => ROLES.find((r) => r.id === id) || { l: id, e: "•", c: C.gray };

export default function AppShell() {
  const { profile, user, signOut, profileLoading } = useAuth();

  if (profileLoading && !profile) {
    return <Centered>Chargement du profil…</Centered>;
  }
  if (!profile) {
    return (
      <Centered>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Profil introuvable</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            Ton compte est authentifié ({user?.email}) mais aucun profil métier n'est associé.
            Reconnecte-toi ou contacte le staff.
          </div>
          <button onClick={signOut} style={btn(C.coral, { marginTop: 16 })}>Se déconnecter</button>
        </div>
      </Centered>
    );
  }

  const roleObj = roleObjOf(profile.role);
  const staff = isStaffRole(profile.role);

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 40px" }}>
        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.navy}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border2}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
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

        <main style={{ padding: "18px" }}>
          <Banner />
          {staff ? <StaffRoster teamId={profile.team_id} /> : <PlayerHome profile={profile} />}
        </main>
      </div>
    </div>
  );
}

function Banner() {
  return (
    <div style={sc({ marginBottom: 16, borderLeft: `4px solid ${C.green}`, display: "flex", gap: 10, alignItems: "flex-start" })}>
      <Shield size={18} color={C.green} />
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
        <strong style={{ color: "#fff" }}>Backend connecté.</strong> Auth Supabase + RLS active :
        chaque ajout est persisté et synchronisé en temps réel pour tout le staff de l'équipe.
        Les écrans détaillés (bilans, séances, charge, messagerie…) arrivent dans les étapes suivantes.
      </div>
    </div>
  );
}

/* ── Vue staff : effectif temps réel + ajout ── */
function StaffRoster({ teamId }) {
  const { players, loading, error } = useRoster(teamId);
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Users size={18} color={C.coral} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Effectif · {players.length}</div>
        <button onClick={() => setAdding(true)} style={btn(C.coral, { display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" })}>
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {error && <div style={{ color: C.coral, fontSize: 12, marginBottom: 10 }}>Erreur : {error}</div>}
      {loading ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Chargement…</div>
      ) : players.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.45)", fontSize: 12 })}>
          Aucun joueur pour le moment.<br />Ajoute le premier membre de l'effectif — il apparaîtra
          instantanément sur tous les appareils du staff.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.map((p) => (
            <div key={p.id} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px" })}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                {p.num ?? "—"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{p.pos} · {grpLabel(p.grp)}</div>
              </div>
              {p.isCustom && <span style={{ fontSize: 9, fontWeight: 700, color: C.teal, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, borderRadius: 6, padding: "2px 7px" }}>auto-profil</span>}
            </div>
          ))}
        </div>
      )}

      {adding && <AddPlayerModal teamId={teamId} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddPlayerModal({ teamId, onClose }) {
  const [name, setName] = useState("");
  const [posIdx, setPosIdx] = useState(0);
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!name.trim()) return setErr("Nom requis.");
    setBusy(true);
    setErr("");
    const [pos, grp] = RUGBY_POS[posIdx];
    try {
      await addPlayer(teamId, { name, pos, grp, num: num ? parseInt(num, 10) : null });
      onClose(); // Realtime rafraîchit la liste
    } catch (e) {
      setErr(e.message || "Échec de l'ajout.");
      setBusy(false);
    }
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.panel, borderRadius: "18px 18px 0 0", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Ajouter un joueur</div>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Prénom Nom" autoFocus style={inp} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={posIdx} onChange={(e) => setPosIdx(Number(e.target.value))} style={{ ...inp, flex: 2 }}>
            {RUGBY_POS.map(([p, g], i) => (
              <option key={i} value={i} style={{ background: C.panel }}>{p} · {grpLabel(g)}</option>
            ))}
          </select>
          <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} placeholder="N°" inputMode="numeric" style={{ ...inp, flex: 1, textAlign: "center" }} />
        </div>
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={btn(C.coral, { width: "100%", opacity: busy ? 0.6 : 1 })}>
          {busy ? "Ajout…" : "Ajouter à l'effectif"}
        </button>
      </div>
    </div>
  );
}

/* ── Vue joueur : sa propre fiche ── */
function PlayerHome({ profile }) {
  const { players, loading } = useRoster(profile.team_id);
  const me = players.find((p) => p.id === profile.player_id);

  return (
    <section>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Mon espace</div>
      {loading ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Chargement…</div>
      ) : me ? (
        <div style={sc({ borderLeft: `4px solid ${C.green}` })}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.green}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: C.green }}>
              {me.num ?? "—"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{me.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{me.pos} · {grpLabel(me.grp)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            Profil créé et persisté côté serveur. Tes bilans quotidiens et le logging de séances
            seront branchés ici aux prochaines étapes.
          </div>
        </div>
      ) : (
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.45)", fontSize: 12 })}>
          Ton profil joueur n'est pas encore lié. Contacte le staff.
        </div>
      )}
    </section>
  );
}

/* ── petits utilitaires UI ── */
function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {children}
    </div>
  );
}
const btn = (bg, extra = {}) => ({ background: bg, border: "none", borderRadius: 10, padding: "11px 14px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", ...extra });
