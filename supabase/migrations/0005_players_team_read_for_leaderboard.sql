-- ============================================================================
--  0005 — Écrans classement / comparaison (vue joueur).
--  Un membre de l'équipe peut lire l'effectif (nom, poste, valeurs de base)
--  pour le classement gamifié et la comparaison intra-ligne.
--  Les données sensibles du quotidien restent cloisonnées :
--    - daily_checkins : joueur = les siens ; staff = l'équipe (inchangé)
--    - session_logs   : joueur = les siens ; staff = l'équipe (inchangé)
--  Ainsi un joueur voit le roster de base des coéquipiers, mais ni leurs
--  bilans du matin ni leurs logs de séance.
-- ============================================================================
create policy players_team_read on players for select
  using (team_id = my_team());
