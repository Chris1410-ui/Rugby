/* Moteur de rendu d'un PROTOCOLE → page HTML autonome dans le thème « stade »
   (fidèle à docs/program-builder.reference.html). PUR et testable : aucune
   dépendance i18n/réseau. Alimenté par le document { meta, sections[] }.

   opts :
     interactive     — true : les exercices liés deviennent des <a> qui postent
                       un message au parent (ouverture de la fiche in-app) et le
                       script de révélation au défilement est actif ; false
                       (défaut) : page statique pour l'export/PDF.
     exercisesByRef  — { ref: { name, gifUrl, thumbUrl, attribution } } pour
                       enrichir les exercices liés (vignette si média présent). */
import { normalizeProgram, slugify, blockTint } from "./model.js";

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Markdown-léger EN LIGNE : **gras**, *accent* (→ <em>, coloré cyan dans le hero).
function mdInline(s) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Markdown-léger EN BLOCS : paragraphes, listes « - », encadrés « > », titres « # ».
function mdBody(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let list = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p class="md-p">${para.map(mdInline).join("<br>")}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul class="md-ul">${list.map((li) => `<li>${mdInline(li)}</li>`).join("")}</ul>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (/^>\s?/.test(line)) { flushPara(); flushList(); out.push(`<div class="callout"><p>${mdInline(line.replace(/^>\s?/, ""))}</p></div>`); continue; }
    if (/^#{1,3}\s+/.test(line)) { flushPara(); flushList(); out.push(`<h4 class="md-h">${mdInline(line.replace(/^#{1,3}\s+/, ""))}</h4>`); continue; }
    if (/^-\s+/.test(line)) { flushPara(); (list = list || []).push(line.replace(/^-\s+/, "")); continue; }
    para.push(line);
  }
  flushPara(); flushList();
  return out.join("\n");
}

const factAccent = (a) => (a === "a" ? "a" : "c");
const weekHeadClass = (a) => (a === "a" ? "wa" : a === "m" ? "wm" : "wc");
const blockClass = (r) => { const tint = r.tint || blockTint(r.block); return tint === "a" ? "b-a" : tint === "r" ? "b-r" : "b-c"; };

function exerciseName(r, opts) {
  const nm = escapeHtml(r.name || "");
  if (!r.exerciseRef) return nm;
  const ex = opts.exercisesByRef?.[r.exerciseRef] || null;
  const thumb = ex?.gifUrl || ex?.thumbUrl;
  const media = thumb ? `<img class="exthumb" src="${escapeHtml(thumb)}" alt="" loading="lazy">` : "";
  if (opts.interactive) {
    return `${media}<a class="exlink" href="#" data-ex-ref="${escapeHtml(r.exerciseRef)}">${nm}</a>`;
  }
  const title = ex?.attribution ? ` title="${escapeHtml(ex.attribution)}"` : "";
  return `${media}<span class="exlinked"${title}>${nm}</span>`;
}

function cellHtml(c) {
  const txt = escapeHtml(c?.text || "");
  return c?.peak ? `${txt} <span class="peak">★</span>` : txt;
}

function heroFacts(facts) {
  if (!facts?.length) return "";
  const items = facts
    .filter((f) => (f.n ?? "") !== "" || (f.label ?? "") !== "")
    .map((f) => `<div class="fact"><div class="n ${factAccent(f.accent)}">${escapeHtml(f.n)}</div><div class="l">${escapeHtml(f.label)}</div></div>`)
    .join("");
  return items ? `<div class="hero-facts">${items}</div>` : "";
}

function sectionHead(s, anchorNum) {
  const num = escapeHtml(s.num || anchorNum);
  const sub = s.subtitle ? `<p>${escapeHtml(s.subtitle)}</p>` : "";
  return `<div class="sec-head"><span class="num">${num}</span><div><h2>${escapeHtml(s.title || "")}</h2>${sub}</div></div>`;
}

