import { generateNKeysBetween } from 'fractional-indexing';
import { now, today } from '@/domain/clock';
import { compareKeys } from '@/domain/ordering';
import { planRollover } from '@/domain/rollover';
import { command, db, getSettings } from '../db';
import type { Id, ListEdge } from '../types';
import { recordUndo } from '../undo';
import { extendAllSeries } from './series';
import { getRunningTimer } from './timer';

const DAY_MS = 24 * 60 * 60 * 1000;
export const TRASH_DAYS = 7;

/** Removes a task and everything attached to it for good. */
async function eraseTasks(ids: Id[]): Promise<void> {
  if (ids.length === 0) return;
  await db.subtasks.where('taskId').anyOf(ids).delete();
  await db.sessions.where('taskId').anyOf(ids).delete();
  await db.timeEntries.where('taskId').anyOf(ids).delete();
  await db.tasks.bulkDelete(ids);
}

/**
 * The start-of-day housekeeping, run when the app opens and at midnight:
 * unfinished tasks from past days come to today (or go to the archive if
 * they have rolled over too long), and the trash drops anything older than
 * a week. Safe to run any number of times.
 */
export const runRollover = command(async (): Promise<{ moved: number; archived: number }> => {
  const day = today();
  const settings = await getSettings();
  const past = await db.tasks.where('[state+day]').between(['active', '0000-00-00'], ['active', day], true, false).toArray();
  const plan = planRollover(past, day, settings.archiveAfterDays);

  // A recurring task left untouched does not pile up: when it would roll onto
  // a day that already has the series' next instance, the old one is dropped.
  // Changing an instance by hand makes it its own task, and it rolls as usual.
  const byId = new Map(past.map((t) => [t.id, t]));
  const todays = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
  const seriesToday = new Set(todays.flatMap((t) => (t.seriesId ? [t.seriesId] : [])));
  const isSuperseded = (id: Id) => {
    const task = byId.get(id);
    return Boolean(task?.seriesId && !task.edited && seriesToday.has(task.seriesId));
  };
  // This applies whether the old instance was about to move or to be archived.
  const superseded = [...plan.moves.map((m) => m.id), ...plan.archive].filter(isSuperseded);
  plan.moves = plan.moves.filter((m) => !isSuperseded(m.id));
  plan.archive = plan.archive.filter((id) => !isSuperseded(id));
  await eraseTasks(superseded);

  if (plan.moves.length) {
    const existing = (await db.tasks.where('[state+day]').equals(['active', day]).toArray()).map((t) => t.order).sort(compareKeys);
    const keys =
      settings.rolloverPosition === 'top'
        ? generateNKeysBetween(null, existing[0] ?? null, plan.moves.length)
        : generateNKeysBetween(existing[existing.length - 1] ?? null, null, plan.moves.length);
    const stamp = now();
    for (const [i, move] of plan.moves.entries()) {
      // Daily priority is for the day it was set on.
      await db.tasks.update(move.id, { day, order: keys[i], rolloverDays: move.rolloverDays, dailyPriority: 'normal', updatedAt: stamp });
    }
  }

  for (const id of plan.archive) await db.tasks.update(id, { state: 'archived', stateChangedAt: now(), updatedAt: now() });

  const expired = (await db.tasks.where('state').equals('deleted').toArray())
    .filter((t) => (t.stateChangedAt ?? 0) < now() - TRASH_DAYS * DAY_MS)
    .map((t) => t.id);
  await eraseTasks(expired);

  await extendAllSeries();

  return { moved: plan.moves.length, archived: plan.archive.length };
});

/** Brings an archived or deleted task back onto a day (today unless told otherwise). */
export const restoreTask = command(async (id: Id, position: ListEdge = 'top'): Promise<void> => {
  const before = await db.tasks.get(id);
  if (!before) return;
  const day = today();
  const keys = (await db.tasks.where('[state+day]').equals(['active', day]).toArray()).map((t) => t.order).sort(compareKeys);
  const [order] = position === 'top' ? generateNKeysBetween(null, keys[0] ?? null, 1) : generateNKeysBetween(keys[keys.length - 1] ?? null, null, 1);
  await db.tasks.update(id, { state: 'active', stateChangedAt: null, day, order, rolloverDays: 0, updatedAt: now() });
  recordUndo('Restore task', async () => {
    await db.tasks.put(before);
  });
});

/** Moves every archived task to the trash, where it stays restorable for a week. */
export const emptyArchive = command(async (): Promise<void> => {
  const archived = await db.tasks.where('state').equals('archived').toArray();
  if (archived.length === 0) return;
  const stamp = now();
  for (const task of archived) await db.tasks.update(task.id, { state: 'deleted', stateChangedAt: stamp });
  recordUndo(
    `${archived.length} archived ${archived.length === 1 ? 'task' : 'tasks'} deleted`,
    async () => {
      await db.tasks.bulkPut(archived);
    },
    true,
  );
});

/** Removes a task from the trash for good. This cannot be undone. */
export const eraseTask = command(async (id: Id): Promise<void> => {
  if ((await getRunningTimer())?.taskId === id) return;
  await eraseTasks([id]);
});
