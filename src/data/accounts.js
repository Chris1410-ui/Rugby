import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Console owner : tous les comptes tous clubs (RPC SECURITY DEFINER réservé à
   l'owner). Renvoie { id, email, full_name, role, team_id, team_label, player_id }. */
export function useOwnerAccounts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error } = await supabase.rpc("owner_list_accounts");
    if (error) { setError(error.message); setLoading(false); return; }
    setRows((data ?? []).map((r) => ({
      id: r.id, email: r.email, fullName: r.full_name, role: r.role,
      teamId: r.team_id, teamLabel: r.team_label, playerId: r.player_id,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { accounts: rows, loading, error, refresh: fetch };
}
