import { now, today } from '@/domain/clock';
import { fromDay, type Day } from '@/domain/dates';
import { entryDay } from '@/domain/time';
import { command, db } from '../db';
import type { Id, ParallelTimer, RunningTimer, TimeEntry } from '../types';
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

/** Stops whatever is running and starts timing a task (or one of its subtasks). Shared by the commands here and in subtasks. */
export async function begin(taskId: Id, subtaskId: Id | null): Promise<void> {
  await stopRunningTimer();
  // The main timer takes over a task that was running alongside.
  await stopParallelFor(taskId);
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

/** The play button on a subtask: stop if that subtask is being timed, otherwise time it. Returns whether a timer is now running. */
export const toggleSubtaskTimer = command(async (taskId: Id, subtaskId: Id): Promise<boolean> => {
  const running = await getRunningTimer();
  if (running?.subtaskId === subtaskId) {
    await stopRunningTimer();
    return false;
  }
  await begin(taskId, subtaskId);
  return true;
});

function checkSpan(start: number, end: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Enter a start and an end time.');
  if (end <= start) throw new Error('The end has to be after the start.');
  if (end > now()) throw new Error('Time can only be logged up to now.');
}

/** Changes when a finished entry started and ended. */
export const updateTimeEntry = command(async (id: Id, start: number, end: number): Promise<void> => {
  const before = await db.timeEntries.get(id);
  const running = await getRunningTimer();
  if (!before || before.end === null || running?.entryId === id) return;
  checkSpan(start, end);
  await db.timeEntries.update(id, { start, end });
  recordUndo('Edit time entry', async () => {
    await db.timeEntries.update(id, { start: before.start, end: before.end });
  });
});

/** Logs a stretch of time worked by hand, with its start and end. */
export const addTimeEntry = command(async (taskId: Id, start: number, end: number, subtaskId: Id | null = null): Promise<TimeEntry> => {
  checkSpan(start, end);
  const entry: TimeEntry = { id: crypto.randomUUID(), taskId, subtaskId, start, end };
  await db.timeEntries.add(entry);
  await db.tasks.update(taskId, { lastActivityDay: entryDay(entry), updatedAt: now() });
  recordUndo('Log time', async () => {
    await db.timeEntries.delete(entry.id);
  });
  return entry;
});

export async function getParallelTimers(): Promise<ParallelTimer[]> {
  return ((await db.meta.get('parallel'))?.value as ParallelTimer[] | undefined) ?? [];
}

/** Ends the timer running alongside for a task, if there is one. Shared with task completion. */
export async function stopParallelFor(taskId: Id): Promise<void> {
  const list = await getParallelTimers();
  const timer = list.find((t) => t.taskId === taskId);
  if (!timer) return;
  const end = now();
  if (end - timer.start < MIN_ENTRY_MS) await db.timeEntries.delete(timer.entryId);
  else await db.timeEntries.update(timer.entryId, { end });
  await db.meta.put({ key: 'parallel', value: list.filter((t) => t.taskId !== taskId) });
}

/**
 * Times a task alongside whatever else is running, or stops it if it
 * already is. Returns whether it is now running alongside. A task that is
 * the main timer's is left alone.
 */
export const toggleParallelTimer = command(async (taskId: Id): Promise<boolean> => {
  if ((await getRunningTimer())?.taskId === taskId) return false;
  const list = await getParallelTimers();
  if (list.some((t) => t.taskId === taskId)) {
    await stopParallelFor(taskId);
    return false;
  }
  const entry: TimeEntry = { id: crypto.randomUUID(), taskId, subtaskId: null, start: now(), end: null };
  await db.timeEntries.add(entry);
  await db.meta.put({ key: 'parallel', value: [...list, { entryId: entry.id, taskId, start: entry.start } satisfies ParallelTimer] });
  await db.tasks.update(taskId, { lastActivityDay: today(), updatedAt: now() });
  return true;
});
