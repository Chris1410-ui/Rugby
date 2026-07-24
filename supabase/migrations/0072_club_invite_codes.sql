-- 0072 — Codes/liens d'invitation par club, DISTINCTS joueur / staff (modèle
-- Twizzit). Deux codes partagés par club : un « player », un « staff » (avec
-- rôle). Régénérables, expiration optionnelle, révocables. Le rattachement se
-- fait TOUJOURS au team_id du code → un code ne rattache qu'à son club.
--
-- Coexiste avec l'existant : teams.join_code est conservé en miroir (le code
-- joueur reprend sa valeur), et les invitations nominatives (club_invitations)
-- restent fonctionnelles.

create table if not exists public.club_invite_codes (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references public.teams(id) on delete cascade,
  kind        text not null check (kind in ('player','staff')),
  role        app_role,                       -- staff : prépa/médical/coach ; joueur : null
  code        text not null unique,
  expires_at  timestamptz,
  active      boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (team_id, kind),                     -- 1 code joueur + 1 code staff par club
  constraint cic_role_chk check (
    (kind = 'staff'  and role in ('preparateur','medical','coach')) or
    (kind = 'player' and role is null)
  )
);

-- Génère un code court unique (8 hex majuscules) pour la table.
create or replace function public.gen_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.club_invite_codes where code = c);
  end loop;
  return c;
end $$;

-- ── RLS : gestion réservée au staff écrivain de SON club, + owner (multi-clubs).
alter table public.club_invite_codes enable row level security;
create policy cic_manage on public.club_invite_codes for all
  using ((public.can_write() and team_id = public.my_team()) or public.is_owner())
  with check ((public.can_write() and team_id = public.my_team()) or public.is_owner());

-- ── Seed : pour chaque club, code joueur (= join_code existant) + code staff.
insert into public.club_invite_codes (team_id, kind, role, code)
select t.id, 'player', null,
       coalesce(nullif(btrim(t.join_code), ''), public.gen_invite_code())
from public.teams t
on conflict (team_id, kind) do nothing;

insert into public.club_invite_codes (team_id, kind, role, code)
select t.id, 'staff', 'preparateur', public.gen_invite_code()
from public.teams t
on conflict (team_id, kind) do nothing;

-- ════════════ RPC ════════════

-- Aperçu public d'un code (pré-remplit l'écran d'inscription). Ne révèle que le
-- club + le type ; rien d'autre. anon autorisé.
create or replace function public.peek_invite_code(p_code text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'valid', true, 'kind', c.kind, 'role', c.role,
    'team_id', c.team_id, 'club', t.label
  )
  from public.club_invite_codes c
  join public.teams t on t.id = c.team_id
  where lower(c.code) = lower(btrim(coalesce(p_code, '')))
    and c.active and (c.expires_at is null or c.expires_at > now())
  limit 1;
$$;
revoke all on function public.peek_invite_code(text) from public;
grant execute on function public.peek_invite_code(text) to anon, authenticated;

