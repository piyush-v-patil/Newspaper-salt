import { describe, expect, it } from 'vitest';
import { autoSchedule, displace, freeSlots, layoutLanes, pullForward, scheduleAnyway } from './scheduling';
import { workloadLevel } from './workload';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const span = (start: number, end: number) => ({ startMin: start, endMin: end });
const WORKDAY = span(h(9), h(17));

describe('freeSlots', () => {
  it('returns the gaps between busy spans inside the window', () => {
    const busy = [span(h(10), h(11)), span(h(8), h(9, 30)), span(h(13), h(14))];
    expect(freeSlots(busy, WORKDAY)).toEqual([span(h(9, 30), h(10)), span(h(11), h(13)), span(h(14), h(17))]);
  });

  it('keeps a gap clear after each busy span', () => {
    expect(freeSlots([span(h(10), h(11))], WORKDAY, 15)).toEqual([span(h(9), h(10)), span(h(11, 15), h(17))]);
  });

  it('merges overlapping busy spans', () => {
    expect(freeSlots([span(h(9), h(12)), span(h(10), h(11))], WORKDAY)).toEqual([span(h(12), h(17))]);
  });
});

describe('autoSchedule', () => {
  it('takes the first free time in working hours', () => {
    expect(autoSchedule({ durationMin: 30, busy: [], window: WORKDAY })).toEqual([span(h(9), h(9, 30))]);
  });

  it('never schedules in the past, and rounds the current time up to 5 minutes', () => {
    expect(autoSchedule({ durationMin: 30, busy: [], window: WORKDAY, notBefore: h(10, 2) })).toEqual([span(h(10, 5), h(10, 35))]);
  });

  it('skips events and other sessions', () => {
    const busy = [span(h(9), h(10)), span(h(10, 15), h(11))];
    expect(autoSchedule({ durationMin: 30, busy, window: WORKDAY })).toEqual([span(h(11), h(11, 30))]);
  });

  it('keeps a short task whole when any single gap fits it', () => {
    const busy = [span(h(9, 20), h(10)), span(h(10, 20), h(11))];
    expect(autoSchedule({ durationMin: 45, busy, window: WORKDAY })).toEqual([span(h(11), h(11, 45))]);
  });

  it('splits a short task only when no single gap fits', () => {
    const busy = [span(h(9, 30), h(16, 30))];
    expect(autoSchedule({ durationMin: 60, busy, window: WORKDAY })).toEqual([span(h(9), h(9, 30)), span(h(16, 30), h(17))]);
    expect(autoSchedule({ durationMin: 60, busy, window: WORKDAY, allowSplit: false })).toBeNull();
  });

  it('fills the earliest gaps with a long task, in at most three blocks', () => {
    const busy = [span(h(10), h(11)), span(h(12), h(13))];
    expect(autoSchedule({ durationMin: 150, busy, window: WORKDAY })).toEqual([
      span(h(9), h(10)),
      span(h(11), h(12)),
      span(h(13), h(13, 30)),
    ]);
  });

  it('falls back to one block when splitting would need more than three', () => {
    const busy = [span(h(9, 30), h(10)), span(h(10, 30), h(11)), span(h(11, 30), h(12)), span(h(12, 30), h(13))];
    // Four half-hour gaps then a long afternoon: 2h30 does not fit in three early gaps.
    expect(autoSchedule({ durationMin: 150, busy, window: WORKDAY })).toEqual([span(h(13), h(15, 30))]);
  });

  it('respects the gap after meetings', () => {
    expect(autoSchedule({ durationMin: 30, busy: [span(h(9), h(10))], window: WORKDAY, gap: 10 })).toEqual([span(h(10, 10), h(10, 40))]);
  });

  it('returns null when the day is full or over', () => {
    expect(autoSchedule({ durationMin: 30, busy: [span(h(9), h(17))], window: WORKDAY })).toBeNull();
    expect(autoSchedule({ durationMin: 30, busy: [], window: WORKDAY, notBefore: h(18) })).toBeNull();
  });
});

describe('scheduleAnyway', () => {
  it('books after everything else, outside working hours if need be', () => {
    expect(scheduleAnyway(60, [span(h(9), h(17, 30))], WORKDAY)).toEqual(span(h(17, 30), h(18, 30)));
    expect(scheduleAnyway(60, [], WORKDAY, h(19, 2))).toEqual(span(h(19, 5), h(20, 5)));
  });
});

describe('displace', () => {
  it('moves the sessions that were landed on to the next free time', () => {
    const others = [
      { id: 'a', ...span(h(9), h(10)) },
      { id: 'b', ...span(h(10), h(10, 30)) },
      { id: 'c', ...span(h(14), h(15)) },
    ];
    // Drop a one-hour session at 9:30: it lands on both a and b.
    const result = displace(span(h(9, 30), h(10, 30)), others, [], WORKDAY);
    expect(result.moves).toEqual([
      { id: 'a', ...span(h(10, 30), h(11, 30)) },
      { id: 'b', ...span(h(11, 30), h(12)) },
    ]);
    expect(result.removed).toEqual([]);
  });

  it('works around events and removes what cannot fit', () => {
    const others = [{ id: 'a', ...span(h(15), h(16)) }];
    const fixed = [span(h(16), h(17))];
    const result = displace(span(h(14, 30), h(16)), others, fixed, WORKDAY);
    expect(result).toEqual({ moves: [], removed: ['a'] });
  });

  it('leaves untouched sessions alone', () => {
    const others = [{ id: 'a', ...span(h(13), h(14)) }];
    expect(displace(span(h(9), h(10)), others, [], WORKDAY)).toEqual({ moves: [], removed: [] });
  });
});

describe('pullForward', () => {
  it('closes the gap for back-to-back sessions and stops at a long break', () => {
    const later = [
      { id: 'a', ...span(h(10), h(11)) },
      { id: 'b', ...span(h(11), h(11, 30)) },
      { id: 'c', ...span(h(12, 15), h(13)) },
    ];
    // A session planned 9:00 to 10:00 is finished at 9:40.
    expect(pullForward(h(10), h(9, 40), later, [])).toEqual([
      { id: 'a', ...span(h(9, 40), h(10, 40)) },
      { id: 'b', ...span(h(10, 40), h(11, 10)) },
    ]);
  });

  it('keeps short breaks between sessions as they were', () => {
    const later = [{ id: 'a', ...span(h(10, 10), h(11)) }];
    expect(pullForward(h(10), h(9, 30), later, [])).toEqual([{ id: 'a', ...span(h(9, 40), h(10, 30)) }]);
  });

  it('stops rather than move a session onto an event', () => {
    const later = [{ id: 'a', ...span(h(10), h(11)) }];
    expect(pullForward(h(10), h(9, 30), later, [span(h(10, 15), h(10, 45))])).toEqual([]);
  });
});

describe('layoutLanes', () => {
  it('puts overlapping items side by side and leaves separate ones full width', () => {
    const items = [
      { id: 'a', ...span(h(9), h(10)) },
      { id: 'b', ...span(h(9, 30), h(10, 30)) },
      { id: 'c', ...span(h(11), h(12)) },
    ];
    const laid = Object.fromEntries(layoutLanes(items).map((l) => [l.item.id, [l.lane, l.lanes]]));
    expect(laid).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });
});

describe('workloadLevel', () => {
  it('is near from 85% of the threshold and over past it', () => {
    expect(workloadLevel(200, 330)).toBe('ok');
    expect(workloadLevel(281, 330)).toBe('near');
    expect(workloadLevel(330, 330)).toBe('near');
    expect(workloadLevel(331, 330)).toBe('over');
  });
});
