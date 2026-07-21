import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, FONT } from "../../lib/tokens.js";
import { Shield, Check } from "../../lib/icons.jsx";

/* Écran d'un joueur AUTO-INSCRIT non encore actif (migration 0061) :
   - pending  : demande envoyée, en attente de validation par le staff ;
   - rejected : demande refusée.
   Le joueur est authentifié mais n'a AUCUN accès au club tant qu'il n'est pas
   validé (profiles.team_id nul → RLS). « Actualiser » relit le profil (le staff
   ayant pu valider entre-temps → bascule automatique dans l'app). */
export default function MembershipGate({ status, email, onSignOut, onRefresh }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const rejected = status === "rejected";

  const refresh = async () => {
    setBusy(true);
    try { await onRefresh?.(); } finally { setBusy(false); }
  };

  const accent = rejected ? C.coral : C.viol;
  const btn = { width: "100%", border: "none", borderRadius: 10, padding: "12px 14px", fontWeight: 800, fontSize: 13.5, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 16, padding: "30px 26px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 27, background: `${accent}22`, border: `1px solid ${accent}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {rejected ? <Shield size={26} color={accent} /> : <Check size={26} color={accent} />}
          </div>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>
          {rejected ? t("membership.rejectedTitle") : t("membership.pendingTitle")}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 22 }}>
          {rejected ? t("membership.rejectedBody") : t("membership.pendingBody")}
        </div>
        {email && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{email}</div>}
        {!rejected && (
          <button onClick={refresh} disabled={busy} style={{ ...btn, background: accent, color: "#fff", marginBottom: 10, opacity: busy ? 0.6 : 1 }}>
            {busy ? t("membership.checking") : t("membership.refresh")}
          </button>
        )}
        <button onClick={onSignOut} style={{ ...btn, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}>{t("common.logout")}</button>
      </div>
    </div>
  );
}
