import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel, RUGBY_POS, POS_GROUPS } from "../../lib/positions.js";
import { isTotemTaken } from "../../lib/totems.js";
import { buildAlerts, SEVC } from "../../lib/metrics.js";
import { rosterCSV, downloadCSV } from "../../lib/csv.js";
import { todayISO } from "../../lib/metrics.js";
import { useTeamData } from "../../data/useTeamData.js";
import { useTeamMessages } from "../../data/messages.js";
import { useTeamTaskCompletions } from "../../data/tasks.js";
import { useTeamAssignments } from "../../data/questionnaires.js";
import { useAlertStatus } from "../../data/alerts.js";
import { staffTaskToConfirm, staffQuestionnaireTodo, activeAlertsCount } from "../../lib/badges.js";
import { addPlayer, usePasswordResetRequests, markResetHandled } from "../../data/players.js";
import { generateDemoPlayers, deleteDemoPlayers } from "../../data/demo.js";
import { BottomNav, MobileNav, Tag, Pill, KPI, CloseX, useModalClose } from "../../lib/ui.jsx";
import { useIsMobile } from "../../lib/useIsMobile.js";
import { Users, Sun, Dumbbell, Plus, AlertOctagon, Bell, BookOpen, Download, Trophy, Calendar, Activity, Video, MessageSquare, TrendingUp, Eye, Flag, ClipboardList, FileText } from "../../lib/icons.jsx";
import PlayerPreview from "../shared/PlayerPreview.jsx";
import Camps from "./Camps.jsx";
import Taches from "./Taches.jsx";
import Questionnaires from "./Questionnaires.jsx";
import { useTeamCamps } from "../../data/camps.js";
import Alertes from "./Alertes.jsx";
import StaffMessages from "./StaffMessages.jsx";
import Programmes from "./Programmes.jsx";
import Bibliotheque from "./Bibliotheque.jsx";
import AnalyseVideo from "./AnalyseVideo.jsx";
import Classement from "../shared/Classement.jsx";
import Calendrier from "../shared/Calendrier.jsx";
import Veille from "../shared/Veille.jsx";
import Fiche from "../shared/Fiche.jsx";
import PlayerReport from "../shared/PlayerReport.jsx";
import TotemPicker from "../shared/TotemPicker.jsx";
import TestsBatch from "./TestsBatch.jsx";
import Historique from "./Historique.jsx";

const ACCENT = C.coral;

/* Espace staff. Une seule dérivation (useTeamData → enrichPlayers) ; tous les
   onglets lisent l'effectif enrichi. */
