import { useNavigate } from '@tanstack/react-router';
import { useToday } from '@/app/useToday';
import { useEffect, useMemo } from 'react';
import { useUi } from '@/app/uiStore';
import { useTasksForDay, useWorkedOn } from '@/data/queries';
import { useChannelMap } from '@/data/ReferenceData';
import { shiftDay, type Day } from '@/domain/dates';
import { matchesFilter } from '@/domain/filter';
import { DayHeading, SortButton } from '@/features/common/DayHeading';
import { ViewHeader } from '@/features/common/ViewHeader';
import { useLayout } from '@/app/useLayout';
import { TodayObjectives } from './TodayObjectives';
import { useDayKeys } from '@/features/common/useDayKeys';
import { ArchiveNotice } from '@/features/lists/ArchiveNotice';
import { DueNotice } from './DueNotice';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskList, useTaskLists } from '@/features/task/TaskDnd';
import { WorkloadCounter } from '@/features/task/WorkloadCounter';
import { WorkedOnCards } from '@/features/task/WorkedOnCards';

export function TodayPage({ date }: { date?: Day }) {
  const navigate = useNavigate();
  const current = useToday();
  const day = date ?? current;
  const all = useTasksForDay(day);
  const filter = useUi((s) => s.filter);
  const setFocusedDay = useUi((s) => s.setFocusedDay);
  const channels = useChannelMap();

  const tasks = useMemo(() => all?.filter((t) => matchesFilter(t, filter, channels)), [all, filter, channels]);
  const lists = useMemo(() => ({ [day]: tasks ?? [] }), [day, tasks]);
  const ordered = useTaskLists('today', lists);
  const workedDays = useMemo(() => [day], [day]);
  const worked = useWorkedOn(workedDays, current);

  useEffect(() => {
    setFocusedDay(day);
    return () => setFocusedDay(null);
  }, [day, setFocusedDay]);

  const go = (next: Day) => void navigate({ to: '/today', search: next === current ? {} : { date: next } });
  useDayKeys({ previous: () => go(shiftDay(day, -1)), next: () => go(shiftDay(day, 1)), today: () => go(current) });

  const { compactNav } = useLayout();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onPrevious={() => go(shiftDay(day, -1))} onNext={() => go(shiftDay(day, 1))} onToday={() => go(current)} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-4">
        <div className="mx-auto flex w-full max-w-[640px] justify-center gap-10">
          {/* The objectives column steps aside in narrow windows. */}
          {!compactNav && <TodayObjectives day={day} tasks={tasks ?? []} />}
          <section aria-label="Tasks" className="flex w-full max-w-[300px] flex-col gap-2.5">
            <div className="flex flex-col gap-3 pb-1">
              <div className="flex items-start justify-between gap-2">
                <DayHeading day={day} isToday={day === current} />
                <SortButton day={day} />
              </div>
              <WorkloadCounter day={day} tasks={tasks ?? []} />
            </div>
            <AddTaskRow day={day} tasks={tasks} />
            {tasks && tasks.length === 0 && (
              <p className="px-1 pt-2 text-[13px] text-ink-3">
                {filter ? 'No tasks match this filter on this day.' : 'Nothing planned for this day yet.'} Press{' '}
                <span className="font-medium text-ink-2">A</span> to add a task.
              </p>
            )}
            <TaskList listId={day} tasks={ordered[day] ?? []} />
            <WorkedOnCards items={worked.get(day) ?? []} />
            {day === current && <DueNotice day={day} />}
            {day === current && <ArchiveNotice day={day} />}
          </section>
        </div>
      </div>
    </div>
  );
}
