import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { displayName } from "../../lib/identity.js";
import { resolveAssignedIds, buildAssigned } from "../../data/sessions.js";

/* Sélecteur de destinataires ADDITIF (partagé) : « Toute l'équipe » OU une/des
   ligne(s) cochée(s) ET des joueurs ajoutés individuellement. `value` =
   { all, groups:[], ids:[] } ; `onChange(next)`. Récap « X destinataires »
   dédupliqué. Le parent convertit en jsonb via buildAssigned(value) au moment
   d'enregistrer. */
export default function RecipientSelect({ players = [], value, onChange, accent = C.coral }) {
  const { t } = useTranslation();
  const v = useMemo(() => value || { all: true, groups: [], ids: [] }, [value]);
  const [expand, setExpand] = useState(false);
  const groupsAvail = useMemo(() => [...new Set(players.map((p) => p.grp).filter(Boolean))], [players]);

  const set = (patch) => onChange({ ...v, ...patch });
  const toggleAll = () => onChange(v.all ? { all: false, groups: [], ids: [] } : { all: true, groups: [], ids: [] });
  const toggleGroup = (g) => set({ all: false, groups: v.groups.includes(g) ? v.groups.filter((x) => x !== g) : [...v.groups, g] });
  const toggleId = (id) => set({ all: false, ids: v.ids.includes(id) ? v.ids.filter((x) => x !== id) : [...v.ids, id] });

  const count = useMemo(() => resolveAssignedIds(buildAssigned(v), players).length, [v, players]);
  const coveredByGroup = (p) => !v.all && v.groups.includes(p.grp);

  const chip = (on, disabled) => ({
    padding: "7px 12px", borderRadius: 999, cursor: disabled ? "default" : "pointer", fontSize: 12, fontWeight: 700,
    border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.05)",
    color: on ? "#fff" : "rgba(255,255,255,0.65)", opacity: disabled ? 0.5 : 1,
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button type="button" onClick={toggleAll} style={chip(v.all)}>{t("recipients.all")}</button>
        {groupsAvail.map((g) => (
          <button type="button" key={g} onClick={() => toggleGroup(g)} style={chip(!v.all && v.groups.includes(g))}>{grpLabel(g)}</button>
        ))}
        <button type="button" onClick={() => setExpand((x) => !x)} style={chip(!v.all && v.ids.length > 0)}>
          {t("recipients.addPlayers", { count: v.ids.length })}
        </button>
      </div>

      {/* Liste des joueurs à ajouter (repliable). Un joueur déjà couvert par une
          ligne cochée est signalé « via ligne » (la coche reste possible mais
          n'ajoute rien — dédup au récap). */}
      {expand && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {players.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: 8 }}>{t("recipients.noPlayers")}</div>}
          {players.map((p) => {
            const checked = v.ids.includes(p.id);
            const covered = coveredByGroup(p);
            return (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, cursor: "pointer", background: checked ? "rgba(255,255,255,0.05)" : "transparent" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleId(p.id)} style={{ width: 15, height: 15, accentColor: accent }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(p)}</span>
                {p.grp && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>{grpLabel(p.grp)}</span>}
                {covered && <span style={{ fontSize: 9, fontWeight: 700, color: accent }}>{t("recipients.viaLine")}</span>}
              </label>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 800, color: count ? accent : C.coral }}>
        {t("recipients.recap", { count })}
      </div>
    </div>
  );
}
