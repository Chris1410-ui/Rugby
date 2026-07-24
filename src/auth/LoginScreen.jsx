import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "./useAuth.jsx";
import { requestPasswordReset } from "../data/players.js";
import { acceptClubInvitation, peekClubInvitation, isMinor, storePendingInvite, clearPendingInvite } from "../data/clubInvitations.js";
import { listClubs, precheckMembership, requestClubMembership } from "../data/membership.js";
import { C, FONT } from "../lib/tokens.js";
import { pwdStrength } from "../lib/password.js";
import { POLICY_VERSION } from "../lib/policy.js";
import PrivacyPolicy from "../screens/shared/PrivacyPolicy.jsx";
import { Eye, EyeOff, Loader, Shield } from "../lib/icons.jsx";

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
  const { t } = useTranslation();
  const { linkError, clearLinkError } = useAuth();
  // Lien d'invitation (?invite=<token>) : parcours d'acceptation dédié (staff ou
  // joueur selon peek) où le rôle/club viennent de l'invite (serveur), jamais du
  // formulaire.
  const inviteToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invite") : null;
  // Entrée publique = connexion + acceptation d'invitation. Le self-signup avec
  // rattachement à un club est retiré (le trigger n'attache plus rien) : on rejoint
  // un club UNIQUEMENT via un lien d'invitation validé par un admin.
  const [step, setStep] = useState(inviteToken ? "invite" : "signin"); // invite | signin (role/details : hérités, inatteignables)
  const [inviteRole, setInviteRole] = useState(null); // rôle porté par l'invitation (peek)
  const [invitePeekErr, setInvitePeekErr] = useState(false);
  const [birthdate, setBirthdate] = useState(""); // acceptation joueur : décide majeur/mineur
  const [fullName, setFullName] = useState(""); // nom d'affichage (acceptation staff)
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
  // Auto-inscription joueur (0061) : club + code + totem/initiales.
  const [clubs, setClubs] = useState([]);
  const [clubId, setClubId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [totem, setTotem] = useState("");
  const [initials, setInitials] = useState("");
  useEffect(() => { listClubs().then(setClubs).catch(() => { /* liste indisponible → réessai au rendu suivant */ }); }, []);

  const st = pwdStrength(pwd);
  const sCol = st.score <= 2 ? C.coral : st.score <= 4 ? C.amb : C.green;
  const sLab = st.score <= 2 ? t("auth.reset.strengthWeak") : st.score <= 4 ? t("auth.reset.strengthMed") : t("auth.reset.strengthStrong");

  // Aperçu de l'invitation (rôle + club) pour adapter le formulaire (staff/joueur).
  useEffect(() => {
    if (!inviteToken) return;
    let alive = true;
    peekClubInvitation(inviteToken)
      .then((inv) => { if (alive) (inv ? setInviteRole(inv.role) : setInvitePeekErr(true)); })
      .catch(() => { if (alive) setInvitePeekErr(true); });
    return () => { alive = false; };
  }, [inviteToken]);

  const reset = () => {
    setErr(""); setInfo(""); setPwd(""); setPwd2(""); clearLinkError();
  };

  // ── ACCEPTATION D'INVITATION ──
  // Le compte est créé SANS rôle (le trigger ne pose pas de profil) ; c'est la
  // fonction serveur accept_club_invitation qui élève le profil au rôle/club portés
  // par l'invite. Le rôle ne transite jamais par le client.
  const doInviteSignUp = async () => {
    reset();
    const isPlayer = inviteRole === "joueur";
    const minor = isPlayer && isMinor(birthdate);
    if (!isPlayer && !fullName.trim()) return setErr(t("auth.login.errName"));
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr(t("auth.login.errEmail"));
    if (!st.valid) return setErr(t("auth.reset.errWeak"));
    if (pwd !== pwd2) return setErr(t("auth.reset.errMismatch"));
    if (isPlayer) {
      if (!birthdate) return setErr(t("auth.login.errBirthdate"));
      if (minor) {
        if (!guardianName.trim()) return setErr(t("auth.login.errGuardianName"));
        if (!/^\S+@\S+\.\S+$/.test(guardianEmail)) return setErr(t("auth.login.errGuardianEmail"));
      }
      if (!consent) return setErr(t("auth.login.errConsent"));
    }
    if (!policyOk) return setErr(t("auth.login.errPolicy"));
    setBusy(true);
    // Persiste le token AVANT signUp : si l'acceptation ne peut aboutir tout de
    // suite (email déjà inscrit → signUp sans session, reconnexion nécessaire), le
    // filet de sécurité de l'app la ré-appliquera une fois authentifié.
    const acceptPayload = isPlayer
      ? { birthdate, guardianName: guardianName.trim(), guardianEmail: guardianEmail.trim(), policyVersion: POLICY_VERSION, consent }
      : {};
    storePendingInvite(inviteToken, acceptPayload);
    const meta = isPlayer ? { policy_version: POLICY_VERSION } : { full_name: fullName.trim(), policy_version: POLICY_VERSION };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pwd, options: { data: meta } });
    if (error) { setBusy(false); return setErr(error.message); }
    // Pas de session immédiate (email déjà inscrit / confirmation requise) : on
    // invite à se connecter — l'acceptation stockée sera finalisée après connexion.
    if (!data.session) { setBusy(false); return setInfo(t("auth.login.inviteNeedsSignin")); }
    try {
      await acceptClubInvitation(inviteToken, acceptPayload);
    } catch (e) {
      setBusy(false);
      const m = e.message;
      // Erreurs terminales : le token stocké ne servira plus → on le purge.
      if (["INVITE_INVALID", "INVITE_EMAIL_MISMATCH", "ALREADY_CLAIMED"].includes(m)) clearPendingInvite();
      return setErr(m === "INVITE_INVALID" ? t("auth.login.inviteInvalid")
        : m === "INVITE_EMAIL_MISMATCH" ? t("auth.login.inviteEmailMismatch")
        : m === "ALREADY_CLAIMED" ? t("auth.login.inviteAlreadyClaimed")
        : t("auth.login.inviteError", { err: m }));
    }
    // Rattachement appliqué : token consommé, reload sur URL propre → profil élevé.
    clearPendingInvite();
    window.location.href = window.location.origin;
  };

  // ── AUTO-INSCRIPTION JOUEUR (double garde-fou : code club + validation staff) ──
  // Le compte est créé « en attente » ; l'accès au club n'est ouvert qu'après
  // validation par le staff. La pré-vérification (code + totem) évite un compte
  // orphelin sur une erreur de saisie ; le serveur re-vérifie tout à la demande.
  const doSelfSignUp = async () => {
    reset();
    const minor = isMinor(birthdate);
    if (!clubId) return setErr(t("auth.signup.errClub"));
    if (!joinCode.trim()) return setErr(t("auth.signup.errCode"));
    if (!totem.trim()) return setErr(t("auth.signup.errTotem"));
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr(t("auth.login.errEmail"));
    if (!st.valid) return setErr(t("auth.reset.errWeak"));
    if (pwd !== pwd2) return setErr(t("auth.reset.errMismatch"));
    if (!birthdate) return setErr(t("auth.login.errBirthdate"));
    if (minor) {
      if (!guardianName.trim()) return setErr(t("auth.login.errGuardianName"));
      if (!/^\S+@\S+\.\S+$/.test(guardianEmail)) return setErr(t("auth.login.errGuardianEmail"));
    }
    if (!consent) return setErr(t("auth.login.errConsent"));
    if (!policyOk) return setErr(t("auth.login.errPolicy"));
    setBusy(true);
    // Pré-vérification (hors création de compte).
    try {
      const { codeOk, totemFree } = await precheckMembership(clubId, joinCode.trim(), totem.trim());
      if (!codeOk) { setBusy(false); return setErr(t("auth.signup.errBadCode")); }
      if (!totemFree) { setBusy(false); return setErr(t("auth.signup.errTotemTaken")); }
    } catch (e) { setBusy(false); return setErr(t("auth.signup.errGeneric", { err: e.message || "" })); }
    // Création du compte auth.
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pwd, options: { data: { policy_version: POLICY_VERSION } } });
    if (error) { setBusy(false); return setErr(error.message); }
    if (!data.session) { setBusy(false); return setInfo(t("auth.login.inviteNeedsSignin")); }
    // Demande d'adhésion (statut « pending »).
    try {
      await requestClubMembership({ clubId, code: joinCode.trim(), totem: totem.trim(), initials: initials.trim(), birthdate, guardianName: guardianName.trim(), guardianEmail: guardianEmail.trim(), policyVersion: POLICY_VERSION, consent });
    } catch (e) {
      setBusy(false);
      const m = e.message || "";
      return setErr(m.includes("BAD_CODE") ? t("auth.signup.errBadCode")
        : m.includes("TOTEM_TAKEN") ? t("auth.signup.errTotemTaken")
        : m.includes("ALREADY_MEMBER") ? t("auth.signup.errAlreadyMember")
        : m.includes("CONSENT_REQUIRED") ? t("auth.login.errConsent")
        : t("auth.signup.errGeneric", { err: m }));
    }
    // Compte en attente → reload sur URL propre → écran d'attente de validation.
    window.location.href = window.location.origin;
  };

  // ── CONNEXION ──
  const doSignIn = async () => {
    reset();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr(t("auth.login.errEmail"));
    if (!pwd) return setErr(t("auth.login.errPwdEmpty"));
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd });
    setBusy(false);
    if (error) return setErr(t("auth.login.errSignin"));
    // succès → onAuthStateChange
  };

  const doForgot = async () => {
    reset();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr(t("auth.login.errEmailFirst"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setInfo(t("auth.login.forgotInfo"));
  };

  // Joueur : demander au staff/responsable de réinitialiser le mot de passe.
  const doRequestStaff = async () => {
    reset();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr(t("auth.login.errEmailFirst"));
    setBusy(true);
    try { await requestPasswordReset(email.trim()); } catch { /* réponse volontairement générique */ }
    setBusy(false);
    setInfo(t("auth.login.staffRequestInfo"));
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
        {t("auth.login.headerSub")}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: C.coral, letterSpacing: 1 }}>PERFORMANCE</div>{/* i18n-ok: nom du produit */}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{t("auth.login.headerTagline")}</div>
    </div>
  );

  const Feedback = () =>
    err ? (
      <div style={{ fontSize: 11, color: C.coral, margin: "2px 0 10px", textAlign: "center" }}>{err}</div>
    ) : info ? (
      <div style={{ fontSize: 11, color: C.green, margin: "2px 0 10px", textAlign: "center" }}>{info}</div>
    ) : null;

  /* ── ACCEPTATION D'INVITATION (staff ou joueur, selon peek) ── */
  if (step === "invite") {
    const isPlayer = inviteRole === "joueur";
    const minor = isPlayer && isMinor(birthdate);
    return (
      <div style={wrap}>
        {styleTag}
        {showPolicy && <PrivacyPolicy onClose={() => setShowPolicy(false)} />}
        <div style={{ width: "100%", maxWidth: 380 }}>
          <Header />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, justifyContent: "center", color: C.coral }}>
            <Shield size={16} />
            <span style={{ fontSize: 15, fontWeight: 800 }}>{isPlayer ? t("auth.login.invitePlayerTitle") : t("auth.login.inviteTitle")}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>{isPlayer ? t("auth.login.invitePlayerSubtitle") : t("auth.login.inviteSubtitle")}</div>

          {invitePeekErr ? (
            <>
              <div style={{ fontSize: 12, color: C.amb, background: `${C.amb}18`, border: `1px solid ${C.amb}55`, borderRadius: 9, padding: "10px 12px", marginBottom: 12, textAlign: "center", lineHeight: 1.5 }}>{t("auth.login.inviteInvalid")}</div>
              <button onClick={() => { reset(); setStep("signin"); }} style={{ width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>{t("auth.login.backToSignin")}</button>
            </>
          ) : !inviteRole ? (
            <div style={{ textAlign: "center", padding: 18, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{t("common.loading")}</div>
          ) : (
            <>
              {!isPlayer && (
                <>
                  <div style={label}>{t("auth.login.nameLabel")}</div>
                  <input value={fullName} onChange={(e) => { setFullName(e.target.value); setErr(""); }} placeholder={t("auth.login.namePlaceholder")} style={input(false)} />
                </>
              )}

              <div style={label}>{t("auth.login.emailLabel")}</div>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder={t("auth.login.emailPlaceholder")} autoComplete="email" style={input(false)} />

              <div style={label}>{t("auth.login.pwdLabel")}</div>
              <div style={{ position: "relative" }}>
                <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} placeholder={t("auth.login.pwdPlaceholder")} autoComplete="new-password" style={input(false)} />
                <button onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {pwd && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: 5, width: `${(st.score / 7) * 100}%`, background: sCol, transition: "width .3s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: sCol, marginTop: 4 }}>{sLab} — {st.valid ? t("auth.reset.valid") : t("auth.reset.weakHint")}</div>
                </div>
              )}
              <input type={showPwd ? "text" : "password"} value={pwd2} onChange={(e) => { setPwd2(e.target.value); setErr(""); }} placeholder={t("auth.reset.confirmPlaceholder")} autoComplete="new-password" style={input(pwd2 && pwd !== pwd2)} />

              {isPlayer && (
                <>
                  <div style={label}>{t("auth.login.birthdateLabel")}</div>
                  <input type="date" value={birthdate} onChange={(e) => { setBirthdate(e.target.value); setErr(""); }} style={{ ...input(false), colorScheme: "dark" }} />
                  {minor ? (
                    <div style={{ marginTop: 2, marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: 10, color: C.amb, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>{t("auth.login.guardianSection")}</div>
                      <input value={guardianName} onChange={(e) => { setGuardianName(e.target.value); setErr(""); }} placeholder={t("auth.login.guardianNamePlaceholder")} style={input(false)} />
                      <input type="email" value={guardianEmail} onChange={(e) => { setGuardianEmail(e.target.value); setErr(""); }} placeholder={t("auth.login.guardianEmailPlaceholder")} autoComplete="off" style={input(false)} />
                      <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer" }}>
                        <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
                        <span>{t("auth.login.consentText")}</span>
                      </label>
                    </div>
                  ) : birthdate ? (
                    <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer", margin: "6px 0 4px" }}>
                      <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
                      <span>{t("auth.login.consentAdult")}</span>
                    </label>
                  ) : null}
                </>
              )}

              <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer", margin: "8px 0 4px" }}>
                <input type="checkbox" checked={policyOk} onChange={(e) => { setPolicyOk(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
                <span>{t("auth.login.policyAck")}
                  <button type="button" onClick={() => setShowPolicy(true)} style={{ background: "none", border: "none", color: C.viol, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: 11.5 }}>{t("auth.login.policyLink")}</button>.
                </span>
              </label>

              <Feedback />
              <button onClick={doInviteSignUp} disabled={busy} style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : C.coral, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 4, opacity: busy ? 0.6 : 1 }}>
                {busy ? spinner : t("auth.login.inviteBtn")}
              </button>
              <button onClick={() => { reset(); setStep("signin"); }} style={{ width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", marginTop: 12 }}>
                {t("auth.login.alreadyRegistered")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── AUTO-INSCRIPTION JOUEUR ── */
  if (step === "signup") {
    const minor = isMinor(birthdate);
    return (
      <div style={wrap}>
        {styleTag}
        {showPolicy && <PrivacyPolicy onClose={() => setShowPolicy(false)} />}
        <div style={{ width: "100%", maxWidth: 380 }}>
          <Header />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, justifyContent: "center", color: C.green }}>
            <Shield size={16} />
            <span style={{ fontSize: 15, fontWeight: 800 }}>{t("auth.signup.title")}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>{t("auth.signup.subtitle")}</div>

          <div style={label}>{t("auth.signup.clubLabel")}</div>
          <select value={clubId} onChange={(e) => { setClubId(e.target.value); setErr(""); }} style={{ ...input(false), colorScheme: "dark" }}>
            <option value="">{t("auth.signup.clubPlaceholder")}</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>

          <div style={label}>{t("auth.signup.codeLabel")}</div>
          <input value={joinCode} onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setErr(""); }} placeholder={t("auth.signup.codePlaceholder")} autoCapitalize="characters" autoComplete="off" style={input(false)} />
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: -4, marginBottom: 10, lineHeight: 1.5 }}>{t("auth.signup.codeHint")}</div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <div style={label}>{t("auth.signup.totemLabel")}</div>
              <input value={totem} onChange={(e) => { setTotem(e.target.value); setErr(""); }} placeholder={t("auth.signup.totemPlaceholder")} style={input(false)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={label}>{t("auth.signup.initialsLabel")}</div>
              <input value={initials} onChange={(e) => { setInitials(e.target.value); setErr(""); }} placeholder="I.F." maxLength={8} style={input(false)} />
            </div>
          </div>

          <div style={label}>{t("auth.login.emailLabel")}</div>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder={t("auth.login.emailPlaceholder")} autoComplete="email" style={input(false)} />

          <div style={label}>{t("auth.login.pwdLabel")}</div>
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} placeholder={t("auth.login.pwdPlaceholder")} autoComplete="new-password" style={input(false)} />
            <button onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {pwd && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: 5, width: `${(st.score / 7) * 100}%`, background: sCol, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 10, color: sCol, marginTop: 4 }}>{sLab} — {st.valid ? t("auth.reset.valid") : t("auth.reset.weakHint")}</div>
            </div>
          )}
          <input type={showPwd ? "text" : "password"} value={pwd2} onChange={(e) => { setPwd2(e.target.value); setErr(""); }} placeholder={t("auth.reset.confirmPlaceholder")} autoComplete="new-password" style={input(pwd2 && pwd !== pwd2)} />

          <div style={label}>{t("auth.login.birthdateLabel")}</div>
          <input type="date" value={birthdate} onChange={(e) => { setBirthdate(e.target.value); setErr(""); }} style={{ ...input(false), colorScheme: "dark" }} />
          {minor ? (
            <div style={{ marginTop: 2, marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 10, color: C.amb, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>{t("auth.login.guardianSection")}</div>
              <input value={guardianName} onChange={(e) => { setGuardianName(e.target.value); setErr(""); }} placeholder={t("auth.login.guardianNamePlaceholder")} style={input(false)} />
              <input type="email" value={guardianEmail} onChange={(e) => { setGuardianEmail(e.target.value); setErr(""); }} placeholder={t("auth.login.guardianEmailPlaceholder")} autoComplete="off" style={input(false)} />
              <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
                <span>{t("auth.login.consentText")}</span>
              </label>
            </div>
          ) : birthdate ? (
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer", margin: "6px 0 4px" }}>
              <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
              <span>{t("auth.login.consentAdult")}</span>
            </label>
          ) : null}

          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: "pointer", margin: "8px 0 4px" }}>
            <input type="checkbox" checked={policyOk} onChange={(e) => { setPolicyOk(e.target.checked); setErr(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: C.green, flexShrink: 0 }} />
            <span>{t("auth.login.policyAck")}
              <button type="button" onClick={() => setShowPolicy(true)} style={{ background: "none", border: "none", color: C.viol, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: 11.5 }}>{t("auth.login.policyLink")}</button>.
            </span>
          </label>

          <Feedback />
          <button onClick={doSelfSignUp} disabled={busy} style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : C.green, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 4, opacity: busy ? 0.6 : 1 }}>
            {busy ? spinner : t("auth.signup.submit")}
          </button>
          <button onClick={() => { reset(); setStep("signin"); }} style={{ width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", marginTop: 12 }}>
            {t("auth.login.alreadyRegistered")}
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
          <span style={{ fontSize: 12, fontWeight: 700 }}>{t("auth.login.secureLogin")}</span>
        </div>
        {linkError && (
          <div style={{ fontSize: 11.5, color: C.amb, background: `${C.amb}18`, border: `1px solid ${C.amb}55`, borderRadius: 9, padding: "9px 11px", marginBottom: 12, textAlign: "center", lineHeight: 1.5 }}>
            {linkError}
          </div>
        )}
        <div style={label}>{t("auth.login.emailLabel")}</div>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder={t("auth.login.emailPlaceholder")} autoComplete="email" style={input(false)} />
        <div style={label}>{t("auth.login.pwdLabel")}</div>
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} placeholder={t("auth.login.pwdPlaceholder")} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && doSignIn()} style={input(false)} />
          <button onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <Feedback />
        <button onClick={doSignIn} disabled={busy} style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : C.coral, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? spinner : t("auth.login.signinBtn")}
        </button>
        {/* Deux options de réinitialisation, côte à côte :
            — « Mot de passe oublié ? » : lien email (surtout staff/owner).
            — « Demander au staff » : le joueur demande, ça remonte au responsable. */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={doForgot} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>
            {t("auth.login.forgot")}
          </button>
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>·</span>
          <button onClick={doRequestStaff} style={{ background: "none", border: "none", color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            {t("auth.login.askStaff")}
          </button>
        </div>
        <div style={{ borderTop: `1px solid ${C.border2}`, margin: "16px 0 0", paddingTop: 14 }}>
          <button onClick={() => { reset(); setStep("signup"); }} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.green}55`, borderRadius: 10, padding: 12, color: C.green, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            {t("auth.signup.cta")}
          </button>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
            {t("auth.signup.staffNote")}
          </div>
        </div>
      </div>
    </div>
  );
}
