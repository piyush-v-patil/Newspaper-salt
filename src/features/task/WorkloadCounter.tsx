import { useMemo } from 'react';
import { useUi } from '@/app/uiStore';
import { useChannelMap, useContexts, useSettings } from '@/data/ReferenceData';
import type { Task } from '@/data/types';
import { today } from '@/domain/clock';
import { formatMinutes, type Day } from '@/domain/dates';
import { dayWorkload, workloadLevel } from '@/domain/workload';

const TEXT = { ok: 'text-ink-3', near: 'text-warn', over: 'text-over' };
const FILL = { ok: 'bg-done', near: 'bg-warn', over: 'bg-over' };

/**
 * Planned time for a day against the workload threshold. Only work tasks
 * count toward the threshold. Clicking switches between all tasks and work
 * tasks only.
 */
export function WorkloadCounter({ day, tasks }: { day: Day; tasks: Task[] }) {
  const settings = useSettings();
  const channels = useChannelMap();
  const contexts = useContexts();
  const mode = useUi((s) => s.workloadMode);
  const cycle = useUi((s) => s.cycleWorkloadMode);

  const workload = useMemo(() => {
    const personal = new Set(contexts.filter((c) => c.isPersonal).map((c) => c.id));
    return dayWorkload(tasks, (task) => {
      const contextId = task.channelId ? channels.get(task.channelId)?.contextId : null;
      return contextId ? personal.has(contextId) : false;
    });
  }, [tasks, channels, contexts]);

  const threshold = settings.workloadThresholdMin;
  const level = workloadLevel(workload.workPlanned, threshold);
  const upcoming = day >= today();
  const isToday = day === today();
  const work = mode === 'work';

  let label = '';
  if (workload.planned > 0) {
    if (isToday) label = `${formatMinutes(work ? workload.workRemaining : workload.remaining)} ${work ? 'work left' : 'left'}`;
    else label = `${formatMinutes(work ? workload.workPlanned : workload.planned)} ${work ? 'work' : upcoming ? 'planned' : 'total'}`;
  }
  if (level === 'over') label += ` · over by ${formatMinutes(workload.workPlanned - threshold)}`;
  const percent = threshold > 0 ? Math.min(100, (workload.workPlanned / threshold) * 100) : 0;

  return (
    <button
      type="button"
      onClick={cycle}
      data-testid="workload"
      data-level={level}
      title={`${formatMinutes(workload.workPlanned)} of work planned against a ${formatMinutes(threshold)} threshold. Click to switch between all tasks and work only.`}
      className="flex w-full flex-col gap-1 rounded text-left"
    >
      <span className={`tabular h-4 text-[12px] ${TEXT[level]}`}>{label}</span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-hover">
        <span className={`block h-full rounded-full transition-[width,background-color] duration-300 ${FILL[level]}`} style={{ width: `${percent}%` }} />
      </span>
    </button>
  );
}
