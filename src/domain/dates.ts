import { addDays, format, parse } from 'date-fns';

/** A local calendar day, stored as YYYY-MM-DD. Never a timestamp. */
export type Day = string;

const DAY_FORMAT = 'yyyy-MM-dd';

export function toDay(date: Date): Day {
  return format(date, DAY_FORMAT);
}

export function fromDay(day: Day): Date {
  return parse(day, DAY_FORMAT, new Date(2000, 0, 1));
}

export function isDay(value: unknown): value is Day {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Rejects well-formed strings that are not real dates, such as February 30.
  return !Number.isNaN(fromDay(value).getTime());
}

export function shiftDay(day: Day, amount: number): Day {
  return toDay(addDays(fromDay(day), amount));
}

/** "Tuesday, November 17" */
export function longDayLabel(day: Day): string {
  return format(fromDay(day), 'EEEE, MMMM d');
}

/** Minutes as h:mm, e.g. 90 -> "1:30". */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
