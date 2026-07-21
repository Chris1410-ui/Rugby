-- ============================================================================
--  0057 — Invitations de club (rattachement UNIQUEMENT sur invitation validée).
--
--  Principe : un compte (staff OU joueur) ne se rattache JAMAIS seul à un club.
--  Un admin du club (owner, ou staff écrivain préparateur/médical) émet une
--  invitation ; le rôle et le club sont portés par l'invitation (source de
--  confiance serveur), jamais par le formulaire d'inscription.
--
--  Ce lot pose la table + l'acceptation + la RLS stricte, et branche le parcours
--  STAFF de bout en bout (le staff n'a plus de self-signup — cf. LoginScreen).
--  Le schéma et la RPC couvrent DÉJÀ le rôle 'joueur' (player_id → carte roster),
--  mais l'enforcement joueur (retrait du self-signup joueur + consentement
--  parental collecté à l'acceptation) fera l'objet d'un lot dédié : on ne casse
--  pas ici l'onboarding mineur existant.
-- ============================================================================

create table if not exists public.club_invitations (
  id          uuid primary key default gen_random_uuid(),
  club_id     text not null references public.teams(id) on delete cascade,
  role        app_role not null,                       -- joueur | preparateur | medical | coach
  email       text,                                    -- destinataire (staff, ou joueur/tuteur)
  player_id   uuid references public.players(id) on delete cascade, -- role=joueur : carte roster à revendiquer
  token       text unique not null,
  status      text not null default 'pending',
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz default now(),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  -- owner reste hors-bande (0056) → non invitable.
  constraint club_inv_role_chk   check (role in ('joueur', 'preparateur', 'medical', 'coach')),
  constraint club_inv_status_chk check (status in ('pending', 'accepted', 'revoked')),
  -- Une invitation joueur DOIT cibler une carte roster ; une invitation staff, non.
  constraint club_inv_player_chk check ((role = 'joueur') = (player_id is not null))
);
create index if not exists club_invitations_club_idx  on public.club_invitations(club_id);
create index if not exists club_invitations_token_idx on public.club_invitations(token);

alter table public.club_invitations enable row level security;

-- Gestion (créer / lister / révoquer) : owner (tout club) OU staff écrivain de
-- SON club. Coach (can_write() = false) et joueurs exclus. RLS stricte par club.
drop policy if exists club_inv_manage on public.club_invitations;
create policy club_inv_manage on public.club_invitations for all to authenticated
  using ( public.is_owner() or (public.can_write() and club_id = public.my_team()) )
  with check ( public.is_owner() or (public.can_write() and club_id = public.my_team()) );

-- Aperçu minimal d'une invitation (rôle + club) pour l'écran d'acceptation, AVANT
-- que l'invité n'ait un rôle. Le token EST le secret → exposé à l'appelant qui le
-- détient. Ne renvoie aucune donnée sensible.
create or replace function public.peek_club_invitation(p_token text)
returns table (role app_role, club_id text, has_email boolean)
language sql security definer set search_path = public, auth as $$
  select ci.role, ci.club_id, ci.email is not null
  from public.club_invitations ci
  where ci.token = p_token and ci.status = 'pending' and ci.expires_at > now();
$$;

-- Acceptation par l'invité : élève SON profil depuis l'invitation validée. Le
-- rôle/club ne viennent jamais du client. Pour un joueur, rattache la carte
-- roster (owner_uid) ; le consentement parental éventuel est fourni à l'acceptation.
create or replace function public.accept_club_invitation(
  p_token          text,
  p_guardian_name  text default null,
  p_guardian_email text default null,
  p_policy_version text default null,
  p_consent        boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_inv   public.club_invitations;
  v_email text;
  v_name  text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_inv from public.club_invitations
    where token = p_token and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  select email, raw_user_meta_data->>'full_name'
    into v_email, v_name
    from auth.users where id = auth.uid();

  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.profiles (id, role, full_name, team_id, player_id)
  values (auth.uid(), v_inv.role, coalesce(nullif(v_name, ''), 'Membre'), v_inv.club_id, v_inv.player_id)
  on conflict (id) do update
    set role = excluded.role, team_id = excluded.team_id,
        player_id = coalesce(excluded.player_id, public.profiles.player_id);

  -- Rôle joueur : rattache la carte roster à ce compte + consentement éventuel.
  if v_inv.role = 'joueur' and v_inv.player_id is not null then
    update public.players set owner_uid = auth.uid() where id = v_inv.player_id;
    if p_policy_version is not null then
      insert into public.consents
        (player_id, team_id, minor, guardian_name, guardian_email, policy_version, consent_given, consented_by)
      values
        (v_inv.player_id, v_inv.club_id, true, p_guardian_name, p_guardian_email, p_policy_version, p_consent, auth.uid())
      on conflict (player_id) do nothing;
    end if;
  end if;

  update public.club_invitations
    set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where id = v_inv.id;
end $$;

revoke all on function public.peek_club_invitation(text)                    from public;
revoke all on function public.accept_club_invitation(text, text, text, text, boolean) from public, anon;
grant  execute on function public.peek_club_invitation(text)                    to anon, authenticated;
grant  execute on function public.accept_club_invitation(text, text, text, text, boolean) to authenticated;
