-- ─────────────────────────────────────────────────────────────────────────────
-- Écran Accueil · PR-A — Actualité du club (« mot du staff ») + réglages club.
--
-- Nouvelle fonctionnalité : un fil d'actualité à PORTÉE CLUB. Publient : staff
-- ÉCRIVAIN (can_write() → coach exclu) + owner. Lisent : tous les membres du club
-- (RLS team). Historique persistant, épinglage « à la une », masquage auto
-- optionnel. Publication via RPC SECURITY DEFINER (fan-out notifications + push
-- optionnel, en réutilisant notify_push 0034). Suivi des non-lus par un simple
-- horodatage « vu » par utilisateur (léger, calqué sur notifications.read).
--
-- Réglages club (photo du hero de l'Accueil) : table club_settings, image
-- stockée dans le bucket privé existant `team-files` (0004), chemin
-- <team_id>/club/… (lecture club / écriture staff déjà en place).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fil d'actualité ──────────────────────────────────────────────────────────
create table if not exists public.club_news (
  id           uuid primary key default gen_random_uuid(),
  team_id      text not null,
  author_uid   uuid not null default auth.uid(),
  author_label text,                                   -- instantané nom/rôle staff (non pseudonymisé)
  kind         text not null default 'actu' check (kind in ('mot','actu')),
  title        text,
  body         text not null,
  pinned       boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists club_news_team_idx on public.club_news(team_id, published_at desc);

alter table public.club_news enable row level security;

-- Lecture : tout le club.
drop policy if exists club_news_select on public.club_news;
create policy club_news_select on public.club_news for select to authenticated
using (team_id = my_team() or is_owner());

-- Écriture : staff écrivain du club (coach exclu via can_write) ou owner.
drop policy if exists club_news_insert on public.club_news;
create policy club_news_insert on public.club_news for insert to authenticated
with check (((is_staff() and can_write()) and team_id = my_team()) or is_owner());

drop policy if exists club_news_update on public.club_news;
create policy club_news_update on public.club_news for update to authenticated
using (((is_staff() and can_write()) and team_id = my_team()) or is_owner())
with check (((is_staff() and can_write()) and team_id = my_team()) or is_owner());

drop policy if exists club_news_delete on public.club_news;
create policy club_news_delete on public.club_news for delete to authenticated
using (((is_staff() and can_write()) and team_id = my_team()) or is_owner());

-- ── Suivi des non-lus (par utilisateur) ──────────────────────────────────────
create table if not exists public.club_news_seen (
  uid      uuid primary key default auth.uid(),
  team_id  text not null,
  seen_at  timestamptz not null default now()
);
alter table public.club_news_seen enable row level security;
drop policy if exists club_news_seen_rw on public.club_news_seen;
create policy club_news_seen_rw on public.club_news_seen for all to authenticated
using (uid = auth.uid()) with check (uid = auth.uid());

-- ── Réglages club (photo du hero) ────────────────────────────────────────────
create table if not exists public.club_settings (
  team_id    text primary key,
  hero_path  text,                                     -- objet dans le bucket team-files
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.club_settings enable row level security;

drop policy if exists club_settings_select on public.club_settings;
create policy club_settings_select on public.club_settings for select to authenticated
using (team_id = my_team() or is_owner());

drop policy if exists club_settings_write on public.club_settings;
create policy club_settings_write on public.club_settings for insert to authenticated
with check (((is_staff() and can_write()) and team_id = my_team()) or is_owner());

drop policy if exists club_settings_update on public.club_settings;
create policy club_settings_update on public.club_settings for update to authenticated
using (((is_staff() and can_write()) and team_id = my_team()) or is_owner())
with check (((is_staff() and can_write()) and team_id = my_team()) or is_owner());

-- ── Publication (fan-out notifications + push optionnel) ──────────────────────
-- Centralise la publication : contrôle d'accès + insertion de la ligne + envoi
-- optionnel d'une notification (pastille + push via notify_push) à tout le club.
create or replace function public.club_news_publish(
  p_title text, p_body text, p_kind text default 'actu',
  p_pinned boolean default false, p_notify boolean default true,
  p_author_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_team text := my_team();
  v_id uuid;
begin
  if not (((is_staff() and can_write()) and v_team is not null) or is_owner()) then
    raise exception 'not_allowed';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 then raise exception 'empty_body'; end if;
  if p_kind not in ('mot','actu') then p_kind := 'actu'; end if;

  insert into public.club_news (team_id, author_uid, author_label, kind, title, body, pinned)
    values (v_team, auth.uid(), p_author_label, p_kind, nullif(btrim(p_title),''), btrim(p_body), coalesce(p_pinned,false))
    returning id into v_id;

  if coalesce(p_notify, false) then
    insert into public.notifications (team_id, player_id, type, titre, body, ref_id, route)
    select v_team, p.id, 'club_news',
           coalesce(nullif(btrim(p_title),''), case when p_kind='mot' then 'Mot du staff' else 'Actualité du club' end),
           left(btrim(p_body), 140), v_id, 'accueil'
    from public.players p
    where p.team_id = v_team
      and coalesce(p.membership_status,'active') <> 'rejected'
      and coalesce(p.is_demo,false) = false
      and p.id is not null;
  end if;

  return v_id;
end $$;

revoke execute on function public.club_news_publish(text, text, text, boolean, boolean, text) from public, anon;
grant execute on function public.club_news_publish(text, text, text, boolean, boolean, text) to authenticated;