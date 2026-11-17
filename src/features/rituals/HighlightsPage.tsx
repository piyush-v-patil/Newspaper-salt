import { useMemo } from 'react';
import { NavToggle } from '@/app/LeftNav';
import { useShutdownDays, useTasksById } from '@/data/queries';
import { longDayLabel } from '@/domain/dates';

/** Each closed day's highlights and reflection, newest first. */
export function HighlightsPage() {
  const days = useShutdownDays();
  const ids = useMemo(() => [...new Set(days.flatMap((d) => d.highlights))].sort(), [days]);
  const tasks = useTasksById(ids);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-6">
        <NavToggle />
        <h1 className="text-[16px] font-semibold tracking-tight">Highlights</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[620px] flex-col gap-8 px-6 py-8">
          {days.length === 0 && (
            <p className="text-[14px] text-ink-2">
              Nothing here yet. Each day you finish with a shutdown leaves its highlights and reflection here.
            </p>
          )}
          {days.map((record) => (
            <article key={record.day} data-testid="highlight-day" className="flex flex-col gap-2.5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                {longDayLabel(record.day)}
                {record.mood && <span aria-label="Mood">{record.mood}</span>}
              </h2>
              <ul className="flex flex-col gap-1">
                {record.highlights.map((id) => (
                  <li key={id} className="flex gap-2 text-[14px]">
                    <span className="text-ink-3">•</span>
                    <span>{tasks.get(id)?.title ?? 'A task that has since been deleted'}</span>
                  </li>
                ))}
                {record.highlights.length === 0 && <li className="text-[14px] text-ink-3">No highlights picked.</li>}
              </ul>
              {record.reflection.trim() && <p className="whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-[14px] leading-relaxed text-ink-2">{record.reflection}</p>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
