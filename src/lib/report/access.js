/* Décision d'autorisation du rapport de performance — pure et testable, alignée
   sur les helpers RLS is_owner()/is_staff() :
     • owner (Head of Performance) : n'importe quel joueur, TOUS clubs ;
     • staff (preparateur/medical/coach) : joueur de SON club uniquement ;
     • joueur (ou rôle inconnu) : lui-même uniquement (doit posséder la ligne).
   L'endpoint applique cette règle après avoir vérifié le JWT ; la RLS reste la
   défense en profondeur sur les lectures. */

const STAFF_ROLES = new Set(["preparateur", "medical", "coach"]);

export function canAccessReport({ role, requesterTeamId, playerTeamId, playerOwnerUid, userId }) {
  if (role === "owner") return true;
  if (STAFF_ROLES.has(role)) return requesterTeamId != null && playerTeamId === requesterTeamId;
  return playerOwnerUid != null && playerOwnerUid === userId;
}
