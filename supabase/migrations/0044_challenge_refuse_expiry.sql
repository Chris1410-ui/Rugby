-- ════════════════════════════════════════════════════════════════
-- 0044 — Défis : refus par le joueur + expiration automatique à 24 h.
--
-- • statut `refuse`  : le joueur clique « Je ne participe pas » (RPC
--   challenge_decline, SECURITY DEFINER — pas d'écriture directe). 0 point.
-- • statut `manque`  : un défi ni relevé ni refusé 24 h après son émission
--   bascule automatiquement (pg_cron horaire → expire_challenges()). 0 point.
--   Les points ne comptent que `confirmee` (team_challenge_points) → aucune
--   pénalité, jamais de points négatifs.
--
-- Idempotent. RLS club conservée (le joueur passe par la RPC ; le cron tourne
-- en SECURITY DEFINER). challenge_completions.statut est en texte libre (aucune
-- contrainte CHECK) → ajout des deux valeurs sans altération de schéma.
-- ════════════════════════════════════════════════════════════════

alter table public.challenge_completions add column if not exists refused_at timestamptz;
alter table public.challenge_completions add column if not exists missed_at  timestamptz;

-- Résout les destinataires d'un défi (miroir de resolveAssignedIds côté client).
-- all/null → toute l'équipe (hors démo) ; group → la ligne ; players/open → ids.
create or replace function public._challenge_assigned_ids(p_assigned jsonb, p_team text)
  returns setof uuid language sql stable as $$
  select p.id from players p
  where p.team_id = p_team and coalesce(p.is_demo, false) = false
    and (
      p_assigned is null
      or coalesce(p_assigned->>'mode', 'all') = 'all'
      or (p_assigned->>'mode' = 'group' and p.grp::text = p_assigned->>'group')
      or (p_assigned->>'mode' in ('players','open') and coalesce(p_assigned->'ids', '[]'::jsonb) ? p.id::text)
    )
$$;

-- Le joueur refuse un défi : « Je ne participe pas » → statut refuse.
-- Interdit si déjà relevé/validé (validee_joueur/confirmee). Sinon upsert refuse.
create or replace function public.challenge_decline(p_challenge uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid; v_team text; v_cteam text; v_assigned jsonb; v_cur text;
begin
  v_pid := my_player_id();
  if v_pid is null then raise exception 'Aucun joueur associé'; end if;
  select team_id into v_team from players where id = v_pid;
  select assigned, team_id into v_assigned, v_cteam from challenges where id = p_challenge;
  if v_cteam is null or v_cteam <> v_team then raise exception 'Défi hors de ton équipe'; end if;
  if not exists (select 1 from public._challenge_assigned_ids(v_assigned, v_cteam) x where x = v_pid) then
    raise exception 'Défi non assigné';
  end if;
  select statut into v_cur from challenge_completions where challenge_id = p_challenge and player_id = v_pid;
  if v_cur in ('validee_joueur','confirmee') then
    raise exception 'Défi déjà relevé — impossible de refuser';
  end if;
  insert into challenge_completions (challenge_id, player_id, team_id, statut, refused_at, updated_at)
  values (p_challenge, v_pid, v_team, 'refuse', now(), now())
  on conflict (challenge_id, player_id) do update
    set statut = 'refuse', refused_at = now(), updated_at = now();
end $$;

grant execute on function public.challenge_decline(uuid) to authenticated;

-- Expiration : défis émis il y a ≥24 h, non traités → manque. Idempotent.
--   1) les lignes 'a_faire' (relevé attendu, pas fait) passent en manque ;
--   2) les assignés SANS ligne reçoivent une ligne 'manque' (do nothing sinon).
-- Ne touche jamais validee_joueur / confirmee / refuse / manque.
create or replace function public.expire_challenges()
  returns integer language plpgsql security definer set search_path = public as $$
declare n1 int; n2 int;
begin
  update challenge_completions cc
     set statut = 'manque', missed_at = now(), updated_at = now()
    from challenges ch
   where ch.id = cc.challenge_id
     and ch.created_at <= now() - interval '24 hours'
     and cc.statut = 'a_faire';
  get diagnostics n1 = row_count;

  insert into challenge_completions (challenge_id, player_id, team_id, statut, missed_at, updated_at)
  select ch.id, pid, ch.team_id, 'manque', now(), now()
    from challenges ch
    cross join lateral public._challenge_assigned_ids(ch.assigned, ch.team_id) as pid
   where ch.created_at <= now() - interval '24 hours'
  on conflict (challenge_id, player_id) do nothing;
  get diagnostics n2 = row_count;

  return coalesce(n1,0) + coalesce(n2,0);
end $$;

-- Planification horaire (minute 23 pour étaler vs les autres jobs).
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('challenge-expiry'); exception when others then null; end $$;
select cron.schedule('challenge-expiry', '23 * * * *', $cron$ select public.expire_challenges(); $cron$);
