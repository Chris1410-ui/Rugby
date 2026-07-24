import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { Plus, Trash2, Check, Shield } from "../../lib/icons.jsx";
import { fmtShort } from "../../lib/metrics.js";
import { useClubInvitations, createClubInvitation, revokeClubInvitation, inviteLink, sendInvitationEmail } from "../../data/clubInvitations.js";
import ClubInviteCodes from "./ClubInviteCodes.jsx";

const accent = C.coral;
const STAFF_INVITE_ROLES = ["preparateur", "medical", "coach"];

/* Invitations staff : l'owner ou un staff écrivain émet un lien d'invitation
   (rôle + club portés serveur). L'invité crée son compte via ce lien → son profil
   est élevé au bon rôle. Le staff ne se rattache plus jamais seul à un club. */
export default function StaffInvites({ teamId }) {
  const { t } = useTranslation();
  const { invites, loading } = useClubInvitations(teamId);
  const [role, setRole] = useState("preparateur");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(null);
  const [sent, setSent] = useState(""); // message de succès (email envoyé / lien copié)

  const generate = async () => {
    setBusy(true); setErr(""); setSent("");
    const targetEmail = email.trim();
    try {
      const token = await createClubInvitation(teamId, { role, email: targetEmail });
      setEmail("");
      // Copie immédiate du lien fraîchement créé (confort, toujours).
      copy(token);
      // Si un email est renseigné, on l'envoie AUSSI automatiquement (Resend).
      if (targetEmail) {
        try {
          await sendInvitationEmail({ token, email: targetEmail, role });
          setSent(t("staff.invites.emailSent", { email: targetEmail }));
        } catch (e) {
          // L'invitation existe (lien copié) ; seul l'envoi a échoué → on le signale sans bloquer.
          setErr(t("staff.invites.emailFail", { err: e.message }));
        }
      }
    } catch (e) {
      setErr(t("staff.invites.errCreate", { err: e.message }));
    }
    setBusy(false);
  };

  const copy = async (token) => {
    try { await navigator.clipboard?.writeText(inviteLink(token)); setCopied(token); setTimeout(() => setCopied(null), 2000); }
    catch { setErr(t("staff.invites.errCopy")); }
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Shield size={16} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("staff.invites.title")}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 14 }}>{t("staff.invites.subtitle")}</div>

      {/* Liens partagés joueur / staff (modèle Twizzit). */}
      <ClubInviteCodes teamId={teamId} />

      {/* Invitations nominatives par email (conservées, ciblage + Resend). */}
      <Section title={t("staff.invites.newTitle")}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 5 }}>{t("staff.invites.roleLabel")}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {STAFF_INVITE_ROLES.map((r) => (
            <button key={r} onClick={() => setRole(r)} style={{ padding: "7px 12px", borderRadius: 8, border: role === r ? "2px solid rgba(255,255,255,0.5)" : `1px solid ${C.border}`, background: role === r ? `${accent}33` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {t(`data.roles.${r}.l`)}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 5 }}>{t("staff.invites.emailLabel")}</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("staff.invites.emailPlaceholder")} type="email" style={{ ...inp, marginBottom: 4 }} />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 10 }}>{t("staff.invites.emailHint")}</div>
        {sent && <div style={{ fontSize: 11, color: C.green, marginBottom: 8 }}>{sent}</div>}
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={generate} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 9, padding: 11, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Plus size={15} /> {busy ? t("staff.invites.generating") : t("staff.invites.generate")}
        </button>
      </Section>

      <Section title={t("staff.invites.listTitle")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{invites.length}</span>}>
        {loading ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 0" }}>{t("common.loading")}</div>
        ) : invites.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 0" }}>{t("staff.invites.empty")}</div>
        ) : (
          invites.map((iv) => {
            const used = iv.status === "accepted";
            const expired = !used && new Date(iv.expiresAt) < new Date();
            return (
              <div key={iv.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border2}`, opacity: used || expired ? 0.55 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t(`data.roles.${iv.role}.l`)}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>· {iv.email || t("staff.invites.anyEmail")}</span>
                  <div style={{ flex: 1 }} />
                  {used ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>{t("staff.invites.used")}</span>
                  ) : expired ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.amb }}>{t("staff.invites.expired")}</span>
                  ) : (
                    <>
                      <button onClick={() => copy(iv.token)} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "4px 10px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        {copied === iv.token ? <><Check size={12} /> {t("staff.invites.copied")}</> : t("staff.invites.copy")}
                      </button>
                      <button onClick={() => revokeClubInvitation(iv.id)} title={t("staff.invites.revoke")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", display: "flex" }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}>
                  {used ? t("staff.invites.usedOn", { date: fmtShort(iv.acceptedAt) }) : t("staff.invites.expiresOn", { date: fmtShort(iv.expiresAt) })}
                </div>
              </div>
            );
          })
        )}
      </Section>
    </section>
  );
}
