import { supabase } from "../lib/supabase.js";
import { TOTEMS } from "../lib/totems.js";
import { RUGBY_POS } from "../lib/positions.js";
import { isoDate } from "../lib/metrics.js";

/* Mode démo : génère / supprime un lot de joueurs fictifs COMPLETS (fiche +
   bilans + séances validées + tests), marqués is_demo → n'affecte jamais les
   vrais joueurs. Respecte le club courant (teamId) et les RLS (staff de
   l'équipe ou owner). */

const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.round(rnd(a, b));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const round1 = (n) => Math.round(n * 10) / 10;
const dayISO = (back) => { const t = new Date(); return isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - back)); };
const broncoFmt = (sec) => `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;

export async function generateDemoPlayers(teamId, { count = 12 } = {}) {
  // ── 1) Joueurs (totems variés, postes variés, seeds plausibles) ──
  const totems = shuffle(TOTEMS).slice(0, Math.min(count, TOTEMS.length));
  const posPool = shuffle(RUGBY_POS);
  const rows = totems.map((name, i) => {
    const p = posPool[i % posPool.length];
    return {
      team_id: teamId, name, pos: p.name, grp: p.grp, num: i + 1,
      acwr_seed: round1(rnd(0.7, 1.5)),
      wellness: rndi(25, 46), sleep_h: round1(rnd(6, 9)), risque: rndi(15, 70),
      charge7j: rndi(1200, 2600), dispo: rndi(60, 100),
      mas: round1(rnd(14, 18)), back_squat: Math.round(rnd(1.0, 2.0) * 100) / 100,
      cmj_g: rndi(30, 55), cmj_d: rndi(30, 55),
      ischios_g: rndi(250, 380), ischios_d: rndi(250, 380), asym: rndi(0, 12),
      is_custom: true, is_demo: true,
    };
  });
  const { data: players, error } = await supabase.from("players").insert(rows).select();
  if (error) throw error;
  const ids = players.map((p) => p.id);

  // ── 2) Bilans du jour récents (bien-être + activités déclarées) ──
  const checkins = [];
  players.forEach((pl) => {
    const days = rndi(2, 5);
    for (let d = 0; d < days; d++) {
      checkins.push({
        player_id: pl.id, date: dayISO(d),
        wb: { sleep: rndi(5, 9), energy: rndi(4, 9), fatigue: rndi(2, 8), soreness: rndi(2, 8), mood: rndi(4, 9), stress: rndi(2, 7) },
        sleep_h: round1(rnd(6, 9)), hydra: round1(rnd(1.5, 3)),
        activities: Math.random() < 0.5 ? [pick(["salle", "course", "natation"])] : [],
      });
    }
  });
  // Non bloquant : si la RLS check-ins refuse (staff non-owner sur env. sans la
  // policy démo), on continue sans les bilans.
  try { if (checkins.length) await supabase.from("daily_checkins").insert(checkins); }
  catch (e) { console.warn("[demo] check-ins ignorés:", e.message); }

  // ── 3) Séances démo (assignées AUX SEULS joueurs démo) + logs ──
  const codes = ["RS", "CDD", "CSB", "AC"];
  const sessRows = Array.from({ length: 6 }, (_, w) => ({
    team_id: teamId, date: dayISO(w * 2 + 1), code: pick(codes), titre: "Séance démo", duration_min: 60,
    exercises: [
      { id: "d1", name: "Back Squat", sets: 4, reps: "6", charge: "", video: "" },
      { id: "d2", name: "Développé couché", sets: 4, reps: "8", charge: "", video: "" },
    ],
    assigned: { mode: "players", ids }, is_demo: true,
  }));
  const { data: sessions, error: sErr } = await supabase.from("sessions").insert(sessRows).select();
  if (sErr) throw sErr;

  const logs = [];
  sessions.forEach((s) => players.forEach((pl) => {
    const r = Math.random();
    if (r < 0.72) logs.push({ session_id: s.id, player_id: pl.id, status: "done", rpe: rndi(4, 8), per_exercise: {} });
    else if (r < 0.85) logs.push({ session_id: s.id, player_id: pl.id, status: "missed" });
  }));
  if (logs.length) await supabase.from("session_logs").insert(logs);

  // ── 4) Deux campagnes de tests (progression Camp 1 → Camp 2) ──
  const { data: camps, error: cErr } = await supabase.from("test_campaigns").insert([
    { team_id: teamId, name: "Démo — Camp 1", date: dayISO(45), is_demo: true },
    { team_id: teamId, name: "Démo — Camp 2", date: dayISO(5), is_demo: true },
  ]).select();
  if (cErr) throw cErr;
  const campsOrdered = [...camps].sort((a, b) => a.date.localeCompare(b.date));
  const results = [];
  players.forEach((pl) => {
    const bw = rndi(80, 115); // poids de corps → ×PdC réalistes
    const base = { yoyo: rndi(1400, 2000), cmj: rnd(30, 54), bench: rnd(60, 120), hang: rndi(60, 110), squat: rndi(120, 190), bronco: rndi(285, 340), dead: rndi(160, 230), trac: rndi(10, 55) };
    campsOrdered.forEach((c, ci) => {
      results.push({
        campaign_id: c.id, player_id: pl.id, team_id: teamId,
        bronco: broncoFmt(base.bronco - ci * rndi(3, 9)),
        yoyo: base.yoyo + ci * rndi(40, 120),
        squat_5rm: String(base.squat + ci * rndi(2, 8)),
        cmj_overall: round1(base.cmj + ci * rnd(0.5, 2)),
        bench_5rm: round1(base.bench + ci * rnd(2, 6)),
        hang_clean_2rm: base.hang + ci * rndi(2, 6),
        deadlift: base.dead + ci * rndi(3, 10),
        tractions: base.trac + ci * rndi(1, 5),
        bodyweight: bw,
      });
    });
  });
  if (results.length) await supabase.from("test_results").insert(results);

  return { players: players.length, sessions: sessions.length, campaigns: camps.length };
}

export async function deleteDemoPlayers(teamId) {
  // Séances & campagnes démo d'abord (leurs logs / résultats cascadent), puis
  // les joueurs démo (leurs check-ins / logs / résultats restants cascadent).
  await supabase.from("sessions").delete().eq("team_id", teamId).eq("is_demo", true);
  await supabase.from("test_campaigns").delete().eq("team_id", teamId).eq("is_demo", true);
  const { error } = await supabase.from("players").delete().eq("team_id", teamId).eq("is_demo", true);
  if (error) throw error;
}

// Petit hook : liste des joueurs démo d'un club (pour l'aperçu owner).
export async function fetchDemoPlayers(teamId) {
  const { data, error } = await supabase
    .from("players").select("id, name, pos, grp").eq("team_id", teamId).eq("is_demo", true).order("num");
  if (error) throw error;
  return data ?? [];
}
