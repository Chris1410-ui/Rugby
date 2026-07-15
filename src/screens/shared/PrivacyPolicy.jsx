import { C } from "../../lib/tokens.js";
import { POLICY, CONTROLLER } from "../../lib/policy.js";
import { Shield, X } from "../../lib/icons.jsx";

/* Politique de confidentialité. Rendu inline, ou en modal si `onClose` fourni
   (lien depuis l'inscription, la connexion ou l'écran « Mes données »). */
export default function PrivacyPolicy({ onClose }) {
  const body = (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Shield size={20} color={C.green} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Politique de confidentialité</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
            Version {POLICY.version} · {POLICY.updated} · hébergement UE (RGPD)
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.65, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>
        {POLICY.intro}
      </p>
      {POLICY.sections.map((s) => (
        <div key={s.title} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.viol, marginBottom: 3 }}>{s.title}</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.65)" }}>{s.body}</div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", borderTop: `1px solid ${C.border2}`, paddingTop: 10, marginTop: 4, lineHeight: 1.5 }}>
        Responsable de traitement : {CONTROLLER.name}
        {CONTROLLER.address ? `, ${CONTROLLER.address}` : ""} — {CONTROLLER.contact}
      </div>
    </div>
  );

  if (!onClose) return body;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: C.navy, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "90vh", overflowY: "auto", fontFamily: "inherit", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        {body}
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, background: C.green, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
    </div>
  );
}
