import { format } from 'date-fns';
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
