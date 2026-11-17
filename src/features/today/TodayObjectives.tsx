import { Link } from '@tanstack/react-router';
import { Plus, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createObjective } from '@/data/commands/objectives';
import { useObjectives, useObjectiveTasks } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import type { Task } from '@/data/types';
import type { Day } from '@/domain/dates';
import { weekStartOf } from '@/domain/weeks';

/**
 * This week's objectives beside the day's list. Objectives with nothing
 * on this day are dimmed, so it is clear which ones the day is moving.
 */
export function TodayObjectives({ day, tasks }: { day: Day; tasks: Task[] }) {
  const { weekStartsOn } = useSettings();
  const weekStart = weekStartOf(day, weekStartsOn);
  const objectives = useObjectives(weekStart);
  const ids = useMemo(() => objectives.map((o) => o.id), [objectives]);
  const linked = useObjectiveTasks(ids);
  const onDay = useMemo(() => new Set(tasks.flatMap((t) => (t.objectiveId ? [t.objectiveId] : []))), [tasks]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  async function add() {
    const title = draft;
    setDraft('');
    setAdding(false);
    if (title.trim()) await createObjective(weekStart, title);
  }

  return (
    <section aria-label="This week's objectives" className="flex w-[240px] shrink-0 flex-col gap-1.5 pt-[104px]">
      <h2 className="pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-3">This week’s objectives</h2>
      {objectives.length === 0 && (
        <p className="flex items-center gap-2 py-1 text-[14px] text-ink-3">
          <Target size={15} /> No objectives for this week
        </p>
      )}
      {objectives.map((objective) => {
        const done = objective.completedAt !== null;
        const tasksOnDay = onDay.has(objective.id);
        const all = linked.get(objective.id) ?? [];
        return (
          <Link
            key={objective.id}
            to="/week"
            data-testid="today-objective"
            className={`flex items-start gap-2 rounded-md px-1 py-1 text-[14px] hover:bg-hover ${tasksOnDay ? 'text-ink' : 'text-ink-3'}`}
          >
            <Target size={15} className={`mt-0.5 shrink-0 ${done ? 'text-done' : ''}`} />
            <span className={`min-w-0 flex-1 break-words leading-snug ${done ? 'line-through' : ''}`}>{objective.title}</span>
            {all.length > 0 && (
              <span className="tabular shrink-0 pt-0.5 text-[11.5px] text-ink-3">
                {all.filter((t) => t.completedAt !== null).length}/{all.length}
              </span>
            )}
          </Link>
        );
      })}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void add()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
            if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          placeholder="What would make this week a good one?"
          aria-label="Add objective"
          className="rounded-md border border-accent bg-surface px-2 py-1.5 text-[14px] outline-none"
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-md px-1 py-1 text-left text-[14px] text-ink-3 hover:bg-hover hover:text-ink-2">
          <Plus size={15} /> Add objective
        </button>
      )}
    </section>
  );
}
