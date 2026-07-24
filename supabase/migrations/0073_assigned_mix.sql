-- 0073 — Destinataires COMBINABLES : nouveau mode `mix` sur le jsonb `assigned`.
--   { "mode":"mix", "groups":["avants"], "ids":["<uuid>", ...] }
-- = union des lignes cochées (groups) ET des joueurs ajoutés (ids), dédupliquée.
--
-- Additif et rétro-compatible : les modes existants (all / group / players /
-- open) sont inchangés ; on ajoute une branche `mix` aux fonctions qui lisent
-- `assigned` côté serveur (notifications + destinataire tâche/défi).

-- 1) Destinataires de notification (séances / programmes / tâches / défis …).
create or replace function public.notif_targets(p_team text, p_assigned jsonb) returns setof uuid
  language sql stable security definer set search_path = public, auth as $$
  select p.id from public.players p
  where p.team_id = p_team and coalesce(p.is_demo, false) = false
    and case coalesce(p_assigned->>'mode', 'all')
      when 'all'     then true
      when 'group'   then p.grp::text = (p_assigned->>'group')
      when 'players' then coalesce(p_assigned->'ids', '[]'::jsonb) ? p.id::text
      when 'mix'     then (coalesce(p_assigned->'groups', '[]'::jsonb) ? p.grp::text)
                       or (coalesce(p_assigned->'ids', '[]'::jsonb) ? p.id::text)
      else true end
$$;

-- 2) Le joueur est-il destinataire de la TÂCHE ?
create or replace function public._task_assigned_to(t public.tasks, p_player uuid) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select case coalesce(t.assigned->>'mode', 'all')
    when 'all'     then true
    when 'group'   then (t.assigned->>'group') = (select grp::text from public.players where id = p_player)
    when 'players' then coalesce(t.assigned->'ids', '[]'::jsonb) ? p_player::text
    when 'mix'     then (coalesce(t.assigned->'groups', '[]'::jsonb) ? (select grp::text from public.players where id = p_player))
                     or (coalesce(t.assigned->'ids', '[]'::jsonb) ? p_player::text)
    else true end
$$;

-- 3) Le joueur est-il destinataire du DÉFI ?
create or replace function public._challenge_assigned_to(c public.challenges, p_player uuid) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select case coalesce(c.assigned->>'mode', 'all')
    when 'all'     then true
    when 'open'    then true
    when 'group'   then (c.assigned->>'group') = (select grp::text from public.players where id = p_player)
    when 'players' then coalesce(c.assigned->'ids', '[]'::jsonb) ? p_player::text
    when 'mix'     then (coalesce(c.assigned->'groups', '[]'::jsonb) ? (select grp::text from public.players where id = p_player))
                     or (coalesce(c.assigned->'ids', '[]'::jsonb) ? p_player::text)
    else true end
$$;