export default function StaffApp({ profile, tab: tabProp, onTab }) {
  const [tabState, setTabState] = useState("effectif");
  const tab = tabProp ?? tabState;               // piloté par AppShell (mobile) ou interne
  const [newIntent, setNewIntent] = useState(null); // demande d'ouverture directe d'un « Nouveau » (FAB)
  const go = (t, intent = null) => { (onTab || setTabState)(t); setNewIntent(intent); };
  const mobile = useIsMobile();
  const [preview, setPreview] = useState(null); // joueur ouvert en aperçu (lecture seule)
  const { players, sessions, logs, checkins, activities, bilans, crews, testCampaigns, testResults, loading } = useTeamData(profile.team_id);
  const { camps } = useTeamCamps(profile.team_id);
  const { threads } = useTeamMessages(players.map((p) => p.id));
  const unread = Object.values(threads).reduce((a, t) => a + t.unread, 0);
  // Pastilles = état réel non-traité (en direct via realtime des tables sources).
  const { byTask } = useTeamTaskCompletions(profile.team_id);
  const { byQuestionnaire } = useTeamAssignments(profile.team_id);
  const { statuses } = useAlertStatus(profile.team_id);
  const { requests: resetReqs } = usePasswordResetRequests(profile.team_id);
  const bTaches = staffTaskToConfirm(byTask);
  const bQuest = staffQuestionnaireTodo(byQuestionnaire);
  const bAlertes = activeAlertsCount(players, sessions, logs, checkins, statuses, todayISO());

  // Vue joueur (lecture seule) : le staff ouvre l'expérience d'un joueur telle
  // qu'il la voit, pour tester sans se déconnecter. Aucune écriture (usePreview).
  if (preview) {
    return <PlayerPreview profile={profile} teamId={profile.team_id} playerId={preview.id} playerName={preview.name} onExit={() => setPreview(null)} />;
  }

  const nav = [
    ["effectif", "Joueurs", Users, resetReqs.length],
    ["aujourdhui", "Aujourd'hui", Sun],
    ["alertes", "Suivi", Bell, bAlertes],
    ["messages", "Messages", MessageSquare, unread],
    ["programmes", "Programmes", Dumbbell],
    ["camps", "Camps", Flag],
    ["taches", "Tâches", ClipboardList, bTaches],
    ["questionnaires", "Quest.", FileText, bQuest],
    ["exos", "Exos", BookOpen],
    ["classement", "Classement", Trophy],
    ["historique", "Historique", TrendingUp],
    ["calendrier", "Calendrier", Calendar],
    ["video", "Vidéo", Video],
    ["veille", "Veille", Activity],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <main style={{ flex: 1, padding: 18 }}>
        {tab === "effectif" && <Effectif teamId={profile.team_id} players={players} sessions={sessions} logs={logs} activities={activities} loading={loading} onPreview={setPreview} resetRequests={resetReqs} />}
        {tab === "aujourdhui" && <Aujourdhui players={players} sessions={sessions} logs={logs} checkins={checkins} activities={activities} />}
        {tab === "alertes" && <Alertes teamId={profile.team_id} players={players} sessions={sessions} logs={logs} checkins={checkins} activities={activities} />}
        {tab === "messages" && <StaffMessages players={players} />}
        {tab === "programmes" && <Programmes teamId={profile.team_id} players={players} sessions={sessions} logs={logs} />}
        {tab === "camps" && <Camps teamId={profile.team_id} players={players} sessions={sessions} logs={logs} />}
        {tab === "taches" && <Taches teamId={profile.team_id} players={players} openNew={newIntent === "taches"} />}
        {tab === "questionnaires" && <Questionnaires teamId={profile.team_id} players={players} openNew={newIntent === "questionnaires"} />}
        {tab === "exos" && <Bibliotheque teamId={profile.team_id} />}
        {tab === "classement" && <Classement players={players} sessions={sessions} logs={logs} activities={activities} bilans={bilans} crews={crews} testCampaigns={testCampaigns} testResults={testResults} accent={ACCENT} />}
        {tab === "historique" && <Historique players={players} testCampaigns={testCampaigns} camps={camps} />}
        {tab === "calendrier" && <Calendrier sessions={sessions} logs={logs} accent={ACCENT} />}
        {tab === "video" && <AnalyseVideo teamId={profile.team_id} />}
        {tab === "veille" && <Veille accent={ACCENT} />}
      </main>
      {mobile && tab === "aujourdhui" && <StaffFab go={go} />}
      {mobile
        ? <MobileNav items={nav} primary={["aujourdhui", "effectif", "alertes", "messages"]} active={tab} onSelect={(t) => go(t)} accent={ACCENT} />
        : <BottomNav items={nav} active={tab} onSelect={(t) => go(t)} accent={ACCENT} />}
    </div>
  );
}

/* FAB « ＋ » contextuel (écran Aujourd'hui) : création rapide. Séance / Joueur
   naviguent vers l'écran ; Tâche / Questionnaire ouvrent directement le formulaire. */
