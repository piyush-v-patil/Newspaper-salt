import type { DailyPriority, Session, Task } from '@/data/types';

const PRIORITY_RANK: Record<DailyPriority, number> = { urgent: 0, priority: 1, normal: 2, low: 3 };

/**
 * The order "Sort" puts a day's list in: open tasks on the calendar by when
 * they start, then open tasks with no timebox by priority, then finished
 * tasks. Ties keep their current order.
 */
export function autoSortOrder(tasks: Task[], sessions: Pick<Session, 'taskId' | 'day' | 'startMin'>[], day: string): Task[] {
  const start = new Map<string, number>();
  for (const s of sessions) {
    if (s.day !== day) continue;
    start.set(s.taskId, Math.min(start.get(s.taskId) ?? Infinity, s.startMin));
  }
  const rank = (t: Task): [number, number] => {
    if (t.completedAt !== null) return [2, 0];
    const at = start.get(t.id);
    return at !== undefined ? [0, at] : [1, PRIORITY_RANK[t.dailyPriority]];
  };
  return tasks
    .map((task, index) => ({ task, index, rank: rank(task) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.index - b.index)
    .map((x) => x.task);
}
