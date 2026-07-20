import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { Section } from "../../lib/ui.jsx";
import { Shield, Download, Trash2, AlertTriangle, CheckCircle, Loader, Lock } from "../../lib/icons.jsx";
import { useAuth } from "../../auth/useAuth.jsx";
import { fetchConsent, exportPlayerData, downloadJSON, slugify, erasePlayer } from "../../data/gdpr.js";
import { usePreview } from "../../lib/preview.js";
import PrivacyPolicy from "./PrivacyPolicy.jsx";

/* Écran « Mes données » (RGPD). Réutilisable :
   - self=true  → le joueur gère ses propres données (export + suppression de compte)
   - self=false → le staff gère un joueur de son équipe (depuis la fiche)
   `onErased` est appelé après un effacement réussi (staff : fermer/rafraîchir). */
export default function Confidentialite({ player, self = false, onErased }) {
  const { t } = useTranslation();
  const CONFIRM_WORD = t("shared.privacy.confirmWord");
  const preview = usePreview(); // aperçu owner/staff → lecture seule
  const { signOut } = useAuth();
  const [consent, setConsent] = useState(null);
  const [loadingC, setLoadingC] = useState(true);
  const [showPolicy, setShowPolicy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingC(true);
    fetchConsent(player.id)
      .then((c) => active && setConsent(c))
      .catch(() => active && setConsent(null))
      .finally(() => active && setLoadingC(false));
    return () => { active = false; };
  }, [player.id]);

  const doExport = async () => {
    if (preview) return; // lecture seule : pas d'action RGPD sous l'identité du joueur
    setErr(""); setOk(""); setExporting(true);
    try {
      const bundle = await exportPlayerData(player);
      downloadJSON(bundle, `donnees-${slugify(player.name)}.json`);
      setOk(t("shared.privacy.exportDone"));
    } catch (e) { setErr(e.message || t("shared.privacy.exportFail")); }
    setExporting(false);
  };

  const doErase = async () => {
    if (preview) return; // lecture seule : pas d'effacement sous l'identité du joueur
    if (word.trim().toUpperCase() !== CONFIRM_WORD.toUpperCase()) return setErr(t("shared.privacy.eraseConfirmPrompt", { word: CONFIRM_WORD }));
    setErr(""); setBusy(true);
    try {
      await erasePlayer(player.id);
      if (self) { await signOut(); } // le compte n'existe plus → retour au login
      else { onErased?.(); }
    } catch (e) { setErr(e.message || t("shared.privacy.eraseFail")); setBusy(false); }
  };

  const line = { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border2}`, fontSize: 12 };

  return (
    <div>
      {showPolicy && <PrivacyPolicy onClose={() => setShowPolicy(false)} />}
      {preview && (
        <div style={sc({ marginBottom: 12, fontSize: 11.5, lineHeight: 1.5, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)", borderColor: C.border, fontWeight: 700, textAlign: "center" })}>{t("shared.privacy.previewBanner")}</div>
      )}

      <div style={sc({ display: "flex", alignItems: "center", gap: 12, padding: 16, marginBottom: 12 })}>
        <Lock size={22} color={C.green} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{self ? t("shared.privacy.titleSelf") : t("shared.privacy.titleOther", { name: displayName(player) })}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
            {t("shared.privacy.subtitle")}
          </div>
        </div>
      </div>

      {/* Consentement */}
      <Section title={t("shared.privacy.consentTitle")}>
        {loadingC ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("shared.privacy.loading")}</div>
        ) : consent ? (
          <div>
            <div style={line}><span style={{ color: "rgba(255,255,255,0.6)" }}>{t("shared.privacy.statusLabel")}</span>
              <span style={{ fontWeight: 800, color: consent.consent_given ? C.green : C.coral }}>
                {consent.consent_given ? t("shared.privacy.consentGiven") : t("shared.privacy.consentNot")}
              </span></div>
            <div style={line}><span style={{ color: "rgba(255,255,255,0.6)" }}>{t("shared.privacy.guardian")}</span>
              <span style={{ fontWeight: 700 }}>{consent.guardian_name || "—"}</span></div>
            <div style={line}><span style={{ color: "rgba(255,255,255,0.6)" }}>{t("shared.privacy.guardianEmail")}</span>
              <span style={{ fontWeight: 700 }}>{consent.guardian_email || "—"}</span></div>
            <div style={{ ...line, borderBottom: "none" }}><span style={{ color: "rgba(255,255,255,0.6)" }}>{t("shared.privacy.policyAccepted")}</span>
              <span style={{ fontWeight: 700 }}>v{consent.policy_version}{consent.consented_at ? ` · ${new Date(consent.consented_at).toLocaleDateString(localeTag())}` : ""}</span></div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} color={C.amb} /> {t("shared.privacy.noConsent")}
          </div>
        )}
        <button onClick={() => setShowPolicy(true)} style={{ marginTop: 10, background: "none", border: "none", color: C.viol, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={13} /> {t("shared.privacy.viewPolicy")}
        </button>
      </Section>

      {/* Export / portabilité */}
      <Section title={t("shared.privacy.portabilityTitle")}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, marginBottom: 10 }}>
          {t("shared.privacy.portabilityDesc", { poss: self ? t("shared.privacy.possSelf") : t("shared.privacy.possOther") })}
        </div>
        <button onClick={doExport} disabled={exporting || preview} style={{ width: "100%", background: C.blue, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: exporting || preview ? 0.5 : 1 }}>
          {exporting ? <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}><Loader size={15} /></span> : <Download size={15} />}
          {self ? t("shared.privacy.exportSelf") : t("shared.privacy.exportOther")}
        </button>
      </Section>

      {/* Effacement */}
      <Section title={t("shared.privacy.eraseTitle")}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, marginBottom: 10 }}>
          {self ? t("shared.privacy.eraseDescSelf") : t("shared.privacy.eraseDescOther")}
          <b style={{ color: C.coral }}> {t("shared.privacy.eraseIrreversible")}</b>
        </div>
        {!confirm ? (
          <button onClick={() => { if (preview) return; setConfirm(true); setErr(""); }} disabled={preview} style={{ width: "100%", background: "transparent", border: `1px solid ${C.coral}`, borderRadius: 10, padding: 12, color: C.coral, fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", opacity: preview ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Trash2 size={15} /> {self ? t("shared.privacy.eraseBtnSelf") : t("shared.privacy.eraseBtnOther")}
          </button>
        ) : (
          <div style={{ border: `1px solid ${C.coral}55`, borderRadius: 10, padding: 12, background: `${C.coral}11` }}>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
              {t("shared.privacy.confirmPrompt1")}<b>{CONFIRM_WORD}</b>{t("shared.privacy.confirmPrompt2")}
            </div>
            <input value={word} onChange={(e) => { setWord(e.target.value); setErr(""); }} placeholder={CONFIRM_WORD} autoCapitalize="characters"
              style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 2, textAlign: "center", outline: "none", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setConfirm(false); setWord(""); setErr(""); }} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
              <button onClick={doErase} disabled={busy} style={{ flex: 2, background: C.coral, border: "none", borderRadius: 8, padding: 11, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
                {busy ? <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}><Loader size={14} /></span> : <Trash2 size={14} />} {t("shared.privacy.eraseFinal")}
              </button>
            </div>
          </div>
        )}
      </Section>

      {err && <div style={{ fontSize: 12, color: C.coral, textAlign: "center", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><AlertTriangle size={13} /> {err}</div>}
      {ok && <div style={{ fontSize: 12, color: C.green, textAlign: "center", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><CheckCircle size={13} /> {ok}</div>}
    </div>
  );
}
