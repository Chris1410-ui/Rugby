// Edge Function `send-invitation` — envoie par email le lien d'invitation d'un
// club à un destinataire, via Resend. Appelée par le STAFF/OWNER depuis l'app
// (bouton « Générer le lien » quand un email est renseigné).
//
// Sécurité : verify_jwt (défaut) + autorisation RLS explicite. On relit
// l'invitation par son token avec le JWT DE L'APPELANT : la policy
// `club_inv_manage` (owner OU can_write() du club) ne la renvoie qu'à un
// staff/owner autorisé du club → seul lui peut déclencher l'envoi. Aucun accès
// service-role, aucun envoi possible par un tiers.
//
// Secrets requis (variables d'environnement de la fonction) :
//   RESEND_API_KEY  — clé API Resend (re_…)
//   INVITE_FROM     — expéditeur vérifié, ex. « Rugby Perf <invitations@domaine.be> »
//   SUPABASE_URL / SUPABASE_ANON_KEY sont injectés automatiquement.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Libellés FR des rôles (pour le corps de l'email).
const ROLE_LABEL: Record<string, string> = {
  joueur: "joueur",
  preparateur: "préparateur physique",
  medical: "membre du staff médical",
  coach: "coach",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildHtml(link: string, roleLabel: string, expiresLabel: string | null) {
  const safeLink = escapeHtml(link);
  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;background:#f2f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2233;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border-radius:14px;padding:32px 30px;border:1px solid #e3e9f0;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.08em;color:#0ea5b7;text-transform:uppercase;margin-bottom:14px;">Rugby Performance</div>
      <h1 style="font-size:22px;margin:0 0 14px;color:#0f1a2b;">Invitation à rejoindre l'équipe</h1>
      <p style="font-size:15px;line-height:1.55;color:#3a4658;margin:0 0 22px;">
        Vous êtes invité(e) à rejoindre la plateforme en tant que <b>${escapeHtml(roleLabel)}</b>.
        Cliquez sur le bouton ci-dessous pour créer votre compte et rejoindre le club.
      </p>
      <a href="${safeLink}" style="display:inline-block;background:#0ea5b7;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:13px 26px;border-radius:10px;">Accepter l'invitation</a>
      <p style="font-size:12.5px;color:#7a8698;line-height:1.5;margin:22px 0 0;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
        <span style="color:#0ea5b7;word-break:break-all;">${safeLink}</span>
      </p>
      ${expiresLabel ? `<p style="font-size:12px;color:#9aa5b5;margin:18px 0 0;">Ce lien expire le ${escapeHtml(expiresLabel)}.</p>` : ""}
    </div>
    <p style="font-size:11px;color:#9aa5b5;text-align:center;margin:18px 0 0;">Email automatique — merci de ne pas répondre.</p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const token = typeof body.token === "string" ? body.token : "";
  const email = (typeof body.email === "string" ? body.email : "").trim();
  const link = typeof body.link === "string" ? body.link : "";
  if (!token || !link) return json({ error: "token et link requis" }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "email invalide" }, 400);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("INVITE_FROM");
  if (!RESEND_API_KEY || !FROM) return json({ error: "service email non configuré (RESEND_API_KEY / INVITE_FROM)" }, 500);

  // Autorisation : relit l'invitation par token AVEC le JWT de l'appelant (RLS).
  // Un tiers non-staff du club ne verra rien → 403.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: invite, error: invErr } = await supabase
    .from("club_invitations")
    .select("role, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (invErr) return json({ error: "lookup failed" }, 500);
  if (!invite) return json({ error: "accès refusé" }, 403);
  if (invite.status !== "pending") return json({ error: "invitation déjà utilisée ou révoquée" }, 409);

  const roleLabel = ROLE_LABEL[invite.role as string] || "membre";
  const expiresLabel = invite.expires_at
    ? new Date(invite.expires_at as string).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: "Invitation à rejoindre l'équipe — Rugby Performance",
      html: buildHtml(link, roleLabel, expiresLabel),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[send-invitation] Resend error", res.status, detail);
    return json({ error: "échec de l'envoi de l'email", status: res.status }, 502);
  }

  return json({ sent: true });
});
