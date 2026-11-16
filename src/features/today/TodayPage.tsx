import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { useUi } from '@/app/uiStore';
import { useTasksForDay } from '@/data/queries';
import { useChannelMap } from '@/data/ReferenceData';
import { today } from '@/domain/clock';
import { formatMinutes, longDayLabel, shiftDay, type Day } from '@/domain/dates';
import { matchesFilter } from '@/domain/filter';
import { ViewHeader } from '@/features/common/ViewHeader';
import { useDayKeys } from '@/features/common/useDayKeys';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskDataProvider } from '@/features/task/TaskData';
import { TaskDnd, TaskList } from '@/features/task/TaskDnd';

export function TodayPage({ date }: { date?: Day }) {
  const navigate = useNavigate();
  const current = today();
  const day = date ?? current;
  const all = useTasksForDay(day);
  const filter = useUi((s) => s.filter);
  const setFocusedDay = useUi((s) => s.setFocusedDay);
  const channels = useChannelMap();

  const tasks = useMemo(() => all?.filter((t) => matchesFilter(t, filter, channels)), [all, filter, channels]);
  const lists = useMemo(() => ({ [day]: tasks ?? [] }), [day, tasks]);

  useEffect(() => {
    setFocusedDay(day);
    return () => setFocusedDay(null);
  }, [day, setFocusedDay]);

  const go = (next: Day) => void navigate({ to: '/today', search: next === current ? {} : { date: next } });
  useDayKeys({ previous: () => go(shiftDay(day, -1)), next: () => go(shiftDay(day, 1)), today: () => go(current) });

  const open = tasks?.filter((t) => t.completedAt === null) ?? [];
  const remaining = open.reduce((sum, t) => sum + (t.plannedMin ?? 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={longDayLabel(day)}
        onPrevious={() => go(shiftDay(day, -1))}
        onNext={() => go(shiftDay(day, 1))}
        onBackToToday={day !== current ? () => go(current) : undefined}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <section aria-label="Tasks" className="mx-auto flex w-full max-w-[460px] flex-col gap-2">
          <div className="flex items-baseline justify-between pb-1">
            <h2 className="text-[13px] font-semibold">{day === current ? 'Today' : 'Tasks'}</h2>
            {tasks && tasks.length > 0 && (
              <span className="tabular text-[12px] text-ink-3">
                {open.length === 0 ? 'All done' : remaining > 0 ? `${formatMinutes(remaining)} left` : `${open.length} to do`}
              </span>
            )}
          </div>
          <AddTaskRow day={day} />
          {tasks && tasks.length === 0 && (
            <p className="px-1 pt-3 text-[13px] text-ink-3">
              {filter ? 'No tasks match this filter on this day.' : 'Nothing planned for this day yet.'} Press{' '}
              <span className="font-medium text-ink-2">A</span> to add a task.
            </p>
          )}
          <TaskDataProvider tasks={tasks ?? []}>
            <TaskDnd lists={lists}>{(ordered) => <TaskList listId={day} tasks={ordered[day] ?? []} />}</TaskDnd>
          </TaskDataProvider>
        </section>
      </div>
    </div>
  );
}