-- Adhésion via code partagé. staff → profil (role+club) immédiat (accès direct,
-- corrige « Profil introuvable » à la racine) ; joueur → carte pending + totem +
-- consentement (validation staff en place). Rattachement TOUJOURS au team du code.
create or replace function public.join_club_with_code(
  p_code           text,
  p_totem          text default null,
  p_initials       text default null,
  p_birthdate      date default null,
  p_guardian_name  text default null,
  p_guardian_email text default null,
  p_policy_version text default null,
  p_consent        boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_c     public.club_invite_codes;
  v_name  text;
  v_totem text := btrim(coalesce(p_totem, ''));
  v_minor boolean;
  v_pid   uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_c from public.club_invite_codes
    where lower(code) = lower(btrim(coalesce(p_code, '')))
      and active and (expires_at is null or expires_at > now())
    limit 1;
  if not found then raise exception 'CODE_INVALID'; end if;

  -- Anti double-rattachement : un compte ne rejoint qu'un club.
  if exists (select 1 from public.profiles where id = v_uid and team_id is not null)
     or exists (select 1 from public.players where owner_uid = v_uid) then
    raise exception 'ALREADY_MEMBER';
  end if;

  -- ── STAFF : profil au rôle du lien, accès immédiat.
  if v_c.kind = 'staff' then
    select nullif(btrim(raw_user_meta_data->>'full_name'), '') into v_name
      from auth.users where id = v_uid;
    insert into public.profiles (id, role, full_name, team_id)
    values (v_uid, v_c.role, coalesce(v_name, 'Membre'), v_c.team_id)
    on conflict (id) do update
      set role = excluded.role, team_id = excluded.team_id,
          full_name = coalesce(excluded.full_name, public.profiles.full_name);
    return jsonb_build_object('kind', 'staff', 'team_id', v_c.team_id, 'role', v_c.role);
  end if;

  -- ── JOUEUR : carte pending + totem unique + consentement (comme l'auto-inscription).
  if v_totem = '' then raise exception 'TOTEM_REQUIRED'; end if;
  if exists (select 1 from public.players
             where team_id = v_c.team_id and lower(btrim(name)) = lower(v_totem)) then
    raise exception 'TOTEM_TAKEN';
  end if;

  v_minor := (p_birthdate is null) or (p_birthdate > (now() - interval '18 years')::date);
  if v_minor and (p_consent is not true
                  or coalesce(btrim(p_guardian_name), '')  = ''
                  or coalesce(btrim(p_guardian_email), '') = '') then
    raise exception 'CONSENT_REQUIRED';
  end if;

  insert into public.players (team_id, owner_uid, name, initials, is_custom, membership_status, membership_requested_at)
    values (v_c.team_id, v_uid, v_totem, nullif(btrim(coalesce(p_initials, '')), ''), true, 'pending', now())
    returning id into v_pid;

  insert into public.profiles (id, role, player_id, team_id)
    values (v_uid, 'joueur', v_pid, null)
    on conflict (id) do update set role = 'joueur', player_id = excluded.player_id, team_id = null;

  if v_minor and p_policy_version is not null then
    insert into public.consents (player_id, team_id, minor, guardian_name, guardian_email, policy_version, consent_given, consented_by)
      values (v_pid, v_c.team_id, true, p_guardian_name, p_guardian_email, p_policy_version, p_consent, v_uid)
      on conflict (player_id) do nothing;
  end if;

  return jsonb_build_object('kind', 'player', 'team_id', v_c.team_id, 'player_id', v_pid, 'status', 'pending');
end $$;
revoke all on function public.join_club_with_code(text, text, text, date, text, text, text, boolean) from public, anon;
grant  execute on function public.join_club_with_code(text, text, text, date, text, text, text, boolean) to authenticated;

-- ── Gestion (staff écrivain du club ou owner). Garde interne + SECURITY DEFINER.
create or replace function public._cic_guard(p_team text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if public.is_owner() then return; end if;
  if public.can_write() and p_team = public.my_team() then return; end if;
  raise exception 'NOT_ALLOWED';
end $$;

create or replace function public.rotate_invite_code(p_team text, p_kind text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_code text;
begin
  perform public._cic_guard(p_team);
  update public.club_invite_codes
    set code = public.gen_invite_code(), active = true, updated_at = now()
    where team_id = p_team and kind = p_kind
    returning code into v_code;
  if v_code is null then raise exception 'CODE_NOT_FOUND'; end if;
  return v_code;
end $$;
grant execute on function public.rotate_invite_code(text, text) to authenticated;

create or replace function public.set_staff_code_role(p_team text, p_role app_role)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public._cic_guard(p_team);
  if p_role not in ('preparateur','medical','coach') then raise exception 'BAD_ROLE'; end if;
  update public.club_invite_codes set role = p_role, updated_at = now()
    where team_id = p_team and kind = 'staff';
end $$;
grant execute on function public.set_staff_code_role(text, app_role) to authenticated;

create or replace function public.set_invite_code_active(p_team text, p_kind text, p_active boolean, p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public._cic_guard(p_team);
  update public.club_invite_codes
    set active = coalesce(p_active, active), expires_at = p_expires_at, updated_at = now()
    where team_id = p_team and kind = p_kind;
end $$;
grant execute on function public.set_invite_code_active(text, text, boolean, timestamptz) to authenticated;
