/* Logique d'ASSIGNATION des protocoles — pure et testable.
   Une assignation cible tout le club (team), un groupe (avants/arrieres) ou un
   joueur, et porte des cibles individualisées libres ([{label,value}]) + un
   « track » optionnel. Ces helpers calculent la visibilité et les cibles
   effectives d'un joueur (précédence joueur > groupe > club). */

// Existe-t-il des assignations CIBLÉES (groupe ou joueur) ? Si non → collectif.
export const isTargeted = (assignments) =>
  (assignments || []).some((a) => a.scope === "group" || a.scope === "player");

// Assignations qui s'appliquent à un joueur donné (par son id / son groupe).
export function applicableTo(assignments, { playerId, group } = {}) {
  return (assignments || []).filter((a) =>
    a.scope === "team"
    || (a.scope === "group" && a.groupKey === group)
    || (a.scope === "player" && a.playerId === playerId));
}

/* Un joueur voit-il ce protocole ? Sans assignation ciblée → oui (visible par
   tout le club). Avec des assignations ciblées → oui seulement s'il en fait
   partie (une assignation « team » rend aussi le protocole visible par tous). */
export function isVisibleToPlayer(assignments, ctx = {}) {
  if (!isTargeted(assignments)) return true;
  return applicableTo(assignments, ctx).length > 0;
}

const RANK = { team: 0, group: 1, player: 2 };

/* Cibles effectives d'un joueur : fusion des assignations applicables, la plus
   spécifique l'emporte (joueur > groupe > club) label par label. Renvoie
   { track, items:[{label,value}] }. */
export function mergeTargets(assignments, ctx = {}) {
  const applicable = applicableTo(assignments, ctx).slice().sort((a, b) => RANK[a.scope] - RANK[b.scope]);
  const byLabel = new Map();
  let track = "";
  for (const a of applicable) {
    if (a.track) track = a.track;
    (a.targets || []).forEach((t) => {
      if (t && (t.label ?? "") !== "") byLabel.set(String(t.label).trim().toLowerCase(), { label: t.label, value: t.value ?? "" });
    });
  }
  return { track, items: [...byLabel.values()] };
}

// Libellé court d'une assignation (pour l'UI staff), sans i18n : renvoie une clé.
export function scopeKey(a) {
  if (a.scope === "group") return `group.${a.groupKey}`;
  if (a.scope === "player") return "player";
  return "team";
}
