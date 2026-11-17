import { now, today } from '@/domain/clock';
import { shiftDay, type Day } from '@/domain/dates';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { occurrencesBetween } from '@/domain/recurrence';
import { command, db, getSettings } from '../db';
import { BACKLOG, type Id, type Repeat, type Series, type Session, type Subtask, type Task } from '../types';
import { recordUndo } from '../undo';

/** Instances are created this many days ahead. */
export const SERIES_WINDOW_DAYS = 30;

async function addInstance(series: Series, day: Day): Promise<void> {
  const keys = (await db.tasks.where('[state+day]').equals(['active', day]).toArray()).map((t) => t.order).sort(compareKeys);
  const stamp = now();
  const task: Task = {
    id: crypto.randomUUID(),
    title: series.template.title,
    notes: series.template.notes,
    channelId: series.template.channelId,
    day,
    order: keyAtEdge(keys, 'bottom'),
    plannedMin: series.template.plannedMin,
    dailyPriority: 'normal',
    backlogPriority: 'none',
    backlogBucket: 'someday',
    backlogFolderId: null,
    objectiveId: null,
    completedAt: null,
    completedDay: null,
    rolloverDays: 0,
    lastActivityDay: null,
    state: 'active',
    stateChangedAt: null,
    seriesId: series.id,
    seriesDay: day,
    edited: false,
    kind: 'task',
    createdAt: stamp,
    updatedAt: stamp,
  };
  let order: string | null = null;
  const subtasks: Subtask[] = series.template.subtasks.map((title) => {
    order = keyAtEdge(order ? [order] : [], 'bottom');
    return { id: crypto.randomUUID(), taskId: task.id, title, order, plannedMin: null, completedAt: null };
  });
  const session = await timeboxFor(series, task);
  // All or nothing, so an instance never exists without its subtasks or timebox.
  await db.transaction('rw', db.tasks, db.subtasks, db.sessions, async () => {
    await db.tasks.add(task);
    await db.subtasks.bulkAdd(subtasks);
    if (session) await db.sessions.add(session);
  });
}

/** With an "at roughly" time, the timebox an instance gets at that time (none if it is already on the calendar that day). */
async function timeboxFor(series: Pick<Series, 'atMin'>, task: Task): Promise<Session | null> {
  if (series.atMin == null || task.day === BACKLOG) return null;
  const existing = await db.sessions.where('taskId').equals(task.id).toArray();
  if (existing.some((s) => s.day === task.day)) return null;
  const length = task.plannedMin ?? (await getSettings()).defaultSessionMin;
  return { id: crypto.randomUUID(), taskId: task.id, day: task.day, startMin: series.atMin, endMin: Math.min(series.atMin + length, 24 * 60) };
}

async function timebox(series: Pick<Series, 'atMin'>, task: Task): Promise<void> {
  const session = await timeboxFor(series, task);
  if (session) await db.sessions.add(session);
}

/**
 * Creates the instances a series is owed, up to a month ahead. Each
 * occurrence is created once: `generatedThrough` remembers how far it has
 * got, so a deleted instance never comes back.
 */
async function extend(series: Series): Promise<void> {
  const horizon = shiftDay(today(), SERIES_WINDOW_DAYS);
  const until = series.endDay !== null && series.endDay < horizon ? series.endDay : horizon;
  const from = shiftDay(series.generatedThrough, 1);
  if (from > until) return;
  // Days that already have an instance (in any state) are skipped, so an extension cut short, by a reload say, can safely run again.
  const have = new Set((await db.tasks.where('seriesId').equals(series.id).toArray()).map((t) => t.seriesDay));
  for (const day of occurrencesBetween(series.repeat, series.startDay, from, until)) if (!have.has(day)) await addInstance(series, day);
  await db.series.update(series.id, { generatedThrough: until });
}

/** Tops up every live series. Called by the start-of-day housekeeping. */
export async function extendAllSeries(): Promise<void> {
  for (const series of await db.series.toArray()) await extend(series);
}

async function templateFrom(task: Task): Promise<Series['template']> {
  const subtasks = (await db.subtasks.where('taskId').equals(task.id).toArray()).sort((a, b) => compareKeys(a.order, b.order));
  return { title: task.title, notes: task.notes, channelId: task.channelId, plannedMin: task.plannedMin, subtasks: subtasks.map((s) => s.title) };
}

/** Makes a task repeat. The task becomes the first instance; the rest are created up to a month ahead. */
export const makeRecurring = command(async (taskId: Id, repeat: Repeat, atMin: number | null = null): Promise<Series> => {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error('That task no longer exists.');
  if (task.seriesId) throw new Error('That task already repeats.');
  const startDay = task.day === BACKLOG ? today() : task.day;
  const series: Series = {
    id: crypto.randomUUID(),
    repeat,
    startDay,
    endDay: null,
    // The task itself covers the first day.
    generatedThrough: startDay,
    template: await templateFrom(task),
    atMin,
  };
  const sessionsBefore = (await db.sessions.where('taskId').equals(taskId).toArray()).map((s) => s.id);
  await db.series.add(series);
  await db.tasks.update(taskId, { seriesId: series.id, seriesDay: startDay, day: startDay, edited: false, updatedAt: now() });
  await timebox(series, { ...task, day: startDay });
  await extend(series);
  recordUndo('Repeat task', async () => {
    const others = (await db.tasks.where('seriesId').equals(series.id).toArray()).filter((t) => t.id !== taskId).map((t) => t.id);
    const added = (await db.sessions.where('taskId').anyOf([...others, taskId]).toArray()).filter((s) => !sessionsBefore.includes(s.id));
    await db.sessions.bulkDelete(added.map((s) => s.id));
    await db.subtasks.where('taskId').anyOf(others).delete();
    await db.tasks.bulkDelete(others);
    await db.series.delete(series.id);
    await db.tasks.put(task);
  });
  return series;
});

