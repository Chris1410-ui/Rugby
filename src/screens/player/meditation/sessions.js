import { C } from "../../../lib/tokens.js";

/* ════════════════════════════════════════════════════════════════
   Catalogue des séances de méditation / relaxation (contenu PUR — aucun
   appel réseau). Chaque séance est déclarative : ajouter une entrée suffit,
   aucune logique à toucher. Le lecteur commun (Player.jsx) rend la bonne
   visualisation selon `kind`.

   i18n : les textes sont centralisés ici en FR (comme tous les écrans de
   l'app, dont le contenu est codé en dur). Pour une traduction EN/NL
   ultérieure, ce fichier est le SEUL point à externaliser (clés à extraire
   vers i18n/locales/*.json → namespace `meditation`). La clé de navigation
   `nav.meditation` est déjà internationalisée dans les trois catalogues.
   ════════════════════════════════════════════════════════════════ */

// Groupes musculaires de Jacobson (relaxation musculaire progressive), dans
// l'ordre travaillé (des extrémités vers le centre puis les jambes/pieds).
export const JACOBSON_GROUPS = [
  { key: "hands",     label: "Mains & avant-bras", zone: "arms",     hint: "Serre les poings, tends les avant-bras." },
  { key: "shoulders", label: "Épaules & nuque",    zone: "shoulders", hint: "Hausse les épaules vers les oreilles." },
  { key: "face",      label: "Visage",             zone: "head",     hint: "Ferme les yeux, plisse le front et les mâchoires." },
  { key: "back",      label: "Dos",                zone: "back",     hint: "Rapproche les omoplates, cambre légèrement." },
  { key: "belly",     label: "Ventre",             zone: "belly",    hint: "Contracte les abdominaux." },
  { key: "legs",      label: "Jambes",             zone: "legs",     hint: "Tends les cuisses et les mollets." },
  { key: "feet",      label: "Pieds",              zone: "feet",     hint: "Recroqueville les orteils." },
];

// Étapes du training autogène de Schultz (6 inductions classiques).
const SCHULTZ_STEPS = [
  { label: "Installation", text: "Installe-toi confortablement, ferme les yeux. Laisse ton corps devenir lourd et immobile.", seconds: 30 },
  { label: "Lourdeur",     text: "Mon bras droit est lourd… tout mon corps devient lourd, détendu, abandonné.", seconds: 60 },
  { label: "Chaleur",      text: "Une chaleur douce se répand dans mes bras et mes jambes. Mes membres sont chauds et lourds.", seconds: 60 },
  { label: "Cœur calme",   text: "Mon cœur bat calmement et régulièrement. Paisible, tranquille.", seconds: 45 },
  { label: "Respiration",  text: "Ma respiration est calme et libre. Ça respire en moi, sans effort.", seconds: 45 },
  { label: "Plexus solaire", text: "Mon plexus solaire est chaud, mon ventre est détendu et souple.", seconds: 45 },
  { label: "Front frais",  text: "Mon front est frais et clair. Mon esprit est calme et reposé.", seconds: 45 },
  { label: "Retour",       text: "Reprends conscience de ton corps. Bouge doucement les doigts, étire-toi, ouvre les yeux.", seconds: 30 },
];

const PREMATCH_STEPS = [
  { label: "Ancrage",    text: "Respire profondément. Sens tes appuis au sol, solide et stable.", seconds: 30 },
  { label: "Activation", text: "Inspire l'énergie, sens ton corps se réveiller, prêt à l'effort.", seconds: 40 },
  { label: "Focus",      text: "Visualise ton premier geste réussi. Tu es concentré, présent, confiant.", seconds: 40 },
  { label: "Prêt",       text: "Trois respirations puissantes. Tu es prêt. On y va.", seconds: 20 },
];

const POSTMATCH_STEPS = [
  { label: "Relâche",     text: "L'effort est terminé. Relâche les épaules, la mâchoire, les mains.", seconds: 40 },
  { label: "Souffle",     text: "Respire lentement, laisse le rythme cardiaque redescendre.", seconds: 50 },
  { label: "Récupération", text: "Sens la détente gagner tes jambes, tes bras. Ton corps récupère.", seconds: 50 },
  { label: "Bilan doux",  text: "Note une chose positive de ta performance. Puis lâche prise.", seconds: 30 },
];

