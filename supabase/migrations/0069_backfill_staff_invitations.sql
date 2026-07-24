-- 0069 — Backfill : comptes STAFF créés via invitation mais dont l'acceptation
-- n'a jamais abouti (profil manquant → écran « Profil introuvable »).
--
-- Cause corrigée côté app (persistance du token + filet d'acceptation) ; cette
-- migration répare les comptes DÉJÀ cassés. Pour chaque invitation STAFF encore
-- « pending » dont l'email correspond à un compte auth SANS profil, on crée le
-- profil (rôle + club portés par l'invitation) et on marque l'invitation acceptée.
--
-- Sûr et idempotent : ne touche que les comptes SANS profil ; ré-exécutable
-- (plus rien à traiter une fois réparé). Les invitations JOUEUR sont exclues
-- (l'acceptation exige naissance + consentement, non reconstituables ici).

do $$
declare r record;
begin
  for r in
    select distinct on (u.id)
           ci.id       as inv_id,
           ci.club_id  as club_id,
           ci.role     as role,
           u.id        as uid,
           coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), 'Membre') as full_name
    from public.club_invitations ci
    join auth.users u        on lower(u.email) = lower(ci.email)
    left join public.profiles p on p.id = u.id
    where ci.status = 'pending'
      and ci.role <> 'joueur'
      and ci.email is not null
      and p.id is null
    order by u.id, ci.created_at desc      -- si plusieurs invites : la plus récente
  loop
    insert into public.profiles (id, role, full_name, team_id)
    values (r.uid, r.role, r.full_name, r.club_id)
    on conflict (id) do update
      set role = excluded.role, team_id = excluded.team_id;

    update public.club_invitations
      set status = 'accepted', accepted_by = r.uid, accepted_at = now()
      where id = r.inv_id;

    raise notice 'Backfill invitation staff : profil % rattaché au club %', r.uid, r.club_id;
  end loop;
end $$;
