import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { Bell } from "../../../lib/icons.jsx";
import { useNotificationPrefs } from "../../../data/notificationPrefs.js";

/* « Rappels » — préférences de notification (refonte Accueil, lot 3 PR-6).
   Le joueur règle SES rappels ; le dispatcher côté base fait le reste. Contrôles
   ≥ 44 px, aucune animation superflue (respecte prefers-reduced-motion). */

const TONES = ["leger", "normal", "costaud"];

function Toggle({ on, onChange, label, sub, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 0", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, minHeight: 44 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ flexShrink: 0, width: 46, height: 28, borderRadius: 14, background: on ? C.green : "rgba(255,255,255,0.12)", border: `1px solid ${on ? C.green : C.border}`, position: "relative", transition: "background .15s ease" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: 11, background: "#fff", transition: "left .15s ease" }} />
      </span>
    </button>
  );
}

function TimeRow({ label, value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", opacity: disabled ? 0.5 : 1, minHeight: 44 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input type="time" value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, padding: "8px 10px", minHeight: 40 }} />
    </div>
  );
}

export default function ReminderPrefs({ me, teamId }) {
  const { t } = useTranslation();
  const { prefs, loading, saving, save } = useNotificationPrefs(me?.id, teamId);
  const set = (patch) => save({ ...prefs, ...patch });

  const quietOn = !!(prefs.quiet_start && prefs.quiet_end);

  if (loading) {
    return <div style={{ padding: "12px 0", fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>{t("common.loading")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
        <Bell size={17} color={C.amb} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t("player.reminders.intro")}</span>
      </div>

      <Toggle on={prefs.enabled} onChange={(v) => set({ enabled: v })}
        label={t("player.reminders.enabled")} sub={t("player.reminders.enabledSub")} />

      <div style={{ height: 1, background: C.border, margin: "4px 0" }} />

      <TimeRow label={t("player.reminders.morningTime")} value={prefs.morning_time} disabled={!prefs.enabled} onChange={(v) => v && set({ morning_time: v })} />

      <Toggle on={prefs.streak_guard} disabled={!prefs.enabled} onChange={(v) => set({ streak_guard: v })}
        label={t("player.reminders.streakGuard")} sub={t("player.reminders.streakGuardSub")} />
      <TimeRow label={t("player.reminders.eveningTime")} value={prefs.evening_time} disabled={!prefs.enabled || !prefs.streak_guard} onChange={(v) => v && set({ evening_time: v })} />

      <div style={{ height: 1, background: C.border, margin: "4px 0" }} />

      {/* Ton / insistance */}
      <div style={{ padding: "6px 0", opacity: prefs.enabled ? 1 : 0.5 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{t("player.reminders.tone")}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{t("player.reminders.toneSub")}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {TONES.map((tk) => {
            const active = prefs.tone === tk;
            return (
              <button key={tk} disabled={!prefs.enabled} onClick={() => set({ tone: tk })}
                style={{ flex: 1, minHeight: 44, borderRadius: 11, cursor: prefs.enabled ? "pointer" : "default", fontSize: 12.5, fontWeight: 800, color: active ? "#fff" : "rgba(255,255,255,0.6)", background: active ? `${C.viol}2e` : "rgba(255,255,255,0.05)", border: `1.5px solid ${active ? C.viol : C.border}` }}>
                {t(`player.reminders.tones.${tk}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: C.border, margin: "4px 0" }} />

      {/* Heures calmes (école / nuit) */}
      <Toggle on={quietOn} disabled={!prefs.enabled} onChange={(v) => set(v ? { quiet_start: "08:30", quiet_end: "16:00" } : { quiet_start: null, quiet_end: null })}
        label={t("player.reminders.quiet")} sub={t("player.reminders.quietSub")} />
      {quietOn && (
        <>
          <TimeRow label={t("player.reminders.quietStart")} value={prefs.quiet_start} disabled={!prefs.enabled} onChange={(v) => v && set({ quiet_start: v })} />
          <TimeRow label={t("player.reminders.quietEnd")} value={prefs.quiet_end} disabled={!prefs.enabled} onChange={(v) => v && set({ quiet_end: v })} />
        </>
      )}

      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 6, minHeight: 14 }}>
        {saving ? t("player.reminders.saving") : t("player.reminders.savedHint")}
      </div>
    </div>
  );
}
