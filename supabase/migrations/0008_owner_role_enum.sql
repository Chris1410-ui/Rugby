-- ════════════════════════════════════════════════════════════════
-- 0008 — Rôle « owner » (Head of Performance) : super-admin qui voit tous
-- les clubs et tous les joueurs. On ajoute d'abord la valeur d'enum (doit
-- être committée avant d'être utilisée en 0009).
-- ════════════════════════════════════════════════════════════════

alter type app_role add value if not exists 'owner';
