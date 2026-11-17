import { now, today } from '@/domain/clock';
import { fromDay, type Day } from '@/domain/dates';
import { entryDay } from '@/domain/time';
import { command, db } from '../db';
import type { Id, RunningTimer, TimeEntry } from '../types';
import { recordUndo } from '../undo';

const MINUTE = 60_000;
/** A timer stopped sooner than this was a slip of the key; it leaves no entry. */
const MIN_ENTRY_MS = 1000;

export async function getRunningTimer(): Promise<RunningTimer | null> {
  return ((await db.meta.get('timer'))?.value as RunningTimer | undefined) ?? null;
}

/** Ends the running entry, if there is one. Shared by the commands below and by task completion. */
export async function stopRunningTimer(): Promise<void> {
  const running = await getRunningTimer();
  if (!running) return;
  const end = now();
  if (end - running.start < MIN_ENTRY_MS) await db.timeEntries.delete(running.entryId);
  else await db.timeEntries.update(running.entryId, { end });
  await db.meta.delete('timer');
}

async function begin(taskId: Id, subtaskId: Id | null): Promise<void> {
  await stopRunningTimer();
  const entry: TimeEntry = { id: crypto.randomUUID(), taskId, subtaskId, start: now(), end: null };
  await db.timeEntries.add(entry);
  await db.meta.put({ key: 'timer', value: { entryId: entry.id, taskId, subtaskId, start: entry.start } satisfies RunningTimer });
  // Tracking time counts as activity, which keeps a task out of the archive.
  await db.tasks.update(taskId, { lastActivityDay: today(), updatedAt: now() });
}

/** Starts timing a task. Only one timer runs at a time, so any other stops. */
export const startTimer = command((taskId: Id, subtaskId: Id | null = null): Promise<void> => begin(taskId, subtaskId));

export const stopTimer = command(stopRunningTimer);

/** Space on a task: stop if it is the one being timed, otherwise start it. Returns whether a timer is now running. */
export const toggleTimer = command(async (taskId: Id): Promise<boolean> => {
  const running = await getRunningTimer();
  if (running?.taskId === taskId) {
    await stopRunningTimer();
    return false;
  }
  await begin(taskId, null);
  return true;
});

/**
 * Sets the actual time for a task on one day to a typed amount. The day's
 * finished entries are replaced by a single entry of that length; a timer
 * still running is left alone. Null or zero clears the day.
 */
export const setActualForDay = command(async (taskId: Id, day: Day, minutes: number | null): Promise<void> => {
  const running = await getRunningTimer();
  const existing = (await db.timeEntries.where('taskId').equals(taskId).toArray()).filter(
    (e) => e.id !== running?.entryId && entryDay(e) === day,
  );
  const added: TimeEntry[] = [];
  if (minutes && minutes > 0) {
    const dayStart = fromDay(day).getTime();
    // Today's time ends now; a past day's is placed at midday.
    const end = day === today() ? now() : dayStart + 12 * 60 * MINUTE + minutes * MINUTE;
    added.push({ id: crypto.randomUUID(), taskId, subtaskId: null, start: Math.max(dayStart, end - minutes * MINUTE), end });
  }
  await db.timeEntries.bulkDelete(existing.map((e) => e.id));
  await db.timeEntries.bulkAdd(added);
  if (added.length) await db.tasks.update(taskId, { lastActivityDay: day, updatedAt: now() });
  recordUndo('Set actual time', async () => {
    await db.timeEntries.bulkDelete(added.map((e) => e.id));
    await db.timeEntries.bulkPut(existing);
  });
});

export const deleteTimeEntry = command(async (id: Id): Promise<void> => {
  const entry = await db.timeEntries.get(id);
  const running = await getRunningTimer();
  if (!entry || running?.entryId === id) return;
  await db.timeEntries.delete(id);
  recordUndo('Delete time entry', async () => {
    await db.timeEntries.put(entry);
  });
});
