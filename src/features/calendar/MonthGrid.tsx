import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { useMemo } from 'react';
import { useSchedule, useTasksInRange } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { formatClock, fromDay, toDay, type Day } from '@/domain/dates';

const MAX_ITEMS = 4;

/** A month at a glance: each day's events and tasks. Clicking a day opens it. */
export function MonthGrid({ anchor, today, onOpenDay }: { anchor: Day; today: Day; onOpenDay: (day: Day) => void }) {
  const { weekStartsOn, timeFormat } = useSettings();
  const month = fromDay(anchor).getMonth();

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(fromDay(anchor)), { weekStartsOn });
    const last = endOfMonth(fromDay(anchor));
    const list: Day[] = [];
    for (let d = first; list.length < 42 && (d <= last || list.length % 7 !== 0); d = addDays(d, 1)) list.push(toDay(d));
    return list;
  }, [anchor, weekStartsOn]);

  const tasks = useTasksInRange(days[0], days[days.length - 1]);
  const schedule = useSchedule(days);
  const weekdayNames = days.slice(0, 7).map((d) => format(fromDay(d), 'EEE'));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {weekdayNames.map((name) => (
          <div key={name} className="px-2 py-2 text-[12px] font-medium text-ink-3">
            {name}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridAutoRows: '1fr' }} data-testid="month-grid">
        {days.map((day) => {
          const events = (schedule?.events ?? []).filter((e) => e.day === day).sort((a, b) => a.startMin - b.startMin);
          const dayTasks = (tasks?.get(day) ?? []).filter((t) => t.kind === 'task');
          const items = [
            ...events.map((e) => ({ key: e.id, text: e.title, time: formatClock(e.startMin, timeFormat), done: false, event: true })),
            ...dayTasks.map((t) => ({ key: t.id, text: t.title, time: null, done: t.completedAt !== null, event: false })),
          ];
          const inMonth = fromDay(day).getMonth() === month;
          return (
            <button
              key={day}
              type="button"
              data-month-day={day}
              onClick={() => onOpenDay(day)}
              aria-label={`${format(fromDay(day), 'EEEE, MMMM d')}: ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
              className={`flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-line p-1.5 text-left transition-colors hover:bg-hover ${inMonth ? '' : 'bg-panel/60'}`}
            >
              <span
                className={`tabular mb-0.5 grid h-6 w-6 place-items-center rounded-full text-[12.5px] ${
                  day === today ? 'bg-accent font-semibold text-white' : inMonth ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {fromDay(day).getDate()}
              </span>
              {items.slice(0, MAX_ITEMS).map((item) => (
                <span
                  key={item.key}
                  className={`truncate rounded px-1 text-[11.5px] leading-[18px] ${item.event ? 'bg-hover text-ink-2' : item.done ? 'text-ink-3 line-through' : 'text-ink'}`}
                >
                  {item.time && <span className="tabular mr-1 text-ink-3">{item.time}</span>}
                  {item.text}
                </span>
              ))}
              {items.length > MAX_ITEMS && <span className="px-1 text-[11px] text-ink-3">{items.length - MAX_ITEMS} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
