-- ════════════════════════════════════════════════════════════════
-- 0040 — Poids de corps sur la fiche joueur, alimenté par le questionnaire.
--
-- Quand un joueur valide un questionnaire contenant la question « poids »
-- (id stable "poids", en kg), sa valeur met à jour players.bodyweight —
-- automatiquement, la plus récente (datée) gagne. Sert de poids « courant »
-- pour les comparaisons ×PdC (résolu côté client avec le dernier test).
--
-- Le joueur ne peut PAS écrire players (RLS staff-only) : le report se fait
-- côté serveur via un trigger SECURITY DEFINER sur questionnaire_assignments
-- (c'est là que le submit RPC écrit les réponses). Aucune autre donnée touchée.
-- ════════════════════════════════════════════════════════════════

alter table public.players
  add column if not exists bodyweight    numeric,
  add column if not exists bodyweight_at  timestamptz;

create or replace function public.sync_bodyweight_from_questionnaire()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_raw  text := new.reponses->>'poids';
  v_num  numeric;
  v_when timestamptz := coalesce(new.filled_at, now());
begin
  -- Seulement un questionnaire rempli qui porte une réponse « poids ».
  if new.statut is distinct from 'rempli' or v_raw is null then
    return new;
  end if;
  begin
    v_num := v_raw::numeric;
  exception when others then
    return new; -- réponse non numérique → ignorée
  end;
  if v_num is null or v_num <= 0 or v_num > 400 then
    return new; -- valeur aberrante ignorée
  end if;

  -- Le plus récent gagne : on n'écrase que si ce questionnaire est plus récent.
  update public.players
     set bodyweight = v_num, bodyweight_at = v_when
   where id = new.player_id
     and (bodyweight_at is null or v_when >= bodyweight_at);
  return new;
end $$;

drop trigger if exists sync_bodyweight_trg on public.questionnaire_assignments;
create trigger sync_bodyweight_trg
  after insert or update on public.questionnaire_assignments
  for each row execute function public.sync_bodyweight_from_questionnaire();
