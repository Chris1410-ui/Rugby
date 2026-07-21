-- ============================================================================
--  0058 — Enforcement JOUEUR : plus aucun auto-rattachement (staff ni joueur).
--
--  Verrou final du modèle « invitation only » (0056/0057). Après ce lot :
--   • handle_new_user ne crée PLUS aucun profil/carte depuis les métadonnées
--     client → créer un compte n'attache à aucun club. Seule l'acceptation
--     d'une invitation (accept_club_invitation) — ou un admin pour l'owner —
--     crée le profil (rôle + club).
--   • players_self_insert supprimée → un joueur ne crée plus sa propre carte.
--   • accept_club_invitation gère le JOUEUR : rattache la carte roster, gère le
--     consentement selon l'âge (majeur 18+ → auto-consentement sans tuteur ;
--     mineur → consentement parental obligatoire), et refuse une carte déjà
--     revendiquée par un autre compte.
-- ============================================================================

-- (1) handle_new_user : no-op. Aucun profil auto-créé (anti auto-rattachement).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  -- Le rôle/club/carte sont posés EXCLUSIVEMENT par accept_club_invitation
  -- (invité) ou par un admin (owner, hors-bande). Un signup seul = compte sans
  -- profil = aucun accès (RLS refuse).
  return new;
end $$;

-- (2) Le joueur ne peut plus créer sa propre carte roster (staff/import only).
drop policy if exists players_self_insert on public.players;

-- (3) accept_club_invitation : nouvelle signature avec date de naissance +
--     consentement adapté à l'âge. On remplace l'ancienne (5 args).
drop function if exists public.accept_club_invitation(text, text, text, text, boolean);

create or replace function public.accept_club_invitation(
  p_token          text,
  p_birthdate      date    default null,
  p_guardian_name  text    default null,
  p_guardian_email text    default null,
  p_policy_version text    default null,
  p_consent        boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_inv    public.club_invitations;
  v_email  text;
  v_name   text;
  v_minor  boolean;
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

  if v_inv.role = 'joueur' then
    if v_inv.player_id is null then
      raise exception 'INVITE_INVALID';           -- garde-fou (contrainte serveur)
    end if;
    if p_birthdate is null then
      raise exception 'BIRTHDATE_REQUIRED';
    end if;
    v_minor := p_birthdate > (current_date - interval '18 years');

    if v_minor and (
      nullif(btrim(coalesce(p_guardian_name, '')), '') is null
      or nullif(btrim(coalesce(p_guardian_email, '')), '') is null
    ) then
      raise exception 'GUARDIAN_REQUIRED';
    end if;
    if not p_consent then
      raise exception 'CONSENT_REQUIRED';
    end if;

    -- Rattache la carte roster à ce compte, sauf si déjà revendiquée par un autre.
    update public.players
      set owner_uid = auth.uid(),
          age = extract(year from age(p_birthdate))::int
      where id = v_inv.player_id and (owner_uid is null or owner_uid = auth.uid());
    if not found then
      raise exception 'ALREADY_CLAIMED';
    end if;

    insert into public.consents
      (player_id, team_id, minor, guardian_name, guardian_email, policy_version, consent_given, consented_by)
    values
      (v_inv.player_id, v_inv.club_id, v_minor,
       case when v_minor then p_guardian_name else null end,
       case when v_minor then p_guardian_email else null end,
       p_policy_version, p_consent, auth.uid())
    on conflict (player_id) do update
      set minor = excluded.minor, guardian_name = excluded.guardian_name,
          guardian_email = excluded.guardian_email, policy_version = excluded.policy_version,
          consent_given = excluded.consent_given;
  end if;

  update public.club_invitations
    set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where id = v_inv.id;
end $$;

revoke all on function public.accept_club_invitation(text, date, text, text, text, boolean) from public, anon;
grant  execute on function public.accept_club_invitation(text, date, text, text, text, boolean) to authenticated;
