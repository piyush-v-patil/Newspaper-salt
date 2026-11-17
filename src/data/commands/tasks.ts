import { now, nowMinutes, today } from '@/domain/clock';
import { compareKeys, keyAtEdge, safeKeyBetween } from '@/domain/ordering';
import { shiftDay, type Day } from '@/domain/dates';
import { pullForward, snap, SNAP_MIN } from '@/domain/scheduling';
import { autoSortOrder } from '@/domain/autoSort';
import { command, db, getSettings } from '../db';
import {
  BACKLOG,
  type BacklogBucket,
  type BacklogPriority,
  type DailyPriority,
  type Id,
  type ListEdge,
  type Subtask,
  type Task,
  type TaskCounter,
  type TaskDay,
} from '../types';
import { recordUndo } from '../undo';
import { withSnapshot } from './snapshot';
import { getRunningTimer, stopParallelFor, stopRunningTimer } from './timer';

export interface NewTask {
  title: string;
  day?: TaskDay;
  channelId?: Id | null;
  plannedMin?: number | null;
  dailyPriority?: DailyPriority;
  backlogBucket?: BacklogBucket;
  backlogFolderId?: Id | null;
  objectiveId?: Id | null;
  position?: ListEdge;
}

async function orderKeysFor(day: TaskDay): Promise<string[]> {
  const rows = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
  return rows.map((t) => t.order).sort(compareKeys);
}

/** A new task row, not yet saved. Shared by every command that creates tasks. */
export async function buildTask(input: NewTask): Promise<Task> {
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
    backlogBucket: input.backlogBucket ?? 'someday',
    backlogFolderId: day === BACKLOG ? (input.backlogFolderId ?? null) : null,
    objectiveId: input.objectiveId ?? null,
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
  return task;
}

export const createTask = command(async (input: NewTask): Promise<Task> => {
  const task = await buildTask(input);
  await db.tasks.add(task);
  recordUndo('Add task', async () => {
    await db.tasks.delete(task.id);
  });
  return task;
});

/**
 * Applies a patch and records the previous values of exactly the patched
 * fields, so undo never clobbers changes made to other fields in between.
 */
