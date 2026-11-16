import { describe, expect, it } from 'vitest';
import { nextWeekStart, relativeDayLabel } from './dayLabels';
import { durationLabel, parseDuration } from './duration';

describe('parseDuration', () => {
  it.each([
    ['30', 30],
    ['30m', 30],
    ['45 min', 45],
    ['2h', 120],
    ['1.5h', 90],
    ['1h30', 90],
    ['1h 30m', 90],
    ['1:30', 90],
    ['0:05', 5],
    [' 90 ', 90],
    ['2 hours', 120],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  it.each(['', 'soon', '0', '-5', '1:3', '25h', 'h', '1.5'])('rejects %s', (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});

describe('labels', () => {
  it('describes durations', () => {
    expect(durationLabel(30)).toBe('30 min');
    expect(durationLabel(60)).toBe('1 hr');
    expect(durationLabel(90)).toBe('1 hr 30 min');
  });

  it('names days relative to today', () => {
    expect(relativeDayLabel('2026-11-17', '2026-11-17')).toBe('Today');
    expect(relativeDayLabel('2026-11-18', '2026-11-17')).toBe('Tomorrow');
    expect(relativeDayLabel('2026-11-16', '2026-11-17')).toBe('Yesterday');
    expect(relativeDayLabel('2026-11-23', '2026-11-17')).toBe('Mon, Nov 23');
  });

  it('finds the start of next week for either week start', () => {
    // 17 November 2026 is a Tuesday.
    expect(nextWeekStart('2026-11-17', 1)).toBe('2026-11-23');
    expect(nextWeekStart('2026-11-17', 0)).toBe('2026-11-22');
    expect(nextWeekStart('2026-11-22', 1)).toBe('2026-11-23');
  });
});
