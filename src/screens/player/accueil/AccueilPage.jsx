import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../../i18n/locale.js";
import { C } from "../../../lib/tokens.js";
import { displayName } from "../../../lib/identity.js";
import { grpLabel } from "../../../lib/positions.js";
import { statusOfLog, todayISO } from "../../../lib/metrics.js";
import { readinessReady } from "../../../lib/reliability.js";
import { ChevronRight, CheckCircle, Flame, Trophy, Sun, Megaphone } from "../../../lib/icons.jsx";
import { useMyDay } from "../../../data/checkins.js";
import { useStreak } from "../../../data/streak.js";
import { useClubLeaderboard } from "../../../data/clubPoints.js";
import { useClubNews, markClubNewsSeen } from "../../../data/clubNews.js";
import { useClubSettings } from "../../../data/clubSettings.js";
import AccueilQuickAccess from "./AccueilQuickAccess.jsx";
import ClubNewsSheet from "./ClubNewsSheet.jsx";

/* Écran « Accueil » (page d'atterrissage joueur), en amont d'« Aujourd'hui ».
   Hero plein cadre (photo club optionnelle), bloc dominant « ce que tu dois
   faire aujourd'hui » (X/3 + « Commencer ma journée » → Aujourd'hui), gros
   chiffres (readiness / points+rang / série), actualité du club, raccourcis à
   pastilles. Aucune formule modifiée : lit les dérivations existantes. */
