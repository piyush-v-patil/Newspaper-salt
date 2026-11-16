import { now, today } from '@/domain/clock';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { db } from '../db';
import type { Id, Subtask } from '../types';
import { recordUndo } from '../undo';

export async function addSubtask(taskId: Id, title: string): Promise<Subtask> {
  const text = title.trim();
  if (!text) throw new Error('A subtask needs a title.');
  const keys = (await db.subtasks.where('taskId').equals(taskId).toArray()).map((s) => s.order).sort(compareKeys);
  const subtask: Subtask = {
    id: crypto.randomUUID(),
    taskId,
    title: text,
    order: keyAtEdge(keys, 'bottom'),
    plannedMin: null,
    completedAt: null,
  };
  await db.transaction('rw', db.tasks, db.subtasks, async () => {
    await db.subtasks.add(subtask);
    await db.tasks.update(taskId, { edited: true, updatedAt: now() });
  });
  recordUndo('Add subtask', async () => {
    await db.subtasks.delete(subtask.id);
  });
  return subtask;
}

export async function renameSubtask(id: Id, title: string): Promise<void> {
  const text = title.trim();
  const before = await db.subtasks.get(id);
  if (!before || !text || text === before.title) return;
  await db.subtasks.update(id, { title: text });
  recordUndo('Rename subtask', async () => {
    await db.subtasks.update(id, { title: before.title });
  });
}

/** Checking a subtask counts as activity on its task for the day. */
export async function setSubtaskCompleted(id: Id, completed: boolean): Promise<void> {
  const before = await db.subtasks.get(id);
  if (!before) return;
  const task = await db.tasks.get(before.taskId);
  await db.transaction('rw', db.tasks, db.subtasks, async () => {
    await db.subtasks.update(id, { completedAt: completed ? now() : null });
    if (completed) await db.tasks.update(before.taskId, { lastActivityDay: today(), updatedAt: now() });
  });
  recordUndo(completed ? 'Complete subtask' : 'Reopen subtask', async () => {
    await db.transaction('rw', db.tasks, db.subtasks, async () => {
      await db.subtasks.update(id, { completedAt: before.completedAt });
      if (completed && task) await db.tasks.update(task.id, { lastActivityDay: task.lastActivityDay });
    });
  });
}

export async function deleteSubtask(id: Id): Promise<void> {
  const before = await db.subtasks.get(id);
  if (!before) return;
  await db.subtasks.delete(id);
  recordUndo('Delete subtask', async () => {
    await db.subtasks.add(before);
  });
}
