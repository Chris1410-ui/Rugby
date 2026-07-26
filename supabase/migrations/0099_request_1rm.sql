-- 0099 — Demande de 1RM : création automatique d'entrées « à renseigner ».
--
-- Quand le staff demande un ou plusieurs 1RM (action dédiée, ou exercices
-- reconnus dans un message, ou mouvement utilisé en @% par un protocole), on
-- crée pour chaque joueur destinataire × mouvement une ligne player_1rm
-- placeholder (value_kg NULL, kind='auto', source='auto') SI elle n'existe pas
-- déjà, et on lui pousse une notification (→ push gratuit) avec lien vers sa
-- fiche. La résolution du nom réutilise _norm_ex_name (unaccent/pg_trgm) : match
-- normalisé EXACT → on relie exercise_id ; sinon on crée sur le nom normalisé et
-- on le SIGNALE (unresolved), jamais de fausse correspondance inventée.
--
-- Réutilise : player_1rm (0079), notif_targets (0073), exercise_library (0085).
-- Aucun barème ni formule modifié.

-- Clé anti-doublon alignée sur exKey() côté JS (lib/hevy.js) : minuscule, on ne
-- garde que [a-z0-9], 24 car. max. (Volontairement SANS unaccent, comme exKey,
-- pour que les lignes auto se dédupliquent contre les saisies manuelles.)
create or replace function public._ex_key(p_name text)
  returns text language sql immutable as $$
  select left(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '', 'g'), 24)
$$;

create or replace function public.request_1rm(p_assigned jsonb, p_exercises jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_team       text := my_team();
  v_created    int := 0;
  v_skipped    int := 0;
  v_unresolved text[] := '{}';
  v_resolved   jsonb := '[]'::jsonb;   -- [{ex uuid|null, label text, key text}]
  v_el         jsonb;
  v_in_id      uuid;
  v_in_name    text;
  v_ex_id      uuid;
  v_label      text;
  v_key        text;
  v_norm       text;
  v_cand_id    uuid;
  v_cand_label text;
  v_sim        real;
  v_player     uuid;
  rec          record;
  v_exists     boolean;
  v_body       text;
begin
  if not (is_staff() or is_owner()) then raise exception 'forbidden'; end if;
  if v_team is null then raise exception 'no team'; end if;
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    return jsonb_build_object('created', 0, 'skipped', 0, 'unresolved', '[]'::jsonb);
  end if;

  -- 1) Résolution des exercices (une seule fois).
  for v_el in select value from jsonb_array_elements(p_exercises) loop
    v_in_id   := nullif(v_el->>'id', '')::uuid;
    v_in_name := btrim(coalesce(v_el->>'name', ''));
    v_ex_id   := v_in_id;
    v_label   := v_in_name;

    if v_ex_id is not null then
      select name into v_label from public.exercise_library where id = v_ex_id;
      v_label := coalesce(nullif(v_label, ''), v_in_name);
    elsif v_in_name <> '' then
      -- Résolution floue : meilleur candidat (match exact = similarité 1.0), on
      -- ne relie QUE si la similarité trigram ≥ 0.6 (gère singulier/pluriel et
      -- variantes légères, exclut les mouvements distincts). Sinon → non résolu.
      v_norm := public._norm_ex_name(v_in_name);
      select e.id, e.name, similarity(e.name_norm, v_norm)
        into v_cand_id, v_cand_label, v_sim
        from public.exercise_library e
        where (e.club_id is null or e.club_id = my_club())
          and (e.name_norm = v_norm or e.name_norm % v_norm)
        order by (e.name_norm = v_norm) desc, similarity(e.name_norm, v_norm) desc, e.usage_count desc
        limit 1;
      if v_cand_id is not null and v_sim >= 0.6 then
        v_ex_id := v_cand_id;
        v_label := v_cand_label;
      else
        v_ex_id := null;
        v_label := v_in_name;
        v_unresolved := array_append(v_unresolved, v_in_name);
      end if;
    else
      continue;  -- ni id ni nom → ignoré
    end if;

    v_key := public._ex_key(v_label);
    if v_key = '' then continue; end if;
    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object('ex', v_ex_id, 'label', v_label, 'key', v_key));
  end loop;

  if jsonb_array_length(v_resolved) = 0 then
    return jsonb_build_object('created', 0, 'skipped', 0, 'unresolved', '[]'::jsonb);
  end if;

  -- 2) Produit cartésien cibles × mouvements → placeholders (anti-doublon).
  for v_player in select t from public.notif_targets(v_team, p_assigned) t loop
    for rec in select * from jsonb_to_recordset(v_resolved) as x(ex uuid, label text, key text) loop
      select exists (
        select 1 from public.player_1rm p
        where p.player_id = v_player
          and ((rec.ex is not null and p.exercise_id = rec.ex) or p.movement_key = rec.key)
      ) into v_exists;
      if v_exists then
        v_skipped := v_skipped + 1;
      else
        insert into public.player_1rm
          (player_id, team_id, exercise_id, movement_key, movement_label, value_kg, kind, source, created_by)
        values
          (v_player, v_team, rec.ex, rec.key, rec.label, null, 'auto', 'auto', auth.uid());
        v_created := v_created + 1;
      end if;
    end loop;

    -- 3) Une notification par joueur ciblé (rappel « à renseigner »), lien fiche.
    select string_agg(x.label, ', ') into v_body
      from jsonb_to_recordset(v_resolved) as x(ex uuid, label text, key text);
    insert into public.notifications (team_id, player_id, type, titre, body, route)
      values (v_team, v_player, '1rm', '🏋️ 1RM à renseigner', v_body, 'fiche');
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'unresolved', to_jsonb(array(select distinct unnest(v_unresolved)))
  );
end;
$$;

revoke execute on function public.request_1rm(jsonb, jsonb) from public, anon;
grant execute on function public.request_1rm(jsonb, jsonb) to authenticated;