export default function AccueilPage({ me, teamId, players = [], sessions = [], logs = {}, badges = {}, onNavigate }) {
  const { t } = useTranslation();
  const today = todayISO();
  const { day } = useMyDay(me.id, today);
  const { streak } = useStreak(me.id);
  const { list, rankById } = useClubLeaderboard(teamId, players, sessions);
  const { items: news, unread, refresh: refreshNews } = useClubNews(teamId);
  const { heroUrl } = useClubSettings(teamId);
  const [newsOpen, setNewsOpen] = useState(false);

  // Ouverture de l'Accueil → le fil est « vu » (remet les non-lus à 0).
  useEffect(() => { if (teamId) markClubNewsSeen(teamId).then(refreshNews).catch(() => {}); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const myPts = list.find((r) => r.id === me.id)?.pts ?? null;
  const myRank = rankById[me.id] || null;
  const ready = readinessReady(me) ? me.readiness : null;

  // Mission du jour (X/3) : matin, séance (repos si aucune assignée), soir.
  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === today && (s.assignedIds || []).includes(me.id)),
    [sessions, today, me.id],
  );
  const sessionDone = todaySessions.length === 0 || todaySessions.every((s) => statusOfLog(logs, s.id, me.id) === "done");
  const steps = [
    { key: "matin", label: t("player.bilan.morning"), done: !!day.matin },
    { key: "seance", label: todaySessions.length ? (todaySessions[0]?.titre || t("player.today.session")) : t("player.home.rest"), done: sessionDone },
    { key: "soir", label: t("player.bilan.evening"), done: !!day.soir },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  const hour = new Date().getHours();
  const greeting = hour < 5 || hour >= 18 ? t("player.home.greetEvening") : t("player.home.greetMorning");
  const dateStr = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long" });
  const avatarText = (me.initials || (me.name || "?").slice(0, 2)).toUpperCase();
  const lastNews = news[0] || null;

  return (
    <div style={{ paddingBottom: 6 }}>
      {/* ── Hero plein cadre ── */}
      <div style={{ position: "relative", margin: "-18px -18px 14px", minHeight: 190, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {heroUrl
          ? <img src={heroUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 20% 0%, #2E2760 0%, #1B1838 70%)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,13,33,0.15) 0%, rgba(15,13,33,0.85) 100%)" }} />
        <div style={{ position: "relative", padding: 18, width: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{dateStr}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 6 }}>
            <span style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff", background: `${C.green}cc`, border: "2px solid rgba(255,255,255,0.25)" }}>{avatarText}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.05 }}>{greeting}, {displayName(me)}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                {[me.pos && grpLabel(me.grp), me.club].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bloc dominant : ce que tu dois faire aujourd'hui ── */}
      <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 13 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.2, lineHeight: 1.15 }}>{t("player.home.mustDo")}</div>
          <div style={{ fontSize: 20, fontWeight: 900, flexShrink: 0 }}>{doneCount}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.34)" }}>/{steps.length}</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {steps.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.done ? C.green : "transparent", border: s.done ? "none" : `1.6px solid rgba(255,255,255,0.28)` }}>
                {s.done && <CheckCircle size={13} color="#fff" />}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: s.done ? "rgba(255,255,255,0.5)" : "#fff", textDecoration: s.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigate && onNavigate("bilan")}
          style={{ width: "100%", minHeight: 52, borderRadius: 13, border: "none", background: allDone ? "rgba(44,140,90,0.9)" : C.coral, color: "#fff", fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer" }}>
          <Sun size={18} color="#fff" />{allDone ? t("player.home.reviewDay") : t("player.home.start")}
          <ChevronRight size={18} color="#fff" />
        </button>
      </div>

      {/* ── Gros chiffres : readiness / points+rang / série ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        <BigStat icon={<Sun size={15} color={C.amb} />} label={t("player.bilan.readiness")}
          value={ready != null ? Math.round(ready) : "—"} color={ready == null ? C.gray : ready > 70 ? C.green : ready > 50 ? C.amb : C.coral}
          sub={ready == null ? t("reliability.noBilan") : null} onClick={() => onNavigate?.("bilan")} />
        <BigStat icon={<Trophy size={15} color={C.amb} />} label={t("player.home.points")}
          value={myPts != null ? myPts : "—"} color="#fff" sub={myRank ? `#${myRank}` : null} onClick={() => onNavigate?.("classement")} />
        <BigStat icon={<Flame size={15} color={C.coral} />} label={t("player.accueil.streakKicker")}
          value={streak} color={streak > 0 ? C.coral : C.gray} sub={t("player.accueil.streakDays", { count: streak })} onClick={() => onNavigate?.("bilan")} />
      </div>

      {/* ── Actualité du club / mot du staff ── */}
      <button onClick={() => setNewsOpen(true)} style={{ width: "100%", textAlign: "left", background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14, cursor: "pointer", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: lastNews ? 10 : 0 }}>
          <Megaphone size={16} color={C.viol} />
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: C.viol, flex: 1 }}>{t("player.home.newsTitle")}</span>
          {unread > 0 && <span style={{ background: C.coral, color: "#fff", fontSize: 9.5, fontWeight: 800, borderRadius: 9, padding: "1px 7px" }}>{unread > 9 ? "9+" : unread}</span>}
          <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
        </div>
        {lastNews ? (
          <div>
            {lastNews.kind === "mot" && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: C.amb, background: `${C.amb}22`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "1px 6px", marginRight: 6 }}>{t("player.home.motStaff")}</span>}
            {lastNews.title && <span style={{ fontSize: 14, fontWeight: 800 }}>{lastNews.title}</span>}
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", marginTop: 4, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{lastNews.body}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{[lastNews.authorLabel, new Date(lastNews.publishedAt).toLocaleDateString(localeTag(), { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("player.home.newsEmpty")}</div>
        )}
      </button>

      {/* ── Raccourcis (grille à pastilles) ── */}
      <AccueilQuickAccess onNavigate={onNavigate} badges={{ defis: badges.defis, messages: badges.messages }} />

      {newsOpen && <ClubNewsSheet items={news} onClose={() => setNewsOpen(false)} />}
    </div>
  );
}

function BigStat({ icon, label, value, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 10px", textAlign: "left", cursor: "pointer", minHeight: 84, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{icon}<span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{label}</span></div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>{sub}</div>}
    </button>
  );
}
