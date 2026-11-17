import { Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavToggle } from '@/app/LeftNav';
import { toggleHighlightStar } from '@/data/commands/days';
import { useShutdownDays, useTasksById } from '@/data/queries';
import { longDayLabel } from '@/domain/dates';

/** Each closed day's highlights and reflection, newest first. Starred highlights lead, and can be shown on their own. */
export function HighlightsPage() {
  const days = useShutdownDays();
  const ids = useMemo(() => [...new Set(days.flatMap((d) => d.highlights))].sort(), [days]);
  const tasks = useTasksById(ids);
  const [starredOnly, setStarredOnly] = useState(false);
  const shown = starredOnly ? days.filter((d) => (d.starred ?? []).some((id) => d.highlights.includes(id))) : days;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6">
        <NavToggle />
        <h1 className="text-[16px] font-semibold tracking-tight">Highlights</h1>
        <button
          type="button"
          aria-pressed={starredOnly}
          onClick={() => setStarredOnly(!starredOnly)}
          className={`ml-auto flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12.5px] ${
            starredOnly ? 'border-warn/50 bg-warn/10 text-warn' : 'border-line text-ink-2 hover:bg-hover'
          }`}
        >
          <Star size={13} fill={starredOnly ? 'currentColor' : 'none'} /> Starred only
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[620px] flex-col gap-8 px-6 py-8">
          {days.length === 0 && (
            <p className="text-[14px] text-ink-2">
              Nothing here yet. Each day you finish with a shutdown leaves its highlights and reflection here.
            </p>
          )}
          {days.length > 0 && shown.length === 0 && <p className="text-[14px] text-ink-2">No starred highlights yet. Star the ones that mattered most, here or during a shutdown.</p>}
          {shown.map((record) => {
            const starred = record.starred ?? [];
            const list = [...record.highlights.filter((id) => starred.includes(id)), ...record.highlights.filter((id) => !starred.includes(id) && !starredOnly)];
            return (
              <article key={record.day} data-testid="highlight-day" className="flex flex-col gap-2.5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  {longDayLabel(record.day)}
                  {record.mood && <span aria-label="Mood">{record.mood}</span>}
                </h2>
                <ul className="flex flex-col gap-1">
                  {list.map((id) => {
                    const star = starred.includes(id);
                    const title = tasks.get(id)?.title ?? 'A task that has since been deleted';
                    return (
                      <li key={id} className="group flex items-center gap-2 text-[14px]">
                        <button
                          type="button"
                          aria-pressed={star}
                          aria-label={star ? `Unstar ${title}` : `Star ${title}`}
                          onClick={() => void toggleHighlightStar(record.day, id)}
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded ${star ? 'text-warn' : 'text-ink-3 opacity-40 hover:text-warn hover:opacity-100 group-hover:opacity-100'}`}
                        >
                          <Star size={14} fill={star ? 'currentColor' : 'none'} />
                        </button>
                        <span className={star ? 'font-medium' : ''}>{title}</span>
                      </li>
                    );
                  })}
                  {record.highlights.length === 0 && <li className="text-[14px] text-ink-3">No highlights picked.</li>}
                </ul>
                {!starredOnly && record.reflection.trim() && (
                  <p className="whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-[14px] leading-relaxed text-ink-2">{record.reflection}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
