import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useToday } from '@/app/useToday';
import { setObjectiveCompleted } from '@/data/commands/objectives';
import { useObjectives, useObjectiveTasks } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { weekLabel, weekStartOf } from '@/domain/weeks';
import { CheckCircle } from '@/ui/CheckCircle';

/** This week's objectives at a glance, beside any view. */
export function ObjectivesPanel() {
  const { weekStartsOn } = useSettings();
  const weekStart = weekStartOf(useToday(), weekStartsOn);
  const objectives = useObjectives(weekStart);
  const ids = useMemo(() => objectives.map((o) => o.id), [objectives]);
  const tasks = useObjectiveTasks(ids);

  return (
    <div className="flex h-full w-[300px] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="text-[13px] font-semibold">Weekly objectives</h2>
        <span className="text-[12.5px] text-ink-3">{weekLabel(weekStart)}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {objectives.length === 0 && <p className="px-1 text-[13px] text-ink-3">No objectives set for this week.</p>}
        {objectives.map((objective) => {
          const linked = tasks.get(objective.id) ?? [];
          const finished = linked.filter((t) => t.completedAt !== null).length;
          const done = objective.completedAt !== null;
          return (
            <div key={objective.id} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="pt-px">
                <CheckCircle checked={done} onChange={(next) => void setObjectiveCompleted(objective.id, next)} label={done ? `Reopen ${objective.title}` : `Complete ${objective.title}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`break-words text-[13.5px] leading-snug ${done ? 'text-ink-3 line-through' : ''}`}>{objective.title}</div>
                <div className="tabular mt-0.5 text-[11.5px] text-ink-3">{linked.length === 0 ? 'No tasks yet' : `${finished}/${linked.length} tasks done`}</div>
              </div>
            </div>
          );
        })}
        <Link to="/week" className="mt-1 self-start rounded px-1.5 py-1 text-[12.5px] text-accent hover:bg-accent-soft">
          Open This week
        </Link>
      </div>
    </div>
  );
}