const SLEEP_STEPS = [
  { label: "Ralentir",   text: "Ferme les yeux. Laisse la journée s'éloigner, sans t'y accrocher.", seconds: 40 },
  { label: "Poids",      text: "Ton corps s'enfonce dans le matelas, de plus en plus lourd.", seconds: 60 },
  { label: "Souffle long", text: "Allonge chaque expiration. Le sommeil vient tout seul.", seconds: 60 },
  { label: "Dérive",     text: "Plus rien à faire, plus rien à penser. Laisse-toi glisser.", seconds: 40 },
];

const STRESS_STEPS = [
  { label: "Reconnaître", text: "Nomme ce que tu ressens, sans le juger. C'est juste une tension.", seconds: 30 },
  { label: "Souffle",     text: "Expire lentement, deux fois plus long que l'inspiration.", seconds: 50 },
  { label: "Relâcher",    text: "À chaque expiration, relâche une zone tendue : épaules, ventre, front.", seconds: 50 },
  { label: "Recentrer",   text: "Reviens à l'instant présent. Une chose que tu vois, une que tu entends.", seconds: 40 },
];

/* Catalogue. `kind` : "breathing" | "jacobson" | "steps".
   - breathing : `pattern` en secondes {inhale, hold1, exhale, hold2} (0 = pas de pause),
     `cycles` = nombre de cycles par défaut (durée réglable dans le lecteur).
   - steps : liste d'étapes minutées.
   - jacobson : utilise JACOBSON_GROUPS + contract/release. */
export const MED_SESSIONS = [
  // ── Respiration ──
  {
    id: "coherence", kind: "breathing", group: "breathing", accent: C.teal,
    title: "Cohérence cardiaque", subtitle: "Respiration 5-5 · apaise le rythme cardiaque",
    pattern: { inhale: 5, hold1: 0, exhale: 5, hold2: 0 }, cycles: 30, durationMin: 5,
  },
  {
    id: "breath478", kind: "breathing", group: "breathing", accent: C.teal,
    title: "Respiration 4-7-8", subtitle: "Inspire 4 · retiens 7 · expire 8 · détente profonde",
    pattern: { inhale: 4, hold1: 7, exhale: 8, hold2: 0 }, cycles: 8, durationMin: 3,
  },
  {
    id: "square", kind: "breathing", group: "breathing", accent: C.teal,
    title: "Respiration carrée", subtitle: "4-4-4-4 · focus & contrôle",
    pattern: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }, cycles: 12, durationMin: 3,
  },

  // ── Relaxation profonde ──
  {
    id: "schultz", kind: "steps", group: "deep", accent: C.viol,
    title: "Training autogène (Schultz)", subtitle: "Lourdeur, chaleur, calme — par étapes guidées",
    steps: SCHULTZ_STEPS, durationMin: 6,
  },
  {
    id: "jacobson", kind: "jacobson", group: "deep", accent: C.viol,
    title: "Relaxation musculaire (Jacobson)", subtitle: "Contracte puis relâche chaque groupe musculaire",
    contractSec: 5, releaseSec: 15, durationMin: 5,
  },

  // ── Séances courtes ──
  {
    id: "prematch", kind: "steps", group: "short", accent: C.blue,
    title: "Avant-match", subtitle: "Focus & activation · 2 min",
    steps: PREMATCH_STEPS, durationMin: 2,
  },
  {
    id: "postmatch", kind: "steps", group: "short", accent: C.blue,
    title: "Après-match", subtitle: "Récupération & retour au calme · 3 min",
    steps: POSTMATCH_STEPS, durationMin: 3,
  },
  {
    id: "sleep", kind: "steps", group: "short", accent: C.blue,
    title: "Sommeil", subtitle: "Endormissement · 3 min",
    steps: SLEEP_STEPS, durationMin: 3,
  },
  {
    id: "stress", kind: "steps", group: "short", accent: C.blue,
    title: "Gestion du stress", subtitle: "Revenir au calme · 3 min",
    steps: STRESS_STEPS, durationMin: 3,
  },
];

export const MED_GROUPS = [
  { key: "breathing", label: "Respiration", emoji: "🌬️" },
  { key: "deep",      label: "Relaxation profonde", emoji: "🧘" },
  { key: "short",     label: "Séances courtes", emoji: "⏱️" },
];

// Libellés des phases de respiration (partagés par le cercle animé).
export const BREATH_LABELS = { inhale: "Inspire…", hold1: "Retiens…", exhale: "Expire…", hold2: "Retiens…" };
