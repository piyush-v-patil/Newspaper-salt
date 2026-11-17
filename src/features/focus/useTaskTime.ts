import { useNow } from '@/app/useNow';
import { useParallelTimers, useRunningTimer, useTimeEntries } from '@/data/queries';
import type { Id } from '@/data/types';
import { today } from '@/domain/clock';
import { actualByTask } from '@/domain/time';

/** Live tracked time for one task: today's, the total, and whether its timer is running. */
export function useTaskTime(taskId: Id | undefined): { todayMs: number; totalMs: number; running: boolean } {
  const entries = useTimeEntries(taskId);
  const running = useRunningTimer()?.taskId === taskId && taskId !== undefined;
  const alongside = useParallelTimers().some((t) => t.taskId === taskId);
  const nowMs = useNow(1000, running || alongside);
  const actual = taskId ? actualByTask(entries, nowMs).get(taskId) : undefined;
  return { todayMs: actual?.byDay.get(today()) ?? 0, totalMs: actual?.totalMs ?? 0, running };
}
