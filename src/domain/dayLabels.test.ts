import { describe, expect, it } from 'vitest';
import { dueLabel, parseTypedDay } from './dayLabels';

describe('typed dates', () => {
  const today = '2026-11-17';
  it('reads month names, day-first and numeric forms', () => {
    expect(parseTypedDay('dec 3', today)).toBe('2026-12-03');
    expect(parseTypedDay('3 December', today)).toBe('2026-12-03');
    expect(parseTypedDay('12/3', today)).toBe('2026-12-03');
    expect(parseTypedDay('Dec 3, 2027', today)).toBe('2027-12-03');
    expect(parseTypedDay('2026-11-30', today)).toBe('2026-11-30');
  });
  it('without a year, a date already past means next year; today counts', () => {
    expect(parseTypedDay('nov 10', today)).toBe('2027-11-10');
    expect(parseTypedDay('nov 17', today)).toBe('2026-11-17');
  });
  it('ignores words that are not dates', () => {
    expect(parseTypedDay('next', today)).toBeNull();
    expect(parseTypedDay('feb 30', today)).toBeNull();
  });
});

describe('due labels', () => {
  const today = '2026-11-17'; // a Tuesday
  it('is relative close by and a date further out', () => {
    expect(dueLabel('2026-11-17', today)).toBe('Due today');
    expect(dueLabel('2026-11-18', today)).toBe('Due tomorrow');
    expect(dueLabel('2026-11-20', today)).toBe('Due Fri');
    expect(dueLabel('2026-12-03', today)).toBe('Due Dec 3');
    expect(dueLabel('2026-11-16', today)).toBe('Due yesterday');
    expect(dueLabel('2026-11-02', today)).toBe('Due Nov 2');
  });
});
