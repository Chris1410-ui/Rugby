-- ════════════════════════════════════════════════════════════════
-- 0042 — Correctif du parseur de charges serveur `_t14_kg`.
--
-- Bug (depuis 0023) : le motif « [0-9]+(\.[0-9]+)? » contenait un groupe
-- CAPTURANT. `regexp_matches` place alors le contenu du groupe (la partie
-- décimale « .5 ») dans x[1], et NON la correspondance entière. D'où :
--   _t14_kg('82.5')  → 0.5   (au lieu de 82.5)
--   _t14_kg('112.5') → 0.5   (au lieu de 112.5)
--   _t14_kg('120')   → NULL  (pas de décimale → groupe NULL)
--   _t14_kg('3x170') → NULL
-- Conséquence : côté serveur, la force ×PdC (squat) et les points Top 14
-- correspondants étaient faux/nuls dans comparison_line_stats() et team_top14().
--
-- Correctif : groupe NON capturant « (?:\.[0-9]+)? » → x[1] = correspondance
-- entière. On prend le DERNIER nombre de la chaîne (miroir de parseKg côté
-- src/lib/top14.js : « 3x170 » → 170, « 82,5 » → 82.5, « 120 » → 120).
-- ════════════════════════════════════════════════════════════════
create or replace function public._t14_kg(s text) returns numeric
  language plpgsql immutable as $$
declare m text[];
begin
  if s is null then return null; end if;
  select array_agg(x[1]) into m
    from regexp_matches(replace(s, ',', '.'), '[0-9]+(?:\.[0-9]+)?', 'g') as x;
  if m is null or array_length(m, 1) = 0 then return null; end if;
  return m[array_length(m, 1)]::numeric;
end $$;
