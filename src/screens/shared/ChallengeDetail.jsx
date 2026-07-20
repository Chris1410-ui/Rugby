import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { bannerGradient, bannerOf, assignedLabel } from "../../lib/challenges.js";
import { fmtShort } from "../../lib/metrics.js";

/* Vue détail « plein écran » d'un défi, partagée staff + joueur. Bannière large,
   tous les champs lisibles (description complète, heure, lieu, échéance, matériel,
   destinataires, points). `topRight` = actions d'en-tête (Modifier/Supprimer côté
   staff) ; `children` = zone d'action/participants selon le rôle.
   Fermeture cohérente : croix 44px, backdrop, RETOUR/Échap (useModalClose). */
export default function ChallengeDetail({ c, onClose, topRight, children }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const grad = bannerGradient(c.banner);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.navy, borderRadius: 18, maxHeight: "94vh", overflowY: "auto" }}>
        {/* Bannière : badge + titre + points, croix toujours accessible */}
        <div style={{ background: grad, padding: "16px 16px 18px", position: "relative" }}>
          <div style={{ position: "absolute", top: 12, right: 12 }}><CloseX onClose={onClose} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 52 }}>
            <div style={{ width: 58, height: 58, borderRadius: 14, background: "rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0, boxShadow: "inset 0 0 14px rgba(0,0,0,0.25)" }}>{c.badge || bannerOf(c.banner).emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)", lineHeight: 1.2 }}>{c.titre}</div>
              <div style={{ marginTop: 7, display: "inline-flex", alignItems: "baseline", gap: 5, background: "rgba(0,0,0,0.25)", borderRadius: 9, padding: "3px 10px" }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>+{c.points}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: 1 }}>{t("shared.challengeDetail.pts")}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {topRight && <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>{topRight}</div>}

          {c.description && (
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.5, marginBottom: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.description}</div>
          )}

          {/* Détails clés */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <Info label={t("shared.challengeDetail.infoHeure")} value={c.heure || "—"} />
            <Info label={t("shared.challengeDetail.infoLieu")} value={c.lieu || "—"} />
            <Info label={t("shared.challengeDetail.infoEcheance")} value={c.echeance ? fmtShort(c.echeance) : "—"} />
            <Info label={t("shared.challengeDetail.infoDest")} value={assignedLabel(t, c.assigned)} />
          </div>

          {/* Matériel */}
          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>{t("shared.challengeDetail.materiel")}</div>
            {(c.materiel || []).length === 0 ? (
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>{t("shared.challengeDetail.none")}</div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.materiel.map((m, i) => <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px" }}>{m}</span>)}
              </div>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

const lbl = { fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginBottom: 6 };
