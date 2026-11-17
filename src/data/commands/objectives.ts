import { now } from '@/domain/clock';
import type { Day } from '@/domain/dates';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { command, db } from '../db';
import type { Id, Objective } from '../types';
import { recordUndo } from '../undo';

export const createObjective = command(async (weekStart: Day, title: string, channelId: Id | null = null): Promise<Objective> => {
  const clean = title.trim();
  if (!clean) throw new Error('An objective needs a title.');
  const keys = (await db.objectives.where('weekStart').equals(weekStart).toArray()).map((o) => o.order).sort(compareKeys);
  const objective: Objective = {
    id: crypto.randomUUID(),
    weekStart,
    title: clean,
    notes: '',
    channelId,
    // New objectives go to the top.
    order: keyAtEdge(keys, 'top'),
    completedAt: null,
  };
  await db.objectives.add(objective);
  recordUndo('Add objective', async () => {
    await db.objectives.delete(objective.id);
  });
  return objective;
});

async function patchObjective(id: Id, patch: Partial<Objective>, label: string): Promise<void> {
  const before = await db.objectives.get(id);
  if (!before) return;
  await db.objectives.update(id, patch);
  recordUndo(label, async () => {
    await db.objectives.put(before);
  });
}

export const renameObjective = command(async (id: Id, title: string): Promise<void> => {
  const clean = title.trim();
  if (clean) await patchObjective(id, { title: clean }, 'Rename objective');
});

export const setObjectiveCompleted = command((id: Id, completed: boolean): Promise<void> =>
  patchObjective(id, { completedAt: completed ? now() : null }, completed ? 'Complete objective' : 'Reopen objective'),
);

/** Continues an unfinished objective in another week. Its tasks stay linked. */
export const carryOverObjective = command(async (id: Id, toWeek: Day): Promise<void> => {
  const keys = (await db.objectives.where('weekStart').equals(toWeek).toArray()).map((o) => o.order).sort(compareKeys);
  await patchObjective(id, { weekStart: toWeek, order: keyAtEdge(keys, 'bottom') }, 'Carry over objective');
});

/** Deletes an objective. Its tasks remain, no longer linked to it. */
export const deleteObjective = command(async (id: Id): Promise<void> => {
  const objective = await db.objectives.get(id);
  if (!objective) return;
  const linked = (await db.tasks.where('objectiveId').equals(id).toArray()).map((t) => t.id);
  await db.objectives.delete(id);
  for (const taskId of linked) await db.tasks.update(taskId, { objectiveId: null });
  recordUndo(
    'Objective deleted',
    async () => {
      await db.objectives.put(objective);
      for (const taskId of linked) await db.tasks.update(taskId, { objectiveId: id });
    },
    true,
  );
});

/** Links a task to an objective, or unlinks it with null. */
export const linkTask = command(async (taskId: Id, objectiveId: Id | null): Promise<void> => {
  const before = await db.tasks.get(taskId);
  if (!before) return;
  await db.tasks.update(taskId, { objectiveId, updatedAt: now() });
  recordUndo(objectiveId ? 'Link to objective' : 'Unlink from objective', async () => {
    await db.tasks.update(taskId, { objectiveId: before.objectiveId });
  });
});
