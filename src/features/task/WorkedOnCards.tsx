import { formatMinutes } from '@/domain/dates';
import type { WorkedOn } from '@/domain/workedOn';
import { useOpenTask } from './useOpenTask';

/** Faded, read-only copies of work done on this day for tasks that have since moved on. */
export function WorkedOnCards({ items }: { items: WorkedOn[] }) {
  const openTask = useOpenTask();
  if (items.length === 0) return null;
  return (
    <ul aria-label="Worked on this day" className="mt-2 flex flex-col gap-2">
      {items.map(({ task, minutes, subtasksDone }) => (
        <li key={task.id}>
          <button
            type="button"
            data-testid="worked-on"
            onClick={() => openTask(task.id)}
            title="Worked on this day; the task has since moved on"
            className="flex w-full items-start gap-2.5 rounded-lg border border-dashed border-line px-3 py-2.5 text-left opacity-70 transition-opacity hover:opacity-100"
          >
            <span className="min-w-0 flex-1 break-words text-[14px] leading-snug text-ink-2">{task.title}</span>
            <span className="tabular shrink-0 text-[12px] text-ink-3">
              {minutes > 0 ? formatMinutes(minutes) : `${subtasksDone} ${subtasksDone === 1 ? 'step' : 'steps'}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
