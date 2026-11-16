import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { useTasksForDay } from '@/data/queries';
import { today } from '@/domain/clock';
import { longDayLabel, shiftDay, type Day } from '@/domain/dates';
import { AddTask } from './AddTask';
import { TaskRow } from './TaskRow';

export function TodayPage({ date }: { date?: Day }) {
  const navigate = useNavigate();
  const current = today();
  const day = date ?? current;
  const tasks = useTasksForDay(day);

  const go = (next: Day) => void navigate({ to: '/today', search: next === current ? {} : { date: next } });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'ArrowLeft') go(shiftDay(day, -1));
      else if (e.key === 'ArrowRight') go(shiftDay(day, 1));
      else if (e.key === ' ') {
        e.preventDefault();
        go(current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const open = tasks?.filter((t) => t.completedAt === null).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-6">
        <div className="flex items-center">
          <button type="button" aria-label="Previous day" onClick={() => go(shiftDay(day, -1))} className="grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-hover">
            <ChevronLeft size={16} />
          </button>
          <button type="button" aria-label="Next day" onClick={() => go(shiftDay(day, 1))} className="grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-hover">
            <ChevronRight size={16} />
          </button>
        </div>
        <h1 className="text-[16px] font-semibold tracking-tight">{longDayLabel(day)}</h1>
        {day !== current && (
          <button type="button" onClick={() => go(current)} className="ml-2 rounded-md border border-line px-2.5 py-1 text-[12.5px] text-ink-2 hover:bg-hover">
            Back to today
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <section aria-label="Tasks" className="mx-auto flex w-full max-w-[460px] flex-col gap-2">
          <div className="flex items-baseline justify-between pb-1">
            <h2 className="text-[13px] font-semibold">{day === current ? 'Today' : 'Tasks'}</h2>
            {tasks && tasks.length > 0 && (
              <span className="tabular text-[12px] text-ink-3">
                {open === 0 ? 'All done' : `${open} to do`}
              </span>
            )}
          </div>
          <AddTask day={day} />
          {tasks && tasks.length === 0 && (
            <p className="px-1 pt-3 text-[13px] text-ink-3">
              Nothing planned for this day yet. Press <span className="font-medium text-ink-2">A</span> to add your first task.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {tasks?.map((task) => <TaskRow key={task.id} task={task} />)}
          </ul>
        </section>
      </div>
    </div>
  );
}
