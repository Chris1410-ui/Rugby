-- ============================================================================
--  0061 — AUTO-INSCRIPTION JOUEUR avec DOUBLE GARDE-FOU (code club + validation).
--
--  On réactive l'auto-inscription des JOUEURS (le staff reste invitation-only),
--  protégée par deux verrous :
--    1) CODE CLUB : secret propre à chaque club (teams.join_code), partagé par le
--       staff. Sans le bon code, impossible de demander l'adhésion à ce club.
--    2) VALIDATION STAFF : le joueur est créé en statut « pending » et n'a AUCUN
--       accès au club tant qu'un owner / staff écrivain ne l'a pas validé.
--
--  Sécurité stricte : le profil du joueur pending a team_id = NULL → my_team()
--  nul → aucune policy RLS ne lui ouvre les données du club. La validation pose
--  profiles.team_id = club ET players.membership_status = 'active'. Le refus
--  laisse team_id nul (aucun accès). players.team_id est renseigné dès la demande
--  pour que le STAFF voie la demande dans l'effectif de SON club (players.team_id
--  ≠ profiles.team_id : visibilité staff vs accès joueur).
-- ============================================================================

-- ── 1) Code club ────────────────────────────────────────────────────────────
alter table public.teams add column if not exists join_code text;

-- Code court, non ambigu (sans 0/O/1/I/L), 8 caractères → ~40 bits (non devinable).
create or replace function public.gen_join_code() returns text
  language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 30) + 1)::int, 1), '')
  from generate_series(1, 8);
$$;

-- Backfill : chaque club existant reçoit un code.
update public.teams set join_code = public.gen_join_code() where join_code is null;

-- ── 2) Statut d'adhésion joueur ─────────────────────────────────────────────
-- Défaut 'active' → tous les joueurs EXISTANTS (créés par le staff / l'invitation)
-- restent actifs. Seule l'auto-inscription crée des 'pending'.
alter table public.players add column if not exists membership_status text not null default 'active'
  check (membership_status in ('pending', 'active', 'rejected'));
alter table public.players add column if not exists membership_requested_at timestamptz;
alter table public.players add column if not exists membership_decided_at   timestamptz;
alter table public.players add column if not exists membership_decided_by   uuid references auth.users(id);

-- ── 3) Liste publique des clubs (sélecteur) — NOM seulement, jamais le code ──
create or replace function public.list_clubs()
  returns table(id text, label text)
  language sql stable security definer set search_path = public as $$
  select id, label from public.teams order by label;
$$;
revoke all on function public.list_clubs() from public;
grant execute on function public.list_clubs() to anon, authenticated;

-- ── 4) Pré-validation (avant création de compte) : code + totem ─────────────
-- Permet au formulaire de vérifier le code et la disponibilité du totem AVANT le
-- signUp, pour ne pas créer de compte orphelin sur une erreur de saisie. Le code
-- de 8 caractères n'est pas brute-forçable ; la validation staff reste le 2e verrou.
create or replace function public.precheck_membership(p_club_id text, p_code text, p_totem text)
  returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code_ok', exists (
      select 1 from public.teams
      where id = p_club_id and join_code is not null
        and upper(join_code) = upper(trim(coalesce(p_code, '')))
    ),
    'totem_free', not exists (
      select 1 from public.players
      where team_id = p_club_id and lower(name) = lower(trim(coalesce(p_totem, '')))
    )
  );
$$;
revoke all on function public.precheck_membership(text, text, text) from public;
grant execute on function public.precheck_membership(text, text, text) to anon, authenticated;

