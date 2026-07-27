-- 0109 — Durcissement : résorbe le reliquat d'advisors préexistant (sans rapport
-- avec la récursion 0108). Trois volets, tous à sémantique préservée.

-- ── Volet A — function_search_path_mutable (10) ──────────────────────────────
-- Fonctions helper sans search_path fixe → risque de résolution de nom détournée.
-- Elles ne référencent que des objets de `public` (types, extensions pg_trgm/
-- unaccent, table test_results) ; `SET search_path = public` verrouille sans
-- changer le comportement. (Le _t14_val surchargé compte pour 2.)
alter function public._t14_kg(text)                                set search_path = public;
alter function public._t14_bronco(text)                            set search_path = public;
alter function public._t14_cat(text)                               set search_path = public;
alter function public._t14_thr(text, text)                         set search_path = public;
alter function public._t14_val(text, public.test_results)          set search_path = public;
alter function public._t14_val(text, public.test_results, numeric) set search_path = public;
alter function public._challenge_assigned_ids(jsonb, text)         set search_path = public;
alter function public.program_assigned_json(text, text, uuid)      set search_path = public;
alter function public.touch_program_docs()                         set search_path = public;
alter function public._ex_key(text)                                set search_path = public;

-- ── Volet B — auth_rls_initplan (4) ─────────────────────────────────────────
-- `auth.uid()` nu est réévalué par ligne. On l'enveloppe dans `(select auth.uid())`
-- pour qu'il soit évalué UNE fois (initplan). Corps = STRICTEMENT les mêmes
-- prédicats que les policies consolidées en 0107 (OU des quals d'origine), rôles
-- {public} inchangés. Aucune modification d'accès.
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (
  is_owner()
  or (id = (select auth.uid()))
  or (is_staff() and team_id = my_team())
);

drop policy if exists crews_del on public.crews;
create policy crews_del on public.crews for delete using (
  (created_by = (select auth.uid())) or is_owner()
);

drop policy if exists crews_ins on public.crews;
create policy crews_ins on public.crews for insert with check (
  ((team_id = my_team()) and (created_by = (select auth.uid())) and (owner_player_id = my_player_id()))
  or is_owner()
);

drop policy if exists crews_upd on public.crews;
create policy crews_upd on public.crews for update
  using (is_owner() or (created_by = (select auth.uid())))
  with check (is_owner() or (created_by = (select auth.uid())));

-- ── Volet C — reactivity_events (rls_enabled_no_policy, INFO) : NON traité ────
-- FAUX POSITIF assumé. Cette table est un journal IMMUABLE (cf. 0026) : RLS
-- activé SANS policy est VOULU — « aucun accès direct : lecture via RPC definer ».
-- Insertions par triggers SECURITY DEFINER, lecture via team_reactivity_bonus()
-- (definer). Aucun client ne l'interroge en direct. Ajouter une policy
-- permissive ne servirait à rien et affaiblirait la garantie d'inaccessibilité
-- du ledger. On la laisse donc telle quelle, à dessein.

-- Reste hors périmètre (non traité ici, motivé) :
--   • 100× authenticated_security_definer_function_executable : architectural
--     (toute fonction SECURITY DEFINER exposée en RPC ; helpers RLS inclus).
--   • 4×  anon_security_definer_function_executable : by-design (parcours
--     pré-inscription — list_clubs, peek_*, precheck_membership).
--   • 2×  extension_in_public (pg_trgm, unaccent) : déplacement d'extension
--     risqué à chaud (dépendances d'index/policies), à traiter à part.
--   • public_bucket_allows_listing / auth_leaked_password_protection : réglages
--     de bucket / dashboard, hors SQL.
