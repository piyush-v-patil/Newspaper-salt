import { now, today } from '@/domain/clock';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { db, getSettings } from '../db';
import type { Id, ListEdge, Task, TaskDay } from '../types';
import { recordUndo } from '../undo';

export interface NewTask {
  title: string;
  day?: TaskDay;
  channelId?: Id | null;
  plannedMin?: number | null;
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

export async function moveTask(id: Id, day: TaskDay, position: ListEdge = 'top'): Promise<void> {
  const order = keyAtEdge(await orderKeysFor(day), position);
  return patchTask(id, { day, order }, 'Move task');
}
