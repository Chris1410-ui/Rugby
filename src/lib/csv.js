/* Export CSV — porté du prototype (BOM + séparateur ';' pour Excel FR). */
import { acwrZ, zoneLabel } from "./metrics.js";
import { grpLabel, posDisplay } from "./positions.js";
export function downloadCSV(filename, rows) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(";")
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Export de l'effectif enrichi (charge / risque / bien-être). `t` = i18next :
// en-têtes, zone ACWR, poste/ligne et oui/non sont traduits dans la langue de
// l'utilisateur (export lisible ; ce fichier n'est pas réimporté par l'app).
export function rosterCSV(players, t) {
  const H = (k) => t(`csv.roster.${k}`);
  const header = [H("num"), H("name"), H("pos"), H("line"), H("acwr"), H("zone"), H("load7d"), H("monotony"), H("strain"), H("wellness"), H("readiness"), H("risk"), H("todayCheckin")];
  const rows = players.map((p) => [
    p.num ?? "", p.name, posDisplay(t, p.pos), grpLabel(p.grp), p.acwr, zoneLabel(t, acwrZ(p.acwr)),
    p.charge7j, p.monotonie, p.strain, p.wellness, p.readiness, p.risque, p._live ? t("csv.yes") : t("csv.no"),
  ]);
  return [header, ...rows];
}
