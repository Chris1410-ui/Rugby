/* Décisions d'autorisation d'un PROTOCOLE — pures et testables, alignées sur la
   RLS de `program_docs` :
     • Lecture : owner partout ; sinon membre du club ET (publié OU staff) →
       les joueurs ne voient que les protocoles publiés de LEUR club, le staff
       (prépa/médical/coach) voit aussi les brouillons.
     • Écriture : owner partout ; staff ÉCRIVAIN (prépa/médical) sur SON club
       uniquement (le coach est staff en lecture seule, comme can_write()).
   L'endpoint d'export applique ces règles après vérification du JWT ; la RLS
   reste la défense en profondeur. */

const STAFF_ROLES = new Set(["preparateur", "medical", "coach"]);
const WRITER_ROLES = new Set(["preparateur", "medical"]);

export function canReadProgram({ role, requesterTeamId, programTeamId, status }) {
  if (role === "owner") return true;
  if (requesterTeamId == null || programTeamId !== requesterTeamId) return false;
  if (STAFF_ROLES.has(role)) return true;         // staff : brouillons + publiés
  return status === "published";                   // joueur : publiés seulement
}

export function canEditProgram({ role, requesterTeamId, programTeamId }) {
  if (role === "owner") return true;
  return WRITER_ROLES.has(role) && requesterTeamId != null && programTeamId === requesterTeamId;
}
