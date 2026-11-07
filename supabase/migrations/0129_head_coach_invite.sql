-- 0129 — Invitation « head coach » par lien magique (passwordless).
-- Réutilise club_invitations (role 'coach') + le rôle coach lecture seule.
-- L'owner/prépa invite par email ; le coach reçoit un lien magique (signInWithOtp),
-- clique, et son profil coach est créé à la volée (claim par email). Aucune
-- donnée santé n'est accessible sans ce profil (RLS club stricte, inchangée).

-- Nom pré-rempli par l'invitant (évite de dépendre des métadonnées Auth).
alter table public.club_invitations add column if not exists full_name text;

-- ── Créer l'invitation head coach (owner + staff écrivain ; coach exclu). ──
-- p_team_id : club choisi (pour l'owner dont profiles.team_id peut être null).
create or replace function public.invite_head_coach(p_email text, p_full_name text default null, p_team_id text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_team text := case when public.is_owner() then coalesce(p_team_id, public.my_team()) else public.my_team() end;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not (public.is_owner() or (public.is_staff() and public.can_write())) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_team is null then raise exception 'NO_TEAM'; end if;
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'EMAIL_INVALID'; end if;

  -- Évite les doublons : on révoque les invitations coach encore en attente
  -- pour ce même email + club avant d'en créer une neuve.
  update public.club_invitations
     set status = 'revoked'
   where club_id = v_team and role = 'coach' and status = 'pending' and lower(email) = v_email;

  insert into public.club_invitations (club_id, role, email, full_name, token, status)
  values (v_team, 'coach', v_email, nullif(trim(coalesce(p_full_name, '')), ''), gen_random_uuid()::text, 'pending');
end;
$$;
revoke all on function public.invite_head_coach(text, text, text) from public, anon;
grant execute on function public.invite_head_coach(text, text, text) to authenticated;

-- ── Réclamer l'invitation (appelée au 1er atterrissage, session sans profil). ──
-- Rapproche par EMAIL authentifié (jamais le formulaire). Crée le profil coach.
create or replace function public.claim_coach_invite()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_meta_name text;
  v_inv public.club_invitations;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Déjà rattaché à un club → rien à faire.
  if exists (select 1 from public.profiles where id = v_uid and team_id is not null) then
    return false;
  end if;

  select email, raw_user_meta_data->>'full_name'
    into v_email, v_meta_name
    from auth.users where id = v_uid;
  if v_email is null then return false; end if;

  select * into v_inv
    from public.club_invitations
   where role = 'coach' and status = 'pending' and expires_at > now()
     and lower(email) = lower(v_email)
   order by created_at desc
   for update
   limit 1;
  if not found then return false; end if;

  insert into public.profiles (id, role, full_name, team_id)
  values (v_uid, 'coach', coalesce(nullif(v_inv.full_name, ''), nullif(v_meta_name, ''), 'Coach'), v_inv.club_id)
  on conflict (id) do update
    set role = 'coach', team_id = excluded.team_id,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  update public.club_invitations
     set status = 'accepted', accepted_by = v_uid, accepted_at = now()
   where id = v_inv.id;

  return true;
end;
$$;
revoke all on function public.claim_coach_invite() from public, anon;
grant execute on function public.claim_coach_invite() to authenticated;
