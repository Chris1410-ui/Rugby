-- ════════════════════════════════════════════════════════════════
-- 0006 — Planification hebdomadaire de l'Edge Function `weekly-alerts`.
--
-- Chaque lundi 07:00 (UTC), pg_cron appelle la fonction via pg_net. La
-- fonction recalcule les alertes (mêmes formules que src/lib/metrics.js)
-- et poste un récap dans le fil de chaque joueur concerné.
--
-- Authentification : la clé `service_role` est lue depuis Vault au moment
-- de l'appel (jamais en clair dans ce dépôt). Avant que le cron ne
-- fonctionne, créer le secret UNE fois (voir README) :
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Réappliquer proprement (migration ré-exécutable)
do $$
begin
  perform cron.unschedule('weekly-alerts');
exception when others then
  null; -- pas encore planifié
end $$;

select cron.schedule(
  'weekly-alerts',
  '0 7 * * 1', -- lundi 07:00 UTC
  $cron$
  select net.http_post(
    url     := 'https://dyazefafptgmqkzabgtx.supabase.co/functions/v1/weekly-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1
      )
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
