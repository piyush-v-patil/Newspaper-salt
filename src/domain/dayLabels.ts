import { addDays, addYears, format, parse, startOfWeek } from 'date-fns';
import { daysBetween, fromDay, shiftDay, toDay, type Day } from './dates';

/** "Today", "Tomorrow", "Yesterday", otherwise "Mon, Nov 23". */
export function relativeDayLabel(day: Day, today: Day): string {
  if (day === today) return 'Today';
  if (day === shiftDay(today, 1)) return 'Tomorrow';
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return format(fromDay(day), 'EEE, MMM d');
}

export function weekdayName(day: Day): string {
  return format(fromDay(day), 'EEEE');
}

export function shortDate(day: Day): string {
  return format(fromDay(day), 'MMM d');
}

export function monthLabel(day: Day): string {
  return format(fromDay(day), 'MMMM yyyy');
}

/** First day of the week after the one containing `day`. */
export function nextWeekStart(day: Day, weekStartsOn: 0 | 1): Day {
  return toDay(addDays(startOfWeek(fromDay(day), { weekStartsOn }), 7));
}

const TYPED_FORMATS = ['MMM d', 'MMMM d', 'd MMM', 'd MMMM', 'M/d', 'MMM d yyyy', 'MMMM d yyyy', 'd MMM yyyy', 'M/d/yyyy', 'yyyy-MM-dd'];

/**
 * A date typed by hand, such as "dec 3", "3 December" or "12/3". Without a
 * year it means the next time that date comes round (today counts).
 */
export function parseTypedDay(text: string, today: Day): Day | null {
  const q = text.trim().replace(/,/g, '').replace(/\s+/g, ' ');
  if (!/\d/.test(q)) return null;
  const base = fromDay(today);
  for (const pattern of TYPED_FORMATS) {
    const date = parse(q, pattern, base);
    if (Number.isNaN(date.getTime())) continue;
    let day = toDay(date);
    if (!pattern.includes('y') && day < today) day = toDay(addYears(date, 1));
    return day;
  }
  return null;
}

/** How a due date reads on a card: "Due today", "Due Fri", "Due Dec 3"; past ones say so. */
export function dueLabel(due: Day, today: Day): string {
  const diff = daysBetween(today, due);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff === -1) return 'Due yesterday';
  if (diff > 1 && diff < 7) return `Due ${format(fromDay(due), 'EEE')}`;
  return `Due ${format(fromDay(due), 'MMM d')}`;
}
