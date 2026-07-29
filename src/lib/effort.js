/* Extraction des MÉTRIQUES prescrites depuis une consigne texte libre, pour
   pré-remplir (souverainement) les champs de la carte joueur d'un effort
   cardio / vitesse / mobilité. On ne DEVINE que ce qui est écrit explicitement
   avec son unité ; en l'absence d'unité claire, on ne remplit rien (mieux vaut
   un champ vide qu'une valeur fausse à corriger).

   Exemples :
   « 250 watts »            → { watts: 250 }
   « 100 kcal »             → { kcal: 100 }
   « 6 min » / « 6:30 »     → { durationSec: 360 } / { durationSec: 390 }
   « 90 s »                 → { durationSec: 90 }
   « 400 m » / « 1,5 km »   → { distanceM: 400 } / { distanceM: 1500 }
   « 6 × 200 m » / « 6 reps »→ { reps: 6, distanceM: 200 }
   « r=90s » / « récup 2min »→ { recoverySec: 90 } / { recoverySec: 120 }
   « tenue 30s »            → { holdSec: 30 }
   « 75% VMA »              → { pctVMA: 75 }

   Fonction PURE & testable. Ne parse JAMAIS les kg (réservés à la muscu). */

const num = (s) => {
  const v = Number(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

// Convertit un couple (minutes, secondes) éventuel en secondes totales.
const toSec = (min, sec) => Math.round((num(min) || 0) * 60 + (sec != null ? (num(sec) || 0) : 0));

export function parsePrescribedMetrics(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  const s = raw.toLowerCase();
  const out = {};

  // Watts : « 250 w », « 250 watts », « 250W ».
  const w = s.match(/(\d+(?:[.,]\d+)?)\s*w(?:att)?s?\b/);
  if (w) out.watts = num(w[1]);

  // Kcal / calories : « 100 kcal », « 100 cal ».
  const kc = s.match(/(\d+(?:[.,]\d+)?)\s*k?cal\b/);
  if (kc) out.kcal = num(kc[1]);

  // Répétitions : « 6 × … », « 6x », « 6 reps », « 6 rép ».
  const reps = s.match(/(\d+)\s*(?:[x×]|reps?\b|rép\b|rep\b)/);
  if (reps) out.reps = num(reps[1]);

  // Récupération explicite : « r=90s », « récup 2 min », « recup 90s », « rest 1:30 ».
  const rec = s.match(/(?:r\s*=|récup|recup|repos|rest)\s*:?\s*(\d+)\s*(?:min|['’:]\s*(\d+))?\s*(s|sec|min|['’])?/);
  if (rec) {
    const n = num(rec[1]);
    if (/min|['’:]/.test(rec[0]) && !/\bs\b|sec/.test(rec[3] || "")) out.recoverySec = toSec(n, rec[2]);
    else out.recoverySec = Math.round(n); // secondes par défaut
  }

  // Tenue (mobilité / gainage) : « tenue 30s », « hold 45s », « maintien 1 min ».
  const hold = s.match(/(?:tenue|hold|maintien|gainage)\s*:?\s*(\d+)\s*(min|['’]|s|sec)?/);
  if (hold) {
    const n = num(hold[1]);
    out.holdSec = /min|['’]/.test(hold[2] || "") ? Math.round(n * 60) : Math.round(n);
  }

  // %VMA (allure cible calculée par computeTargetPace uniquement si MAS connue).
  const vma = s.match(/(\d+(?:[.,]\d+)?)\s*%?\s*(?:vma|mas)\b/);
  if (vma) out.pctVMA = num(vma[1]);

  // Distance : « 400 m », « 1,5 km », « 5km ». (après reps pour capter « 6×200m ».)
  const dist = s.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/);
  if (dist) out.distanceM = Math.round(num(dist[1]) * (dist[2] === "km" ? 1000 : 1));

  // Durée globale : « 6 min », « 6:30 », « 90 s » — sauf si déjà capté en récup/tenue.
  // On évite de reprendre le nombre de la récup/tenue : on cherche la 1re durée
  // « libre » (précédée d'un séparateur/début, suivie de min/s/mm:ss).
  const mmss = s.match(/(?:^|[^:\d])(\d{1,3})\s*[:’']\s*(\d{2})\b/);
  const minOnly = s.match(/(?:^|[^:\d])(\d+(?:[.,]\d+)?)\s*min\b/);
  const secOnly = s.match(/(?:^|[^:\d])(\d+)\s*(?:s|sec)\b/);
  if (out.durationSec == null) {
    if (mmss) out.durationSec = toSec(mmss[1], mmss[2]);
    else if (minOnly) out.durationSec = toSec(minOnly[1], 0);
    else if (secOnly && out.recoverySec == null && out.holdSec == null) out.durationSec = Math.round(num(secOnly[1]));
  }

  return out;
}
