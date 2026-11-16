import { Trash2 } from 'lucide-react';
import { deleteTask, setTaskCompleted } from '@/data/commands/tasks';
import type { Task } from '@/data/types';
import { formatMinutes } from '@/domain/dates';
import { CheckCircle } from '@/ui/CheckCircle';

export function TaskRow({ task }: { task: Task }) {
  const done = task.completedAt !== null;
  return (
    <li
      data-testid="task"
      className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-card transition-colors hover:border-line-strong"
    >
      <CheckCircle
        checked={done}
        onChange={(next) => void setTaskCompleted(task.id, next)}
        label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-[14.5px] transition-colors duration-200 ${
          done ? 'text-ink-3 line-through' : 'text-ink'
        }`}
      >
        {task.title}
      </span>
      {task.plannedMin !== null && <span className="tabular text-[12px] text-ink-3">{formatMinutes(task.plannedMin)}</span>}
      <button
        type="button"
        aria-label={`Delete ${task.title}`}
        onClick={() => void deleteTask(task.id)}
        className="grid h-6 w-6 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-hover hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
