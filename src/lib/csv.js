/* Export CSV — porté du prototype (BOM + séparateur ';' pour Excel FR). */
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

// Export de l'effectif enrichi (charge / risque / bien-être)
export function rosterCSV(players) {
  const header = ["N°", "Nom", "Poste", "Ligne", "ACWR", "Zone", "Charge7j (UA)", "Monotonie", "Strain", "Bien-être/50", "Readiness/100", "Risque/100", "Bilan du jour"];
  const zone = (v) => (v < 0.8 ? "sous-charge" : v <= 1.3 ? "cible" : v <= 1.5 ? "vigilance" : "surcharge");
  const rows = players.map((p) => [
    p.num ?? "", p.name, p.pos ?? "", p.grp ?? "", p.acwr, zone(p.acwr), p.charge7j, p.monotonie, p.strain,
    p.wellness, p.readiness, p.risque, p._live ? "oui" : "non",
  ]);
  return [header, ...rows];
}
