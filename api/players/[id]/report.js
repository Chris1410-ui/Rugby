/* Endpoint PDF du rapport de performance (fonction serverless Vercel, Node).
   GET /api/players/:id/report  →  application/pdf (9 pages, 16:9).

   Sécurité :
     • JWT Supabase vérifié (en-tête Authorization: Bearer …).
     • Contrôle d'accès EXPLICITE (jamais délégué à la seule RLS, car un joueur
       peut lire l'effectif de base de ses coéquipiers via players_team_read) :
         - staff (rôle ≠ joueur) : n'importe quel joueur de SON équipe ;
         - joueur : lui-même uniquement (players.owner_uid = auth.uid()).
       Sinon 403.
     • La récupération des données sensibles (tests, bilans) passe par un client
       porteur du JWT de l'utilisateur → la RLS s'applique en défense en profondeur.
   Génération : le HTML paramétré (lib/report/*) est rendu en PDF par Chromium
   headless (@sparticuz/chromium + puppeteer-core). */

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

import { normalizeReportInput } from "../../../src/lib/report/input.js";
import { buildReportModel } from "../../../src/lib/report/compute.js";
import { buildNarrative } from "../../../src/lib/report/narrative.js";
import { renderReportHtml } from "../../../src/lib/report/template.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Date du jour (Europe/Bruxelles), format 'YYYY-MM-DD' pour « généré le … ».
function todayBrussels() {
  // fr-CA rend l'ISO YYYY-MM-DD ; le fuseau force le bon jour civil.
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Brussels" }).format(new Date());
}

// Nom de fichier propre : « rapport-performance-nom.pdf » (ASCII sûr).
function fileName(name) {
  const slug = String(name || "joueur")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "joueur";
  return `rapport-performance-${slug}.pdf`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: "Configuration Supabase manquante côté serveur" });
  }

  const playerId = req.query.id;
  if (!playerId) return res.status(400).json({ error: "Identifiant joueur manquant" });

  // 1) JWT.
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentification requise" });

  // Client porteur du JWT : la RLS s'applique à toutes ses lectures.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return res.status(401).json({ error: "Session invalide" });

  try {
    // 2) Rôle + équipe du demandeur (profiles_self : sa propre ligne).
    const { data: me } = await supabase.from("profiles").select("role, team_id").eq("id", user.id).maybeSingle();
    const isStaff = !!me && me.role !== "joueur";

    // 3) Joueur cible (lisible via RLS effectif/équipe).
    const { data: player } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    // 4) Contrôle d'accès EXPLICITE.
    const allowed = isStaff
      ? me.team_id != null && player.team_id === me.team_id
      : player.owner_uid === user.id;
    if (!allowed) return res.status(403).json({ error: "Accès refusé" });

    // 5) Données (RLS : joueur = les siennes ; staff = son équipe).
    const [{ data: campaigns }, { data: results }, { data: checkins }] = await Promise.all([
      supabase.from("test_campaigns").select("id, date").eq("team_id", player.team_id),
      supabase.from("test_results").select("*").eq("player_id", playerId),
      supabase.from("daily_checkins").select("date, wb, moment").eq("player_id", playerId)
        .neq("moment", "meditation").order("date", { ascending: false }).limit(1),
    ]);

    const input = normalizeReportInput({
      player,
      campaigns: campaigns || [],
      results: results || [],
      checkin: (checkins && checkins[0]) || null,
      generatedAt: todayBrussels(),
    });
    const model = buildReportModel(input);
    const html = renderReportHtml(model, buildNarrative(model));

    // 6) HTML → PDF (Chromium headless).
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    let pdf;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdf = await page.pdf({
        width: "1280px",
        height: "720px",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
    } finally {
      await browser.close();
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName(player.name)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error("[report.pdf]", e);
    return res.status(500).json({ error: "Échec de génération du rapport" });
  }
}
