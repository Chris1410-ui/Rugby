-- ════════════════════════════════════════════════════════════════
-- 0066 — Notifications pour les PROGRAMMES (protocoles).
--
-- Régression : publier/assigner un protocole (program_docs) aux joueurs ne
-- créait AUCUNE notification (ni pastille in-app, ni push). Toutes les autres
-- entrées du staff (tâches, défis, questionnaires, séances, médias…) passent par
-- un trigger `notify_*` qui insère une ligne `notifications` par destinataire
-- (via notif_targets), et le push suit automatiquement (trigger notify_push de
-- 0034). Le module protocoles avait été oublié dans ce déclencheur.
--
-- Un protocole devient disponible pour un joueur à DEUX moments distincts :
--   1) sa PUBLICATION (status → 'published') — c'est là qu'il devient visible ;
--   2) une nouvelle ASSIGNATION ciblée (all / ligne / joueur) sur un protocole
--      DÉJÀ publié (ciblage tardif).
-- On couvre les deux, sans double-notif ni spam sur simple édition d'un
-- protocole déjà publié.
--
-- Destinataires = mêmes règles all/ligne/joueur que partout ailleurs, résolues
-- par notif_targets(team, assigned_jsonb). Le joueur ne voyant que les
-- protocoles PUBLIÉS (RLS de 0063), on ne notifie jamais un brouillon : le
-- trigger de publication s'en chargera le moment venu.
--
-- type = 'program' (texte libre, pas d'enum en base) ; route = 'protocoles'
-- (onglet joueur existant) → clic = ouverture de la liste des protocoles.
-- ════════════════════════════════════════════════════════════════

-- Mappe le scope d'une assignation (team|group|player) vers la forme `assigned`
-- attendue par notif_targets ({mode:all} | {mode:group,group} | {mode:players,ids}).
create or replace function public.program_assigned_json(p_scope text, p_group text, p_player uuid)
  returns jsonb language sql immutable as $$
  select case p_scope
    when 'team'   then '{"mode":"all"}'::jsonb
    when 'group'  then jsonb_build_object('mode', 'group', 'group', p_group)
    when 'player' then jsonb_build_object('mode', 'players', 'ids', jsonb_build_array(p_player::text))
    else '{"mode":"all"}'::jsonb
  end
$$;

-- ---------- Publication d'un protocole → notifie les destinataires ----------
create or replace function public.notify_program() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_title text;
begin
  -- Seulement quand le protocole EST publié…
  if new.status <> 'published' then return new; end if;
  -- …et seulement au PASSAGE à publié (pas à chaque édition d'un doc déjà publié).
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;

  v_title := coalesce(nullif(new.title, ''), 'Programme');

  if exists (select 1 from public.program_assignments a where a.program_id = new.id) then
    -- Ciblé : union (dédupliquée) des destinataires de toutes les assignations.
    insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
      select new.team_id, s.tgt, 'program', 'Nouveau programme', v_title, new.id, 'protocoles'
      from (
        select distinct t as tgt
        from public.program_assignments a
        cross join lateral public.notif_targets(
          a.team_id, public.program_assigned_json(a.scope, a.group_key, a.player_id)) t
        where a.program_id = new.id
      ) s;
  else
    -- Aucune assignation ciblée → visible par tout le club (comportement collectif).
    insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
      select new.team_id, t, 'program', 'Nouveau programme', v_title, new.id, 'protocoles'
      from public.notif_targets(new.team_id, '{"mode":"all"}'::jsonb) t;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_program on public.program_docs;
create trigger trg_notify_program after insert or update on public.program_docs
  for each row execute function public.notify_program();

-- ---------- Assignation tardive sur un protocole déjà publié ----------
create or replace function public.notify_program_assignment() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_title text;
  v_status text;
begin
  select title, status into v_title, v_status from public.program_docs where id = new.program_id;
  -- Brouillon → on ne notifie pas ici (le trigger de publication le fera).
  if v_status is distinct from 'published' then return new; end if;

  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, t, 'program', 'Nouveau programme',
           coalesce(nullif(v_title, ''), 'Programme'), new.program_id, 'protocoles'
    from public.notif_targets(new.team_id,
      public.program_assigned_json(new.scope, new.group_key, new.player_id)) t;
  return new;
end $$;

drop trigger if exists trg_notify_program_assignment on public.program_assignments;
create trigger trg_notify_program_assignment after insert on public.program_assignments
  for each row execute function public.notify_program_assignment();
