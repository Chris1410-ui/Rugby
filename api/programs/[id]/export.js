/* Endpoint PDF d'un PROTOCOLE (fonction serverless Vercel, Node).
   GET /api/programs/:id/export  →  application/pdf (thème « stade », A4 paysage).

   Sécurité (miroir de api/players/[id]/report.js) :
     • JWT Supabase vérifié (Authorization: Bearer …).
     • Contrôle d'accès EXPLICITE via canReadProgram (owner partout ; staff =
       brouillons+publiés de son club ; joueur = publiés de son club). La RLS de
       program_docs reste la défense en profondeur sur la lecture.
   Génération : renderProgramHtml (lib/program/template.js) rendu en PDF par
   Chromium headless (@sparticuz/chromium + puppeteer-core). */

import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

// Voir report.js : forcer la variante AL2023 AVANT le chargement de chromium
// (import dynamique dans le handler) pour extraire les libs et poser LD_LIBRARY_PATH.
if (!process.env.AWS_LAMBDA_JS_RUNTIME) process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs22.x";

import { renderProgramHtml } from "../../../src/lib/program/template.js";
import { canReadProgram } from "../../../src/lib/program/access.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

function fileName(title) {
  const slug = String(title || "protocole")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "protocole";
  return `protocole-${slug}.pdf`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: "Configuration Supabase manquante côté serveur" });
  }

  const programId = req.query.id;
  if (!programId) return res.status(400).json({ error: "Identifiant protocole manquant" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentification requise" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return res.status(401).json({ error: "Session invalide" });

  try {
    // Rôle + équipe du demandeur.
    const { data: me } = await supabase.from("profiles").select("role, team_id").eq("id", user.id).maybeSingle();

    // Protocole cible (RLS : lisible seulement si publié pour un joueur, etc.).
    const { data: prog } = await supabase.from("program_docs").select("*").eq("id", programId).maybeSingle();
    if (!prog) return res.status(404).json({ error: "Protocole introuvable" });

    const allowed = canReadProgram({
      role: me?.role || null,
      requesterTeamId: me?.team_id ?? null,
      programTeamId: prog.team_id,
      status: prog.status,
    });
    if (!allowed) return res.status(403).json({ error: "Accès refusé" });

    // Exercices liés (attribution / média) via leurs refs.
    const refs = [];
    ((prog.doc && prog.doc.sections) || []).forEach((s) => {
      if (s.type === "exercises") (s.rows || []).forEach((r) => r.exerciseRef && refs.push(r.exerciseRef));
    });
    const uniqRefs = [...new Set(refs)];
    let exercisesByRef = {};
    if (uniqRefs.length) {
      const { data: exs } = await supabase.from("exercise_library").select("ref, name, gif_url, thumb_url, attribution").in("ref", uniqRefs);
      (exs || []).forEach((e) => { exercisesByRef[e.ref] = { name: e.name, gifUrl: e.gif_url, thumbUrl: e.thumb_url, attribution: e.attribution }; });
    }

    const doc = { ...(prog.doc || {}), meta: { ...((prog.doc && prog.doc.meta) || {}), weeks: prog.weeks } };
    const html = renderProgramHtml(doc, { exercisesByRef });

    const chromium = (await import("@sparticuz/chromium")).default;
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    let pdf;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdf = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        scale: 0.8,
        margin: { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" },
      });
    } finally {
      await browser.close();
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName(prog.title)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error("[program.export]", e);
    return res.status(500).json({ error: "Échec de génération du PDF" });
  }
}
