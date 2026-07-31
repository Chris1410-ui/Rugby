-- ─────────────────────────────────────────────────────────────────────────────
-- Lot 3 · PR-6 — Préférences de rappels (écran Accueil).
--
-- Le joueur règle SES rappels : heure du matin, heure limite du soir (garde de
-- série), heures calmes (école/nuit, pas de rappel), niveau d'insistance (ton).
-- Chaque rappel = une ligne `notifications` (pastille in-app) → le trigger
-- notify_push (0034) envoie aussi le push PWA, comme les relances existantes
-- (0045). Dispatcher planifié par pg_cron (toutes les 30 min), idempotent :
-- 1 rappel/type/jour local, jamais si le bilan du matin est déjà fait.
--
-- Fuseau LOCAL au joueur (défaut Europe/Paris = CET, aligné FR/BE) → l'heure de
-- rappel est comprise dans le temps du joueur, cohérent avec le reset minuit
-- local (lot 1). Aucune donnée de santé n'est transmise (seulement un rappel).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notification_prefs (
  player_id    uuid primary key references public.players(id) on delete cascade,
  team_id      text not null,
  enabled      boolean not null default true,        -- interrupteur maître
  morning_time time    not null default '08:00',     -- rappel bilan du matin
  evening_time time    not null default '20:00',      -- garde de série (dernier appel)
  streak_guard boolean not null default true,        -- activer le rappel du soir
  quiet_start  time,                                  -- heures calmes : pas de rappel
  quiet_end    time,
  tone         text    not null default 'normal' check (tone in ('leger','normal','costaud')),
  tz           text    not null default 'Europe/Paris',
  updated_at   timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

-- Le joueur lit/écrit SES préférences ; staff (équipe) et owner en lecture.
drop policy if exists notification_prefs_select on public.notification_prefs;
create policy notification_prefs_select on public.notification_prefs for select to authenticated
using (player_id = my_player_id() or (team_id = my_team() and is_staff()) or is_owner());

drop policy if exists notification_prefs_write on public.notification_prefs;
create policy notification_prefs_write on public.notification_prefs for insert to authenticated
with check (player_id = my_player_id() and team_id = my_team());

drop policy if exists notification_prefs_update on public.notification_prefs;
create policy notification_prefs_update on public.notification_prefs for update to authenticated
using (player_id = my_player_id())
with check (player_id = my_player_id() and team_id = my_team());

-- ── Dispatcher : crée les rappels dus (fuseau local du joueur) ──
-- Deux rappels, tous deux à propos du BILAN DU MATIN (le seul qui valide la
-- journée) : matin (dès morning_time) puis garde de série (dès evening_time).
-- Le ton module la copie. Rien n'est envoyé si le bilan matin est déjà fait,
-- pendant les heures calmes, ou si un rappel du même type existe déjà ce jour.
create or replace function public.notify_reminders()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
  v_local timestamptz;
  v_ld date;
  v_lt time;
  v_quiet boolean;
  v_matin boolean;
  v_titre text;
  v_body text;
  n int := 0;
begin
  for r in
    select pr.*
    from public.notification_prefs pr
    join public.players p on p.id = pr.player_id
    where pr.enabled
      and coalesce(p.membership_status, 'active') <> 'rejected'
      and coalesce(p.is_demo, false) = false
  loop
    v_local := now() at time zone r.tz;
    v_ld := v_local::date;
    v_lt := v_local::time;

    -- Heures calmes (gère l'intervalle passant minuit).
    v_quiet := r.quiet_start is not null and r.quiet_end is not null and (
      case when r.quiet_start <= r.quiet_end
        then v_lt >= r.quiet_start and v_lt < r.quiet_end
        else v_lt >= r.quiet_start or v_lt < r.quiet_end
      end);
    if v_quiet then continue; end if;

    -- Bilan du matin déjà fait aujourd'hui (local) → plus rien à rappeler.
    v_matin := exists (
      select 1 from public.daily_checkins c
      where c.player_id = r.player_id and coalesce(c.moment,'matin')='matin' and c.date = v_ld);
    if v_matin then continue; end if;

    -- Rappel du matin (dès morning_time, avant l'heure du soir).
    if v_lt >= r.morning_time and v_lt < r.evening_time
       and not exists (
         select 1 from public.notifications x
         where x.player_id = r.player_id and x.type = 'rappel_matin'
           and (x.created_at at time zone r.tz)::date = v_ld)
    then
      v_titre := 'Bilan du matin';
      v_body := case r.tone
        when 'leger'  then 'Petit rappel : ton bilan du matin t''attend 🙂'
        when 'costaud' then 'Bouge ! Ton bilan du matin n''est pas fait — ne casse pas ta série 🔥'
        else 'Rappel : fais ton bilan du matin pour valider ta journée.' end;
      insert into public.notifications (team_id, player_id, type, titre, body, route)
        values (r.team_id, r.player_id, 'rappel_matin', v_titre, v_body, 'bilan');
      n := n + 1;

    -- Garde de série (dès evening_time, dernier appel avant minuit local).
    elsif r.streak_guard and v_lt >= r.evening_time and v_lt < time '23:30'
       and not exists (
         select 1 from public.notifications x
         where x.player_id = r.player_id and x.type = 'rappel_serie'
           and (x.created_at at time zone r.tz)::date = v_ld)
    then
      v_titre := 'Ta série est en jeu';
      v_body := case r.tone
        when 'leger'  then 'Dernière ligne droite : un petit bilan pour garder ta série ?'
        when 'costaud' then 'Dernier appel ⏰ Valide ta journée maintenant ou tu perds ta série 🔥'
        else 'Ta série est en jeu ce soir — fais ton bilan du matin avant minuit.' end;
      insert into public.notifications (team_id, player_id, type, titre, body, route)
        values (r.team_id, r.player_id, 'rappel_serie', v_titre, v_body, 'bilan');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke execute on function public.notify_reminders() from public, anon, authenticated;

-- Planification toutes les 30 min (minute 07/37 pour étaler vs les autres jobs).
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('bilan-reminders'); exception when others then null; end $$;
select cron.schedule('bilan-reminders', '7,37 * * * *', $cron$ select public.notify_reminders(); $cron$);