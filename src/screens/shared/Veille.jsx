import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { ExternalLink } from "../../lib/icons.jsx";
import { BIBLIO, VEILLE_THEMES, getRef } from "../../lib/biblio.js";

/* Veille scientifique — contenu de référence (rugby). Pas de données joueur. */
export default function Veille({ accent = C.coral }) {
  const { t } = useTranslation();
  return (
    <div>
      <Section title={t("shared.veille.byTheme")}>
        {VEILLE_THEMES.map((th, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t(`shared.veille.themes.${th.key}.title`)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>{t(`shared.veille.themes.${th.key}.desc`)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {th.refs.map((rid) => {
                const r = getRef(rid);
                if (!r) return null;
                return (
                  <a key={rid} href={r.q} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: accent, textDecoration: "none", background: `${accent}18`, border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {r.a.split(",")[0]} {r.y}<ExternalLink size={9} />
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section title={t("shared.veille.biblioTitle")}>
        {BIBLIO.rugby.map((r, i) => (
          <a key={i} href={r.q} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "10px 0", borderBottom: `1px solid ${C.border2}`, textDecoration: "none", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{r.t}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>{r.a} · {r.j}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{r.y}</span>
                <ExternalLink size={12} color="rgba(255,255,255,0.4)" />
              </div>
            </div>
          </a>
        ))}
      </Section>
    </div>
  );
}