async function removeInstances(seriesId: Id, keep: (task: Task) => boolean): Promise<Task[]> {
  const removed = (await db.tasks.where('seriesId').equals(seriesId).toArray()).filter((t) => t.state === 'active' && !keep(t));
  await db.sessions.where('taskId').anyOf(removed.map((t) => t.id)).delete();
  await db.tasks.bulkDelete(removed.map((t) => t.id));
  return removed;
}

/** Stops a series. Today's and earlier instances stay; later unfinished ones are removed. */
export const stopRepeating = command(async (seriesId: Id): Promise<void> => {
  const series = await db.series.get(seriesId);
  if (!series) return;
  const day = today();
  const removed = await removeInstances(seriesId, (t) => t.completedAt !== null || t.day === BACKLOG || t.day <= day);
  await db.series.update(seriesId, { endDay: day });
  recordUndo(
    'Stopped repeating',
    async () => {
      await db.tasks.bulkPut(removed);
      await db.series.put(series);
    },
    true,
  );
});

/** Stops a series and removes every unfinished instance, including today's. Finished ones stay. */
export const deleteIncompleteInstances = command(async (seriesId: Id): Promise<void> => {
  const series = await db.series.get(seriesId);
  if (!series) return;
  const removed = await removeInstances(seriesId, (t) => t.completedAt !== null);
  await db.series.update(seriesId, { endDay: shiftDay(today(), -1) });
  recordUndo(
    `${removed.length} unfinished ${removed.length === 1 ? 'instance' : 'instances'} deleted`,
    async () => {
      await db.tasks.bulkPut(removed);
      await db.series.put(series);
    },
    true,
  );
});

/** Copies this instance's title, notes, channel and planned time to the series and every unfinished instance. */
export const applyToSeries = command(async (taskId: Id): Promise<number> => {
  const task = await db.tasks.get(taskId);
  if (!task?.seriesId) return 0;
  const series = await db.series.get(task.seriesId);
  if (!series) return 0;
  const template = await templateFrom(task);
  const open = (await db.tasks.where('seriesId').equals(series.id).toArray()).filter((t) => t.state === 'active' && t.completedAt === null && t.id !== taskId);
  await db.series.update(series.id, { template });
  for (const instance of open) {
    await db.tasks.update(instance.id, { title: template.title, notes: template.notes, channelId: template.channelId, plannedMin: template.plannedMin, updatedAt: now() });
  }
  recordUndo('Update series', async () => {
    await db.series.put(series);
    await db.tasks.bulkPut(open);
  });
  return open.length;
});

/**
 * Changes how often a series repeats (and its "at roughly" time) from one
 * instance on. That instance stays; unfinished instances after it are
 * replaced by ones that follow the new rule. Earlier ones are left alone.
 */
export const changeRepeat = command(async (taskId: Id, repeat: Repeat, atMin: number | null): Promise<void> => {
  const task = await db.tasks.get(taskId);
  if (!task?.seriesId) throw new Error('That task does not repeat.');
  const series = await db.series.get(task.seriesId);
  if (!series) throw new Error('That series no longer exists.');
  const anchor = task.day === BACKLOG ? today() : task.day;
  const later = (await db.tasks.where('seriesId').equals(series.id).toArray()).filter(
    (t) => t.state === 'active' && t.completedAt === null && t.id !== taskId && t.day !== BACKLOG && t.day > anchor,
  );
  const laterIds = later.map((t) => t.id);
  const laterSubtasks = await db.subtasks.where('taskId').anyOf(laterIds).toArray();
  const laterSessions = await db.sessions.where('taskId').anyOf(laterIds).toArray();
  const anchorSessions = await db.sessions.where('taskId').equals(taskId).toArray();
  const before = new Set((await db.tasks.where('seriesId').equals(series.id).primaryKeys()) as Id[]);

  const next: Series = { ...series, repeat, atMin, startDay: anchor, generatedThrough: anchor, endDay: null };
  // The old instances go and the new rule takes over together; the new instances follow.
  await db.transaction('rw', db.tasks, db.subtasks, db.sessions, db.series, async () => {
    await db.sessions.bulkDelete(laterSessions.map((s) => s.id));
    await db.subtasks.bulkDelete(laterSubtasks.map((s) => s.id));
    await db.tasks.bulkDelete(laterIds);
    await db.series.put(next);
  });
  // A newly chosen time also moves this instance's timebox, if it has one that day from the old time.
  if (atMin != null) {
    const old = anchorSessions.find((s) => s.day === anchor && series.atMin != null && s.startMin === series.atMin);
    if (old) await db.sessions.update(old.id, { startMin: atMin, endMin: Math.min(atMin + (old.endMin - old.startMin), 24 * 60) });
    else await timebox(next, task);
  }
  await extend(next);

  recordUndo('Change repeat', async () => {
    const createdIds = ((await db.tasks.where('seriesId').equals(series.id).primaryKeys()) as Id[]).filter((id) => !before.has(id));
    await db.sessions.where('taskId').anyOf([...createdIds, taskId]).delete();
    await db.subtasks.where('taskId').anyOf(createdIds).delete();
    await db.tasks.bulkDelete(createdIds);
    await db.tasks.bulkPut(later);
    await db.subtasks.bulkPut(laterSubtasks);
    await db.sessions.bulkPut([...laterSessions, ...anchorSessions]);
    await db.series.put(series);
  });
});
