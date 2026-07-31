import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { readinessReady } from "../../lib/reliability.js";
import { useReadOnly } from "../../lib/readonly.js";
import { ChevronRight, Megaphone, Clock, Users, Bell, MessageSquare, Trophy, Dumbbell, Send, ClipboardList, Flame, FileText, AlertOctagon } from "../../lib/icons.jsx";
import { useTeamTrainings, useTeamAttendance } from "../../data/trainings.js";
import { useClubNews, markClubNewsSeen } from "../../data/clubNews.js";
import { useClubSettings, setClubHero } from "../../data/clubSettings.js";
import { Upload } from "../../lib/icons.jsx";
import ClubNewsComposer from "./ClubNewsComposer.jsx";

/* Écran « Accueil » staff (page d'atterrissage). Même ossature que le joueur mais
   priorité = AGENDA DU JOUR (horaire, terrain, taux de présence confirmée par
   séance), puis chiffres d'équipe, bloc « en attente de ta validation »,
   actualité du club, raccourcis. Aucune formule modifiée. */
export default function StaffAccueil({ profile, players = [], badges = {}, authorLabel, onNavigate }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const teamId = profile.team_id;
  const today = todayISO();
  const { trainings } = useTeamTrainings(teamId, players);
  const { byTraining } = useTeamAttendance(teamId);
  const { items: news, unread, refresh: refreshNews } = useClubNews(teamId);
  const { heroUrl, refresh: refreshHero } = useClubSettings(teamId);
  const [composer, setComposer] = useState(false);
  const [heroBusy, setHeroBusy] = useState(false);

  const onHeroPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setHeroBusy(true);
    try { await setClubHero(teamId, file); await refreshHero(); }
    catch (err) { console.error("[club hero]", err.message); }
    finally { setHeroBusy(false); }
  };

  useEffect(() => { if (teamId) markClubNewsSeen(teamId).then(refreshNews).catch(() => {}); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agenda du jour : convocations datées d'aujourd'hui + taux de présence confirmée.
  const agenda = useMemo(() => {
    return trainings.filter((tr) => tr.date === today).map((tr) => {
      const att = byTraining[tr.id] || {};
      const total = tr.assignedIds?.length || 0;
      const present = Object.values(att).filter((a) => a.playerResponse === "present").length;
      return { id: tr.id, heure: tr.heure, lieu: tr.lieu, titre: tr.titre, present, total };
    }).sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  }, [trainings, byTraining, today]);

  // Chiffres d'équipe (dérivations existantes uniquement).
  const realReady = players.filter(readinessReady);
  const avgReady = realReady.length ? Math.round(realReady.reduce((a, p) => a + (p.readiness || 0), 0) / realReady.length) : null;
  const live = players.filter((p) => p._live).length;

  // En attente de validation (pastilles réelles fournies par StaffApp).
  const pending = [
    { key: "taches", label: t("nav.taches"), n: badges.taches, Icon: ClipboardList },
    { key: "defis", label: t("nav.defis"), n: badges.defis, Icon: Flame },
    { key: "questionnaires", label: t("nav.questionnaires"), n: badges.quest, Icon: FileText },
    { key: "adhesions", label: t("nav.adhesions"), n: badges.adhesions, Icon: Users },
  ].filter((x) => (x.n || 0) > 0);

  const shortcuts = [
    { key: "effectif", label: t("nav.effectif"), Icon: Users },
    { key: "alertes", label: t("nav.alertes"), Icon: Bell, badge: badges.alertes },
    { key: "messages", label: t("nav.messages"), Icon: MessageSquare, badge: badges.messages },
    { key: "convocations", label: t("nav.convocations"), Icon: Send },
    { key: "programmes", label: t("nav.programmes"), Icon: Dumbbell },
    { key: "classement", label: t("nav.classement"), Icon: Trophy },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 5 || hour >= 18 ? t("player.home.greetEvening") : t("player.home.greetMorning");
  const dateStr = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long" });
  const lastNews = news[0] || null;

  return (
    <div style={{ paddingBottom: 6 }}>
      {/* Hero */}
      <div style={{ position: "relative", margin: "-18px -18px 14px", minHeight: 150, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {heroUrl
          ? <img src={heroUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 20% 0%, #3A2440 0%, #1B1838 70%)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,13,33,0.2) 0%, rgba(15,13,33,0.86) 100%)" }} />
        <div style={{ position: "relative", padding: 18, width: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{dateStr}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{greeting}, {profile.full_name || t("roles." + profile.role)}</div>
        </div>
        {/* Photo du club (staff écrivain / owner) : upload direct. */}
        {!readOnly && (
          <label title={t("staff.home.heroUpload")} style={{ position: "absolute", top: 10, right: 10, background: "rgba(15,13,33,0.6)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 8, color: "#fff", cursor: heroBusy ? "default" : "pointer", display: "flex", opacity: heroBusy ? 0.5 : 1 }}>
            <Upload size={15} />
            <input type="file" accept="image/*" onChange={onHeroPick} disabled={heroBusy} style={{ display: "none" }} />
          </label>
        )}
      </div>

      {/* Agenda du jour */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Clock size={16} color={C.coral} />
        <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{t("staff.home.agendaTitle")}</div>
      </div>
      {agenda.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>{t("staff.home.noAgenda")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {agenda.map((a) => {
            const pct = a.total ? Math.round((a.present / a.total) * 100) : 0;
            const col = pct >= 80 ? C.green : pct >= 50 ? C.amb : C.coral;
            return (
              <button key={a.id} onClick={() => onNavigate?.("convocations")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, cursor: "pointer" }}>
                <div style={{ flexShrink: 0, textAlign: "center", minWidth: 46 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{a.heure || "—"}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.titre || t("nav.convocations")}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>{a.lieu || t("staff.home.noPlace")}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: col }}>{a.present}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.34)" }}>/{a.total}</span></div>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{t("staff.home.confirmed")}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Chiffres d'équipe */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        <Stat label={t("staff.app.kpiReadiness")} value={avgReady ?? "—"} color={avgReady == null ? C.gray : avgReady > 70 ? C.green : avgReady > 50 ? C.amb : C.coral} onClick={() => onNavigate?.("aujourdhui")} />
        <Stat label={t("staff.app.kpiBilans")} value={`${live}/${players.length}`} color={C.viol} onClick={() => onNavigate?.("aujourdhui")} />
        <Stat label={t("nav.alertes")} value={badges.alertes || 0} color={badges.alertes ? C.coral : C.gray} onClick={() => onNavigate?.("alertes")} />
      </div>

      {/* En attente de ta validation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <AlertOctagon size={16} color={C.amb} />
        <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{t("staff.home.pending")}</div>
      </div>
      {pending.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>{t("staff.home.nothingPending")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {pending.map(({ key, label, n, Icon }) => (
            <button key={key} onClick={() => onNavigate?.(key)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: `${C.amb}12`, border: `1px solid ${C.amb}44`, borderRadius: 12, padding: "11px 13px", cursor: "pointer" }}>
              <Icon size={17} color={C.amb} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</span>
              <span style={{ background: C.amb, color: "#0c0a1e", fontSize: 11, fontWeight: 800, borderRadius: 9, padding: "1px 8px" }}>{n}</span>
              <ChevronRight size={15} color="rgba(255,255,255,0.35)" />
            </button>
          ))}
        </div>
      )}

      {/* Actualité du club + publier */}
      <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: lastNews ? 10 : 12 }}>
          <Megaphone size={16} color={C.viol} />
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: C.viol, flex: 1 }}>{t("player.home.newsTitle")}</span>
          {unread > 0 && <span style={{ background: C.coral, color: "#fff", fontSize: 9.5, fontWeight: 800, borderRadius: 9, padding: "1px 7px" }}>{unread > 9 ? "9+" : unread}</span>}
        </div>
        {lastNews && (
          <div style={{ marginBottom: 12 }}>
            {lastNews.kind === "mot" && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: C.amb, background: `${C.amb}22`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "1px 6px", marginRight: 6 }}>{t("player.home.motStaff")}</span>}
            {lastNews.title && <span style={{ fontSize: 14, fontWeight: 800 }}>{lastNews.title}</span>}
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", marginTop: 4, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{lastNews.body}</div>
          </div>
        )}
        {!readOnly && (
          <button onClick={() => setComposer(true)} style={{ width: "100%", minHeight: 44, borderRadius: 11, border: `1px solid ${C.viol}66`, background: `${C.viol}22`, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Megaphone size={16} color="#fff" /> {t("staff.home.publish")}
          </button>
        )}
      </div>

      {/* Raccourcis */}
      <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.34)", marginBottom: 12 }}>{t("player.accueil.quickAccess")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {shortcuts.map(({ key, label, Icon, badge }) => (
            <button key={key} onClick={() => onNavigate?.(key)} style={{ position: "relative", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 13, padding: "13px 6px", minHeight: 76, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              <Icon size={21} color="rgba(255,255,255,0.56)" />
              {label}
              {typeof badge === "number" && badge > 0 && (
                <span style={{ position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: C.coral, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge > 9 ? "9+" : badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {composer && <ClubNewsComposer teamId={teamId} authorLabel={authorLabel} onClose={() => setComposer(false)} />}
    </div>
  );
}

function Stat({ label, value, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 10px", textAlign: "left", cursor: "pointer", minHeight: 74, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
    </button>
  );
}
