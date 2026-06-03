// ── In-memory daily stats ─────────────────────────────────────────────────────
// Tracks backend-side operations only (client-side Firestore ops appear in
// Firebase Console → Usage & Billing, not here).
// Resets automatically at UTC midnight on the first call of the new day.

export interface ServerStats {
  date: string;           // YYYY-MM-DD UTC
  studySaves: number;     // successful POST /study/save calls
  wsConnections: number;  // total WS connections opened today
  wsMessages: number;     // chat messages relayed via WS today
  wsReactions: number;    // emoji reactions relayed today
  wsRoomsNow: number;     // rooms with ≥1 WS member (live snapshot)
  wsUsersNow: number;     // total WS-connected users (live snapshot)
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function fresh(): ServerStats {
  return {
    date: utcDate(),
    studySaves: 0,
    wsConnections: 0,
    wsMessages: 0,
    wsReactions: 0,
    wsRoomsNow: 0,
    wsUsersNow: 0,
  };
}

let s: ServerStats = fresh();

function tick() {
  if (s.date !== utcDate()) s = fresh();
}

export const stats = {
  incStudySaves:    () => { tick(); s.studySaves++;    },
  incWsConnections: () => { tick(); s.wsConnections++; },
  incWsMessages:    () => { tick(); s.wsMessages++;    },
  incWsReactions:   () => { tick(); s.wsReactions++;   },
  setLive: (rooms: number, users: number) => {
    tick();
    s.wsRoomsNow = rooms;
    s.wsUsersNow = users;
  },
  get: (): ServerStats => { tick(); return { ...s }; },
};
