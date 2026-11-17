import { Plus } from 'lucide-react';
import { useUi } from '@/app/uiStore';
import type { Id, Task, TaskDay } from '@/data/types';
import { formatMinutes } from '@/domain/dates';

interface Props {
  day: TaskDay;
  /** The list's tasks, for the planned-total badge. */
  tasks?: Task[];
  /** Backlog only: new tasks go into this folder. */
  folderId?: Id | null;
  placeholder?: string;
}

/** "+ Add task" at the top of a list. Opens the add-task card over this row. */
export function AddTaskRow({ day, tasks, folderId, placeholder = 'Add task' }: Props) {
  const total = (tasks ?? []).filter((t) => t.kind === 'task').reduce((sum, t) => sum + (t.plannedMin ?? 0), 0);
  return (
    <button
      type="button"
      aria-label={`Add task to ${day}`}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        useUi.getState().openAddTask(day, { top: rect.top, left: rect.left }, folderId ?? null);
      }}
      className="flex w-full items-center gap-2.5 rounded-lg bg-surface px-3 py-2 text-left text-ink-3 shadow-card transition-colors hover:text-ink-2"
    >
      <Plus size={15} />
      <span className="flex-1 text-[14px]">{placeholder}</span>
      {total > 0 && <span className="tabular rounded bg-hover px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2">{formatMinutes(total)}</span>}
    </button>
  );
}
