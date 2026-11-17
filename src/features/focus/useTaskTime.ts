import { useNow } from '@/app/useNow';
import { useRunningTimer, useTimeEntries } from '@/data/queries';
import type { Id } from '@/data/types';
import { today } from '@/domain/clock';
import { actualByTask } from '@/domain/time';

/** Live tracked time for one task: today's, the total, and whether its timer is running. */
export function useTaskTime(taskId: Id | undefined): { todayMs: number; totalMs: number; running: boolean } {
  const entries = useTimeEntries(taskId);
  const running = useRunningTimer()?.taskId === taskId && taskId !== undefined;
  const nowMs = useNow(1000, running);
  const actual = taskId ? actualByTask(entries, nowMs).get(taskId) : undefined;
  return { todayMs: actual?.byDay.get(today()) ?? 0, totalMs: actual?.totalMs ?? 0, running };
}