function exerciseTable(s, opts) {
  const labels = s.weekLabels || [];
  const accents = s.weekAccents || [];
  const heads = labels.map((wl, i) => `<th class="mono ${weekHeadClass(accents[i])}">${escapeHtml(wl)}</th>`).join("");
  const rows = (s.rows || []).map((r) => {
    const cells = (r.weeks || []).map((c) => `<td class="mono">${cellHtml(c)}</td>`).join("");
    return `<tr class="blk ${blockClass(r)}">`
      + `<td>${escapeHtml(r.block || "")}</td>`
      + `<td>${exerciseName(r, opts)}</td>`
      + `<td class="mono">${escapeHtml(r.tempo || "")}</td>`
      + `<td class="mono">${escapeHtml(r.rest || "")}</td>`
      + cells
      + `<td><span class="note">${escapeHtml(r.note || "")}</span></td>`
      + `</tr>`;
  }).join("");
  return `<div class="tblx-scroll"><table class="tblx"><thead><tr>`
    + `<th>Bloc</th><th>Exercice</th><th class="mono">Tempo</th><th class="mono">Repos</th>`
    + heads
    + `<th>Note</th>`
    + `</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSection(s, i, opts) {
  const anchor = `${slugify(s.title)}-${i}`;
  const anchorNum = String(i + 1).padStart(2, "0");
  const body = s.type === "narrative"
    ? `<div class="md">${mdBody(s.body)}</div>`
    : exerciseTable(s, opts);
  return `<section id="${anchor}"><div class="wrap"><div class="rv in">${sectionHead(s, anchorNum)}${body}</div></div></section>`;
}

/* Panneau « Tes cibles » (assignation individualisée) inséré après le hero pour
   le joueur concerné. opts.targets = { track, items:[{label,value}] }. */
function targetsPanel(targets) {
  if (!targets) return "";
  const { track, items } = targets;
  if (!track && !(items && items.length)) return "";
  const trackHtml = track ? `<span class="tgt-track">${escapeHtml(track)}</span>` : "";
  const grid = (items || []).map((i) => `<div class="tgt-item"><div class="tv">${escapeHtml(i.value)}</div><div class="tl">${escapeHtml(i.label)}</div></div>`).join("");
  return `<section class="targets"><div class="wrap"><div class="rv in tgt-card"><div class="tgt-head"><span class="tgt-h">Tes cibles</span>${trackHtml}</div>${grid ? `<div class="tgt-grid">${grid}</div>` : ""}</div></div></section>`;
}

function navToc(sections) {
  const links = sections.map((s, i) => {
    const num = escapeHtml(s.num || String(i + 1).padStart(2, "0"));
    return `<a href="#${slugify(s.title)}-${i}">${num} · ${escapeHtml(s.title || "")}</a>`;
  }).join("");
  return links ? `<nav class="toc"><div class="wrap">${links}</div></nav>` : "";
}

export function renderProgramHtml(rawDoc, opts = {}) {
  const doc = normalizeProgram(rawDoc, rawDoc?.meta?.weeks);
  const m = doc.meta;
  const badge = m.badge || {};
  const badgeHtml = (badge.big || badge.tag)
    ? `<div class="badge-c1 rv in">${badge.big ? `<span class="big">${escapeHtml(badge.big)}</span>` : ""}${badge.tag ? `<span class="tag">${escapeHtml(badge.tag)}</span>` : ""}</div>`
    : "";
  const eyebrow = m.eyebrow ? `<div class="eyebrow rv in">${escapeHtml(m.eyebrow)}</div>` : "";
  const h1 = m.title ? `<h1 class="rv in">${mdInline(m.title)}</h1>` : "";
  const lede = m.lede ? `<p class="lede rv in">${mdInline(m.lede)}</p>` : "";
  const sources = m.sources ? `<p class="sources rv in">${mdInline(m.sources)}</p>` : "";
  const facts = heroFacts(m.facts);

  const sections = doc.sections.map((s, i) => renderSection(s, i, opts)).join("\n");
  const mantra = m.mantra ? `<div class="mantra rv in">${mdInline(m.mantra)}</div>` : "";

  const script = `<script>
    (function(){
      var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
      document.querySelectorAll('.rv').forEach(function(el){io.observe(el);});
      ${opts.interactive ? `document.addEventListener('click',function(ev){var a=ev.target.closest('[data-ex-ref]');if(a){ev.preventDefault();try{parent.postMessage({type:'protocol-exercise',ref:a.getAttribute('data-ex-ref')},'*');}catch(e){}}});` : ""}
    })();
  </script>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(m.title || "Protocole")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,500&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="hero"><div class="pitchlines"></div><div class="wrap" style="position:relative">
${badgeHtml}${eyebrow}${h1}${lede}${facts}${sources}
</div></header>
${targetsPanel(opts.targets)}
${navToc(doc.sections)}
${sections}
<footer><div class="wrap">${mantra}</div></footer>
${script}
</body></html>`;
}

/* CSS du thème « stade » — repris de docs/program-builder.reference.html, enrichi
   du rendu Markdown (.md) et des liens d'exercice (.exlink/.exthumb/.peak). */
const CSS = `
:root{--nuit:#0D1117;--ardoise:#161C24;--brume:#1E2732;--craie:#E8EDF3;--fumee:#94A2B2;--ambre:#E8A33D;--ambre-d:#8a5f1c;--cyan:#38D2E6;--cyan-d:#146a75;--rouge:#E5484D;--vert:#4FBF7B;--line:rgba(255,255,255,.09);--line-2:rgba(255,255,255,.05)}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
body{background:var(--nuit);color:var(--craie);font-family:'Barlow',system-ui,sans-serif;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
h1,h2,h3,h4,.eyebrow,.mono{font-family:'Oswald',sans-serif}
.mono{font-family:'JetBrains Mono',monospace}
.eyebrow{font-size:.72rem;letter-spacing:.32em;text-transform:uppercase;font-weight:600;color:var(--fumee)}
header.hero{position:relative;padding:80px 0 56px;overflow:hidden;background:radial-gradient(1200px 500px at 78% -8%,rgba(56,210,230,.10),transparent 60%),radial-gradient(900px 500px at 8% 108%,rgba(232,163,61,.10),transparent 60%),linear-gradient(180deg,#0b0f14,#0D1117);border-bottom:1px solid var(--line)}
.hero .pitchlines{position:absolute;inset:0;opacity:.5;background-image:repeating-linear-gradient(90deg,transparent 0 118px,var(--line-2) 118px 119px);-webkit-mask-image:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent);mask-image:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent)}
.badge-c1{display:inline-flex;align-items:baseline;gap:14px;margin-bottom:26px}
.badge-c1 .big{font-family:'Anton';font-size:clamp(58px,11vw,120px);background:linear-gradient(160deg,#fff,#cfe9ee 40%,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 30px rgba(56,210,230,.25))}
.badge-c1 .tag{font-family:'Oswald';font-weight:600;font-size:.8rem;letter-spacing:.28em;text-transform:uppercase;color:var(--ambre);border:1px solid var(--ambre-d);border-radius:100px;padding:8px 16px;transform:translateY(-14px)}
header.hero h1{font-family:'Anton';font-size:clamp(34px,6.4vw,72px);text-transform:uppercase;letter-spacing:.005em;max-width:16ch;margin-bottom:22px}
header.hero h1 em{font-style:normal;color:var(--cyan)}
.lede{font-size:clamp(1rem,2vw,1.22rem);color:var(--fumee);max-width:60ch;margin-bottom:36px}
.lede b{color:var(--craie);font-weight:600}
.hero-facts{display:flex;flex-wrap:wrap;gap:14px}
.fact{border:1px solid var(--line);background:rgba(255,255,255,.02);border-radius:12px;padding:14px 18px;min-width:120px}
.fact .n{font-family:'Anton';font-size:1.9rem;line-height:1}.fact .n.c{color:var(--cyan)}.fact .n.a{color:var(--ambre)}
.fact .l{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--fumee);margin-top:6px}
.sources{margin-top:34px;font-size:.82rem;color:var(--fumee)}.sources b{color:var(--craie)}
nav.toc{position:sticky;top:0;z-index:40;background:rgba(13,17,23,.86);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
nav.toc .wrap{display:flex;gap:6px;overflow-x:auto;padding-top:12px;padding-bottom:12px;scrollbar-width:none}
nav.toc .wrap::-webkit-scrollbar{display:none}
nav.toc a{font-family:'Oswald';font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--fumee);text-decoration:none;white-space:nowrap;padding:8px 12px;border-radius:8px;font-weight:600;transition:.2s}
nav.toc a:hover{color:var(--craie);background:rgba(255,255,255,.05)}
section{padding:66px 0;border-bottom:1px solid var(--line-2)}
.sec-head{display:flex;align-items:baseline;gap:18px;margin-bottom:34px}
.sec-head .num{font-family:'JetBrains Mono';font-weight:700;font-size:.9rem;color:var(--cyan);border:1px solid var(--cyan-d);border-radius:7px;padding:4px 9px;flex:none}
.sec-head h2{font-family:'Oswald';font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(1.5rem,3.6vw,2.3rem)}
.sec-head p{color:var(--fumee);font-size:.95rem;margin-top:4px}
.md p.md-p{color:var(--fumee);max-width:70ch;margin-bottom:14px;font-size:1.02rem}
.md p.md-p b{color:var(--craie);font-weight:600}
.md .md-h{font-family:'Oswald';font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:1.05rem;margin:22px 0 10px}
.md .md-ul{list-style:none;margin:0 0 16px;max-width:70ch}
.md .md-ul li{color:var(--fumee);font-size:.95rem;padding-left:18px;position:relative;margin-bottom:8px}
.md .md-ul li::before{content:"";position:absolute;left:0;top:.62em;width:7px;height:7px;border-radius:2px;background:var(--cyan)}
.callout{border:1px solid var(--line);border-left:3px solid var(--ambre);background:var(--ardoise);border-radius:0 12px 12px 0;padding:18px 22px;margin:16px 0}
.callout p{color:var(--fumee);font-size:.9rem}.callout p b{color:var(--craie)}
.tblx{width:100%;border-collapse:collapse;font-size:.86rem;margin-top:6px}
.tblx th,.tblx td{border:1px solid var(--line);padding:9px 12px;text-align:left;vertical-align:middle}
.tblx thead th{background:rgba(255,255,255,.03);font-family:'Oswald';font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:.72rem;color:var(--fumee)}
.tblx td.mono,.tblx th.mono{font-family:'JetBrains Mono';font-size:.8rem}
.tblx tbody tr:nth-child(even){background:rgba(255,255,255,.015)}
.tblx .blk td:first-child{font-family:'JetBrains Mono';font-weight:700;color:var(--nuit);text-align:center;width:44px}
.b-a td:first-child{background:var(--ambre)!important}.b-c td:first-child{background:var(--cyan)!important}.b-r td:first-child{background:var(--rouge)!important;color:#fff!important}
.tblx td .note{color:var(--fumee);font-size:.78rem}
.tblx-scroll{overflow-x:auto;border-radius:12px}
.tblx th.wc{background:rgba(56,210,230,.12);color:var(--cyan);text-align:center}
.tblx th.wa{background:rgba(232,163,61,.12);color:var(--ambre);text-align:center}
.tblx th.wm{background:rgba(255,255,255,.05);color:var(--fumee);text-align:center}
.targets{padding:26px 0 0;border-bottom:none}
.tgt-card{background:linear-gradient(135deg,rgba(56,210,230,.10),rgba(232,163,61,.08));border:1px solid var(--cyan-d);border-radius:16px;padding:20px 22px}
.tgt-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.tgt-h{font-family:'Oswald';font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:1.05rem;color:var(--craie)}
.tgt-track{font-family:'Oswald';font-weight:600;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ambre);border:1px solid var(--ambre-d);border-radius:100px;padding:5px 13px}
.tgt-grid{display:flex;flex-wrap:wrap;gap:12px}
.tgt-item{border:1px solid var(--line);background:rgba(255,255,255,.02);border-radius:12px;padding:12px 16px;min-width:120px}
.tgt-item .tv{font-family:'Anton';font-size:1.5rem;line-height:1;color:var(--cyan)}
.tgt-item .tl{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--fumee);margin-top:6px}
.peak{color:var(--ambre);font-weight:700}
.exlink{color:var(--craie);text-decoration:none;border-bottom:1px dotted var(--cyan);cursor:pointer}
.exlink:hover{color:var(--cyan)}
.exlinked{border-bottom:1px dotted var(--cyan-d)}
.exthumb{width:34px;height:34px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:8px;border:1px solid var(--line)}
footer{padding:60px 0 70px;text-align:center;background:radial-gradient(700px 300px at 50% -20%,rgba(56,210,230,.08),transparent 70%)}
footer .mantra{font-family:'Anton';font-size:clamp(1.6rem,4.5vw,3rem);text-transform:uppercase;line-height:1}
footer .mantra em{font-style:normal;color:var(--ambre)}
.rv{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease}.rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}}
@media(max-width:560px){section{padding:50px 0}.hero-facts .fact{min-width:calc(50% - 7px)}}
@media print{body{background:#fff;color:#111;font-size:11px}nav.toc{display:none}header.hero,section,footer{background:#fff;border-color:#ccc;page-break-inside:avoid;padding:20px 0}.callout,.tblx thead th{background:#f4f4f4!important;border-color:#bbb!important;color:#111!important}.badge-c1 .big,footer .mantra{color:#111!important;-webkit-text-fill-color:#111!important;background:none}h1,h2,h3,h4,.fact .n,.md-p,.lede,.sec-head p{color:#111!important}a{color:#111!important}.rv{opacity:1;transform:none}}
`;
