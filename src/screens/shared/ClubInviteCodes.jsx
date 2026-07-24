import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { Check, Sparkles, Users, Shield } from "../../lib/icons.jsx";
import { useClubInviteCodes, joinLink, rotateInviteCode, setStaffCodeRole, setInviteCodeActive } from "../../data/clubCodes.js";

/* Liens/codes d'invitation PARTAGÉS par club, distincts joueur / staff (modèle
   Twizzit). Owner/staff écrivain : copier le lien, régénérer le code, révoquer /
   activer, expiration optionnelle, + sélecteur de rôle pour le lien staff. Le
   code rattache TOUJOURS à son club (serveur). */
const STAFF_ROLES = ["preparateur", "medical", "coach"];

function CodeCard({ teamId, kind, entry, accent, onErr }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!entry) return null;

  const link = joinLink(entry.code);
  const wrap = (fn) => async () => { setBusy(true); onErr(""); try { await fn(); } catch (e) { onErr(e.message || String(e)); } setBusy(false); };
  const copy = async () => { try { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { onErr(t("staff.invites.errCopy")); } };
  const rotate = wrap(() => rotateInviteCode(teamId, kind));
  const toggle = wrap(() => setInviteCodeActive(teamId, kind, !entry.active, entry.expiresAt));
  const setRole = (r) => wrap(() => setStaffCodeRole(teamId, r))();
  const setExpiry = (v) => wrap(() => setInviteCodeActive(teamId, kind, entry.active, v || null))();

  const off = !entry.active;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 13, marginBottom: 10, opacity: off ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {kind === "player" ? <Users size={15} color={accent} /> : <Shield size={15} color={accent} />}
        <span style={{ fontSize: 13, fontWeight: 800 }}>{kind === "player" ? t("clubCodes.playerLink") : t("clubCodes.staffLink")}</span>
        {off && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.amb, background: `${C.amb}22`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "1px 6px" }}>{t("clubCodes.revoked")}</span>}
      </div>

      {/* Sélecteur de rôle (lien staff uniquement). */}
      {kind === "staff" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {STAFF_ROLES.map((r) => (
            <button key={r} disabled={busy} onClick={() => setRole(r)}
              style={{ padding: "5px 10px", borderRadius: 8, border: entry.role === r ? "2px solid rgba(255,255,255,0.5)" : `1px solid ${C.border}`, background: entry.role === r ? `${accent}33` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
              {t(`data.roles.${r}.l`)}
            </button>
          ))}
        </div>
      )}

      {/* Code + lien */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <code style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, letterSpacing: 2, color: "#fff", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.code}</code>
        <button onClick={copy} disabled={busy} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "9px 12px", color: accent, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {copied ? <><Check size={13} /> {t("staff.invites.copied")}</> : t("clubCodes.copyLink")}
        </button>
      </div>

      {/* Expiration optionnelle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{t("clubCodes.expiry")}</span>
        <input type="date" value={entry.expiresAt ? String(entry.expiresAt).slice(0, 10) : ""} onChange={(e) => setExpiry(e.target.value)} disabled={busy}
          style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 9px", color: "#fff", fontSize: 12, outline: "none", colorScheme: "dark" }} />
        {entry.expiresAt && <button onClick={() => setExpiry("")} disabled={busy} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>{t("clubCodes.noExpiry")}</button>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={rotate} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 9, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Sparkles size={14} /> {t("clubCodes.regen")}
        </button>
        <button onClick={toggle} disabled={busy} style={{ flex: 1, background: off ? `${C.green}18` : "rgba(255,255,255,0.06)", border: `1px solid ${off ? `${C.green}66` : C.border}`, borderRadius: 8, padding: 9, color: off ? C.green : C.coral, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {off ? t("clubCodes.activate") : t("clubCodes.revoke")}
        </button>
      </div>
    </div>
  );
}

export default function ClubInviteCodes({ teamId }) {
  const { t } = useTranslation();
  const { codes, loading } = useClubInviteCodes(teamId);
  const [err, setErr] = useState("");

  return (
    <Section title={t("clubCodes.title")}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: 12 }}>{t("clubCodes.subtitle")}</div>
      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      {loading ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("common.loading")}</div>
      ) : (
        <>
          <CodeCard teamId={teamId} kind="player" entry={codes.player} accent={C.green} onErr={setErr} />
          <CodeCard teamId={teamId} kind="staff" entry={codes.staff} accent={C.coral} onErr={setErr} />
        </>
      )}
    </Section>
  );
}
