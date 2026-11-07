import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Overlay } from "../../lib/ui.jsx";
import { inviteHeadCoach } from "../../data/coachInvite.js";
import { Send, CheckCircle } from "../../lib/icons.jsx";

/* Inviter un head coach (owner/staff écrivain). Nom + prénom + email → crée
   l'invitation (role coach) et envoie un lien magique (passwordless). Au clic,
   le coach est connecté et son profil coach lecture seule est créé à la volée. */
export default function CoachInviteSheet({ teamId = null, onClose }) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async () => {
    if (busy) return;
    setErr("");
    if (!valid) { setErr(t("staff.coachInvite.errEmail")); return; }
    setBusy(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      await inviteHeadCoach({ email: email.trim(), fullName, teamId });
      setSent(true);
    } catch (e) {
      const m = e?.message || "";
      setErr(m.includes("NOT_AUTHORIZED") ? t("staff.coachInvite.errAuth")
        : m.includes("EMAIL_INVALID") ? t("staff.coachInvite.errEmail")
        : t("staff.coachInvite.errGeneric"));
    }
    setBusy(false);
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "11px 12px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10 };
  const lbl = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 5 };

  return (
    <Overlay onClose={onClose} sheet z={340}>
      <div style={{ padding: "4px 18px 10px", fontSize: 16, fontWeight: 900 }}>{t("staff.coachInvite.title")}</div>
      <div style={{ padding: "0 18px 24px" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "14px 6px" }}>
            <CheckCircle size={30} color={C.green} />
            <div style={{ fontSize: 14, fontWeight: 800, margin: "10px 0 4px" }}>{t("staff.coachInvite.sentTitle")}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{t("staff.coachInvite.sentBody", { email: email.trim() })}</div>
            <button onClick={onClose} style={{ marginTop: 16, background: C.green, border: "none", borderRadius: 10, padding: "11px 16px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("common.close")}</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 14 }}>{t("staff.coachInvite.intro")}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><div style={lbl}>{t("staff.coachInvite.firstName")}</div>
                <input value={firstName} onChange={(e) => { setFirstName(e.target.value); setErr(""); }} style={inp} /></div>
              <div style={{ flex: 1 }}><div style={lbl}>{t("staff.coachInvite.lastName")}</div>
                <input value={lastName} onChange={(e) => { setLastName(e.target.value); setErr(""); }} style={inp} /></div>
            </div>
            <div style={lbl}>{t("staff.coachInvite.email")}</div>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder={t("auth.login.emailPlaceholder")} autoComplete="off" style={inp} />
            {err && <div style={{ fontSize: 11.5, color: C.coral, margin: "2px 0 10px", textAlign: "center" }}>{err}</div>}
            <button onClick={submit} disabled={busy || !valid} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: busy || !valid ? "rgba(255,255,255,0.1)" : C.coral, border: "none", borderRadius: 11, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy || !valid ? "default" : "pointer" }}>
              <Send size={15} color="#fff" /> {busy ? t("staff.coachInvite.sending") : t("staff.coachInvite.submit")}
            </button>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 12, lineHeight: 1.5 }}>{t("staff.coachInvite.note")}</div>
          </>
        )}
      </div>
    </Overlay>
  );
}
