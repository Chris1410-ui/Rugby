-- Web Push : à chaque notification in-app insérée (par les triggers de 0026),
-- on déclenche un push vers les appareils du joueur via l'Edge Function
-- `send-push`. L'appel HTTP part en asynchrone via pg_net ; l'URL et le secret
-- partagé sont lus depuis Vault (aucun secret en dur dans la migration).
--
-- Prérequis opérationnels (hors migration, à provisionner une fois) :
--   • extension pg_net activée ;
--   • secrets Vault `push_function_url` et `push_hook_secret` créés :
--       select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--       select vault.create_secret('<secret aléatoire>', 'push_hook_secret');
--   • variables d'env de la fonction send-push : PUSH_HOOK_SECRET (= secret Vault),
--     VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.

create extension if not exists pg_net;

create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net', 'extensions'
as $function$
declare
  fn_url text;
  hook_secret text;
begin
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_function_url' limit 1;
  select decrypted_secret into hook_secret from vault.decrypted_secrets where name = 'push_hook_secret' limit 1;
  if fn_url is null or hook_secret is null then
    return new; -- push non configuré → no-op (la notification in-app reste OK)
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', hook_secret
    ),
    body := jsonb_build_object(
      'player_id', new.player_id,
      'title', new.titre,
      'body', new.body,
      'route', new.route,
      'type', new.type,
      'tag', new.type
    )
  );
  return new;
exception when others then
  -- Ne JAMAIS faire échouer l'insertion de la notification à cause du push.
  return new;
end;
$function$;

drop trigger if exists notify_push_trg on public.notifications;
create trigger notify_push_trg
  after insert on public.notifications
  for each row execute function public.notify_push();
