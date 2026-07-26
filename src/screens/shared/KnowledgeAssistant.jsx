import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { CloseX, useModalClose, Tag } from "../../lib/ui.jsx";
import { Sparkles, Plus, Search } from "../../lib/icons.jsx";
import { usePublishedKnowledge } from "../../data/knowledge.js";
import { rankNotes } from "../../lib/knowledge/rank.js";

const accent = C.viol;

/* Assistance contextuelle à la création de protocoles : propose les conseils
   PUBLIÉS (base de connaissance, issus des « PDF nourriciers ») pertinents pour
   le protocole en cours, chacun avec sa CITATION SOURCE (doc + page). « Insérer »
   ajoute une section narrative dont le sous-titre porte l'attribution, pour que
   la source voyage avec le contenu. */
export default function KnowledgeAssistant({ context = {}, onInsert, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const { notes, loading } = usePublishedKnowledge();
  const [q, setQ] = useState("");

  const ranked = useMemo(() => {
    const base = rankNotes(notes, context);
    const nq = q.trim().toLowerCase();
    if (!nq) return base;
    return base.filter((n) => `${n.title} ${n.body} ${n.theme}`.toLowerCase().includes(nq));
  }, [notes, context, q]);

  const relevant = ranked.filter((n) => n._score > 0);
  const others = ranked.filter((n) => n._score === 0);

  const insert = (n) => { onInsert?.(n); onClose?.(); };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Sparkles size={17} style={{ color: accent }} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("knowledge.title")}</div>
          <CloseX onClose={onClose} />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 1.5 }}>{t("knowledge.hint")}</div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: 11, color: "rgba(255,255,255,0.4)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("knowledge.searchPh")}
            style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px 9px 34px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("common.loading")}</div>
        ) : notes.length === 0 ? (
          <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>{t("knowledge.empty")}</div>
        ) : ranked.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: 8 }}>{t("knowledge.noMatch")}</div>
        ) : (
          <>
            {relevant.length > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>{t("knowledge.relevant")}</div>}
            {relevant.map((n) => <NoteCard key={n.id} n={n} t={t} onInsert={insert} />)}
            {others.length > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase", margin: "10px 0 8px" }}>{t("knowledge.others")}</div>}
            {others.map((n) => <NoteCard key={n.id} n={n} t={t} onInsert={insert} />)}
          </>
        )}
      </div>
    </div>
  );
}

function NoteCard({ n, t, onInsert }) {
  return (
    <div style={sc({ padding: 12, marginBottom: 8 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{n.title}</div>
        {n.theme && <Tag c={C.teal}>{n.theme}</Tag>}
      </div>
      {n.body && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, marginBottom: 8, maxHeight: 96, overflow: "hidden" }}>{n.body}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {n.sourceRef && <span style={{ flex: 1, fontSize: 9.5, color: "rgba(255,255,255,0.45)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("knowledge.source")} {n.sourceRef}</span>}
        <div style={{ flex: n.sourceRef ? 0 : 1 }} />
        <button onClick={() => onInsert(n)} style={{ background: accent, border: "none", borderRadius: 8, padding: "7px 12px", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}><Plus size={13} /> {t("knowledge.insert")}</button>
      </div>
    </div>
  );
}
