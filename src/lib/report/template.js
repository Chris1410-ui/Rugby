/* Gabarit du rapport de performance (9 pages, 16:9). Reproduit fidèlement
   docs/performance-report.reference.html — CSS inline, valeurs pilotées par le
   view-model (compute.js) et le narratif (narrative.js). Aucun accès réseau :
   pur → testable ; rendu en PDF par le navigateur headless de l'endpoint. */

import { escapeHtml } from "./standards.js";

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// 'YYYY-MM-DD' → « 19 juillet 2026 » ; repli sur la chaîne brute si non datée.
function frDate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${Number(m[3])} ${MONTHS_FR[Number(m[2]) - 1]} ${m[1]}`;
}
// 'YYYY-MM-DD' → « 15/7/2026 » (sous-libellé de la 1re ligne du tableau).
function frDateShort(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
}

const pctTxt = (p) => (p == null ? "—" : `${p} %`);
const pctTxtShort = (p) => (p == null ? "—" : `${p}%`);

const BADGE = {
  met: '<span class="badge met">✔ Standard atteint (+30 pts)</span>',
  dev: '<span class="badge dev">En développement</span>',
  ref: '<span class="badge ref">Sert aux ratios</span>',
};
const VS_CELL = {
  ref: '<td class="muted-cell">Référence</td>',
};

// ── Sections ───────────────────────────────────────────────────────────────

function cover(model) {
  const p = model.player;
  const line = [escapeHtml(p.name), p.posLabel ? `— ${escapeHtml(p.posLabel)}` : ""].filter(Boolean).join(" ");
  const imported = frDate(model.dates.testDate);
  const wellness = frDate(model.dates.wellnessDate);
  const meta = [
    imported ? `données de tests du ${imported}` : "campagne de tests à programmer",
    wellness ? `questionnaire bien-être le ${wellness}` : "questionnaire bien-être non renseigné",
  ].join(" · ");
  return `
  <section class="slide cover">
    <div class="prog">ANALYSIS&nbsp;&nbsp;PROGRAMME</div>
    <h1>PERFORMANCE REPORT</h1>
    <div class="rule"></div>
    <div class="sub">Bilan athlétique complet et axes d'entraînement du joueur</div>
    <div class="player">${line}</div>
    <div class="meta">${meta}</div>
  </section>`;
}

function divider() {
  return `
  <section class="slide divider">
    <div class="rule"></div>
    <h2>01 / SYNTHÈSE &amp; PROFIL</h2>
    <p>Vue d'ensemble des capacités du joueur, morphologie de référence et état de santé</p>
  </section>`;
}

function profile(model, narrative) {
  const p = model.player;
  const wb = model.wellbeing;
  const mensu = [p.heightCm ? `${p.heightCm} cm` : null, p.weightKg ? `${Math.round(p.weightKg)} kg` : null].filter(Boolean).join(" · ") || "—";
  const seances = p.sessionsPerWeek != null ? `${p.sessionsPerWeek} par semaine` : "—";
  const mental = `Morale ${wb.mood ?? "—"}/10 · Stress ${wb.stress ?? "—"}/10`;
  const injury = model.flags.hasInjuries
    ? `<div class="injury"><div class="k">⚠ HISTORIQUE BLESSURES &amp; DOULEURS</div><div class="t">${escapeHtml(p.injuryHistory)}</div></div>`
    : `<div class="injury" style="border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.05);"><div class="k" style="color:var(--green);">✔ AUCUN ANTÉCÉDENT SIGNALÉ</div><div class="t">Aucune blessure ni gêne enregistrée à ce jour.</div></div>`;

  const k = model.kpis;
  const kpi = (n, l, accent) => `<div class="kpi${accent ? " accent" : ""}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const kpis = [
    kpi(k.standardsMet, "Standards atteints", false),
    kpi(`+${k.points}`, "Points gagnés", false),
    kpi(pctTxtShort(k.broncoPct), "Bronco vs cible", false),
    kpi(pctTxtShort(k.jumpPct), "Saut vs cible", true),
  ].join("");

  const paras = narrative.summary.paragraphs.map((t) => `<p>${t}</p>`).join("");
  return `
  <section class="slide">
    <div class="head">
      <div class="title"><span class="bar"></span>PROFIL &amp; ANALYSE</div>
      <div class="eyebrow">RÉSUMÉ EXÉCUTIF</div>
    </div>
    <div class="cols">
      <div class="card">
        <h3>FICHE JOUEUR</h3>
        <p class="lead">${narrative.lead}</p>
        <div class="grid2">
          <div class="field"><div class="k">Poste</div><div class="v">${escapeHtml(p.posLabel)}</div></div>
          <div class="field"><div class="k">Mensurations</div><div class="v">${mensu}</div></div>
          <div class="field"><div class="k">Séances gym</div><div class="v">${seances}</div></div>
          <div class="field"><div class="k">Mental</div><div class="v">${mental}</div></div>
        </div>
        ${injury}
      </div>
      <div class="summary">
        <h4>${escapeHtml(narrative.summary.title)}</h4>
        ${paras}
        <div class="kpis">${kpis}</div>
      </div>
    </div>
  </section>`;
}

