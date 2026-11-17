import { BACKLOG, type Id, type Task } from '@/data/types';
import { daysBetween, type Day } from './dates';

export interface RolloverPlan {
  /** Tasks to bring to today, in the order they should appear, with their new rollover count. */
  moves: { id: Id; rolloverDays: number }[];
  /** Tasks that have rolled over too many days in a row and go to the archive instead. */
  archive: Id[];
}

/**
 * Decides what happens to unfinished tasks left on past days.
 *
 * Every such task rolls forward to today. Its rollover count is the number
 * of days in a row it has rolled with no activity: tracking time or
 * checking a subtask on the day it sat on restarts the count from that day.
 * A task whose count passes `archiveAfterDays` is archived rather than
 * moved (null turns archiving off).
 */
export function planRollover(tasks: Task[], today: Day, archiveAfterDays: number | null): RolloverPlan {
  const plan: RolloverPlan = { moves: [], archive: [] };
  const stale = tasks
    .filter((t) => t.state === 'active' && t.completedAt === null && t.kind === 'task' && t.day !== BACKLOG && t.day < today)
    .sort((a, b) => (a.day === b.day ? (a.order < b.order ? -1 : 1) : a.day < b.day ? -1 : 1));

  for (const task of stale) {
    const activeOnItsDay = task.lastActivityDay !== null && task.lastActivityDay >= task.day;
    const rolloverDays = activeOnItsDay
      ? daysBetween(task.lastActivityDay as Day, today)
      : task.rolloverDays + daysBetween(task.day, today);
    if (archiveAfterDays !== null && rolloverDays > archiveAfterDays) plan.archive.push(task.id);
    else plan.moves.push({ id: task.id, rolloverDays });
  }
  return plan;
}
