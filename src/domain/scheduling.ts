/** A span of one day, in minutes after midnight. */
export interface Interval {
  startMin: number;
  endMin: number;
}

export interface Placed extends Interval {
  id: string;
}

/** Sessions move and resize in 5-minute steps. */
export const SNAP_MIN = 5;
/** Auto-scheduling never creates a fragment shorter than this, unless the whole task is shorter. */
const MIN_BLOCK = 15;
const MAX_BLOCKS = 3;
const DAY_END = 24 * 60;

export const snap = (min: number, step = SNAP_MIN) => Math.round(min / step) * step;
export const snapUp = (min: number, step = SNAP_MIN) => Math.ceil(min / step) * step;
export const overlaps = (a: Interval, b: Interval) => a.startMin < b.endMin && b.startMin < a.endMin;
const length = (i: Interval) => i.endMin - i.startMin;

/** The gaps left in `window` once `busy` is taken out. `gap` is kept clear after each busy span. */
export function freeSlots(busy: Interval[], window: Interval, gap = 0): Interval[] {
  const sorted = busy
    .map((b) => ({ startMin: b.startMin, endMin: b.endMin + gap }))
    .filter((b) => b.endMin > window.startMin && b.startMin < window.endMin)
    .sort((a, b) => a.startMin - b.startMin);

  const slots: Interval[] = [];
  let cursor = window.startMin;
  for (const b of sorted) {
    if (b.startMin > cursor) slots.push({ startMin: cursor, endMin: b.startMin });
    cursor = Math.max(cursor, b.endMin);
  }
  if (cursor < window.endMin) slots.push({ startMin: cursor, endMin: window.endMin });
  return slots;
}

export interface ScheduleRequest {
  durationMin: number;
  /** Events and other sessions already on the day. */
  busy: Interval[];
  /** Working hours for the day. */
  window: Interval;
  /** Earliest allowed start, e.g. the current time when scheduling today. */
  notBefore?: number;
  /** Minutes kept clear after each event or session. */
  gap?: number;
  /** False keeps the task in one block (Shift+X). */
  allowSplit?: boolean;
}

/**
 * Finds time for a task on one day. Returns the blocks to create, or null if
 * the day has no room.
 *
 * - Never starts before `notBefore`, and stays inside working hours.
 * - A task of an hour or less goes in the first gap that holds all of it,
 *   and is split only when no single gap does.
 * - A longer task fills the earliest gaps, in at most three blocks.
 */
export function autoSchedule(req: ScheduleRequest): Interval[] | null {
  const { durationMin, busy, gap = 0, allowSplit = true } = req;
  if (durationMin <= 0) return null;
  const window = {
    startMin: Math.max(req.window.startMin, snapUp(req.notBefore ?? 0)),
    endMin: req.window.endMin,
  };
  if (window.endMin - window.startMin < Math.min(durationMin, MIN_BLOCK)) return null;

  const slots = freeSlots(busy, window, gap).filter((s) => length(s) >= Math.min(durationMin, MIN_BLOCK));
  const whole = slots.find((s) => length(s) >= durationMin);
  const single = whole ? [{ startMin: whole.startMin, endMin: whole.startMin + durationMin }] : null;

  if (!allowSplit) return single;
  if (durationMin <= 60 && single) return single;

  const blocks: Interval[] = [];
  let remaining = durationMin;
  for (const slot of slots) {
    if (blocks.length === MAX_BLOCKS) break;
    const take = Math.min(remaining, length(slot));
    blocks.push({ startMin: slot.startMin, endMin: slot.startMin + take });
    remaining -= take;
    if (remaining === 0) break;
  }
  return remaining === 0 ? blocks : single;
}

/** Where to put a task when the day is full and the user chooses to schedule anyway: after everything else. */
export function scheduleAnyway(durationMin: number, busy: Interval[], window: Interval, notBefore = 0): Interval | null {
  const lastEnd = busy.reduce((max, b) => Math.max(max, b.endMin), 0);
  const startMin = snapUp(Math.max(lastEnd, notBefore, window.startMin));
  const endMin = Math.min(startMin + durationMin, DAY_END);
  return endMin - startMin >= SNAP_MIN ? { startMin, endMin } : null;
}

export interface Displacement {
  /** Sessions given a new time. */
  moves: Placed[];
  /** Sessions that no longer fit on the day and come off the calendar. */
  removed: string[];
}

/**
 * When a session is dropped onto others, the ones it lands on move to the
 * next free time at or after where they were. Events never move.
 */
export function displace(moved: Interval, others: Placed[], fixed: Interval[], window: Interval, gap = 0): Displacement {
  const hit = others.filter((o) => overlaps(o, moved)).sort((a, b) => a.startMin - b.startMin);
  const busy: Interval[] = [...fixed, moved, ...others.filter((o) => !overlaps(o, moved))];
  const result: Displacement = { moves: [], removed: [] };

  for (const session of hit) {
    const placed = autoSchedule({
      durationMin: length(session),
      busy,
      // A session that already ran past working hours may stay past them.
      window: { startMin: window.startMin, endMin: Math.max(window.endMin, session.endMin) },
      notBefore: session.startMin,
      gap,
      allowSplit: false,
    });
    if (placed) {
      result.moves.push({ id: session.id, ...placed[0] });
      busy.push(placed[0]);
    } else {
      result.removed.push(session.id);
    }
  }
  return result;
}

/**
 * When a task is finished early, the sessions that followed it back to back
 * move forward to close the gap. The chain stops at the first break of half
 * an hour or more, or at an event in the way.
 */
export function pullForward(originalEnd: number, newEnd: number, later: Placed[], fixed: Interval[]): Placed[] {
  const moves: Placed[] = [];
  let previousEnd = originalEnd;
  let cursor = newEnd;

  for (const session of later.filter((s) => s.startMin >= originalEnd).sort((a, b) => a.startMin - b.startMin)) {
    const breakBefore = session.startMin - previousEnd;
    if (breakBefore >= 30) break;
    const startMin = cursor + breakBefore;
    const next = { id: session.id, startMin, endMin: startMin + length(session) };
    if (fixed.some((f) => overlaps(f, next))) break;
    if (next.startMin !== session.startMin) moves.push(next);
    previousEnd = session.endMin;
    cursor = next.endMin;
  }
  return moves;
}

export interface Laid<T> {
  item: T;
  /** Column index within its cluster of overlapping items. */
  lane: number;
  /** How many columns the cluster needs. */
  lanes: number;
}

/** Lays overlapping calendar items side by side. */
export function layoutLanes<T extends Interval>(items: T[]): Laid<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result: Laid<T>[] = [];
  let cluster: Laid<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const close = () => {
    for (const laid of cluster) laid.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endMin;
    clusterEnd = Math.max(clusterEnd, item.endMin);
    cluster.push({ item, lane, lanes: 1 });
  }
  close();
  return result;
}
