-- ─────────────────────────────────────────────────────────────────────────────
-- Lot 2 · PR-C — Mur d'activité du club (onglet Équipe).
--
-- Fil pseudonymisé des FAITS D'ACTIVITÉ du club : séance validée, check-in fait,
-- défi relevé, présence à une convocation, dépôt GPS. AUCUNE donnée de santé
-- (pas de readiness, wellness, poids, valeurs de bilan, charges) — uniquement
-- l'existence d'un fait, daté, rattaché à un player_id (le client résout le
-- totem + initiales, jamais le nom civil).
--
-- Même modèle que les autres RPC de faits d'équipe (team_gps_events, 0114 /
-- team_checkin_events, 0036) : SECURITY DEFINER + résolution d'équipe
-- my_team()/is_owner(), scope strict au club. Fenêtre 30 jours, plafonné.
-- Les records (charges soulevées) sont VOLONTAIREMENT exclus du mur (perf
-- d'autrui) — ils restent sur l'onglet « Moi » du joueur uniquement.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.team_activity_feed(p_team text default null, p_limit int default 40)
returns table (player_id uuid, kind text, occurred_at timestamptz, subject text)
language sql
stable
security definer
set search_path = public, auth
as $$
  with eff as (
    select case
      when p_team is null then my_team()
      when is_owner() then p_team
      when p_team = my_team() then p_team
      else my_team()
    end as team
  ),
  feed as (
    -- Séance validée (session_logs.status = 'done') → titre de la séance.
    select sl.player_id, 'session'::text as kind, sl.logged_at as occurred_at, se.titre as subject
    from public.session_logs sl
    join public.sessions se on se.id = sl.session_id
    join public.players p on p.id = sl.player_id
    where sl.status = 'done'
      and se.team_id = (select team from eff)
      and p.team_id = (select team from eff)
      and sl.logged_at >= now() - interval '30 days'

    union all
    -- Check-in du jour (matin / soir) → le moment, jamais les valeurs.
    select c.player_id, 'checkin'::text, c.created_at, coalesce(c.moment, 'matin')
    from public.daily_checkins c
    join public.players p on p.id = c.player_id
    where coalesce(c.moment, 'matin') in ('matin', 'soir')
      and p.team_id = (select team from eff)
      and c.created_at >= now() - interval '30 days'

    union all
    -- Défi relevé par le joueur (validé / confirmé) → titre du défi.
    select cc.player_id, 'challenge'::text, coalesce(cc.confirmed_at, cc.validated_at), ch.titre
    from public.challenge_completions cc
    join public.challenges ch on ch.id = cc.challenge_id
    where cc.team_id = (select team from eff)
      and cc.statut in ('validee_joueur', 'confirmee')
      and coalesce(cc.confirmed_at, cc.validated_at) >= now() - interval '30 days'

    union all
    -- Présence pointée à une convocation (staff_status = 'present') → titre.
    select ta.player_id, 'convocation'::text, coalesce(ta.staff_at, ta.responded_at), tr.titre
    from public.training_attendance ta
    join public.trainings tr on tr.id = ta.training_id
    where ta.team_id = (select team from eff)
      and ta.staff_status = 'present'
      and coalesce(ta.staff_at, ta.responded_at) >= now() - interval '30 days'

    union all
    -- Dépôt GPS (charge externe) → aucun sujet (jamais le nom de séance privé).
    select g.player_id, 'gps'::text, g.created_at, null::text
    from public.gps_sessions g
    where g.team_id = (select team from eff)
      and g.created_at >= now() - interval '30 days'
  )
  select player_id, kind, occurred_at, subject
  from feed
  where occurred_at is not null
  order by occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

revoke execute on function public.team_activity_feed(text, int) from public, anon;
grant execute on function public.team_activity_feed(text, int) to authenticated;
