import { addDays, format, startOfWeek } from 'date-fns';
import { fromDay, shiftDay, toDay, weekdayOf, type Day } from './dates';

/** The first day of the week containing `day`. */
export function weekStartOf(day: Day, weekStartsOn: 0 | 1): Day {
  return toDay(startOfWeek(fromDay(day), { weekStartsOn }));
}

export function weekDays(weekStart: Day): Day[] {
  return Array.from({ length: 7 }, (_, i) => toDay(addDays(fromDay(weekStart), i)));
}

/** "Nov 16 – 22", or "Nov 30 – Dec 6" across a month boundary. */
export function weekLabel(weekStart: Day): string {
  const start = fromDay(weekStart);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${format(start, 'MMM d')} – ${format(end, sameMonth ? 'd' : 'MMM d')}`;
}

const THURSDAY = 4;
const WEDNESDAY = 3;

/** Weekly planning looks at this week until Wednesday; from Thursday it plans the next one. */
export function planningWeek(today: Day, weekStartsOn: 0 | 1): Day {
  const current = weekStartOf(today, weekStartsOn);
  const weekday = weekdayOf(today);
  // Sunday (0) is the tail of a Monday-start week and the head of a Sunday-start one.
  const late = weekStartsOn === 1 ? weekday === 0 || weekday >= THURSDAY : weekday >= THURSDAY;
  return late ? shiftDay(current, 7) : current;
}

/** Weekly review looks back at last week on Monday to Wednesday; later in the week it reviews the current one. */
export function reviewWeek(today: Day, weekStartsOn: 0 | 1): Day {
  const current = weekStartOf(today, weekStartsOn);
  const weekday = weekdayOf(today);
  const early = weekStartsOn === 1 ? weekday >= 1 && weekday <= WEDNESDAY : weekday <= WEDNESDAY;
  return early ? shiftDay(current, -7) : current;
}
