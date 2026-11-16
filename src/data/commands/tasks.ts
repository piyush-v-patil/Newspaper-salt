import { now, nowMinutes, today } from '@/domain/clock';
import { compareKeys, keyAtEdge, safeKeyBetween } from '@/domain/ordering';
import { shiftDay } from '@/domain/dates';
import { pullForward, snap, SNAP_MIN } from '@/domain/scheduling';
import { db, getSettings } from '../db';
import { BACKLOG, type DailyPriority, type Id, type ListEdge, type Task, type TaskDay } from '../types';
import { recordUndo } from '../undo';
import { withSnapshot } from './snapshot';

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

/**
 * Completes or reopens a task. Completing one today also tidies its
 * calendar: a session that has not started is removed, a session in
 * progress ends now, and (if the setting is on) the sessions that followed
 * back to back move forward.
 */
export async function setTaskCompleted(id: Id, completed: boolean): Promise<void> {
  if (!completed) return patchTask(id, { completedAt: null, completedDay: null }, 'Reopen task');

  const day = today();
  const settings = await getSettings();
  await withSnapshot('Complete task', { taskIds: [id], days: [day] }, async () => {
    await db.tasks.update(id, { completedAt: now(), completedDay: day, lastActivityDay: day, updatedAt: now() });

    const time = nowMinutes();
    const onDay = await db.sessions.where('day').equals(day).toArray();
    const owners = await db.tasks.bulkGet(onDay.map((s) => s.taskId));
    const laterOpen = onDay.filter((s, i) => s.taskId !== id && owners[i]?.state === 'active' && owners[i]?.completedAt === null);
    const events = (await db.events.where('day').equals(day).toArray()).filter((e) => e.blocksTime);

    for (const session of onDay.filter((s) => s.taskId === id)) {
      if (time <= session.startMin) {
        await db.sessions.delete(session.id);
      } else if (time < session.endMin) {
        const endMin = Math.max(session.startMin + SNAP_MIN, snap(time));
        await db.sessions.update(session.id, { endMin });
        if (settings.rescheduleOnEarlyFinish) {
          for (const move of pullForward(session.endMin, endMin, laterOpen, events)) {
            await db.sessions.update(move.id, { startMin: move.startMin, endMin: move.endMin });
          }
        }
      }
    }
  });
}

/** Soft delete. The task sits in the trash and can be restored for a week. */
export function deleteTask(id: Id): Promise<void> {
  return patchTask(id, { state: 'deleted', stateChangedAt: now() }, 'Task deleted', true);
}

async function requireTask(id: Id): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) throw new Error('That task no longer exists.');
  return task;
}

/**
 * Puts a task at a position in a list. Changing its day is a deliberate
 * act, so it clears the rollover count, and it takes the task's upcoming
 * calendar sessions with it: sessions still ahead on other days are removed,
 * while sessions already in the past stay as a record.
 */
async function reposition(task: Task, day: TaskDay, order: string): Promise<void> {
  if (task.day === day) return patchTask(task.id, { order }, 'Move task');

  await withSnapshot('Move task', { taskIds: [task.id] }, async () => {
    await db.tasks.update(task.id, { day, order, rolloverDays: 0, updatedAt: now() });
    const current = today();
    const time = nowMinutes();
    const upcoming = (await db.sessions.where('taskId').equals(task.id).toArray()).filter(
      (s) => s.day !== day && (s.day > current || (s.day === current && s.endMin > time)),
    );
    await db.sessions.bulkDelete(upcoming.map((s) => s.id));
  });
}

/** Moves a task to the top or bottom of a day (or the backlog). */
export async function moveTask(id: Id, day: TaskDay, position: ListEdge = 'top'): Promise<void> {
  const task = await requireTask(id);
  const keys = (await orderKeysFor(day)).filter((k) => !(task.day === day && k === task.order));
  return reposition(task, day, keyAtEdge(keys, position));
}

/** Drops a task between two neighbours, given their order keys (null at either end). */
export async function placeTask(id: Id, day: TaskDay, before: string | null, after: string | null): Promise<void> {
  return reposition(await requireTask(id), day, safeKeyBetween(before, after));
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

/**
 * Sets the estimate. If the task is on the calendar, its last session grows
 * or shrinks so the sessions still add up to the planned time.
 */
export async function setPlannedTime(id: Id, plannedMin: number | null): Promise<void> {
  const sessions = (await db.sessions.where('taskId').equals(id).toArray()).sort(
    (a, b) => (a.day === b.day ? a.startMin - b.startMin : a.day < b.day ? -1 : 1),
  );
  if (plannedMin === null || sessions.length === 0) return patchTask(id, { plannedMin, edited: true }, 'Set planned time');

  await withSnapshot('Set planned time', { taskIds: [id] }, async () => {
    await db.tasks.update(id, { plannedMin, edited: true, updatedAt: now() });
    const last = sessions[sessions.length - 1];
    const scheduled = sessions.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
    const endMin = Math.min(last.endMin + (plannedMin - scheduled), 24 * 60);
    if (endMin - last.startMin >= SNAP_MIN) await db.sessions.update(last.id, { endMin });
  });
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
