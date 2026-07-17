import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array, subscriptionRow } from "./push.js";

describe("push — helpers purs", () => {
  it("urlBase64ToUint8Array : clé VAPID → 65 octets (point EC non compressé)", () => {
    const key = "BL5oz7h3-3EGk6nCYb6uvMBglZerVyx-19QhHKJRRMrymCKwHFbdAUU8onmdzNpMZzQfPs7cgw7Y5PfH8t28kTc";
    const arr = urlBase64ToUint8Array(key);
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.length).toBe(65);
    expect(arr[0]).toBe(4); // préfixe 0x04 d'un point non compressé
  });

  it("urlBase64ToUint8Array : gère l'absence de padding et l'alphabet url-safe", () => {
    // "-_" (url-safe) doit être décodé comme "+/" — 4 octets ici.
    expect(urlBase64ToUint8Array("-_-_").length).toBe(3);
  });

  it("urlBase64ToUint8Array : tolère espaces / retours à la ligne (env Vercel)", () => {
    const key = "BL5oz7h3-3EGk6nCYb6uvMBglZerVyx-19QhHKJRRMrymCKwHFbdAUU8onmdzNpMZzQfPs7cgw7Y5PfH8t28kTc";
    const dirty = ["\n" + key + "\n", " " + key + " ", key.slice(0, 10) + "\n" + key.slice(10)];
    for (const v of dirty) {
      const arr = urlBase64ToUint8Array(v);
      expect(arr.length).toBe(65);   // sinon atob lèverait « invalid characters »
      expect(arr[0]).toBe(4);
    }
  });

  it("subscriptionRow : mappe une PushSubscription JSON en ligne DB", () => {
    const row = subscriptionRow("p1", "rugby-u18", {
      endpoint: "https://push.example/abc",
      keys: { p256dh: "PUB", auth: "AUTH" },
    }, "UA/1.0");
    expect(row.player_id).toBe("p1");
    expect(row.team_id).toBe("rugby-u18");
    expect(row.endpoint).toBe("https://push.example/abc");
    expect(row.p256dh).toBe("PUB");
    expect(row.auth).toBe("AUTH");
    expect(row.user_agent).toBe("UA/1.0");
    expect(typeof row.updated_at).toBe("string");
  });

  it("subscriptionRow : valeurs manquantes → null (pas d'undefined en base)", () => {
    const row = subscriptionRow("p1", "t1", { endpoint: "e", keys: {} });
    expect(row.p256dh).toBeNull();
    expect(row.auth).toBeNull();
    expect(row.user_agent).toBeNull();
  });
});
