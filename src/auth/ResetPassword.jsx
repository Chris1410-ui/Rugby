import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "./useAuth.jsx";
import { C, FONT } from "../lib/tokens.js";
import { pwdStrength } from "../lib/password.js";
import { Eye, EyeOff, Shield, CheckCircle, Loader } from "../lib/icons.jsx";

const wrap = {
  minHeight: "100vh",
  background: `radial-gradient(120% 80% at 50% -10%, #2a2550 0%, ${C.navy} 60%)`,
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: 24, fontFamily: FONT, color: "#fff",
};
const input = (err) => ({ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${err ? C.coral : C.border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none", marginBottom: 10 });

/* Écran « nouveau mot de passe » — affiché après clic sur le lien de
   réinitialisation reçu par email (événement PASSWORD_RECOVERY). */
export default function ResetPassword() {
  const { t } = useTranslation();
  const { endRecovery, signOut } = useAuth();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const st = pwdStrength(pwd);
  const sCol = st.score <= 2 ? C.coral : st.score <= 4 ? C.amb : C.green;
  const sLab = st.score <= 2 ? t("auth.reset.strengthWeak") : st.score <= 4 ? t("auth.reset.strengthMed") : t("auth.reset.strengthStrong");

  const submit = async () => {
    setErr("");
    if (!st.valid) return setErr(t("auth.reset.errWeak"));
    if (pwd !== pwd2) return setErr(t("auth.reset.errMismatch"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
  };

  if (done) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <CheckCircle size={40} color={C.green} />
          <div style={{ fontSize: 17, fontWeight: 800, margin: "12px 0 6px" }}>{t("auth.reset.doneTitle")}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 18 }}>
            {t("auth.reset.doneDesc")}
          </div>
          <button onClick={endRecovery} style={{ width: "100%", background: C.green, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{t("auth.reset.continue")}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
          <Shield size={16} color={C.green} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("auth.reset.title")}</span>
        </div>
        <div style={{ position: "relative" }}>
          <input type={show ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} placeholder={t("auth.reset.newPlaceholder")} autoComplete="new-password" autoFocus style={input(false)} />
          <button onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
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
        <input type={show ? "text" : "password"} value={pwd2} onChange={(e) => { setPwd2(e.target.value); setErr(""); }} placeholder={t("auth.reset.confirmPlaceholder")} autoComplete="new-password" style={input(pwd2 && pwd !== pwd2)} />
        {err && <div style={{ fontSize: 11, color: C.coral, margin: "2px 0 10px", textAlign: "center" }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ width: "100%", background: busy ? "rgba(255,255,255,0.1)" : C.green, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}><Loader size={16} /></span> : t("auth.reset.save")}
        </button>
        <button onClick={async () => { await signOut(); endRecovery(); }} style={{ width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", marginTop: 12 }}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
