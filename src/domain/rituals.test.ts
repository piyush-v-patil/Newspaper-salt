import { describe, expect, it } from 'vitest';
import { isPlanningDue, isShutdownDue, planningTarget, ritualToOffer } from './rituals';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe('ritual timing', () => {
  it('plans today before 3 PM and tomorrow from 3 PM', () => {
    expect(planningTarget(h(8, 30), '2026-11-17')).toBe('2026-11-17');
    expect(planningTarget(h(14, 59), '2026-11-17')).toBe('2026-11-17');
    expect(planningTarget(h(15), '2026-11-17')).toBe('2026-11-18');
    expect(planningTarget(h(18), '2026-11-30')).toBe('2026-12-01');
  });

  it('is due from its time until it is done', () => {
    expect(isPlanningDue(h(8, 29), h(8, 30), 'none')).toBe(false);
    expect(isPlanningDue(h(8, 30), h(8, 30), 'none')).toBe(true);
    expect(isPlanningDue(h(11), h(8, 30), 'in_progress')).toBe(true);
    expect(isPlanningDue(h(11), h(8, 30), 'done')).toBe(false);
    expect(isShutdownDue(h(16, 59), h(17), 'none')).toBe(false);
    expect(isShutdownDue(h(17), h(17), 'none')).toBe(true);
    expect(isShutdownDue(h(22), h(17), 'done')).toBe(false);
  });

  it('offers shutdown before planning when both are due', () => {
    expect(ritualToOffer(true, true)).toBe('shutdown');
    expect(ritualToOffer(true, false)).toBe('plan');
    expect(ritualToOffer(false, false)).toBeNull();
  });
});
