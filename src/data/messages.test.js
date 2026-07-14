import { describe, it, expect, afterAll } from "vitest";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Régression de l'écran blanc (Alertes / Messages) :
   supabase-js dédoublonne les canaux Realtime par "topic". Le parent (badge de
   non-lus) et l'écran s'abonnaient au même joueur → même topic → le 2e
   `.on('postgres_changes', …)` levait « after subscribe() » → écran blanc.
   `uniqueTopic` garantit un nom de canal distinct par abonnement. */

afterAll(() => supabase.removeAllChannels());

describe("messagerie — canaux Realtime", () => {
  it("uniqueTopic renvoie un nom différent à chaque appel", () => {
    expect(uniqueTopic("messages:1")).not.toBe(uniqueTopic("messages:1"));
  });

  it("supabase-js dédoublonne par topic (cause racine du bug)", () => {
    const a = supabase.channel("dedup-demo");
    const b = supabase.channel("dedup-demo");
    expect(a).toBe(b); // même instance → collision si on ré-`.on()` après subscribe
  });

  it("uniqueTopic évite la collision (canaux distincts pour le même joueur)", () => {
    const a = supabase.channel(uniqueTopic("messages:zzz"));
    const b = supabase.channel(uniqueTopic("messages:zzz"));
    expect(a).not.toBe(b);
  });
});
