-- ─────────────────────────────────────────────────────────────────────────────
-- GPS-3 — Quota d'analyses vision par joueur/jour (coût maîtrisé).
--
-- L'Edge Function `analyze-gps-shot` appelle gps_ai_quota_consume AVEC le JWT du
-- joueur (auth.uid) avant d'appeler Claude. Le plafond est donc incontournable
-- côté client : un joueur ne peut pas s'octroyer d'analyses supplémentaires.
-- Aucune policy RLS n'est posée sur gps_ai_usage → accès UNIQUEMENT via la RPC
-- SECURITY DEFINER (le compteur n'est ni lisible ni modifiable directement).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gps_ai_usage (
  player_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (player_id, day)
);
alter table public.gps_ai_usage enable row level security;

-- Consomme 1 crédit pour l'appelant (auth.uid) et renvoie l'état du jour.
-- allowed=false si le plafond est atteint → AUCUNE consommation (le joueur peut
-- alors saisir à la main). Atomique (verrou de ligne) contre les appels concurrents.
create or replace function public.gps_ai_quota_consume(p_limit int default 5)
returns table (allowed boolean, used int, lim int)
language plpgsql security definer set search_path = public, auth as $$
declare v_used int;
begin
  if auth.uid() is null then
    return query select false, 0, p_limit; return;
  end if;
  insert into public.gps_ai_usage(player_id, day, count)
    values (auth.uid(), current_date, 0)
    on conflict (player_id, day) do nothing;
  select count into v_used from public.gps_ai_usage
    where player_id = auth.uid() and day = current_date for update;
  if v_used >= p_limit then
    return query select false, v_used, p_limit; return;
  end if;
  update public.gps_ai_usage set count = count + 1
    where player_id = auth.uid() and day = current_date;
  return query select true, v_used + 1, p_limit;
end $$;

revoke execute on function public.gps_ai_quota_consume(int) from public, anon;
grant execute on function public.gps_ai_quota_consume(int) to authenticated;