-- ── 5) Demande d'adhésion (auto-inscription joueur, gardée par le code) ─────
create or replace function public.request_club_membership(
  p_club_id        text,
  p_code           text,
  p_totem          text,
  p_initials       text default null,
  p_birthdate      date default null,
  p_guardian_name  text default null,
  p_guardian_email text default null,
  p_policy_version text default null,
  p_consent        boolean default false
) returns text
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_minor boolean;
  v_totem text := trim(coalesce(p_totem, ''));
  v_pid   uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Anti double-rattachement : un compte ne rejoint qu'un club.
  if exists (select 1 from public.profiles where id = v_uid and team_id is not null)
     or exists (select 1 from public.players where owner_uid = v_uid) then
    raise exception 'ALREADY_MEMBER';
  end if;

  -- Verrou 1 : code club.
  select join_code into v_code from public.teams where id = p_club_id;
  if v_code is null or upper(trim(coalesce(p_code, ''))) <> upper(v_code) then
    raise exception 'BAD_CODE';
  end if;

  if v_totem = '' then raise exception 'TOTEM_REQUIRED'; end if;
  if exists (select 1 from public.players where team_id = p_club_id and lower(name) = lower(v_totem)) then
    raise exception 'TOTEM_TAKEN';
  end if;

  -- RGPD : mineur (ou date absente, par prudence) → consentement parental requis.
  v_minor := (p_birthdate is null) or (p_birthdate > (now() - interval '18 years')::date);
  if v_minor and (p_consent is not true
                  or coalesce(trim(p_guardian_name), '')  = ''
                  or coalesce(trim(p_guardian_email), '') = '') then
    raise exception 'CONSENT_REQUIRED';
  end if;

  -- Joueur en ATTENTE. players.team_id = club (visibilité staff). is_custom = true.
  insert into public.players (team_id, owner_uid, name, initials, is_custom, membership_status, membership_requested_at)
    values (p_club_id, v_uid, v_totem, nullif(trim(coalesce(p_initials, '')), ''), true, 'pending', now())
    returning id into v_pid;

  -- Profil joueur SANS équipe → AUCUN accès au club tant que non validé.
  insert into public.profiles (id, role, player_id, team_id)
    values (v_uid, 'joueur', v_pid, null)
    on conflict (id) do update set role = 'joueur', player_id = excluded.player_id, team_id = null;

  -- Consentement (mineur) horodaté, comme le flux d'invitation.
  if v_minor and p_policy_version is not null then
    insert into public.consents (player_id, team_id, minor, guardian_name, guardian_email, policy_version, consent_given, consented_by)
      values (v_pid, p_club_id, true, p_guardian_name, p_guardian_email, p_policy_version, p_consent, v_uid)
      on conflict (player_id) do nothing;
  end if;

  return v_pid::text;
end $$;
revoke all on function public.request_club_membership(text, text, text, text, date, text, text, text, boolean) from public, anon;
grant  execute on function public.request_club_membership(text, text, text, text, date, text, text, text, boolean) to authenticated;

-- ── 6) Validation / refus par le staff (verrou 2) ───────────────────────────
create or replace function public.set_membership_status(p_player_id uuid, p_status text)
  returns void
  language plpgsql security definer set search_path = public, auth as $$
declare v_team text; v_owner uuid;
begin
  if p_status not in ('active', 'rejected') then raise exception 'BAD_STATUS'; end if;

  select team_id, owner_uid into v_team, v_owner from public.players where id = p_player_id;
  if v_team is null then raise exception 'NOT_FOUND'; end if;

  -- Autorisation : owner global OU staff écrivain (préparateur/médical) du club.
  if not (public.is_owner() or (public.can_write() and v_team = public.my_team())) then
    raise exception 'FORBIDDEN';
  end if;

  update public.players
     set membership_status = p_status, membership_decided_at = now(), membership_decided_by = auth.uid()
   where id = p_player_id;

  -- Validé → rattache le profil au club (accès activé). Refusé → team_id reste nul.
  if p_status = 'active' then
    update public.profiles set team_id = v_team where id = v_owner;
  else
    update public.profiles set team_id = null where id = v_owner;
  end if;
end $$;
revoke all on function public.set_membership_status(uuid, text) from public, anon;
grant  execute on function public.set_membership_status(uuid, text) to authenticated;

-- ── 7) Régénération du code club (owner / staff écrivain de SON club) ────────
create or replace function public.regenerate_join_code(p_club_id text)
  returns text
  language plpgsql security definer set search_path = public, auth as $$
declare v_code text;
begin
  if not (public.is_owner() or (public.can_write() and p_club_id = public.my_team())) then
    raise exception 'FORBIDDEN';
  end if;
  v_code := public.gen_join_code();
  update public.teams set join_code = v_code where id = p_club_id;
  return v_code;
end $$;
revoke all on function public.regenerate_join_code(text) from public, anon;
grant  execute on function public.regenerate_join_code(text) to authenticated;
