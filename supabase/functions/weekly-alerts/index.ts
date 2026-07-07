// Edge Function `weekly-alerts` — récap hebdomadaire des alertes.
//
// Appelée par un cron (pg_cron + pg_net) le lundi matin avec la clé service_role
// (stockée dans Vault) en Authorization: Bearer. verify_jwt=true → la passerelle
// vérifie la signature ; on exige en plus le rôle `service_role` (bloque anon /
// authenticated). Pour chaque joueur en alerte, poste un message de récap dans
// son fil (table messages, dir='staff', author='Système').
//
// Le moteur d'alertes est PORTÉ de src/lib/metrics.js (mêmes formules) pour ne
// pas diverger de l'app.

import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── moteur métier porté (identique à lib/metrics.js) ── */
const isoDate = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const todayISO = () => isoDate(new Date());
const seasonSeed = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h >>> 0;
};
function rng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  for (let i = 0; i < 8; i++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return ((s >>> 8) & 0xffffff) / 0x1000000;
  };
}
const sessDur = (s: any) => s.dur || s.duration || 60;

function loadDaily(p: any, sessions: any[], logs: any, nDays = 42) {
  const r = rng(seasonSeed(p.id) + 991);
  const Cw = p.charge7j || 1800;
  const acwr0 = p.acwr || 1;
  const out: any[] = [];
  const t = new Date();
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
    const dow = d.getDay();
    const w = dow === 0 ? 0 : dow === 3 ? 0.4 : 0.7 + r() * 0.9;
    out.push({ date: isoDate(d), au: w });
  }
  const nWeeks = Math.ceil(nDays / 7);
  for (let w = 0; w < nWeeks; w++) {
    const slice = out.slice(Math.max(0, out.length - (w + 1) * 7), out.length - w * 7);
    const raw = slice.reduce((a, o) => a + o.au, 0) || 1;
    const target = w === 0 ? Cw * acwr0 : Cw;
    slice.forEach((o) => { o.au = Math.round((o.au / raw) * target); });
  }
  const mine = sessions.filter((s) => s.assignedIds?.includes(p.id));
  mine.forEach((s) => {
    const lg = logs?.[s.id]?.[p.id];
    const idx = out.findIndex((o) => o.date === s.date);
    if (idx < 0) return;
    if (lg && lg.status === "done" && lg.rpe) out[idx].au = Math.round(lg.rpe * sessDur(s));
    else if (lg && lg.status === "missed") out[idx].au = 0;
  });
  return out;
}
function playerLoad(p: any, sessions: any[], logs: any) {
  const hist = loadDaily(p, sessions, logs, 42);
  const last28 = hist.slice(-28);
  const sum = (a: any[]) => a.reduce((x, o) => x + o.au, 0);
  const acute = sum(last28.slice(-7));
  const chronic = sum(last28.slice(0, 21)) / 3;
  const acwr = chronic > 0 ? +(acute / chronic).toFixed(2) : 0;
  const vals7 = last28.slice(-7).map((o) => o.au);
  const mean = vals7.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(vals7.reduce((a, b) => a + (b - mean) ** 2, 0) / 7) || 1;
  const monotony = +(mean / sd).toFixed(2);
  return { acute, acwr, monotony };
}
const statusOf = (logs: any, sid: string, pid: string) => logs?.[sid]?.[pid]?.status || "pending";

