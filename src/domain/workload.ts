import type { Settings, Task } from '@/data/types';
import { weekdayOf, type Day } from './dates';

export interface Workload {
  /** Planned time on every task of the day. */
  planned: number;
  /** Planned time on tasks not yet done. */
  remaining: number;
  /** As above, leaving out tasks in a personal context. Only this counts against the threshold. */
  workPlanned: number;
  workRemaining: number;
  /** Open tasks with no estimate, which the totals cannot see. */
  unestimated: number;
}

export function dayWorkload(tasks: Task[], isPersonal: (task: Task) => boolean): Workload {
  const w: Workload = { planned: 0, remaining: 0, workPlanned: 0, workRemaining: 0, unestimated: 0 };
  for (const task of tasks) {
    const minutes = task.plannedMin ?? 0;
    const open = task.completedAt === null;
    const work = !isPersonal(task);
    w.planned += minutes;
    if (open) w.remaining += minutes;
    if (work) w.workPlanned += minutes;
    if (work && open) w.workRemaining += minutes;
    if (open && task.plannedMin === null) w.unestimated += 1;
  }
  return w;
}

export type WorkloadLevel = 'ok' | 'near' | 'over';

/** How close to the threshold "near" begins. */
const NEAR_RATIO = 0.85;

export function workloadLevel(workPlanned: number, thresholdMin: number): WorkloadLevel {
  if (thresholdMin <= 0) return 'ok';
  if (workPlanned > thresholdMin) return 'over';
  return workPlanned >= thresholdMin * NEAR_RATIO ? 'near' : 'ok';
}

/** The workload limit for a day: that weekday's own, if it has one, else the daily limit. */
export function workloadLimitFor(settings: Pick<Settings, 'workloadThresholdMin' | 'workloadByWeekday'>, day: Day): number {
  return settings.workloadByWeekday?.[weekdayOf(day)] ?? settings.workloadThresholdMin;
}
