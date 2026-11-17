import { format } from 'date-fns';
import { ArrowDownUp } from 'lucide-react';
import { sortDay } from '@/data/commands/tasks';
import { fromDay, type Day } from '@/domain/dates';

/** "Tuesday" over "November 17", as at the top of each day's list. */
export function DayHeading({ day, isToday, level = 1, onClick }: { day: Day; isToday: boolean; level?: 1 | 2; onClick?: () => void }) {
  const date = fromDay(day);
  const Tag = level === 1 ? 'h1' : 'h2';
  const body = (
    <Tag className="flex flex-col">
      <span className={`text-[20px] font-semibold leading-tight tracking-tight ${isToday ? 'text-ink' : 'text-ink-2'}`}>{format(date, 'EEEE')}</span>
      <span className="text-[14px] text-ink-2">{format(date, 'MMMM d')}</span>
    </Tag>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded text-left">
      {body}
    </button>
  ) : (
    body
  );
}

/** Puts the day's list in order: timeboxed tasks by time, then by priority, finished ones last. */
export function SortButton({ day }: { day: Day }) {
  return (
    <button
      type="button"
      aria-label="Sort tasks"
      title="Sort: timeboxed by time, then by priority"
      onClick={() => void sortDay(day)}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
    >
      <ArrowDownUp size={14} />
    </button>
  );
}
