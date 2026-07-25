/* Présences aux convocations — helpers purs & testables. Le pointage staff
   (`staffStatus`) est LA VÉRITÉ ; la réponse du joueur (`playerResponse`) n'est
   qu'une annonce. Aucune formule de points existante n'est modifiée : ces
   helpers ne font que classer les états et dériver les events datés que
   computePoints consommera (PR-D). */

// États possibles d'une réponse / d'un pointage.
export const ATT_STATES = ["present", "late", "absent", "pending"];

/* État effectif AFFICHÉ pour un joueur : le pointage staff prime, sinon la
   réponse du joueur, sinon « pas encore répondu ». */
export function effectiveAttendance(row) {
  return row?.staffStatus || row?.playerResponse || "pending";
}

/* Compteurs sur l'effectif convoqué (ids résolus depuis `assigned`). `byPlayer`
   = { [playerId]: attendanceRow }. Les convoqués sans ligne comptent « pending ». */
export function attendanceCounts(convenedIds = [], byPlayer = {}) {
  const c = { present: 0, late: 0, absent: 0, pending: 0 };
  convenedIds.forEach((id) => {
    const st = effectiveAttendance(byPlayer[id]);
    c[st] = (c[st] || 0) + 1;
  });
  c.total = convenedIds.length;
  c.responded = convenedIds.filter((id) => byPlayer[id]?.playerResponse).length;
  return c;
}

/* Taux de présence : présents (pointés) / séances pointées. Basé sur le pointage
   staff (vérité) uniquement ; renvoie null tant qu'aucun pointage n'existe. */
export function attendanceRate(rows = []) {
  const pointed = rows.filter((r) => r?.staffStatus);
  if (!pointed.length) return null;
  const present = pointed.filter((r) => r.staffStatus === "present" || r.staffStatus === "late").length;
  return Math.round((present / pointed.length) * 100);
}

/* Nature de l'event de points d'un pointage (miroir EXACT de team_training_events
   côté SQL). Présence confirmée / retard / absence non annoncée ; l'absence
   annoncée à l'avance est neutre (null). Basé sur le pointage staff. */
export function attendancePointKind(row) {
  const s = row?.staffStatus;
  if (s === "present") return "present";
  if (s === "late") return "late";
  if (s === "absent") return row?.playerResponse === "absent" ? null : "absentUnannounced";
  return null; // pas pointé → pas d'event
}
