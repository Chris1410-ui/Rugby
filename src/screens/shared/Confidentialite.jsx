import { useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { Section } from "../../lib/ui.jsx";
import { Shield, Download, Trash2, AlertTriangle, CheckCircle, Loader, Lock } from "../../lib/icons.jsx";
import { useAuth } from "../../auth/useAuth.jsx";
import { fetchConsent, exportPlayerData, downloadJSON, slugify, erasePlayer } from "../../data/gdpr.js";
import { usePreview } from "../../lib/preview.js";
import PrivacyPolicy from "./PrivacyPolicy.jsx";

const CONFIRM_WORD = "SUPPRIMER";

/* Écran « Mes données » (RGPD). Réutilisable :
   - self=true  → le joueur gère ses propres données (export + suppression de compte)
   - self=false → le staff gère un joueur de son équipe (depuis la fiche)
   `onErased` est appelé après un effacement réussi (staff : fermer/rafraîchir). */
export default function Confidentialite({ player, self = false, onErased }) {
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
      setOk("Export téléchargé.");
    } catch (e) { setErr(e.message || "Échec de l'export."); }
    setExporting(false);
  };

  const doErase = async () => {
    if (preview) return; // lecture seule : pas d'effacement sous l'identité du joueur
    if (word.trim().toUpperCase() !== CONFIRM_WORD) return setErr(`Tape « ${CONFIRM_WORD} » pour confirmer.`);
    setErr(""); setBusy(true);
    try {
      await erasePlayer(player.id);
      if (self) { await signOut(); } // le compte n'existe plus → retour au login
      else { onErased?.(); }
    } catch (e) { setErr(e.message || "Échec de la suppression."); setBusy(false); }
  };

  const line = { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border2}`, fontSize: 12 };

  return (
    <div>
      {showPolicy && <PrivacyPolicy onClose={() => setShowPolicy(false)} />}
      {preview && (
        <div style={sc({ marginBottom: 12, fontSize: 11.5, lineHeight: 1.5, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)", borderColor: C.border, fontWeight: 700, textAlign: "center" })}>👁 Mode aperçu — lecture seule (export & effacement désactivés)</div>
      )}

      <div style={sc({ display: "flex", alignItems: "center", gap: 12, padding: 16, marginBottom: 12 })}>
        <Lock size={22} color={C.green} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{self ? "Mes données" : `Données de ${displayName(player)}`}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
            Accès, export et effacement — conformément au RGPD.
          </div>
        </div>
      </div>

      {/* Consentement */}
      <Section title="CONSENTEMENT PARENTAL">
        {loadingC ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Chargement…</div>
        ) : consent ? (
          <div>
            <div style={line}><span style={{ color: "rgba(255,255,255,0.6)" }}>Statut</span>
              <span style={{ fontWeight: 800, color: consent.consent_given ? C.green : C.coral }}>
                {consent.consent_given ? "✓ Consentement donné" : "✗ Non consenti"}
              </span></div>
            <div style={line}><span style={{ color: "rgba(255,255,255,0.6)" }}>Représentant légal</span>
              <span style={{ fontWeight: 700 }}>{consent.guardian_name || "—"}</span></div>
            <div style={line}><span style={{ color: "rgba(255,255,255,0.6)" }}>Email du responsable</span>
              <span style={{ fontWeight: 700 }}>{consent.guardian_email || "—"}</span></div>
            <div style={{ ...line, borderBottom: "none" }}><span style={{ color: "rgba(255,255,255,0.6)" }}>Politique acceptée</span>
              <span style={{ fontWeight: 700 }}>v{consent.policy_version}{consent.consented_at ? ` · ${new Date(consent.consented_at).toLocaleDateString("fr-BE")}` : ""}</span></div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} color={C.amb} /> Aucun consentement enregistré pour ce joueur.
          </div>
        )}
        <button onClick={() => setShowPolicy(true)} style={{ marginTop: 10, background: "none", border: "none", color: C.viol, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={13} /> Voir la politique de confidentialité
        </button>
      </Section>

      {/* Export / portabilité */}
      <Section title="PORTABILITÉ">
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, marginBottom: 10 }}>
          Télécharge {self ? "tes" : "les"} données (bilans, séances, messages, consentement) au format JSON.
        </div>
        <button onClick={doExport} disabled={exporting || preview} style={{ width: "100%", background: C.blue, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: exporting || preview ? 0.5 : 1 }}>
          {exporting ? <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}><Loader size={15} /></span> : <Download size={15} />}
          {self ? "Exporter mes données" : "Exporter les données du joueur"}
        </button>
      </Section>

      {/* Effacement */}
      <Section title="DROIT À L'EFFACEMENT">
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, marginBottom: 10 }}>
          Supprime définitivement {self ? "ton compte et toutes tes données" : "ce joueur et toutes ses données"}
          {" "}(bilans, séances, messages, consentement){self ? "" : ", ainsi que son compte s'il en a un"}.
          <b style={{ color: C.coral }}> Cette action est irréversible.</b>
        </div>
        {!confirm ? (
          <button onClick={() => { if (preview) return; setConfirm(true); setErr(""); }} disabled={preview} style={{ width: "100%", background: "transparent", border: `1px solid ${C.coral}`, borderRadius: 10, padding: 12, color: C.coral, fontWeight: 800, fontSize: 13, cursor: preview ? "default" : "pointer", opacity: preview ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Trash2 size={15} /> {self ? "Supprimer mon compte et mes données" : "Supprimer ce joueur et ses données"}
          </button>
        ) : (
          <div style={{ border: `1px solid ${C.coral}55`, borderRadius: 10, padding: 12, background: `${C.coral}11` }}>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
              Pour confirmer, tape <b>{CONFIRM_WORD}</b> ci-dessous.
            </div>
            <input value={word} onChange={(e) => { setWord(e.target.value); setErr(""); }} placeholder={CONFIRM_WORD} autoCapitalize="characters"
              style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 2, textAlign: "center", outline: "none", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setConfirm(false); setWord(""); setErr(""); }} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Annuler</button>
              <button onClick={doErase} disabled={busy} style={{ flex: 2, background: C.coral, border: "none", borderRadius: 8, padding: 11, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
                {busy ? <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}><Loader size={14} /></span> : <Trash2 size={14} />} Supprimer définitivement
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
