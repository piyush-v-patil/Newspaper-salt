import { moveTask } from '@/data/commands/tasks';
import { useDueElsewhere } from '@/data/queries';
import { BACKLOG } from '@/data/types';
import { dueLabel, shortDate } from '@/domain/dayLabels';
import type { Day } from '@/domain/dates';
import { useOpenTask } from '@/features/task/useOpenTask';

/** Tasks due by today that sit on another day or in the backlog, each a click away from today's list. */
export function DueNotice({ day }: { day: Day }) {
  const due = useDueElsewhere(day);
  const openTask = useOpenTask();
  if (due.length === 0) return null;
  return (
    <section aria-label="Due elsewhere" className="mt-1 flex flex-col gap-1 rounded-lg border border-dashed border-over/40 px-3 py-2">
      <p className="text-[12px] font-medium text-over">Due, but not planned for this day</p>
      <ul className="flex flex-col">
        {due.map((task) => (
          <li key={task.id} className="flex items-center gap-2 py-0.5 text-[12.5px]">
            <button type="button" onClick={() => openTask(task.id)} className="min-w-0 flex-1 truncate text-left text-ink hover:underline">
              {task.title}
            </button>
            <span className="shrink-0 text-ink-3" title={task.day === BACKLOG ? 'In the backlog' : `Planned for ${shortDate(task.day)}`}>
              {dueLabel(task.dueDay!, day)}
            </span>
            <button
              type="button"
              onClick={() => void moveTask(task.id, day, 'bottom')}
              aria-label={`Move ${task.title} here`}
              className="shrink-0 rounded px-1.5 text-[12px] font-medium text-accent hover:bg-hover"
            >
              Move here
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
