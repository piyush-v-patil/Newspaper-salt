import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useToday } from '@/app/useToday';
import { useUi } from '@/app/uiStore';
import { useChannelMap } from '@/data/ReferenceData';
import { useTasksInRange, useWorkedOn } from '@/data/queries';
import type { WorkedOn } from '@/domain/workedOn';
import { WorkedOnCards } from '@/features/task/WorkedOnCards';
import type { Task } from '@/data/types';
import { shiftDay, type Day } from '@/domain/dates';
import { monthLabel, shortDate, weekdayName } from '@/domain/dayLabels';
import { matchesFilter } from '@/domain/filter';
import { DayHeading, SortButton } from '@/features/common/DayHeading';
import { ViewHeader } from '@/features/common/ViewHeader';
import { useDayKeys } from '@/features/common/useDayKeys';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskList, useTaskLists } from '@/features/task/TaskDnd';
import { WorkloadCounter } from '@/features/task/WorkloadCounter';

const COLUMN_WIDTH = 280;
// Each column carries its gap as left padding, so snapping a day to the left
// edge leaves no sliver of the day before it.
const GAP = 24;
const STRIDE = COLUMN_WIDTH + GAP;
const PAGE = 7;
const NONE: WorkedOn[] = [];

function DayColumn({ day, tasks, worked, isToday, onFocus }: { day: Day; tasks: Task[]; worked: WorkedOn[]; isToday: boolean; onFocus: () => void }) {
  return (
    <section aria-label={`${weekdayName(day)} ${shortDate(day)}`} data-day={day} className="flex h-full shrink-0 flex-col" style={{ width: STRIDE, paddingLeft: GAP }}>
      <div className="flex flex-col gap-3 px-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <DayHeading day={day} isToday={isToday} level={2} onClick={onFocus} />
          <SortButton day={day} />
        </div>
        <WorkloadCounter day={day} tasks={tasks} />
      </div>
      <AddTaskRow day={day} tasks={tasks} />
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-6">
        <TaskList listId={day} tasks={tasks} className={worked.length ? '' : 'min-h-full'} />
        <WorkedOnCards items={worked} />
      </div>
    </section>
  );
}

export function BoardPage() {
  const current = useToday();
  // The window of days rendered, as offsets from today. It grows as you scroll.
  const [range, setRange] = useState({ start: -PAGE, end: PAGE * 2 });
  const [leftmost, setLeftmost] = useState<Day>(current);
  const scroller = useRef<HTMLDivElement>(null);
  const prepended = useRef(0);
  const filter = useUi((s) => s.filter);
  const setFocusedDay = useUi((s) => s.setFocusedDay);
  const channels = useChannelMap();

  const days = useMemo(() => {
    const list: Day[] = [];
    for (let offset = range.start; offset <= range.end; offset++) list.push(shiftDay(current, offset));
    return list;
  }, [current, range]);

  const grouped = useTasksInRange(days[0], days[days.length - 1]);
  const lists = useMemo(() => {
    const result: Record<string, Task[]> = {};
    for (const day of days) result[day] = (grouped?.get(day) ?? []).filter((t) => matchesFilter(t, filter, channels));
    return result;
  }, [days, grouped, filter, channels]);
  const ordered = useTaskLists('board', lists);
  const worked = useWorkedOn(days, current);

  const scrollToDay = useCallback(
    (day: Day, behavior: ScrollBehavior = 'smooth') => {
      const index = days.indexOf(day);
      if (index >= 0) scroller.current?.scrollTo({ left: index * STRIDE, behavior });
    },
    [days],
  );

  // Start with today at the left edge.
  useLayoutEffect(() => {
    scroller.current?.scrollTo({ left: -range.start * STRIDE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When earlier days are added on the left, hold the view still.
  useLayoutEffect(() => {
    if (prepended.current && scroller.current) {
      scroller.current.scrollLeft += prepended.current * STRIDE;
      prepended.current = 0;
    }
  }, [range.start]);

  useEffect(() => {
    setFocusedDay(current);
    return () => setFocusedDay(null);
  }, [current, setFocusedDay]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const index = Math.max(0, Math.min(days.length - 1, Math.round(el.scrollLeft / STRIDE)));
    setLeftmost(days[index]);
    if (el.scrollLeft < STRIDE * 2 && prepended.current === 0) {
      prepended.current = PAGE;
      setRange((r) => ({ ...r, start: r.start - PAGE }));
    } else if (el.scrollLeft + el.clientWidth > el.scrollWidth - STRIDE * 2) {
      setRange((r) => ({ ...r, end: r.end + PAGE }));
    }
  }

  const step = (amount: number) => scroller.current?.scrollBy({ left: amount * STRIDE, behavior: 'smooth' });
  useDayKeys({ previous: () => step(-1), next: () => step(1), today: () => scrollToDay(current) });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title={monthLabel(leftmost)} onPrevious={() => step(-1)} onNext={() => step(1)} onToday={() => scrollToDay(current)} />
      <div ref={scroller} onScroll={onScroll} data-testid="board" className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden pt-5">
        {days.map((day) => (
          <DayColumn
            key={day}
            day={day}
            tasks={ordered[day] ?? []}
            worked={worked.get(day) ?? NONE}
            isToday={day === current}
            onFocus={() => setFocusedDay(day)}
          />
        ))}
        {/* Lets the last column scroll all the way to the left edge. */}
        <div className="shrink-0" style={{ width: '60vw' }} />
      </div>
    </div>
  );
}