// buildAlerts porté : renvoie la liste d'alertes par joueur
function alertsFor(p: any, sessions: any[], logs: any, checkin: any) {
  const out: string[] = [];
  const L = playerLoad(p, sessions, logs);
  if (L.acwr > 1.5) out.push(`⚡ ACWR ${L.acwr} — surcharge`);
  else if (L.acwr > 0 && L.acwr < 0.8) out.push(`📉 ACWR ${L.acwr} — sous-charge`);
  if (L.monotony > 2) out.push(`🔁 Monotonie ${L.monotony} — manque de variété`);
  const wb = checkin?.wb;
  if (wb) {
    if (wb.fatigue >= 8) out.push(`🥵 Fatigue ${wb.fatigue}/10`);
    if (wb.soreness >= 8) out.push(`💢 Courbatures ${wb.soreness}/10`);
    if (wb.sleep <= 4 || checkin.sleepH <= 5) out.push(`😴 Sommeil insuffisant`);
  }
  const today = todayISO();
  const overdue = sessions.filter((s) => s.assignedIds?.includes(p.id) && s.date < today && statusOf(logs, s.id, p.id) === "pending").length;
  if (overdue > 0) out.push(`⏳ ${overdue} séance${overdue > 1 ? "s" : ""} non validée${overdue > 1 ? "s" : ""}`);
  return out;
}

/* ── résolution des assignés (porté de data/sessions.js) ── */
function resolveAssignedIds(assigned: any, roster: any[]) {
  if (!assigned || assigned.mode === "all" || !assigned.mode) return roster.map((p) => p.id);
  if (assigned.mode === "group") return roster.filter((p) => p.grp === assigned.group).map((p) => p.id);
  return assigned.ids || [];
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  // Exige un appelant service_role (la passerelle a déjà vérifié la signature).
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  let role = "";
  try { role = JSON.parse(atob(token.split(".")[1] || "")).role; } catch { /* ignore */ }
  if (role !== "service_role") return jsonResp({ error: "forbidden" }, 403);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Données (service_role → contourne la RLS)
  const [{ data: players }, { data: sessRows }, { data: logRows }, { data: checkRows }] = await Promise.all([
    db.from("players").select("id, team_id, name, grp, acwr_seed, charge7j"),
    db.from("sessions").select("id, team_id, date, exercises, assigned, duration_min"),
    db.from("session_logs").select("session_id, player_id, status, rpe"),
    db.from("daily_checkins").select("player_id, date, wb, sleep_h").order("date", { ascending: false }),
  ]);

  // logs map
  const logs: any = {};
  (logRows ?? []).forEach((r) => { (logs[r.session_id] = logs[r.session_id] || {})[r.player_id] = { status: r.status, rpe: r.rpe }; });
  // dernier bilan par joueur
  const checkins: any = {};
  (checkRows ?? []).forEach((r) => { if (!checkins[r.player_id]) checkins[r.player_id] = { wb: r.wb, sleepH: r.sleep_h != null ? Number(r.sleep_h) : undefined }; });

  // par équipe
  const teams: Record<string, any[]> = {};
  (players ?? []).forEach((p: any) => {
    (teams[p.team_id] = teams[p.team_id] || []).push({ id: p.id, name: p.name, grp: p.grp, acwr: Number(p.acwr_seed ?? 1), charge7j: p.charge7j ?? 1800 });
  });

  const toInsert: any[] = [];
  let alertedPlayers = 0;
  const week = isoDate(new Date());

  for (const [teamId, roster] of Object.entries(teams)) {
    const teamSessions = (sessRows ?? [])
      .filter((s: any) => s.team_id === teamId)
      .map((s: any) => ({ id: s.id, date: s.date, dur: s.duration_min, exercises: s.exercises, assignedIds: resolveAssignedIds(s.assigned, roster) }));
    for (const p of roster) {
      const al = alertsFor(p, teamSessions, logs, checkins[p.id]);
      if (!al.length) continue;
      alertedPlayers++;
      toInsert.push({
        player_id: p.id,
        dir: "staff",
        author: "Système",
        text: `📊 Récap hebdo (${week}) — ${al.join(" · ")}. Pense à faire ton point avec le staff.`,
      });
    }
  }

  if (toInsert.length) {
    const { error } = await db.from("messages").insert(toInsert);
    if (error) return jsonResp({ error: error.message }, 500);
  }

  return jsonResp({ ok: true, week, teams: Object.keys(teams).length, alertedPlayers, messages: toInsert.length });
});
