import { useRouterState } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useUi } from '@/app/uiStore';
import { useTasksForDay } from '@/data/queries';
import { useChannelMap } from '@/data/ReferenceData';
import { BACKLOG } from '@/data/types';
import { matchesFilter } from '@/domain/filter';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskList, useTaskLists } from '@/features/task/TaskDnd';

function BacklogList() {
  const all = useTasksForDay(BACKLOG);
  const filter = useUi((s) => s.filter);
  const channels = useChannelMap();
  const tasks = useMemo(() => (all ?? []).filter((t) => matchesFilter(t, filter, channels)), [all, filter, channels]);
  const lists = useMemo(() => ({ [BACKLOG]: tasks }), [tasks]);
  const ordered = useTaskLists('backlog-panel', lists);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
      <AddTaskRow day={BACKLOG} />
      <TaskList listId={BACKLOG} tasks={ordered[BACKLOG] ?? []} className="min-h-24" />
    </div>
  );
}

/** A compact backlog beside any view: drag a task out onto a day, or onto it to put one away. */
export function BacklogPanel() {
  // The full backlog page already lists these tasks; showing them twice would give each two homes to drag from.
  const onBacklogPage = useRouterState({ select: (s) => s.location.pathname === '/backlog' });
  return (
    <div className="flex h-full w-[max(300px,100%)] flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <h2 className="text-[13px] font-semibold">Backlog</h2>
      </div>
      {onBacklogPage ? <p className="p-4 text-[13px] text-ink-3">The backlog is open in the main view.</p> : <BacklogList />}
    </div>
  );
}
