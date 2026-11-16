import { now, today } from '@/domain/clock';
import { compareKeys, keyAtEdge, safeKeyBetween } from '@/domain/ordering';
import { shiftDay } from '@/domain/dates';
import { db, getSettings } from '../db';
import { BACKLOG, type DailyPriority, type Id, type ListEdge, type Task, type TaskDay } from '../types';
import { recordUndo } from '../undo';

export interface NewTask {
  title: string;
  day?: TaskDay;
  channelId?: Id | null;
  plannedMin?: number | null;
  dailyPriority?: DailyPriority;
  position?: ListEdge;
}

async function orderKeysFor(day: TaskDay): Promise<string[]> {
  const rows = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
  return rows.map((t) => t.order).sort(compareKeys);
}

export async function createTask(input: NewTask): Promise<Task> {
  const title = input.title.trim();
  if (!title) throw new Error('A task needs a title.');
  const settings = await getSettings();
  const day = input.day ?? today();
  const stamp = now();
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    notes: '',
    channelId: input.channelId ?? null,
    day,
    order: keyAtEdge(await orderKeysFor(day), input.position ?? settings.newTaskPosition),
    plannedMin: input.plannedMin ?? null,
    dailyPriority: input.dailyPriority ?? 'normal',
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
    seriesId: null,
    seriesDay: null,
    edited: false,
    kind: 'task',
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.tasks.add(task);
  recordUndo('Add task', async () => {
    await db.tasks.delete(task.id);
  });
  return task;
}

/**
 * Applies a patch and records the previous values of exactly the patched
 * fields, so undo never clobbers changes made to other fields in between.
 */
async function patchTask(id: Id, patch: Partial<Task>, label: string, announce = false): Promise<void> {
  const before = await db.tasks.get(id);
  if (!before) throw new Error('That task no longer exists.');
  const previous: Partial<Task> = {};
  for (const key of Object.keys(patch) as (keyof Task)[]) {
    (previous as Record<string, unknown>)[key] = before[key];
  }
  await db.tasks.update(id, { ...patch, updatedAt: now() });
  recordUndo(
    label,
    async () => {
      await db.tasks.update(id, { ...previous, updatedAt: now() });
    },
    announce,
  );
}

export function renameTask(id: Id, title: string): Promise<void> {
  const next = title.trim();
  if (!next) throw new Error('A task needs a title.');
  return patchTask(id, { title: next, edited: true }, 'Rename task');
}

export function setTaskCompleted(id: Id, completed: boolean): Promise<void> {
  return patchTask(
    id,
    completed
      ? { completedAt: now(), completedDay: today(), lastActivityDay: today() }
      : { completedAt: null, completedDay: null },
    completed ? 'Complete task' : 'Reopen task',
  );
}

/** Soft delete. The task sits in the trash and can be restored for a week. */
export function deleteTask(id: Id): Promise<void> {
  return patchTask(id, { state: 'deleted', stateChangedAt: now() }, 'Task deleted', true);
}

/** A change of day is a deliberate act, so it clears the rollover count. */
function dayPatch(task: Task, day: TaskDay, order: string): Partial<Task> {
  return task.day === day ? { order } : { day, order, rolloverDays: 0 };
}

async function requireTask(id: Id): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) throw new Error('That task no longer exists.');
  return task;
}

/** Moves a task to the top or bottom of a day (or the backlog). */
export async function moveTask(id: Id, day: TaskDay, position: ListEdge = 'top'): Promise<void> {
  const task = await requireTask(id);
  const keys = (await orderKeysFor(day)).filter((k) => !(task.day === day && k === task.order));
  return patchTask(id, dayPatch(task, day, keyAtEdge(keys, position)), 'Move task');
}

/** Drops a task between two neighbours, given their order keys (null at either end). */
export async function placeTask(id: Id, day: TaskDay, before: string | null, after: string | null): Promise<void> {
  const task = await requireTask(id);
  return patchTask(id, dayPatch(task, day, safeKeyBetween(before, after)), 'Move task');
}

/** Moves a task one place up or down within its list. Does nothing at the edge. */
export async function nudgeTask(id: Id, direction: 'up' | 'down'): Promise<void> {
  const task = await requireTask(id);
  const list = (await db.tasks.where('[state+day]').equals(['active', task.day]).toArray()).sort((a, b) =>
    compareKeys(a.order, b.order),
  );
  const i = list.findIndex((t) => t.id === id);
  const target = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || target < 0 || target >= list.length) return;
  const [before, after] =
    direction === 'up'
      ? [list[target - 1]?.order ?? null, list[target].order]
      : [list[target].order, list[target + 1]?.order ?? null];
  return patchTask(id, { order: safeKeyBetween(before, after) }, 'Move task');
}

/** Pushes a task to the day after the one it is on (tomorrow, if it is in the backlog). */
export async function snoozeTask(id: Id): Promise<void> {
  const task = await requireTask(id);
  const from = task.day === BACKLOG ? today() : task.day;
  return moveTask(id, shiftDay(from, 1));
}

export function setPlannedTime(id: Id, plannedMin: number | null): Promise<void> {
  return patchTask(id, { plannedMin, edited: true }, 'Set planned time');
}

export function setChannel(id: Id, channelId: Id | null): Promise<void> {
  return patchTask(id, { channelId, edited: true }, 'Set channel');
}

export function setDailyPriority(id: Id, dailyPriority: DailyPriority): Promise<void> {
  return patchTask(id, { dailyPriority }, 'Set priority');
}

/** Notes save as you type, so they are not added to the undo stack. */
export async function setNotes(id: Id, notes: string): Promise<void> {
  await db.tasks.update(id, { notes, edited: true, updatedAt: now() });
}

/** Copies a task and its subtasks, placing the copy directly below the original. */
export async function duplicateTask(id: Id): Promise<Task> {
  const source = await requireTask(id);
  const list = (await db.tasks.where('[state+day]').equals(['active', source.day]).toArray()).sort((a, b) =>
    compareKeys(a.order, b.order),
  );
  const next = list[list.findIndex((t) => t.id === id) + 1];
  const stamp = now();
  const copy: Task = {
    ...source,
    id: crypto.randomUUID(),
    order: safeKeyBetween(source.order, next?.order ?? null),
    completedAt: null,
    completedDay: null,
    rolloverDays: 0,
    lastActivityDay: null,
    seriesId: null,
    seriesDay: null,
    edited: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const subtasks = (await db.subtasks.where('taskId').equals(id).toArray()).map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    taskId: copy.id,
    completedAt: null,
  }));
  await db.transaction('rw', db.tasks, db.subtasks, async () => {
    await db.tasks.add(copy);
    await db.subtasks.bulkAdd(subtasks);
  });
  recordUndo('Duplicate task', async () => {
    await db.transaction('rw', db.tasks, db.subtasks, async () => {
      await db.subtasks.where('taskId').equals(copy.id).delete();
      await db.tasks.delete(copy.id);
    });
  });
  return copy;
}