function StaffFab({ go }) {
  const [open, setOpen] = useState(false);
  const item = (label, onClick) => (
    <button onClick={() => { onClick(); setOpen(false); }} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 22, padding: "9px 14px", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(0,0,0,0.4)" }}>{label}</button>
  );
  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 24 }} />}
      <div style={{ position: "fixed", right: 16, bottom: 76, zIndex: 25, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {open && (
          <>
            {item("＋ Séance", () => go("programmes"))}
            {item("＋ Tâche", () => go("taches", "taches"))}
            {item("＋ Questionnaire", () => go("questionnaires", "questionnaires"))}
            {item("＋ Joueur", () => go("effectif"))}
          </>
        )}
        <button onClick={() => setOpen((v) => !v)} title="Créer" style={{ background: ACCENT, border: "none", borderRadius: 28, width: 52, height: 52, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.45)", transform: open ? "rotate(45deg)" : "none", transition: "transform .15s" }}>
          <Plus size={24} />
        </button>
      </div>
    </>
  );
}

/* ── Effectif enrichi ── */
function Effectif({ teamId, players, sessions, logs, activities = {}, loading, onPreview, resetRequests = [] }) {
  const [adding, setAdding] = useState(false);
  const [fiche, setFiche] = useState(null);
  const [report, setReport] = useState(null); // joueur pour le récap détaillé
  const [batch, setBatch] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoNote, setDemoNote] = useState("");
  const demoCount = players.filter((p) => p.isDemo).length;

  const genDemo = async () => {
    setDemoBusy(true); setDemoNote("");
    try { const r = await generateDemoPlayers(teamId); setDemoNote(`${r.players} joueurs de démo générés ✓`); }
    catch (e) { setDemoNote("Échec de la génération : " + (e.message || "")); }
    setDemoBusy(false);
  };
  const delDemo = async () => {
    setDemoBusy(true); setDemoNote("");
    try { await deleteDemoPlayers(teamId); setDemoNote("Joueurs de démo supprimés ✓"); }
    catch (e) { setDemoNote("Échec de la suppression : " + (e.message || "")); }
    setDemoBusy(false);
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Users size={18} color={ACCENT} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Effectif · {players.length}</div>
        {players.length > 0 && (
          <button onClick={() => setBatch(true)} title="Saisie groupée des tests" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 9, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
            <Activity size={16} />
          </button>
        )}
        {players.length > 0 && (
          <button onClick={() => downloadCSV(`effectif_${todayISO()}.csv`, rosterCSV(players))} title="Exporter en CSV" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 9, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
            <Download size={16} />
          </button>
        )}
        <button onClick={() => setAdding(true)} style={{ background: ACCENT, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* Demandes de réinitialisation de mot de passe (joueur → staff) */}
      {resetRequests.length > 0 && (
        <div style={{ background: `${C.amb}14`, border: `1px solid ${C.amb}55`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.amb, letterSpacing: 0.5, marginBottom: 8 }}>🔑 DEMANDES DE MOT DE PASSE · {resetRequests.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {resetRequests.map((r) => {
              const pl = players.find((p) => p.id === r.player_id);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || pl?.name || r.email}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}{r.note ? ` · « ${r.note} »` : ""}</div>
                  </div>
                  {pl && <button onClick={() => setFiche(pl)} title="Ouvrir la fiche pour réinitialiser" style={{ background: `${C.green}1f`, border: `1px solid ${C.green}66`, borderRadius: 8, padding: "6px 10px", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Réinitialiser</button>}
                  <button onClick={() => markResetHandled(r.id).catch((e) => console.error(e.message))} title="Marquer traité" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Traité</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode démo : joueurs fictifs complets pour démonstration */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {demoCount === 0 ? (
          <button onClick={genDemo} disabled={demoBusy} style={{ background: `${C.viol}22`, border: `1px solid ${C.viol}66`, borderRadius: 9, padding: "8px 12px", color: C.viol, fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: demoBusy ? 0.6 : 1 }}>🎭 {demoBusy ? "Génération…" : "Générer des joueurs de démo"}</button>
        ) : (
          <button onClick={delDemo} disabled={demoBusy} style={{ background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 9, padding: "8px 12px", color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: demoBusy ? 0.6 : 1 }}>🗑 {demoBusy ? "Suppression…" : `Supprimer les joueurs de démo (${demoCount})`}</button>
        )}
        {demoNote && <span style={{ fontSize: 11, color: demoNote.includes("Échec") ? C.coral : C.green }}>{demoNote}</span>}
      </div>
      {loading && !players.length ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Chargement…</div>
      ) : players.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>
          Aucun joueur. Ajoute le premier membre — il apparaîtra en direct sur tous les appareils du staff.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.map((p) => (
            <div key={p.id} onClick={() => setFiche(p)} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", cursor: "pointer" })}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.85)", width: 30, textAlign: "center" }}>{p.num ?? "—"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  {p.name}{p._live && <span title="Bilan du jour encodé" style={{ width: 6, height: 6, borderRadius: 4, background: C.green, display: "inline-block" }} />}
                  {p.isDemo && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, color: C.viol, background: `${C.viol}22`, border: `1px solid ${C.viol}55`, borderRadius: 5, padding: "1px 5px" }}>DÉMO</span>}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{p.pos} · {grpLabel(p.grp)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: p.readiness > 70 ? C.green : p.readiness > 50 ? C.amb : C.coral }}>{p.readiness}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.56)" }}>READY</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onPreview?.(p); }} title="Vue joueur (lecture seule)" style={{ background: `${C.viol}18`, border: `1px solid ${C.viol}55`, borderRadius: 8, padding: 7, color: C.viol, cursor: "pointer", display: "flex" }}>
                <Eye size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setReport(p); }} title="Récap détaillé" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex" }}>
                <Activity size={15} />
              </button>
              <Pill v={p.acwr} />
            </div>
          ))}
        </div>
      )}
      {adding && <AddPlayerModal teamId={teamId} players={players} onClose={() => setAdding(false)} />}
      {batch && <TestsBatch teamId={teamId} players={players} onClose={() => setBatch(false)} />}
      {report && <PlayerReport player={players.find((p) => p.id === report.id) || report} sessions={sessions} logs={logs} activities={activities[report.id] || []} onClose={() => setReport(null)} onEditFiche={() => setFiche(report)} />}
      {fiche && <Fiche player={players.find((p) => p.id === fiche.id) || fiche} canEdit onClose={() => setFiche(null)} />}
    </section>
  );
}

