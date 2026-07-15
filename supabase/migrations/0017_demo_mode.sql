-- ════════════════════════════════════════════════════════════════
-- 0017 — Mode démo : joueurs fictifs marqués `is_demo`.
--
-- Les entités de démo sont marquées pour ne JAMAIS toucher aux vraies :
-- génération / suppression en masse filtrent sur is_demo. La suppression des
-- joueurs démo cascade sur leurs check-ins / logs / résultats de tests.
-- ════════════════════════════════════════════════════════════════

alter table players        add column if not exists is_demo boolean not null default false;
alter table sessions       add column if not exists is_demo boolean not null default false;
alter table test_campaigns add column if not exists is_demo boolean not null default false;

-- Le staff peut écrire les bilans du jour des JOUEURS DÉMO de son club (pour
-- seeder des données réalistes), sans jamais pouvoir écrire ceux des vrais
-- joueurs (leurs check-ins restent privés — policy daily_self inchangée).
create policy daily_staff_demo_write on daily_checkins for all
  using (is_staff() and exists (
    select 1 from public.players p where p.id = player_id and p.team_id = my_team() and p.is_demo))
  with check (is_staff() and exists (
    select 1 from public.players p where p.id = player_id and p.team_id = my_team() and p.is_demo));
