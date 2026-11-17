import { describe, expect, it } from 'vitest';
import type { Repeat } from '@/data/types';
import { describeRepeat, occurrencesBetween, occursOn } from './recurrence';

const repeat = (kind: Repeat['kind'], interval = 1, weekdays: number[] = []): Repeat => ({ kind, interval, weekdays });
// 17 November 2026 is a Tuesday.
const START = '2026-11-17';

describe('occursOn', () => {
  it('never falls before the start', () => {
    expect(occursOn(repeat('daily'), START, '2026-11-16')).toBe(false);
  });

  it('daily, and every N days', () => {
    expect(occurrencesBetween(repeat('daily'), START, START, '2026-11-20')).toHaveLength(4);
    expect(occurrencesBetween(repeat('daily', 3), START, START, '2026-11-27')).toEqual(['2026-11-17', '2026-11-20', '2026-11-23', '2026-11-26']);
  });

  it('weekdays skips the weekend', () => {
    expect(occurrencesBetween(repeat('weekdays'), START, START, '2026-11-24')).toEqual([
      '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24',
    ]);
  });

  it('weekly on chosen days', () => {
    expect(occurrencesBetween(repeat('weekly', 1, [2, 4]), START, START, '2026-11-27')).toEqual(['2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26']);
  });

  it('every other week keeps its rhythm from the starting week', () => {
    expect(occurrencesBetween(repeat('weekly', 2, [1, 2]), START, START, '2026-12-08')).toEqual(['2026-11-17', '2026-11-30', '2026-12-01']);
  });

  it('monthly on the same date, and on the last day of shorter months', () => {
    expect(occurrencesBetween(repeat('monthly'), START, START, '2027-01-31')).toEqual(['2026-11-17', '2026-12-17', '2027-01-17']);
    expect(occurrencesBetween(repeat('monthly'), '2027-01-31', '2027-01-31', '2027-04-30')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    expect(occurrencesBetween(repeat('monthly', 3), START, START, '2027-06-30')).toEqual(['2026-11-17', '2027-02-17', '2027-05-17']);
  });

  it('yearly, including a leap day', () => {
    expect(occursOn(repeat('yearly'), START, '2027-11-17')).toBe(true);
    expect(occursOn(repeat('yearly'), START, '2027-11-18')).toBe(false);
    expect(occursOn(repeat('yearly'), '2028-02-29', '2029-02-28')).toBe(true);
    expect(occursOn(repeat('yearly', 2), START, '2027-11-17')).toBe(false);
  });
});

describe('describeRepeat', () => {
  it('reads naturally', () => {
    expect(describeRepeat(repeat('daily'))).toBe('Every day');
    expect(describeRepeat(repeat('daily', 3))).toBe('Every 3 days');
    expect(describeRepeat(repeat('weekdays'))).toBe('Weekdays');
    expect(describeRepeat(repeat('weekly', 2, [4, 1]))).toBe('Every 2 weeks on Mon, Thu');
    expect(describeRepeat(repeat('monthly'))).toBe('Every month');
  });
});
