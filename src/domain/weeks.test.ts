import { describe, expect, it } from 'vitest';
import { planningWeek, reviewWeek, weekDays, weekLabel, weekStartOf } from './weeks';

// November 2026: the 16th is a Monday, the 22nd a Sunday.
describe('weeks', () => {
  it('finds the start of the week for either convention', () => {
    expect(weekStartOf('2026-11-17', 1)).toBe('2026-11-16');
    expect(weekStartOf('2026-11-22', 1)).toBe('2026-11-16');
    expect(weekStartOf('2026-11-22', 0)).toBe('2026-11-22');
    expect(weekStartOf('2026-11-17', 0)).toBe('2026-11-15');
  });

  it('lists the seven days and labels the range', () => {
    expect(weekDays('2026-11-16')).toHaveLength(7);
    expect(weekDays('2026-11-16')[6]).toBe('2026-11-22');
    expect(weekLabel('2026-11-16')).toBe('Nov 16 – 22');
    expect(weekLabel('2026-11-30')).toBe('Nov 30 – Dec 6');
  });

  it('plans this week until Wednesday and next week from Thursday', () => {
    expect(planningWeek('2026-11-16', 1)).toBe('2026-11-16'); // Monday
    expect(planningWeek('2026-11-18', 1)).toBe('2026-11-16'); // Wednesday
    expect(planningWeek('2026-11-19', 1)).toBe('2026-11-23'); // Thursday
    expect(planningWeek('2026-11-22', 1)).toBe('2026-11-23'); // Sunday
    expect(planningWeek('2026-11-22', 0)).toBe('2026-11-22'); // Sunday starts the week
  });

  it('reviews last week on Monday to Wednesday and this week after', () => {
    expect(reviewWeek('2026-11-16', 1)).toBe('2026-11-09'); // Monday
    expect(reviewWeek('2026-11-18', 1)).toBe('2026-11-09'); // Wednesday
    expect(reviewWeek('2026-11-20', 1)).toBe('2026-11-16'); // Friday
    expect(reviewWeek('2026-11-22', 1)).toBe('2026-11-16'); // Sunday
  });
});
