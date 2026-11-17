import { useMemo } from 'react';
import { useUi } from '@/app/uiStore';
import { useChannelMap, useContexts, useSettings } from '@/data/ReferenceData';
import type { Task } from '@/data/types';
import { today } from '@/domain/clock';
import { formatMinutes, type Day } from '@/domain/dates';
import { msToMinutes } from '@/domain/time';
import { dayWorkload, workloadLevel, workloadLimitFor } from '@/domain/workload';
import { useTaskData } from './TaskData';

const TEXT = { ok: 'text-ink-3', near: 'text-warn', over: 'text-over' };
const FILL = { ok: 'bg-done', near: 'bg-warn', over: 'bg-over' };

/**
 * Planned time for a day against the workload threshold. Only work tasks
 * count toward the threshold. Clicking cycles through all tasks, work tasks
 * only, and actual against planned.
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

  const threshold = workloadLimitFor(settings, day);
  const level = workloadLevel(workload.workPlanned, threshold);
  const upcoming = day >= today();
  const isToday = day === today();
  const work = mode === 'work';

  const { actual } = useTaskData();
  const actualMin = msToMinutes(tasks.reduce((sum, t) => sum + (actual.get(t.id)?.byDay.get(day) ?? 0), 0));

  let label = '';
  if (mode === 'actual') {
    if (workload.planned > 0 || actualMin > 0) label = `${formatMinutes(actualMin)} / ${formatMinutes(workload.planned)}`;
  } else if (workload.planned > 0) {
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
      title={`${formatMinutes(workload.workPlanned)} of work planned against a ${formatMinutes(threshold)} threshold. Click to switch between all tasks, work only, and actual against planned.`}
      className="flex w-full flex-col gap-1 rounded text-left"
    >
      <span className="h-[6px] w-full overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full transition-[width,background-color] duration-300 ${FILL[level]}`} style={{ width: `${percent}%` }} />
      </span>
      {/* The bar says enough until the day gets full, or another view is chosen. */}
      <span className={`tabular text-[12px] ${TEXT[level]} ${level === 'ok' && mode === 'all' ? 'sr-only' : ''}`}>{label}</span>
    </button>
  );
}
