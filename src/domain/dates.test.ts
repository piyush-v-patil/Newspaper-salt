import { describe, expect, it } from 'vitest';
import { formatMinutes, isDay, longDayLabel, shiftDay } from './dates';
import { compareKeys, keyAtEdge, keyBetween } from './ordering';

describe('days', () => {
  it('shifts across month and year boundaries', () => {
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('shifts across a daylight-saving change without skipping a day', () => {
    expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29');
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('accepts only real calendar days', () => {
    expect(isDay('2026-11-17')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('17-11-2026')).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });

  it('labels a day in full', () => {
    expect(longDayLabel('2026-11-17')).toBe('Tuesday, November 17');
  });

  it('formats minutes as h:mm', () => {
    expect(formatMinutes(90)).toBe('1:30');
    expect(formatMinutes(5)).toBe('0:05');
    expect(formatMinutes(330)).toBe('5:30');
  });
});

describe('ordering', () => {
  it('generates keys that sort between and beyond their neighbours', () => {
    const a = keyBetween(null, null);
    const top = keyAtEdge([a], 'top');
    const bottom = keyAtEdge([a], 'bottom');
    const mid = keyBetween(a, bottom);
    expect([bottom, mid, a, top].sort(compareKeys)).toEqual([top, a, mid, bottom]);
  });
});
