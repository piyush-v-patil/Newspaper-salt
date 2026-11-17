import { useNavigate } from '@tanstack/react-router';
import { useToday } from '@/app/useToday';
import { addDays, startOfWeek } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { useUi, type CalendarSpan } from '@/app/uiStore';
import { useSettings } from '@/data/ReferenceData';
import { fromDay, shiftDay, toDay, type Day } from '@/domain/dates';
import { monthLabel } from '@/domain/dayLabels';
import { ViewHeader } from '@/features/common/ViewHeader';
import { useDayKeys } from '@/features/common/useDayKeys';
import { TimeGrid } from './TimeGrid';

const SPANS: { value: CalendarSpan; label: string; days: number }[] = [
  { value: 'day', label: 'Day', days: 1 },
  { value: '3day', label: '3 days', days: 3 },
  { value: 'week', label: 'Week', days: 7 },
];

/** The calendar in the centre, with the day's tasks in the right panel to drag from. */
export function CalendarPage({ date }: { date?: Day }) {
  const navigate = useNavigate();
  const { weekStartsOn } = useSettings();
  const span = useUi((s) => s.calendarSpan);
  const setSpan = useUi((s) => s.setCalendarSpan);
  const setFocusedDay = useUi((s) => s.setFocusedDay);
  const current = useToday();
  const anchor = date ?? current;
  const length = SPANS.find((s) => s.value === span)?.days ?? 7;

  const days = useMemo(() => {
    const first = span === 'week' ? toDay(startOfWeek(fromDay(anchor), { weekStartsOn })) : anchor;
    return Array.from({ length }, (_, i) => toDay(addDays(fromDay(first), i)));
  }, [anchor, span, length, weekStartsOn]);

  // The task panel follows the day in view: today if it is showing, else the first day.
  const focus = days.includes(anchor) && span !== 'week' ? anchor : days.includes(current) ? current : days[0];
  useEffect(() => {
    setFocusedDay(focus);
    return () => setFocusedDay(null);
  }, [focus, setFocusedDay]);

  const go = (next: Day) => void navigate({ to: '/calendar', search: next === current ? {} : { date: next } });
  const step = (direction: number) => go(shiftDay(anchor, direction * length));
  useDayKeys({ previous: () => step(-1), next: () => step(1), today: () => go(current) });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={monthLabel(days[0])}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        onBackToToday={days.includes(current) ? undefined : () => go(current)}
      >
        <div role="group" aria-label="Calendar range" className="flex h-7 items-center rounded-md border border-line p-0.5">
          {SPANS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={span === s.value}
              onClick={() => setSpan(s.value)}
              className={`h-full rounded px-2 text-[12.5px] ${span === s.value ? 'bg-hover font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </ViewHeader>
      <TimeGrid days={days} showHeader />
    </div>
  );
}
