import { getDaysInMonth } from 'date-fns';
import type { Repeat } from '@/data/types';
import { daysBetween, fromDay, shiftDay, weekdayOf, type Day } from './dates';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Whether a repeating task that began on `startDay` falls on `day`. */
export function occursOn(repeat: Repeat, startDay: Day, day: Day): boolean {
  const elapsed = daysBetween(startDay, day);
  if (elapsed < 0) return false;
  const interval = Math.max(1, Math.floor(repeat.interval));
  const start = fromDay(startDay);
  const date = fromDay(day);

  switch (repeat.kind) {
    case 'daily':
      return elapsed % interval === 0;
    case 'weekdays': {
      const weekday = weekdayOf(day);
      return weekday >= 1 && weekday <= 5;
    }
    case 'weekly': {
      if (!repeat.weekdays.includes(weekdayOf(day))) return false;
      // Count weeks from the Monday of the starting week, so "every other week" keeps its rhythm.
      const startMonday = shiftDay(startDay, -((weekdayOf(startDay) + 6) % 7));
      return Math.floor(daysBetween(startMonday, day) / 7) % interval === 0;
    }
    case 'monthly': {
      const months = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
      if (months % interval !== 0) return false;
      // The 31st falls on the last day of shorter months.
      return date.getDate() === Math.min(start.getDate(), getDaysInMonth(date));
    }
    case 'yearly': {
      const years = date.getFullYear() - start.getFullYear();
      if (years % interval !== 0 || date.getMonth() !== start.getMonth()) return false;
      return date.getDate() === Math.min(start.getDate(), getDaysInMonth(date));
    }
  }
}

/** Every occurrence from `from` to `to` inclusive. */
export function occurrencesBetween(repeat: Repeat, startDay: Day, from: Day, to: Day): Day[] {
  const days: Day[] = [];
  for (let day = from < startDay ? startDay : from; day <= to; day = shiftDay(day, 1)) {
    if (occursOn(repeat, startDay, day)) days.push(day);
  }
  return days;
}

/** "Every day", "Weekdays", "Every 2 weeks on Mon, Thu", "Every month", … */
export function describeRepeat(repeat: Repeat): string {
  const n = Math.max(1, Math.floor(repeat.interval));
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`);
  switch (repeat.kind) {
    case 'daily':
      return every('day');
    case 'weekdays':
      return 'Weekdays';
    case 'weekly': {
      const names = [...repeat.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d]);
      return `${every('week')} on ${names.join(', ')}`;
    }
    case 'monthly':
      return every('month');
    case 'yearly':
      return every('year');
  }
}