async function patchTask(id: Id, patch: Partial<Task>, label: string, announce: boolean = false): Promise<void> {
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

export const renameTask = command(async (id: Id, title: string): Promise<void> => {
  const next = title.trim();
  if (!next) throw new Error('A task needs a title.');
  return patchTask(id, { title: next, edited: true }, 'Rename task');
});

/**
 * Completes or reopens a task. Completing one today also tidies its
 * calendar: a session that has not started is removed, a session in
 * progress ends now, and (if the setting is on) the sessions that followed
 * back to back move forward.
 */
export const setTaskCompleted = command(async (id: Id, completed: boolean): Promise<void> => {
  if (!completed) return patchTask(id, { completedAt: null, completedDay: null }, 'Reopen task');

  const day = today();
  const settings = await getSettings();
  let loggedEntryId: Id | null = null;
  await withSnapshot('Complete task', { taskIds: [id], days: [day] }, async () => {
    await db.tasks.update(id, { completedAt: now(), completedDay: day, lastActivityDay: day, updatedAt: now() });
    // Finishing a task stops its timer.
    if ((await getRunningTimer())?.taskId === id) await stopRunningTimer();
    await stopParallelFor(id);

    // With that setting on, a task finished without any tracked time today has its estimate logged as actual.
    const task = await db.tasks.get(id);
    if (settings.countPlannedAsActual && task?.plannedMin) {
      const dayStart = new Date(`${day}T00:00:00`).getTime();
      const trackedToday = (await db.timeEntries.where('taskId').equals(id).toArray()).some((e) => e.start >= dayStart);
      if (!trackedToday) {
        const end = now();
        loggedEntryId = crypto.randomUUID();
        await db.timeEntries.add({ id: loggedEntryId, taskId: id, subtaskId: null, start: Math.max(dayStart, end - task.plannedMin * 60_000), end });
      }
    }

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
  }, false, async () => {
    if (loggedEntryId) await db.timeEntries.delete(loggedEntryId);
  });
});

/** Soft delete. The task sits in the trash and can be restored for a week. */
export const deleteTask = command((id: Id): Promise<void> =>
  patchTask(id, { state: 'deleted', stateChangedAt: now() }, 'Task deleted', true),
);

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
async function reposition(task: Task, day: TaskDay, order: string, bucket?: BacklogBucket): Promise<void> {
  const extra = bucket ? { backlogBucket: bucket } : {};
  if (task.day === day) return patchTask(task.id, { order, ...extra }, 'Move task');

  await withSnapshot('Move task', { taskIds: [task.id] }, async () => {
    // Folders exist only in the backlog, so a task leaves its folder when it gets a day.
    const folder = day === BACKLOG ? {} : { backlogFolderId: null };
    await db.tasks.update(task.id, { day, order, rolloverDays: 0, ...extra, ...folder, updatedAt: now() });
    const current = today();
    const time = nowMinutes();
    const upcoming = (await db.sessions.where('taskId').equals(task.id).toArray()).filter(
      (s) => s.day !== day && (s.day > current || (s.day === current && s.endMin > time)),
    );
    await db.sessions.bulkDelete(upcoming.map((s) => s.id));
  });
}

/** The shared step behind moveTask and snoozeTask. */
async function moveToEdge(id: Id, day: TaskDay, position: ListEdge): Promise<void> {
  const task = await requireTask(id);
  const keys = (await orderKeysFor(day)).filter((k) => !(task.day === day && k === task.order));
  return reposition(task, day, keyAtEdge(keys, position));
}

/** Moves a task to the top or bottom of a day (or the backlog). */
export const moveTask = command((id: Id, day: TaskDay, position: ListEdge = 'top'): Promise<void> => moveToEdge(id, day, position));

/** Drops a task between two neighbours, given their order keys (null at either end). */
export const placeTask = command(
  async (id: Id, day: TaskDay, before: string | null, after: string | null, bucket?: BacklogBucket): Promise<void> => {
    return reposition(await requireTask(id), day, safeKeyBetween(before, after), bucket);
  },
);

/** Moves a task one place up or down within its list. Does nothing at the edge. */
export const nudgeTask = command(async (id: Id, direction: 'up' | 'down'): Promise<void> => {
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
});

/** Pushes a task to the day after the one it is on (tomorrow, if it is in the backlog). */
export const snoozeTask = command(async (id: Id): Promise<void> => {
  const task = await requireTask(id);
  const from = task.day === BACKLOG ? today() : task.day;
  return moveToEdge(id, shiftDay(from, 1), 'top');
});

/**
 * Sets the estimate. If the task is on the calendar, its last session grows
 * or shrinks so the sessions still add up to the planned time.
 */
export const setPlannedTime = command(async (id: Id, plannedMin: number | null): Promise<void> => {
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
});

export const setChannel = command((id: Id, channelId: Id | null): Promise<void> =>
  patchTask(id, { channelId, edited: true }, 'Set channel'),
);

export const setDailyPriority = command((id: Id, dailyPriority: DailyPriority): Promise<void> =>
  patchTask(id, { dailyPriority }, 'Set priority'),
);

/** Backlog priority is separate from daily priority and stays until changed. */
export const setBacklogPriority = command((id: Id, backlogPriority: BacklogPriority): Promise<void> =>
  patchTask(id, { backlogPriority }, 'Set priority'),
);

export const setDueDay = command((id: Id, dueDay: Day | null): Promise<void> =>
  patchTask(id, { dueDay, edited: true }, dueDay ? 'Set due date' : 'Clear due date'),
);

export const setBacklogFolder = command((id: Id, backlogFolderId: Id | null): Promise<void> =>
  patchTask(id, { backlogFolderId }, 'Set folder'),
);

/** Notes save as you type, so they are not added to the undo stack. */
export const setNotes = command(async (id: Id, notes: string): Promise<void> => {
  await db.tasks.update(id, { notes, edited: true, updatedAt: now() });
});

/** Copies a task and its subtasks, placing the copy directly below the original. */
export const duplicateTask = command(async (id: Id): Promise<Task> => {
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
    counter: source.counter ? { ...source.counter, count: 0 } : source.counter,
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
});

/** Sorts a day's list: timeboxed tasks by time, then by priority, finished ones last. One undo restores the old order. */
export const sortDay = command(async (day: Day): Promise<void> => {
  const list = (await db.tasks.where('[state+day]').equals(['active', day]).toArray()).sort((a, b) => compareKeys(a.order, b.order));
  const sessions = await db.sessions.where('day').equals(day).toArray();
  const sorted = autoSortOrder(list, sessions, day);
  if (sorted.every((t, i) => t.id === list[i].id)) return;
  await withSnapshot('Sort tasks', { taskIds: list.map((t) => t.id) }, async () => {
    let previous: string | null = null;
    for (const task of sorted) {
      const order = keyAtEdge(previous ? [previous] : [], 'bottom');
      await db.tasks.update(task.id, { order, updatedAt: now() });
      previous = order;
    }
  });
});

/**
 * Merges one task into another. The merged task's title becomes a subtask
 * of the other (done if it was done), followed by its own subtasks; its
 * notes are appended; its tracked time and timeboxes move across; planned
 * times add up. The merged task goes to the trash. One undo reverses it all.
 */
export const mergeTasks = command(async (sourceId: Id, targetId: Id): Promise<void> => {
  if (sourceId === targetId) return;
  const source = await requireTask(sourceId);
  const target = await requireTask(targetId);
  const sourceSubtasks = (await db.subtasks.where('taskId').equals(sourceId).toArray()).sort((a, b) => compareKeys(a.order, b.order));
  const targetKeys = (await db.subtasks.where('taskId').equals(targetId).toArray()).map((s) => s.order).sort(compareKeys);
  const entries = await db.timeEntries.where('taskId').equals(sourceId).toArray();
  const sessions = await db.sessions.where('taskId').equals(sourceId).toArray();
  const running = await getRunningTimer();

  let last = targetKeys[targetKeys.length - 1] ?? null;
  const next = () => (last = safeKeyBetween(last, null));
  const heading: Subtask = { id: crypto.randomUUID(), taskId: targetId, title: source.title, order: next(), plannedMin: source.plannedMin, completedAt: source.completedAt };
  const moved = sourceSubtasks.map((s) => ({ ...s, taskId: targetId, order: next() }));
  const plannedMin = target.plannedMin === null && source.plannedMin === null ? null : (target.plannedMin ?? 0) + (source.plannedMin ?? 0);
  const stamp = now();

  await db.transaction('rw', [db.tasks, db.subtasks, db.timeEntries, db.sessions, db.meta], async () => {
    await db.subtasks.bulkPut([heading, ...moved]);
    await db.timeEntries.bulkPut(entries.map((e) => ({ ...e, taskId: targetId })));
    await db.sessions.bulkPut(sessions.map((s) => ({ ...s, taskId: targetId })));
    if (running?.taskId === sourceId) await db.meta.put({ key: 'timer', value: { ...running, taskId: targetId } });
    await db.tasks.update(targetId, { plannedMin, notes: [target.notes, source.notes].filter((n) => n.trim()).join(''), edited: true, updatedAt: stamp });
    await db.tasks.update(sourceId, { state: 'deleted', stateChangedAt: stamp, updatedAt: stamp });
  });

  recordUndo(
    'Tasks merged',
    async () => {
      await db.transaction('rw', [db.tasks, db.subtasks, db.timeEntries, db.sessions, db.meta], async () => {
        await db.subtasks.delete(heading.id);
        await db.subtasks.bulkPut(sourceSubtasks);
        await db.timeEntries.bulkPut(entries);
        await db.sessions.bulkPut(sessions);
        const timer = await getRunningTimer();
        if (timer && running?.taskId === sourceId && timer.entryId === running.entryId) await db.meta.put({ key: 'timer', value: running });
        await db.tasks.bulkPut([source, target]);
      });
    },
    true,
  );
});

/** Adds, changes or removes a task's counter. */
export const setCounter = command((id: Id, counter: TaskCounter | null): Promise<void> =>
  patchTask(id, { counter, edited: true }, counter ? 'Change counter' : 'Remove counter'),
);

/** Counts one up (or down). Counting is activity, so it keeps the task out of the archive. */
export const bumpCounter = command(async (id: Id, by: 1 | -1): Promise<void> => {
  const task = await requireTask(id);
  if (!task.counter) return;
  const count = Math.max(0, task.counter.count + by);
  if (count === task.counter.count) return;
  return patchTask(id, { counter: { ...task.counter, count }, lastActivityDay: today() }, by > 0 ? 'Counted one' : 'Counted one less');
});
