-- ============================================================================
--  0057 — Invitations STAFF (le staff ne s'auto-rattache plus à un club).
--
--  Complète le durcissement 0056 : après 0056 un self-signup ne peut plus forger
--  owner, mais pouvait encore choisir un rôle staff + un club arbitraire. On
--  ferme ça : le staff n'arrive QUE sur invitation émise par l'owner ou un staff
--  écrivain (préparateur/médical) du club. Le rôle et le club sont portés par
--  l'invitation (source de confiance serveur), jamais par le formulaire client.
--
--  Owner reste hors-bande (0056/0009). Coach (lecture seule) ne peut pas inviter.
-- ============================================================================

create table if not exists public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references public.teams(id) on delete cascade,
  role        app_role not null,
  email       text,                                   -- optionnel : verrouille l'invite à cette adresse
  token       text unique not null,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  -- Seuls les rôles staff sont invitables (owner = provisionnement admin uniquement).
  constraint staff_invites_role_chk check (role in ('preparateur', 'medical', 'coach'))
);
create index if not exists staff_invites_team_idx on public.staff_invites(team_id);

alter table public.staff_invites enable row level security;

-- Gestion (créer / lister / révoquer) : owner (tout club) OU staff écrivain de
-- SON club. Le coach (can_write() = false) est exclu.
drop policy if exists staff_invites_manage on public.staff_invites;
create policy staff_invites_manage on public.staff_invites for all to authenticated
  using ( public.is_owner() or (public.can_write() and team_id = public.my_team()) )
  with check ( public.is_owner() or (public.can_write() and team_id = public.my_team()) );

-- Redemption : l'invité (pas encore staff → aucune policy de lecture sur la
-- table) élève SON propre profil depuis l'invite, via cette fonction definer.
-- Le rôle/club proviennent de la ligne d'invite validée, pas du client.
create or replace function public.redeem_staff_invite(p_token text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_inv   public.staff_invites;
  v_email text;
  v_name  text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_inv from public.staff_invites
    where token = p_token and redeemed_at is null and expires_at > now()
    for update;
  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  select email, raw_user_meta_data->>'full_name'
    into v_email, v_name
    from auth.users where id = auth.uid();

  -- Si l'invite est verrouillée à un email, il doit correspondre au compte.
  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.profiles (id, role, full_name, team_id)
  values (auth.uid(), v_inv.role, coalesce(nullif(v_name, ''), 'Staff'), v_inv.team_id)
  on conflict (id) do update
    set role = excluded.role, team_id = excluded.team_id;

  update public.staff_invites
    set redeemed_by = auth.uid(), redeemed_at = now()
    where id = v_inv.id;
end $$;

revoke all on function public.redeem_staff_invite(text) from public, anon;
grant execute on function public.redeem_staff_invite(text) to authenticated;
