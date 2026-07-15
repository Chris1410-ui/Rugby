import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { C, FONT, sc, ROLES, TEAMS, isStaffRole } from "../lib/tokens.js";
import { RUGBY_POS, POS_GROUPS } from "../lib/positions.js";
import { pwdStrength } from "../lib/password.js";
import { POLICY_VERSION } from "../lib/policy.js";
import PrivacyPolicy from "../screens/shared/PrivacyPolicy.jsx";
import TotemPicker from "../screens/shared/TotemPicker.jsx";
import { ChevronRight, Eye, EyeOff, Loader, Shield } from "../lib/icons.jsx";

const wrap = {
  minHeight: "100vh",
  background: `radial-gradient(120% 80% at 50% -10%, #2a2550 0%, ${C.navy} 60%)`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: FONT,
  color: "#fff",
};
const input = (err) => ({
  width: "100%",
  background: "rgba(255,255,255,0.08)",
  border: `1px solid ${err ? C.coral : C.border}`,
  borderRadius: 10,
  padding: "12px 14px",
  color: "#fff",
  fontSize: 15,
  outline: "none",
  marginBottom: 10,
});
const label = { fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 6, fontWeight: 700 };

export default function LoginScreen() {
  const [step, setStep] = useState("role"); // role | details | signin
  const [role, setRole] = useState(null);
  const [team, setTeam] = useState(TEAMS.rugby[0].id);
  const [fullName, setFullName] = useState("");
  const [nPos, setNPos] = useState(0);
  const [nNum, setNNum] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  // RGPD — consentement à l'inscription
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [consent, setConsent] = useState(false); // consentement parental (joueur)
  const [policyOk, setPolicyOk] = useState(false); // politique lue/acceptée
  const [showPolicy, setShowPolicy] = useState(false);

  const roleObj = role ? ROLES.find((r) => r.id === role) : null;
  const st = pwdStrength(pwd);
  const sCol = st.score <= 2 ? C.coral : st.score <= 4 ? C.amb : C.green;
  const sLab = st.score <= 2 ? "Faible" : st.score <= 4 ? "Moyen" : "Fort";

  const reset = () => {
    setErr(""); setInfo(""); setPwd(""); setPwd2("");
  };

  const chooseRole = (r) => {
    reset();
    setRole(r);
    setFullName(""); setEmail(""); setNPos(0); setNNum("");
    setGuardianName(""); setGuardianEmail(""); setConsent(false); setPolicyOk(false);
    setTeam(TEAMS.rugby[0].id);
    setStep("details");
  };

  // ── INSCRIPTION ──
  const doSignUp = async () => {
    reset();
    if (!fullName.trim()) return setErr(role === "joueur" ? "Choisis un totem." : "Indique ton nom.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Adresse email invalide.");
    if (!st.valid) return setErr("Mot de passe trop faible (10+, majuscule, minuscule, chiffre, spécial).");
    if (pwd !== pwd2) return setErr("Les mots de passe ne correspondent pas.");
    if (!policyOk) return setErr("Merci de prendre connaissance de la politique de confidentialité.");
    if (role === "joueur") {
      if (!guardianName.trim()) return setErr("Indique le nom du représentant légal.");
      if (!/^\S+@\S+\.\S+$/.test(guardianEmail)) return setErr("Email du représentant légal invalide.");
      if (!consent) return setErr("Le consentement parental est requis (joueur mineur).");
    }

    setBusy(true);
    const { name: pos, grp } = RUGBY_POS[nPos];
    const meta = {
      role,
      team_id: team,
      full_name: fullName.trim(),
      policy_version: POLICY_VERSION,
    };
    if (role === "joueur") {
      Object.assign(meta, {
        new_player: true,
        pos,
        grp,
        num: nNum ? String(parseInt(nNum, 10)) : "",
        guardian_name: guardianName.trim(),
        guardian_email: guardianEmail.trim(),
        consent: true,
      });
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pwd,
      options: { data: meta },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    // Session immédiate (confirmation email désactivée) → onAuthStateChange bascule l'app.
    if (!data.session) {
      setInfo("Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.");
      setStep("signin");
    }
  };

  // ── CONNEXION ──
  const doSignIn = async () => {
    reset();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Adresse email invalide.");
    if (!pwd) return setErr("Saisis ton mot de passe.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd });
    setBusy(false);
    if (error) return setErr("Email ou mot de passe incorrect.");
    // succès → onAuthStateChange
  };

  const doForgot = async () => {
    reset();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Saisis d'abord ton email.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setInfo("Email de réinitialisation envoyé (si le compte existe).");
  };

  const spinner = (
    <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}>
      <Loader size={16} />
    </span>
  );

  const styleTag = (
    <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}
      input::placeholder{color:rgba(255,255,255,0.35)} select option{background:${C.panel}}`}</style>
  );

  const Header = () => (
    <div style={{ textAlign: "center", marginBottom: 18 }}>
      <div style={{ fontSize: 13, letterSpacing: 4, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
        PLATEFORME D'ANALYSE
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: C.coral, letterSpacing: 1 }}>PERFORMANCE</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>Rugby — Belgique U18 · 2026</div>
    </div>
  );

  const Feedback = () =>
    err ? (
      <div style={{ fontSize: 11, color: C.coral, margin: "2px 0 10px", textAlign: "center" }}>{err}</div>
    ) : info ? (
      <div style={{ fontSize: 11, color: C.green, margin: "2px 0 10px", textAlign: "center" }}>{info}</div>
    ) : null;

  /* ── ÉTAPE 1 : rôle ── */
  if (step === "role") {
    return (
      <div style={wrap}>
        {styleTag}
        <Header />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 12, letterSpacing: 2 }}>
          CHOISIR UNE VUE
        </div>
        {ROLES.map((r) => (
          <div
            key={r.id}
            onClick={() => chooseRole(r.id)}
            style={sc({
              width: "100%", maxWidth: 380, marginBottom: 10, cursor: "pointer",
              borderLeft: `4px solid ${r.c}`, padding: "14px 16px",
            })}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>{r.e}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{r.l}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{r.s}</div>
              </div>
              <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
            </div>
          </div>
        ))}
        <button
          onClick={() => { reset(); setStep("signin"); }}
          style={{ marginTop: 8, background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
        >
          J'ai déjà un compte → <span style={{ color: C.coral }}>Connexion</span>
        </button>
      </div>
    );
  }

  /* ── ÉTAPE 2 : détails d'inscription ── */
  if (step === "details") {
    return (
      <div style={wrap}>
        {styleTag}
        {showPolicy && <PrivacyPolicy onClose={() => setShowPolicy(false)} />}
        <div style={{ width: "100%", maxWidth: 380 }}>
          <button onClick={() => setStep("role")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>
            ← Retour
          </button>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: roleObj.c }}>
            {roleObj.e} {roleObj.l}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
            Création de compte · {isStaffRole(role) ? "accès staff de l'équipe" : "ton espace joueur"}
          </div>

          <div style={label}>ÉQUIPE</div>
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ ...input(false), fontWeight: 600 }}>
            {TEAMS.rugby.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>

          <div style={label}>{role === "joueur" ? "TON TOTEM (pseudo affiché)" : "NOM (staff)"}</div>
          {role === "joueur" ? (
            <TotemPicker value={fullName} onChange={(v) => { setFullName(v); setErr(""); }} accent={roleObj.c} />
          ) : (
            <input value={fullName} onChange={(e) => { setFullName(e.target.value); setErr(""); }} placeholder="Prénom Nom" style={input(false)} />
          )}

          {role === "joueur" && (
            <>
              <div style={label}>POSTE</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={nPos} onChange={(e) => setNPos(Number(e.target.value))} style={{ ...input(false), flex: 2 }}>
                  {POS_GROUPS.map((grp) => (
                    <optgroup key={grp.grp} label={grp.label}>
                      {grp.items.map((p) => <option key={p.i} value={p.i}>{p.num} — {p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input value={nNum} onChange={(e) => setNNum(e.target.value.replace(/\D/g, ""))} placeholder="N°" inputMode="numeric" style={{ ...input(false), flex: 1, textAlign: "center" }} />
              </div>
            </>
          )}

          <div style={label}>EMAIL</div>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="prenom.nom@email.be" autoComplete="email" style={input(false)} />

          <div style={label}>MOT DE PASSE</div>
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} placeholder="Mot de passe" autoComplete="new-password" style={input(false)} />
            <button onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {pwd && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: 5, width: `${(st.score / 7) * 100}%`, background: sCol, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 10, color: sCol, marginTop: 4 }}>
                {sLab} — {st.valid ? "✓ valide" : "10+ caractères, majuscule, minuscule, chiffre, spécial"}
              </div>
            </div>
          )}
          <input type={showPwd ? "text" : "password"} value={pwd2} onChange={(e) => { setPwd2(e.target.value); setErr(""); }} placeholder="Confirmer le mot de passe" autoComplete="new-password" style={input(pwd2 && pwd !== pwd2)} />

          {/* ── RGPD : consentement parental (joueur mineur) ── */}
          {role === "joueur" && (
            <div style={{ marginTop: 6, marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 10, color: C.amb, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                REPRÉSENTANT LÉGAL (JOUEUR MINEUR)
              </div>
              <input value={guardianName} onChange={(e) => { setGuardianName(e.target.value); setErr(""); }} placeholder="Nom du parent / tuteur" style={input(false)} />
              <input type="email" value={guardianEmail} onChange={(e) => { setGuardianEmail(e.target.value); setErr(""); }} placeholder="Email du parent / tuteur" autoComplete="off" style={input(false)} />
              <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
                <span>En tant que représentant légal, je consens au traitement des données (dont données de santé) de ce joueur mineur pour le suivi de sa performance.</span>
              </label>
            </div>
          )}

          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer", margin: "8px 0 4px" }}>
            <input type="checkbox" checked={policyOk} onChange={(e) => { setPolicyOk(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
            <span>J'ai pris connaissance de la{" "}
              <button type="button" onClick={() => setShowPolicy(true)} style={{ background: "none", border: "none", color: C.viol, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: 11.5 }}>politique de confidentialité</button>.
            </span>
          </label>

          <Feedback />
          <button
            onClick={doSignUp}
            disabled={busy}
            style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : roleObj.c, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 4, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? spinner : "Créer mon compte"}
          </button>
          <button onClick={() => { reset(); setStep("signin"); }} style={{ width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", marginTop: 12 }}>
            Déjà inscrit ? Connexion
          </button>
        </div>
      </div>
    );
  }

  /* ── CONNEXION ── */
  return (
    <div style={wrap}>
      {styleTag}
      <Header />
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, justifyContent: "center", color: "rgba(255,255,255,0.5)" }}>
          <Shield size={15} color={C.green} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>Connexion sécurisée</span>
        </div>
        <div style={label}>EMAIL</div>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="prenom.nom@email.be" autoComplete="email" style={input(false)} />
        <div style={label}>MOT DE PASSE</div>
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} placeholder="Mot de passe" autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && doSignIn()} style={input(false)} />
          <button onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <Feedback />
        <button onClick={doSignIn} disabled={busy} style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : C.coral, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? spinner : "Se connecter"}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button onClick={() => { reset(); setStep("role"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>
            Créer un compte
          </button>
          <button onClick={doForgot} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>
            Mot de passe oublié ?
          </button>
        </div>
      </div>
    </div>
  );
}
