import { supabase } from "../lib/supabase.js";

/* Recommandations IA — invoque l'Edge Function `recommendations`.
   L'appel à Claude et la clé API restent CÔTÉ SERVEUR (jamais exposés au
   navigateur). Repli déterministe géré par la fonction si l'IA n'est pas
   configurée. */
export async function getRecommendation(player) {
  // On n'envoie que les indicateurs utiles (pas de données superflues)
  const payload = {
    name: player.name,
    pos: player.pos,
    acwr: player.acwr,
    wellness: player.wellness,
    readiness: player.readiness,
    risque: player.risque,
    monotonie: player.monotonie,
    charge7j: player.charge7j,
  };
  const { data, error } = await supabase.functions.invoke("recommendations", {
    body: { player: payload },
  });
  if (error) throw error;
  return data; // { recommendation, source }
}
