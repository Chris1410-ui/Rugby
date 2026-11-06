import { TEAMS } from "./tokens.js";
import { localeTag } from "../i18n/locale.js";
import {
  favMarkers, recoveryIndex, wellnessScore, rpeOf, remarkOf, needsWatch, statusOf, mean,
} from "./wellnessView.js";

/* Rapport Wellson du jour → modèle de données (pur) + export PowerPoint natif
   (pptxgenjs, côté client). Le modèle est calculé depuis les mêmes helpers que
   l'écran (lib/wellnessView) → chiffres identiques. Portée : ÉQUIPE entière pour
   le jour sélectionné (le filtre « athlète » de l'écran est ignoré). */

export const clubLabel = (teamId) => TEAMS.rugby.find((t) => t.id === teamId)?.label || teamId || "";

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

/* Construit le modèle du rapport. byId = { playerId: player }. */
export function buildReportModel({ roster = [], byId = {}, rows = [], selDate, civilNames = {}, teamId, t }) {
  // Nom civil si importé, sinon TOTEM seul (les initiales restent séparées, pour
  // ne pas les dupliquer — displayName les accolerait au totem).
  const nameOf = (pid) => civilNames[pid] || (byId[pid]?.name || "—");
  const initOf = (pid) => byId[pid]?.initials || "";

  // 1 ligne / joueur pour la date (upsert → une seule).
  const dayByPlayer = {};
  for (const r of rows) if (r.date === selDate) dayByPlayer[r.playerId] = r;
  const dayRows = Object.values(dayByPlayer);

  const timeStr = (iso) => { try { return new Date(iso).toLocaleTimeString(localeTag(), { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };
  const dLabel = (iso) => { try { return new Date(iso + "T00:00:00").toLocaleDateString(localeTag(), { day: "numeric", month: "short" }); } catch { return iso; } };
  const dLong = (iso) => { try { return new Date(iso + "T00:00:00").toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { return iso; } };

  const kpis = {
    responses: dayRows.length,
    total: roster.length,
    wellness: round1(mean(dayRows.map((r) => wellnessScore(r.wb)))),
    recovery: round1(mean(dayRows.map((r) => recoveryIndex(r.wb)))),
    watch: dayRows.filter((r) => needsWatch(r.wb)).length,
  };

  const favAvg = (key) => round1(mean(dayRows.map((r) => favMarkers(r.wb)[key])));
  const profile = [
    { key: "mWellness", label: t("staff.wellness.mWellness"), value: favAvg("wellness") },
    { key: "mSleep", label: t("staff.wellness.mSleep"), value: favAvg("sommeil") },
    { key: "mFatigue", label: t("staff.wellness.mFatigue"), value: favAvg("fatigue") },
    { key: "mStress", label: t("staff.wellness.mStress"), value: favAvg("stress") },
    { key: "mMood", label: t("staff.wellness.mMood"), value: favAvg("humeur") },
    { key: "mWill", label: t("staff.wellness.mWill"), value: favAvg("willTrain") },
    { key: "mRpe", label: t("staff.wellness.mRpe"), value: round1(mean(dayRows.map((r) => rpeOf(r.wb)))), rpe: true },
  ];

  const responders = dayRows
    .filter((r) => r.createdAt)
    .map((r) => ({ name: nameOf(r.playerId), init: initOf(r.playerId), time: timeStr(r.createdAt), at: r.createdAt }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  const missing = roster
    .filter((p) => !dayByPlayer[p.id])
    .map((p) => ({ name: nameOf(p.id), init: initOf(p.id) }));

  const alerts = dayRows
    .map((r) => ({ name: nameOf(r.playerId), rec: round1(recoveryIndex(r.wb)), well: round1(wellnessScore(r.wb)), remark: remarkOf(r.wb), status: statusOf(recoveryIndex(r.wb)) }))
    .filter((x) => x.status === "vigilance" || x.status === "alerte" || x.remark)
    .sort((a, b) => (a.rec ?? 99) - (b.rec ?? 99));

  const trendDates = [...new Set(rows.map((r) => r.date))].sort(); // chronologique
  const trend = trendDates.map((d) => {
    const rs = rows.filter((r) => r.date === d);
    return { date: d, label: dLabel(d), n: rs.length, well: round1(mean(rs.map((r) => wellnessScore(r.wb)))), rec: round1(mean(rs.map((r) => recoveryIndex(r.wb)))) };
  });

  return {
    club: clubLabel(teamId),
    date: selDate,
    dateLong: dLong(selDate),
    kpis, profile, responders, missing, alerts, trend,
  };
}

// Palette (hex sans #) alignée sur l'identité de l'app.
const CORAL = "E8553B", NAVY = "1E1B3A", TEAL = "2CA6A4", BLUE = "3B82C4", AMBER = "E0A33E", GREEN = "2C8C5A", GREY = "8A8698";
const TITLE_FONT = "Anton", BODY_FONT = "Barlow";
const statusColor = (s) => (s === "alerte" ? CORAL : s === "vigilance" ? AMBER : GREEN);

const slug = (s) => (s || "club").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "club";

/* Génère et télécharge le .pptx. t = i18n. Renvoie le nom de fichier. */
export async function exportWellnessPptx(model, { t }) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.theme = { headFontFace: TITLE_FONT, bodyFontFace: BODY_FONT };
  const W = 13.33;
  const footer = `RP · ${model.club} · ${model.dateLong}`;

  const addFooter = (slide, n) => {
    slide.addText(footer, { x: 0.5, y: 7.05, w: 10.5, h: 0.3, fontFace: BODY_FONT, fontSize: 9, color: GREY });
    slide.addText(String(n), { x: W - 1.0, y: 7.05, w: 0.5, h: 0.3, align: "right", fontFace: BODY_FONT, fontSize: 9, color: GREY });
  };
  const nt = (v) => (v == null ? "—" : String(v));

  // ── Slide 1 : couverture ──
  const s1 = pptx.addSlide();
  s1.background = { color: "FFFFFF" };
  s1.addShape(pptx.ShapeType.ellipse, { x: 0.7, y: 0.7, w: 1.3, h: 1.3, fill: { color: CORAL } });
  s1.addText("RP", { x: 0.7, y: 0.7, w: 1.3, h: 1.3, align: "center", valign: "middle", fontFace: TITLE_FONT, fontSize: 34, color: "FFFFFF" });
  s1.addText(t("staff.report.title"), { x: 0.7, y: 2.6, w: 11.9, h: 0.9, fontFace: TITLE_FONT, fontSize: 40, color: NAVY });
  s1.addText(model.club, { x: 0.72, y: 3.5, w: 11.9, h: 0.6, fontFace: TITLE_FONT, fontSize: 26, color: CORAL });
  s1.addText(model.dateLong, { x: 0.75, y: 4.25, w: 11.9, h: 0.5, fontFace: BODY_FONT, fontSize: 18, color: NAVY });
  s1.addText(t("staff.wellness.nResponses", { count: model.kpis.responses }), { x: 0.75, y: 4.8, w: 11.9, h: 0.5, fontFace: BODY_FONT, fontSize: 14, color: GREY });
  addFooter(s1, 1);

  // ── Slide 2 : KPIs ──
  const s2 = pptx.addSlide();
  s2.background = { color: "FFFFFF" };
  s2.addText(t("staff.wellness.dayTitle"), { x: 0.5, y: 0.4, w: 12, h: 0.7, fontFace: TITLE_FONT, fontSize: 26, color: NAVY });
  const cards = [
    { label: t("staff.wellness.kResponses"), value: `${model.kpis.responses}/${model.kpis.total}`, color: NAVY },
    { label: t("staff.wellness.kWellness"), value: `${nt(model.kpis.wellness)}`, sub: "/10", color: BLUE },
    { label: t("staff.wellness.kRecovery"), value: `${nt(model.kpis.recovery)}`, sub: "/10", color: TEAL },
    { label: t("staff.wellness.kWatch"), value: `${model.kpis.watch}`, color: model.kpis.watch > 0 ? AMBER : GREEN },
  ];
  const cw = 2.85, gap = 0.37, x0 = 0.6, cy = 2.1, ch = 2.4;
  cards.forEach((c, i) => {
    const x = x0 + i * (cw + gap);
    s2.addShape(pptx.ShapeType.roundRect, { x, y: cy, w: cw, h: ch, rectRadius: 0.12, fill: { color: "F5F4F8" }, line: { color: "E4E2EC", width: 1 } });
    s2.addText(c.label.toUpperCase(), { x: x + 0.2, y: cy + 0.25, w: cw - 0.4, h: 0.5, fontFace: BODY_FONT, fontSize: 11, bold: true, color: GREY });
    s2.addText([{ text: c.value, options: { fontFace: TITLE_FONT, fontSize: 48, color: c.color } }, ...(c.sub ? [{ text: ` ${c.sub}`, options: { fontFace: BODY_FONT, fontSize: 16, color: GREY } }] : [])], { x: x + 0.2, y: cy + 0.9, w: cw - 0.4, h: 1.1, valign: "middle" });
  });
  addFooter(s2, 2);

  // ── Slide 3 : qui a répondu / n'a pas répondu ──
  const s3 = pptx.addSlide();
  s3.background = { color: "FFFFFF" };
  s3.addText(t("staff.wellness.respondedTitle"), { x: 0.5, y: 0.4, w: 6, h: 0.6, fontFace: TITLE_FONT, fontSize: 22, color: NAVY });
  s3.addText(t("staff.wellness.notRespondedTitle"), { x: 7, y: 0.4, w: 6, h: 0.6, fontFace: TITLE_FONT, fontSize: 22, color: CORAL });
  const respText = model.responders.length
    ? model.responders.map((r) => ({ text: `${r.name}${r.init ? "  " + r.init : ""}`, options: { fontFace: BODY_FONT, fontSize: 13, color: NAVY, bullet: false, breakLine: false } }))
    : [{ text: t("staff.wellness.noResponses"), options: { fontFace: BODY_FONT, fontSize: 13, color: GREY } }];
  // Deux colonnes avec l'heure alignée à droite via un tableau léger.
  if (model.responders.length) {
    const rrows = model.responders.map((r) => ([
      { text: `${r.name}${r.init ? "  " + r.init : ""}`, options: { fontFace: BODY_FONT, fontSize: 12, color: NAVY, align: "left" } },
      { text: r.time, options: { fontFace: BODY_FONT, fontSize: 12, color: TEAL, bold: true, align: "right" } },
    ]));
    s3.addTable(rrows, { x: 0.5, y: 1.1, w: 6, colW: [4.4, 1.6], border: { type: "solid", color: "EEECF2", pt: 1 }, rowH: 0.3, valign: "middle" });
  } else {
    s3.addText(respText, { x: 0.5, y: 1.1, w: 6, h: 5, fontFace: BODY_FONT });
  }
  const missText = model.missing.length
    ? model.missing.map((m) => ({ text: `${m.name}${m.init ? "  " + m.init : ""}`, options: { fontFace: BODY_FONT, fontSize: 13, color: NAVY, bullet: { code: "2022" }, breakLine: true } }))
    : [{ text: t("staff.wellness.allResponded"), options: { fontFace: BODY_FONT, fontSize: 14, color: GREEN, bold: true } }];
  s3.addText(missText, { x: 7, y: 1.1, w: 6, h: 5.5, valign: "top" });
  addFooter(s3, 3);

  // ── Slide 4 : profil collectif (bar chart natif) ──
  const s4 = pptx.addSlide();
  s4.background = { color: "FFFFFF" };
  s4.addText(t("staff.wellness.profileTitle"), { x: 0.5, y: 0.4, w: 12, h: 0.7, fontFace: TITLE_FONT, fontSize: 26, color: NAVY });
  const pLabels = model.profile.map((p) => p.label);
  const pValues = model.profile.map((p) => (p.value == null ? 0 : p.value));
  const pColors = model.profile.map((p) => (p.rpe ? CORAL : BLUE));
  s4.addChart(pptx.ChartType.bar, [{ name: t("staff.wellness.profileTitle"), labels: pLabels, values: pValues }], {
    x: 0.6, y: 1.3, w: 12.1, h: 5.2, barDir: "bar", chartColors: pColors,
    showValue: true, dataLabelFontFace: BODY_FONT, dataLabelColor: NAVY, dataLabelFontSize: 12, dataLabelPosition: "outEnd",
    valAxisMinVal: 0, valAxisMaxVal: 10, valGridLine: { style: "none" },
    catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 12, catAxisLabelColor: NAVY,
    valAxisLabelFontFace: BODY_FONT, valAxisLabelFontSize: 10, valAxisLabelColor: GREY,
    showLegend: false, barGapWidthPct: 40,
  });
  addFooter(s4, 4);

  // ── Slide 5 : à surveiller & remarques (tableau natif) ──
  const s5 = pptx.addSlide();
  s5.background = { color: "FFFFFF" };
  s5.addText(t("staff.wellness.alertsTitle"), { x: 0.5, y: 0.4, w: 12, h: 0.7, fontFace: TITLE_FONT, fontSize: 26, color: NAVY });
  const head = [
    t("staff.wellness.colAthlete"), t("staff.wellness.colWellness"), t("staff.wellness.colRecovery"), t("staff.wellness.colStatus"), t("staff.wellness.colRemark"),
  ].map((h) => ({ text: h.toUpperCase(), options: { fontFace: BODY_FONT, fontSize: 11, bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "left", valign: "middle" } }));
  const body = model.alerts.length
    ? model.alerts.map((a) => ([
        { text: a.name, options: { fontFace: BODY_FONT, fontSize: 12, color: NAVY, bold: true } },
        { text: nt(a.well), options: { fontFace: BODY_FONT, fontSize: 12, align: "center", color: NAVY } },
        { text: nt(a.rec), options: { fontFace: BODY_FONT, fontSize: 12, align: "center", color: NAVY } },
        { text: t(`staff.wellness.status${a.status === "alerte" ? "Alerte" : a.status === "vigilance" ? "Vigilance" : "Ok"}`), options: { fontFace: BODY_FONT, fontSize: 11, bold: true, color: statusColor(a.status) } },
        { text: a.remark || "—", options: { fontFace: BODY_FONT, fontSize: 11, color: a.remark ? NAVY : GREY } },
      ]))
    : [[{ text: t("staff.wellness.noAlerts"), options: { fontFace: BODY_FONT, fontSize: 13, color: GREEN, bold: true, colspan: 5, align: "center" } }]];
  s5.addTable([head, ...body], { x: 0.5, y: 1.3, w: 12.3, colW: [3.6, 1.6, 1.9, 1.9, 3.3], border: { type: "solid", color: "E4E2EC", pt: 1 }, rowH: 0.4, valign: "middle", autoPage: true, autoPageRepeatHeader: true });
  addFooter(s5, 5);

  // ── Slide 6 : tendance 14 jours (line chart natif, 2 séries) ──
  const s6 = pptx.addSlide();
  s6.background = { color: "FFFFFF" };
  s6.addText(t("staff.wellness.trendTitle"), { x: 0.5, y: 0.4, w: 12, h: 0.7, fontFace: TITLE_FONT, fontSize: 26, color: NAVY });
  const tLabels = model.trend.map((d) => d.label);
  const tWell = model.trend.map((d) => (d.well == null ? 0 : d.well));
  const tRec = model.trend.map((d) => (d.rec == null ? 0 : d.rec));
  s6.addChart(pptx.ChartType.line, [
    { name: t("staff.wellness.mWellness"), labels: tLabels, values: tWell },
    { name: t("staff.wellness.kRecovery"), labels: tLabels, values: tRec },
  ], {
    x: 0.6, y: 1.3, w: 12.1, h: 5.1, chartColors: [BLUE, TEAL], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    valAxisMinVal: 0, valAxisMaxVal: 10,
    catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 10, catAxisLabelColor: NAVY,
    valAxisLabelFontFace: BODY_FONT, valAxisLabelFontSize: 10, valAxisLabelColor: GREY,
    showLegend: true, legendPos: "b", legendFontFace: BODY_FONT, legendFontSize: 11,
  });
  addFooter(s6, 6);

  const fileName = `wellness-${slug(model.club)}-${model.date}.pptx`;
  await pptx.writeFile({ fileName });
  return fileName;
}
