-- ════════════════════════════════════════════════════════════════
-- 0022 — Lecture des résultats de tests par le club (émulation collective).
--
-- Jusqu'ici test_results n'était lisible que par le joueur concerné ou le staff
-- (0016 tr_read). Pour la comparaison intra-ligne côté joueur (« où je me
-- situe ? » : moyenne de ma ligne, mon rang) et le badge Top 14 visible par
-- TOUS les joueurs au classement, on autorise la LECTURE des résultats du CLUB
-- par tout membre du club — même patron que players (0005, leaderboard).
-- L'écriture reste réservée au staff/owner (tr_staff / tr_owner inchangées).
-- Isolation stricte : team_id = my_team() (jamais un autre club).
-- ════════════════════════════════════════════════════════════════

create policy tr_team_read on test_results for select using (team_id = my_team());
