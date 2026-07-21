import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { Shield, Check, Trash2, Sparkles } from "../../lib/icons.jsx";
import { fmtShort } from "../../lib/metrics.js";
import { useMembershipRequests, setMembershipStatus, regenerateJoinCode, fetchJoinCode } from "../../data/membership.js";

const accent = C.green;

/* Écran staff « Demandes d'adhésion » (migration 0061) : gère le CODE CLUB
   (verrou 1) et la VALIDATION des auto-inscriptions joueur (verrou 2). Réservé à
   l'owner / staff écrivain (le coach en lecture seule n'y accède pas). */
export default function MembershipRequests({ teamId }) {
  const { t } = useTranslation();
  const { requests, loading } = useMembershipRequests(teamId);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(null); // id en cours de décision
  const [regen, setRegen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { fetchJoinCode(teamId).then(setCode).catch(() => setCode(null)); }, [teamId]);

  const decide = async (id, status) => {
    setBusy(id); setErr("");
    try { await setMembershipStatus(id, status); }
    catch (e) { setErr(t("membership.staff.errDecide", { err: e.message || "" })); }
    setBusy(null);
  };

  const regenerate = async () => {
    if (!window.confirm(t("membership.staff.regenConfirm"))) return;
    setRegen(true); setErr("");
    try { setCode(await regenerateJoinCode(teamId)); }
    catch (e) { setErr(t("membership.staff.errRegen", { err: e.message || "" })); }
    setRegen(false);
  };

  const copy = async () => {
    try { await navigator.clipboard?.writeText(code || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* copie manuelle */ }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Shield size={16} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("membership.staff.title")}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 14 }}>{t("membership.staff.subtitle")}</div>

      {/* Code club (verrou 1) */}
      <Section title={t("membership.staff.codeTitle")}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: 10 }}>{t("membership.staff.codeHelp")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontFamily: "monospace", fontSize: 22, fontWeight: 800, letterSpacing: 3, color: accent, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 14px", textAlign: "center" }}>
            {code || "········"}
          </div>
          <button onClick={copy} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: copied ? accent : "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>{copied ? <><Check size={14} /> {t("membership.staff.copied")}</> : t("membership.staff.copy")}</button>
          <button onClick={regenerate} disabled={regen} title={t("membership.staff.regen")} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", opacity: regen ? 0.5 : 1 }}><Sparkles size={16} /></button>
        </div>
      </Section>

      {/* Demandes en attente (verrou 2) */}
      <Section title={t("membership.staff.pendingTitle")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{requests.length}</span>}>
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        {loading ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 0" }}>{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 0" }}>{t("membership.staff.empty")}</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}{r.initials ? <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}> ({r.initials})</span> : null}</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}>{t("membership.staff.requestedOn", { date: fmtShort(r.requestedAt) })}</div>
              </div>
              <button onClick={() => decide(r.id, "active")} disabled={busy === r.id} style={{ display: "flex", alignItems: "center", gap: 5, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 8, padding: "6px 12px", color: accent, fontSize: 11.5, fontWeight: 800, cursor: "pointer", opacity: busy === r.id ? 0.5 : 1 }}>
                <Check size={13} /> {t("membership.staff.approve")}
              </button>
              <button onClick={() => decide(r.id, "rejected")} disabled={busy === r.id} title={t("membership.staff.reject")} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex", opacity: busy === r.id ? 0.5 : 1 }}><Trash2 size={15} /></button>
            </div>
          ))
        )}
      </Section>
    </section>
  );
}
