import { useMemo } from 'react';
import { useToday } from '@/app/useToday';
import { useUi } from '@/app/uiStore';
import { useTasksForDay } from '@/data/queries';
import { useChannelMap } from '@/data/ReferenceData';
import { relativeDayLabel } from '@/domain/dayLabels';
import { matchesFilter } from '@/domain/filter';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskList, useTaskLists } from '@/features/task/TaskDnd';
import { WorkloadCounter } from '@/features/task/WorkloadCounter';

/** The focused day's task list, shown beside the Calendar view so tasks can be dragged onto it. */
export function TasksPanel() {
  const current = useToday();
  const day = useUi((s) => s.focusedDay) ?? current;
  const filter = useUi((s) => s.filter);
  const channels = useChannelMap();
  const all = useTasksForDay(day);
  const tasks = useMemo(() => (all ?? []).filter((t) => matchesFilter(t, filter, channels)), [all, filter, channels]);
  const lists = useMemo(() => ({ [day]: tasks }), [day, tasks]);
  const ordered = useTaskLists('panel', lists);

  return (
    <div className="flex h-full w-[max(300px,100%)] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="text-[13px] font-semibold">Tasks</h2>
        <span className="text-[12.5px] text-ink-3">{relativeDayLabel(day, current)}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <WorkloadCounter day={day} tasks={tasks} />
        <AddTaskRow day={day} tasks={tasks} />
        <TaskList listId={day} tasks={ordered[day] ?? []} className="min-h-24" />
      </div>
    </div>
  );
}
