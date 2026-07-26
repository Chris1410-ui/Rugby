import { describe, it, expect } from "vitest";
import { orderTickets, playerQueueStatus, nextUpIds, nextProgress } from "./queue.js";

const T = (id, position, progress = 0, absent = false) => ({ id, playerId: id, position, progress, absent, joinedAt: `2024-01-01T00:0${position}:00` });

describe("queue logic", () => {
  it("ordonne par position puis joinedAt", () => {
    const order = orderTickets([T("c", 3), T("a", 1), T("b", 2)]);
    expect(order.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("calcule rang et joueurs devant en ignorant absents / terminés", () => {
    const tickets = [T("a", 1, 100), T("b", 2, 0), T("c", 3, 0, true), T("d", 4, 50), T("e", 5, 0)];
    // a terminé, c absent → ne comptent pas. Devant e : b et d (en attente) = 2.
    expect(playerQueueStatus(tickets, "e")).toMatchObject({ rank: 3, ahead: 2, isTurn: false });
    // b est le 1er en attente → son tour.
    expect(playerQueueStatus(tickets, "b")).toMatchObject({ rank: 1, ahead: 0, isTurn: true });
    expect(playerQueueStatus(tickets, "a")).toMatchObject({ done: true });
    expect(playerQueueStatus(tickets, "c")).toMatchObject({ absent: true });
    expect(playerQueueStatus(tickets, "zzz")).toEqual({ inQueue: false });
  });

  it("nextUpIds = 2 premiers en attente dans l'ordre", () => {
    const tickets = [T("a", 1, 100), T("b", 2), T("c", 3, 0, true), T("d", 4), T("e", 5)];
    expect(nextUpIds(tickets, 2)).toEqual(["b", "d"]);
  });

  it("cycle d'avancement 0 → 50 → 100 → 0", () => {
    expect(nextProgress(0)).toBe(50);
    expect(nextProgress(50)).toBe(100);
    expect(nextProgress(100)).toBe(0);
  });
});
