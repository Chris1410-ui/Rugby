-- 0078 — Lecture d'un PROTOCOLE planifié côté joueur.
-- Un protocole peut générer des séances datées pour les joueurs (planification,
-- 0077) tout en restant en brouillon. Le joueur doit pouvoir CONSULTER ce
-- protocole depuis sa séance (consignes, sécurité, progression). On étend donc
-- la lecture : tout membre de l'équipe peut lire un protocole dès qu'AU MOINS UNE
-- séance de son équipe y est liée (program_doc_id), sans le rendre « publié ».

drop policy if exists progdocs_read on public.program_docs;
create policy progdocs_read on public.program_docs for select using (
  is_owner()
  or (team_id = my_team() and (status = 'published' or is_staff()))
  or exists (
    select 1 from public.sessions s
    where s.program_doc_id = program_docs.id and s.team_id = my_team()
  )
);