function testsTable(model) {
  const shortDate = frDateShort(model.dates.testDate);
  const rows = model.tableRows.map((r, i) => {
    const labelSub = i === 0 && shortDate ? `<br><span class="muted-cell" style="font-weight:400;font-size:13px;">${shortDate}</span>` : "";
    const vs = r.status === "ref" ? VS_CELL.ref : `<td class="pct">${pctTxt(r.pct)}</td>`;
    return `
          <tr>
            <td>${escapeHtml(r.label)}${labelSub}</td>
            <td class="muted-cell">${r.raw}</td>
            <td class="muted-cell">${r.standard}</td>
            ${vs}
            <td>${BADGE[r.status] || ""}</td>
          </tr>`;
  }).join("");
  return `
  <section class="slide">
    <div class="head">
      <div class="title"><span class="bar"></span>RÉSULTATS DES TESTS PHYSIQUES</div>
      <div class="eyebrow">DONNÉES DE PERFORMANCE</div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Test athlétique</th><th>Mesure brute</th><th>Standard Top 14*</th><th>Vs cible</th><th>Statut</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="note">* Standards seniors Top 14 (borne basse indicative) ajustés par poste. Force exprimée en multiples du poids de corps (× PC).</div>
  </section>`;
}

function bars(model, narrative) {
  const pcts = model.bars.map((b) => b.pct);
  const denom = Math.max(105, ...pcts, 100); // le max mappe ~100% de piste ; marque 100% visible.
  const markerFrac = (100 / denom); // position de la ligne « 100% CIBLE ».
  const rows = model.bars.map((b) => {
    const w = Math.min(100, (b.pct / denom) * 100);
    const cls = b.met ? "cyan" : "pink";
    return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml((b.label || "").toUpperCase())}</div>
        <div class="track"><div class="fill ${cls}" style="width:${w.toFixed(1)}%">${b.pct}%</div></div>
      </div>`;
  }).join("");
  const markerCss = `left:calc(240px + (100% - 240px) * ${markerFrac.toFixed(3)});`;
  const empty = `<div class="bar-row"><div class="bar-label"></div><div style="color:var(--gray);font-size:14px;">Aucun test de terrain / force mesuré sur cette campagne.</div></div>`;
  return `
  <section class="slide">
    <div class="head">
      <div class="title"><span class="bar"></span>PROFIL ATHLÉTIQUE VS CIBLE TOP 14</div>
      <div class="eyebrow">ANALYSE COMPARATIVE</div>
    </div>
    <div class="bars">
      ${rows || empty}
      <div class="marker" style="${markerCss}"></div>
      <div class="marker-label" style="${markerCss}">100% CIBLE</div>
    </div>
    <div class="comment-cols">
      <div class="comment c-cyan"><h5>${narrative.comments.positive.title}</h5><p>${narrative.comments.positive.body}</p></div>
      <div class="comment c-pink"><h5>${narrative.comments.deficit.title}</h5><p>${narrative.comments.deficit.body}</p></div>
    </div>
  </section>`;
}

function goals(model) {
  const w = model.weightKg;
  const wTxt = w ? `${Math.round(w)} kg` : "—";
  const item = (g) => `<div class="goal-item"><span class="gk">${escapeHtml(g.label)} :</span> <span class="gv">${g.target}</span></div>`;
  const strengthItems = model.missing.strength.map(item).join("");
  const cardioItems = model.missing.cardio.map(item).join("");
  const strengthBody = model.missing.strength.length
    ? `<p>Tests clés de force et de tirage non encore réalisés dans cette campagne. Cibles requises, calibrées pour un poids de corps de ${wTxt} :</p>${strengthItems}`
    : `<p>Tous les tests de force du référentiel ont été mesurés. ✔</p>`;
  const cardioBody = model.missing.cardio.length
    ? `<p>Pour affiner la cartographie métabolique du joueur, la programmation des tests de terrain complémentaires est essentielle :</p>${cardioItems}<p class="goal-note">Ces indicateurs isoleront les profils de puissance aérobie et individualiseront finement la charge de course.</p>`
    : `<p>Tous les tests cardio du référentiel ont été mesurés. ✔</p>`;
  return `
  <section class="slide">
    <div class="head">
      <div class="title"><span class="bar"></span>OBJECTIFS &amp; TESTS MANQUANTS</div>
      <div class="eyebrow">DONNÉES À COMPLÉTER</div>
    </div>
    <div class="goal-cols">
      <div class="goal-card"><h3>▮▮ FORCE &amp; PUISSANCE</h3>${strengthBody}</div>
      <div class="goal-card"><h3>🏃 VITESSE &amp; CAPACITÉ CARDIAQUE</h3>${cardioBody}</div>
    </div>
  </section>`;
}

function healthPage(narrative) {
  const card = (c) => `
      <div class="hcard ${c.accent}">
        <div class="top-accent"></div>
        <div class="ic">${c.icon}</div>
        <h4>${c.title}</h4>
        <div class="stat">${c.stat}</div>
        <p>${c.body}</p>
      </div>`;
  const h = narrative.health;
  return `
  <section class="slide">
    <div class="head">
      <div class="title"><span class="bar"></span>COMPORTEMENT &amp; SANTÉ</div>
      <div class="eyebrow">BIEN-ÊTRE &amp; POINTS DE VIGILANCE</div>
    </div>
    <div class="health-cols">${card(h.psych)}${card(h.sleep)}${card(h.third)}</div>
  </section>`;
}

function recommendations(narrative) {
  const prio = (p) => `
      <div class="prio">
        <div class="pic" style="color:${p.color};">${p.icon}</div>
        <div><h4>${p.title}</h4><p>${p.body}</p></div>
      </div>`;
  return `
  <section class="slide">
    <div class="head">
      <div class="title"><span class="bar"></span>RECOMMANDATIONS D'ENTRAÎNEMENT</div>
      <div class="eyebrow">PLAN DE DÉVELOPPEMENT</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
      ${narrative.priorities.map(prio).join("")}
    </div>
  </section>`;
}

function closing(model) {
  const gen = frDate(model.dates.generatedAt) || "—";
  return `
  <section class="slide close">
    <div class="values">EXCELLENCE · RESPECT · FIERTÉ</div>
    <div class="banner">
      <h2>TRAVAILLE AUJOURD'HUI, DOMINE DEMAIN</h2>
      <p>Rapport généré le ${gen} pour le staff performance</p>
    </div>
    <div class="contact">
      <div class="role">Responsable de la performance</div>
      Christophe Delfosse<br>
      +32 493 59 38 08<br>
      Chris.delfosse@hotmail.com
    </div>
  </section>`;
}

const STYLE = `
  :root{
    --bg:#060a14;--bg-card:#0d1424;--bg-card-2:#111a2e;--grid:rgba(45,212,232,0.05);
    --cyan:#2dd4e8;--cyan-soft:#4fd8ea;--pink:#f43f6e;--pink-soft:#ff5c86;--green:#34d399;
    --amber:#f59e0b;--white:#f5f8fc;--gray:#8a97ac;--gray-dim:#5b6678;--line:rgba(255,255,255,0.07);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#02040a;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:var(--white);display:flex;flex-direction:column;align-items:center;gap:0;}
  .slide{position:relative;width:1280px;height:720px;background:linear-gradient(180deg,#070c18 0%,#050810 55%,#04070f 100%);overflow:hidden;padding:56px 60px;display:flex;flex-direction:column;page-break-after:always;}
  .slide:last-child{page-break-after:auto;}
  .slide::before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:56px 56px;pointer-events:none;}
  .slide::after{content:"";position:absolute;right:-180px;bottom:-220px;width:640px;height:640px;background:radial-gradient(circle,rgba(45,212,232,0.07) 0%,transparent 65%);pointer-events:none;}
  .slide > *{position:relative;z-index:1;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:22px;margin-bottom:30px;}
  .head .title{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:800;letter-spacing:.01em;}
  .head .title .bar{width:5px;height:34px;background:var(--cyan);border-radius:2px;}
  .head .eyebrow{color:var(--cyan);font-size:26px;font-weight:800;letter-spacing:.03em;text-align:right;}
  .cover{align-items:center;justify-content:center;text-align:center;}
  .cover .prog{color:var(--cyan);letter-spacing:.55em;font-size:20px;font-weight:700;margin-bottom:26px;}
  .cover h1{font-size:78px;font-weight:800;letter-spacing:.01em;line-height:1;}
  .cover .rule{width:66px;height:4px;background:var(--cyan);border-radius:2px;margin:26px auto 26px;}
  .cover .sub{color:var(--gray);font-size:20px;margin-bottom:44px;}
  .cover .player{color:var(--cyan);font-size:40px;font-weight:800;margin-bottom:18px;}
  .cover .meta{color:var(--gray-dim);font-size:16px;}
  .divider{align-items:flex-start;justify-content:center;}
  .divider .rule{width:66px;height:4px;background:var(--cyan);border-radius:2px;margin-bottom:26px;}
  .divider h2{font-size:56px;font-weight:800;line-height:1.05;}
  .divider p{color:var(--gray);font-size:19px;margin-top:8px;}
  .cols{display:grid;grid-template-columns:1fr 1.15fr;gap:36px;flex:1;}
  .card{background:linear-gradient(180deg,var(--bg-card) 0%,var(--bg-card-2) 100%);border:1px solid var(--line);border-radius:14px;padding:30px 30px;}
  .card h3{color:var(--cyan);font-size:22px;font-weight:800;letter-spacing:.02em;padding-bottom:14px;border-bottom:1px solid rgba(45,212,232,.25);margin-bottom:20px;}
  .card .lead{color:#c7d1e0;font-size:15px;line-height:1.5;margin-bottom:22px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px 24px;margin-bottom:22px;}
  .field .k{color:var(--gray-dim);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;}
  .field .v{font-size:19px;font-weight:700;}
  .injury{border:1px solid rgba(244,63,110,.4);border-radius:10px;background:rgba(244,63,110,.06);padding:16px 18px;}
  .injury .k{color:var(--pink);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;display:flex;gap:8px;align-items:center;}
  .injury .t{color:#c7d1e0;font-size:13.5px;line-height:1.45;}
  .summary h4{font-size:22px;font-weight:800;line-height:1.2;margin-bottom:16px;text-transform:uppercase;letter-spacing:.01em;}
  .summary p{color:#c1cbdb;font-size:14.5px;line-height:1.55;margin-bottom:16px;}
  .summary b{color:var(--white);}
  .summary .hl{color:var(--cyan-soft);font-weight:700;}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:8px;}
  .kpi{background:#0a1020;border:1px solid var(--line);border-radius:12px;padding:18px 10px;text-align:center;}
  .kpi.accent{border-color:rgba(45,212,232,.4);background:linear-gradient(180deg,#0b1626,#0a1120);}
  .kpi .n{font-size:32px;font-weight:800;color:var(--cyan);line-height:1;}
  .kpi .l{color:var(--gray-dim);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;margin-top:8px;line-height:1.3;}
  .table-wrap{background:linear-gradient(180deg,var(--bg-card),#0a1120);border:1px solid var(--line);border-radius:14px;overflow:hidden;}
  table{width:100%;border-collapse:collapse;}
  thead th{color:var(--cyan);font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;text-align:left;font-weight:700;padding:20px 26px;background:rgba(45,212,232,.04);}
  tbody td{padding:20px 26px;border-top:1px solid var(--line);font-size:15px;vertical-align:middle;}
  tbody tr td:first-child{font-weight:700;}
  .muted-cell{color:var(--gray);}
  .pct{font-weight:800;font-size:16px;}
  .badge{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:8px;font-size:12.5px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;}
  .badge.met{color:var(--green);border:1px solid rgba(52,211,153,.5);background:rgba(52,211,153,.08);}
  .badge.dev{color:var(--amber);border:1px solid rgba(245,158,11,.55);background:rgba(245,158,11,.08);}
  .badge.ref{color:var(--gray);border:1px solid var(--line);background:rgba(255,255,255,.02);}
  .note{color:var(--gray-dim);font-size:13px;font-style:italic;margin-top:22px;}
  .bars{background:linear-gradient(180deg,var(--bg-card),#0a1120);border:1px solid var(--line);border-radius:14px;padding:34px 40px;position:relative;margin-bottom:26px;}
  .bar-row{display:grid;grid-template-columns:220px 1fr;align-items:center;gap:20px;margin-bottom:20px;}
  .bar-row:last-child{margin-bottom:0;}
  .bar-label{text-align:right;font-size:13.5px;font-weight:700;letter-spacing:.04em;color:#d4dcea;}
  .track{position:relative;height:38px;background:#0a1122;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
  .fill{height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:14px;font-weight:800;font-size:14px;border-radius:7px 0 0 7px;}
  .fill.cyan{background:linear-gradient(90deg,#0e5063,#2dd4e8);}
  .fill.pink{background:linear-gradient(90deg,#5c1230,#f43f6e);}
  .bars .marker{position:absolute;top:30px;bottom:56px;border-left:2px solid rgba(255,255,255,.35);}
  .bars .marker-label{position:absolute;bottom:34px;color:var(--gray);font-size:11px;font-weight:700;letter-spacing:.1em;transform:translateX(-50%);}
  .comment-cols{display:grid;grid-template-columns:1fr 1fr;gap:24px;}
  .comment{background:linear-gradient(180deg,var(--bg-card),#0a1120);border:1px solid var(--line);border-radius:12px;padding:22px 26px;}
  .comment h5{font-size:16px;font-weight:800;letter-spacing:.02em;margin-bottom:12px;display:flex;align-items:center;gap:10px;text-transform:uppercase;}
  .comment.c-cyan h5{color:var(--cyan);}
  .comment.c-pink h5{color:var(--pink);}
  .comment p{color:#b9c4d4;font-size:13.5px;line-height:1.5;}
  .goal-cols{display:grid;grid-template-columns:1fr 1fr;gap:34px;flex:1;}
  .goal-card{background:linear-gradient(180deg,var(--bg-card),#0a1120);border:1px solid var(--line);border-radius:14px;padding:32px 34px;}
  .goal-card h3{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:800;color:var(--green);letter-spacing:.02em;margin-bottom:20px;text-transform:uppercase;}
  .goal-card > p{color:#b9c4d4;font-size:14px;line-height:1.55;margin-bottom:20px;}
  .goal-item{padding:14px 0;border-top:1px solid var(--line);}
  .goal-item:first-of-type{border-top:none;}
  .goal-item .gk{color:var(--cyan);font-weight:800;font-size:15px;}
  .goal-item .gv{color:#cdd6e4;font-size:15px;}
  .goal-item .gt{color:var(--white);font-weight:700;}
  .goal-note{color:var(--gray-dim);font-style:italic;font-size:13px;line-height:1.5;margin-top:8px;}
  .health-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;flex:1;}
  .hcard{background:linear-gradient(180deg,var(--bg-card),#0a1120);border:1px solid var(--line);border-radius:14px;padding:28px 28px;position:relative;overflow:hidden;}
  .hcard .top-accent{position:absolute;top:0;left:0;right:0;height:3px;}
  .hcard.a-cyan .top-accent{background:var(--cyan);}
  .hcard.a-pink .top-accent{background:var(--pink);}
  .hcard .ic{font-size:26px;margin-bottom:18px;}
  .hcard h4{font-size:20px;font-weight:800;letter-spacing:.02em;margin-bottom:8px;text-transform:uppercase;}
  .hcard .stat{color:var(--gray);font-size:13.5px;font-weight:700;margin-bottom:20px;}
  .hcard p{color:#b9c4d4;font-size:13.5px;line-height:1.55;}
  .prio{display:flex;gap:18px;padding:20px 0;border-top:1px solid var(--line);}
  .prio:first-of-type{border-top:none;}
  .prio .pic{font-size:22px;flex-shrink:0;width:34px;text-align:center;}
  .prio h4{font-size:17px;font-weight:800;letter-spacing:.01em;margin-bottom:8px;}
  .prio p{color:#b3bdcd;font-size:13.5px;line-height:1.5;}
  .close{align-items:center;justify-content:center;text-align:center;}
  .close .values{color:var(--cyan);letter-spacing:.5em;font-size:26px;font-weight:800;margin-bottom:40px;}
  .close .banner{border:1px solid var(--line);background:rgba(13,20,36,.6);border-radius:14px;padding:34px 60px;margin-bottom:44px;}
  .close .banner h2{color:var(--cyan);font-size:40px;font-weight:800;margin-bottom:12px;}
  .close .banner p{color:#cdd6e4;font-size:16px;}
  .close .contact{color:var(--gray);font-size:16px;line-height:1.7;font-weight:700;text-align:center;}
  .close .contact .role{color:var(--gray);}
  @page{size:1280px 720px;margin:0;}`;

/* Rend le rapport complet (9 pages) en une chaîne HTML autonome. `model` vient
   de buildReportModel, `narrative` de buildNarrative. Le nom de fichier est géré
   par l'endpoint (Content-Disposition). */
export function renderReportHtml(model, narrative) {
  const pages = [
    cover(model),
    divider(),
    profile(model, narrative),
    testsTable(model),
    bars(model, narrative),
    goals(model),
    healthPage(narrative),
    recommendations(narrative),
    closing(model),
  ].join("\n");
  const title = `Rapport de performance — ${escapeHtml(model.player.name)}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
${pages}
</body>
</html>`;
}
