import { addDays, format, startOfWeek } from 'date-fns';
import { fromDay, shiftDay, toDay, type Day } from './dates';

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
