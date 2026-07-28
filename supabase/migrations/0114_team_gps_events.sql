-- ─────────────────────────────────────────────────────────────────────────────
-- GPS-2b — Points « séance GPS déposée » (+10 par ligne gps_sessions).
--
-- Le classement se calcule côté client (computePoints) à partir d'events exposés
-- par des RPC SECURITY DEFINER qui ne révèlent QUE le sous-ensemble « points ».
-- Ici : (player_id, at) uniquement — jamais les métriques, le nom de séance privé
-- ni les chemins d'images (pseudonymisation préservée). Barèmes séance / sRPE /
-- ACWR inchangés ; charge externe sans impact sur les formules.
--
-- Résolution d'équipe alignée sur team_training_events (0082) : joueur → sa team ;
-- owner → team demandée ; staff → sa team. 1 dépôt = 1 ligne = +10 (pas de distinct
-- sur la date : 2 séances GPS le même jour = 2 events).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.team_gps_events(p_team text default null)
returns table (player_id uuid, at date)
language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  )
  select g.player_id, g.date as at
  from public.gps_sessions g
  where g.team_id = (select team from eff)
$$;

revoke execute on function public.team_gps_events(text) from public, anon;
grant execute on function public.team_gps_events(text) to authenticated;
