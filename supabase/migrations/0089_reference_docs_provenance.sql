-- 0089 — Provenance des documents de référence : « origine inconnue » + verrou
--
-- Le cas NORMAL en prépa physique est le PDF tiers non attribué. Le booléen
-- `author_owned` (« je suis l'auteur / j'ai l'autorisation ») pousse à cocher
-- « oui » par défaut — exactement ce que la certification veut éviter. On passe
-- à une PROVENANCE explicite à 4 valeurs, dont « origine inconnue », et on
-- verrouille le partage inter-club pour les provenances à risque.

alter table public.reference_docs
  add column if not exists provenance          text
    check (provenance in ('creation_propre','adapte_source','autorise_tiers','origine_inconnue')),
  add column if not exists has_text_layer      boolean,          -- false = PDF scanné/images (pas d'analyse IA sans OCR)
  add column if not exists share_authorized_by uuid,             -- trace d'autorisation de partage inter-club
  add column if not exists share_authorized_at timestamptz;

-- Backfill sûr de l'existant : la case « auteur OU autorisation » ne présume pas
-- la création propre → `autorise_tiers` (conservateur, reste non partageable sans
-- trace). Les rares docs non certifiés → `origine_inconnue`.
update public.reference_docs
  set provenance = case when author_owned then 'autorise_tiers' else 'origine_inconnue' end
  where provenance is null;

-- Défaut sûr (le client impose un choix actif ; ceci n'est qu'un filet).
alter table public.reference_docs alter column provenance set default 'origine_inconnue';

-- Verrou : un document « origine inconnue » n'est JAMAIS partageable ; un document
-- « adapté d'une source » ne l'est pas sans autorisation explicite tracée. On
-- force alors visibility='club'. (Le partage inter-club effectif viendra plus
-- tard ; ce garde-fou empêche tout basculement non tracé dès maintenant.)
create or replace function public._refdoc_provenance_guard()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provenance = 'origine_inconnue' then
    new.visibility := 'club';
    new.share_authorized_by := null;
    new.share_authorized_at := null;
  elsif new.provenance = 'adapte_source' and new.share_authorized_by is null then
    new.visibility := 'club';
  end if;
  return new;
end $$;
revoke execute on function public._refdoc_provenance_guard() from public, anon, authenticated;

drop trigger if exists trg_refdoc_provenance on public.reference_docs;
create trigger trg_refdoc_provenance
  before insert or update on public.reference_docs
  for each row execute function public._refdoc_provenance_guard();