function AddPlayerModal({ teamId, players = [], onClose }) {
  useModalClose(onClose);
  const [name, setName] = useState("");
  const [posIdx, setPosIdx] = useState(0);
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10 };
  const save = async () => {
    if (!name.trim()) return setErr("Choisis un totem pour le joueur.");
    // Totem unique par club : refuse un doublon (l'index DB reste le garde-fou).
    if (isTotemTaken(players.map((p) => p.name), name)) return setErr("Ce totem est déjà pris dans l'effectif. Choisis-en un autre (bouton 🎲).");
    setBusy(true); setErr("");
    const { name: pos, grp } = RUGBY_POS[posIdx];
    try {
      await addPlayer(teamId, { name, pos, grp, num: num ? parseInt(num, 10) : null });
      onClose();
    } catch (e) {
      const dup = e?.code === "23505" || /players_team_name_uq|duplicate key/i.test(e?.message || "");
      setErr(dup ? "Ce totem est déjà pris dans l'effectif. Choisis-en un autre." : (e.message || "Échec de l'ajout."));
      setBusy(false);
    }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Ajouter un joueur</div>
          <CloseX onClose={onClose} />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>Le joueur est identifié par un <b>totem</b> (pseudo), affiché partout.</div>
        <TotemPicker value={name} onChange={(v) => { setName(v); setErr(""); }} accent={C.coral} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={posIdx} onChange={(e) => setPosIdx(Number(e.target.value))} style={{ ...inp, flex: 2 }}>
            {POS_GROUPS.map((grp) => (
              <optgroup key={grp.grp} label={grp.label}>
                {grp.items.map((p) => <option key={p.i} value={p.i}>{p.num} — {p.name}</option>)}
              </optgroup>
            ))}
          </select>
          <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} placeholder="N°" inputMode="numeric" style={{ ...inp, flex: 1, textAlign: "center" }} />
        </div>
        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: C.coral, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter à l'effectif"}</button>
      </div>
    </div>
  );
}

/* ── Aujourd'hui : synthèse readiness/bien-être + aperçu alertes (effectif enrichi) ── */
function Aujourdhui({ players, sessions, logs, checkins, activities = {} }) {
  const [report, setReport] = useState(null); // { player, reason }
  if (!players.length) return <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>Aucune donnée. Ajoute des joueurs et attends les premiers bilans.</div>;
  const avg = (k) => Math.round(players.reduce((a, p) => a + (p[k] || 0), 0) / players.length);
  const live = players.filter((p) => p._live).length;
  const alerts = buildAlerts(players, sessions, logs, checkins);
  const top = alerts.slice(0, 4);
  const byId = (pid) => players.find((p) => p.id === pid);
  return (
    <section>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Aujourd'hui · {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        <KPI label="READINESS MOY." value={avg("readiness")} color={avg("readiness") > 70 ? C.green : avg("readiness") > 50 ? C.amb : C.coral} />
        <KPI label="BIEN-ÊTRE MOY." value={`${avg("wellness")}/50`} color={C.blue} />
        <KPI label="BILANS DU JOUR" value={`${live}/${players.length}`} sub="encodés" color={C.viol} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <AlertOctagon size={16} color={C.coral} />
        <div style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Alertes · {alerts.length}</div>
        {alerts.length > top.length && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>→ onglet Alertes</span>}
      </div>
      {alerts.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>Aucune alerte. 👌</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {top.map((a, i) => (
            <div key={i} onClick={() => setReport({ player: byId(a.pid), reason: { ...a, color: SEVC[a.sev] } })} style={sc({ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderLeft: `3px solid ${SEVC[a.sev]}`, cursor: "pointer" })}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{a.txt}</div>
              </div>
              <Tag c={SEVC[a.sev]}>{a.cat}</Tag>
            </div>
          ))}
        </div>
      )}
      {report?.player && <PlayerReport player={report.player} sessions={sessions} logs={logs} activities={activities[report.player.id] || []} reason={report.reason} onClose={() => setReport(null)} />}
    </section>
  );
}

