-- 0108 — Fix « infinite recursion detected in policy for relation queue_tickets ».
--
-- Cause (préexistante depuis 0100) : la policy SELECT de `queues` interroge
-- `queue_tickets` (EXISTS), et la policy SELECT de `queue_tickets` interroge
-- `queues` (+ queue_tickets) → évaluer la RLS de l'une déclenche la RLS de l'autre
-- → récursion infinie. « Créer la file » échoue car l'insert().select() passe par
-- la policy SELECT de queues. (La consolidation 0107 n'a fait que préserver ces
-- sous-requêtes croisées ; elle n'est pas la cause.)
--
-- Correctif : déporter les vérifications inter-tables dans des fonctions STABLE
-- SECURITY DEFINER (comme my_team()/is_staff()) qui lisent les tables SANS RLS →
-- plus aucune évaluation de policy croisée, donc plus de récursion. L'owner
-- (team_id NULL, multi-clubs) passe par is_owner() → crée/gère la file du club
-- sélectionné sans souci (même écueil que reference_docs / suppression joueur).

-- Un ticket M'APPARTIENT dans cette file ? (lecture queue_tickets sans RLS)
create or replace function public.q_ticket_of_mine(p_queue uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from queue_tickets t where t.queue_id = p_queue and t.player_id = my_player_id());
$$;

-- La file est-elle OUVERTE ? (lecture queues sans RLS)
create or replace function public.q_is_open(p_queue uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((select status = 'open' from queues q where q.id = p_queue), false);
$$;

revoke execute on function public.q_ticket_of_mine(uuid) from public, anon;
revoke execute on function public.q_is_open(uuid) from public, anon;
grant execute on function public.q_ticket_of_mine(uuid) to authenticated;
grant execute on function public.q_is_open(uuid) to authenticated;

-- Policies SELECT réécrites : plus de sous-requête inter-tables (helpers SD).
drop policy if exists queues_sel on public.queues;
create policy queues_sel on public.queues for select using (
  is_owner()
  or (is_staff() and team_id = my_team())
  or (team_id = my_team() and (status = 'open' or public.q_ticket_of_mine(id)))
);

drop policy if exists queue_tickets_sel on public.queue_tickets;
create policy queue_tickets_sel on public.queue_tickets for select using (
  is_owner()
  or (is_staff() and team_id = my_team())
  or (team_id = my_team() and (public.q_is_open(queue_id) or public.q_ticket_of_mine(queue_id)))
);
