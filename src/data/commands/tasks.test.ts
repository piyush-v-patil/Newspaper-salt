import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { db, getSettings } from '../db';
import { tasksForDay } from '../queries';
import { BACKLOG } from '../types';
import { clearUndo, undoLast, useUndo } from '../undo';
import { updateSettings } from './settings';
import { createChannel } from './channels';
import { createFolder, deleteFolder } from './folders';
import { addSubtask, deleteSubtask, setSubtaskCompleted } from './subtasks';
import {
  createTask,
  deleteTask,
  duplicateTask,
  moveTask,
  nudgeTask,
  placeTask,
  renameTask,
  setBacklogPriority,
  setTaskCompleted,
  snoozeTask,
} from './tasks';

const DAY = '2026-11-17';

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  // Tuesday 17 November 2026, 10:00 local time.
  setClock(() => new Date(2026, 10, 17, 10, 0).getTime());
  return () => resetClock();
});

describe('a new profile', () => {
  it('starts with default settings and two contexts', async () => {
    const settings = await getSettings();
    expect(settings.archiveAfterDays).toBe(4);
    expect(settings.workloadThresholdMin).toBe(330);
    const contexts = await db.contexts.toArray();
    expect(contexts.map((c) => c.name).sort()).toEqual(['Personal', 'Work']);
    expect(contexts.find((c) => c.name === 'Personal')?.isPersonal).toBe(true);
  });
});

describe('createTask', () => {
  it('stores a task on today and reads it back', async () => {
    const task = await createTask({ title: '  Draft Q4 report  ' });
    const [stored] = await tasksForDay(DAY);
    expect(stored.id).toBe(task.id);
    expect(stored.title).toBe('Draft Q4 report');
    expect(stored.day).toBe(DAY);
    expect(stored.state).toBe('active');
  });

  it('rejects an empty title', async () => {
    await expect(createTask({ title: '   ' })).rejects.toThrow('needs a title');
  });

  it('puts new tasks at the top by default and at the bottom when set', async () => {
    await createTask({ title: 'first' });
    await createTask({ title: 'second' });
    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['second', 'first']);

    await updateSettings({ newTaskPosition: 'bottom' });
    await createTask({ title: 'third' });
    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['second', 'first', 'third']);
  });

  it('can be undone', async () => {
    await createTask({ title: 'oops' });
    expect(await undoLast()).toBe('Add task');
    expect(await tasksForDay(DAY)).toEqual([]);
  });
});

describe('completing', () => {
  it('records when and on which day, and undo reopens it', async () => {
    const task = await createTask({ title: 'Reply to Arjun' });
    await setTaskCompleted(task.id, true);
    let stored = await db.tasks.get(task.id);
    expect(stored?.completedDay).toBe(DAY);
    expect(stored?.completedAt).toBe(new Date(2026, 10, 17, 10, 0).getTime());

    await undoLast();
    stored = await db.tasks.get(task.id);
    expect(stored?.completedAt).toBeNull();
    expect(stored?.completedDay).toBeNull();
  });
});

describe('deleting', () => {
  it('moves the task to the trash, announces it, and undo restores it', async () => {
    const task = await createTask({ title: 'Call supplier' });
    await deleteTask(task.id);
    expect(await tasksForDay(DAY)).toEqual([]);
    expect((await db.tasks.get(task.id))?.state).toBe('deleted');
    expect(useUndo.getState().toast?.label).toBe('Task deleted');

    await undoLast();
    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['Call supplier']);
    expect(useUndo.getState().toast).toBeNull();
  });
});

describe('undo', () => {
  it('restores only the fields its command changed', async () => {
    const task = await createTask({ title: 'Old name' });
    await setTaskCompleted(task.id, true);
    await renameTask(task.id, 'New name');
    await undoLast(); // undo the rename
    const stored = await db.tasks.get(task.id);
    expect(stored?.title).toBe('Old name');
    expect(stored?.completedDay).toBe(DAY);
  });

  it('returns null when there is nothing to undo', async () => {
    expect(await undoLast()).toBeNull();
  });
});

describe('moveTask', () => {
  it('moves a task to another day and to the backlog', async () => {
    const task = await createTask({ title: 'Prep workshop' });
    await moveTask(task.id, '2026-11-18');
    expect(await tasksForDay(DAY)).toEqual([]);
    expect((await tasksForDay('2026-11-18')).map((t) => t.title)).toEqual(['Prep workshop']);

    await moveTask(task.id, BACKLOG);
    expect((await tasksForDay(BACKLOG)).map((t) => t.title)).toEqual(['Prep workshop']);
  });
});

describe('ordering commands', () => {
  async function titles(day = DAY) {
    return (await tasksForDay(day)).map((t) => t.title);
  }

  it('places a task between two neighbours', async () => {
    const c = await createTask({ title: 'c' });
    const b = await createTask({ title: 'b' });
    const a = await createTask({ title: 'a' });
    expect(await titles()).toEqual(['a', 'b', 'c']);
    await placeTask(a.id, DAY, b.order, c.order);
    expect(await titles()).toEqual(['b', 'a', 'c']);
    await placeTask(a.id, DAY, c.order, null);
    expect(await titles()).toEqual(['b', 'c', 'a']);
  });

  it('nudges one place at a time and stops at the edges', async () => {
    await createTask({ title: 'c' });
    const b = await createTask({ title: 'b' });
    await createTask({ title: 'a' });
    await nudgeTask(b.id, 'up');
    expect(await titles()).toEqual(['b', 'a', 'c']);
    await nudgeTask(b.id, 'up');
    expect(await titles()).toEqual(['b', 'a', 'c']);
    await nudgeTask(b.id, 'down');
    await nudgeTask(b.id, 'down');
    expect(await titles()).toEqual(['a', 'c', 'b']);
  });

  it('moves to the top or bottom of the same day', async () => {
    await createTask({ title: 'c' });
    await createTask({ title: 'b' });
    const a = await createTask({ title: 'a' });
    await moveTask(a.id, DAY, 'bottom');
    expect(await titles()).toEqual(['b', 'c', 'a']);
    await moveTask(a.id, DAY, 'top');
    expect(await titles()).toEqual(['a', 'b', 'c']);
  });

  it('snoozes to the next day, and from the backlog to tomorrow', async () => {
    const task = await createTask({ title: 'later', day: '2026-11-20' });
    await snoozeTask(task.id);
    expect(await titles('2026-11-21')).toEqual(['later']);
    await moveTask(task.id, BACKLOG);
    await snoozeTask(task.id);
    expect(await titles('2026-11-18')).toEqual(['later']);
  });

  it('clears the rollover count when the day changes, but not on reorder', async () => {
    const task = await createTask({ title: 'stale' });
    await db.tasks.update(task.id, { rolloverDays: 3 });
    await moveTask(task.id, DAY, 'bottom');
    expect((await db.tasks.get(task.id))?.rolloverDays).toBe(3);
    await moveTask(task.id, '2026-11-18');
    expect((await db.tasks.get(task.id))?.rolloverDays).toBe(0);
  });
});

describe('duplicateTask', () => {
  it('copies the task and its subtasks, unchecked, directly below the original', async () => {
    await createTask({ title: 'other' });
    const source = await createTask({ title: 'Prep workshop', plannedMin: 120 });
    const sub = await addSubtask(source.id, 'Book room');
    await setSubtaskCompleted(sub.id, true);
    await setTaskCompleted(source.id, true);

    const copy = await duplicateTask(source.id);
    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['Prep workshop', 'Prep workshop', 'other']);
    expect(copy.completedAt).toBeNull();
    expect(copy.plannedMin).toBe(120);
    const copied = await db.subtasks.where('taskId').equals(copy.id).toArray();
    expect(copied.map((s) => [s.title, s.completedAt])).toEqual([['Book room', null]]);

    await undoLast();
    expect(await db.tasks.get(copy.id)).toBeUndefined();
    expect(await db.subtasks.where('taskId').equals(copy.id).count()).toBe(0);
  });
});

describe('subtasks', () => {
  it('adds in order, completes with activity on the task, and undoes', async () => {
    const task = await createTask({ title: 'Draft Q4 report' });
    await addSubtask(task.id, 'Pull revenue numbers');
    const second = await addSubtask(task.id, 'Outline sections');
    const rows = (await db.subtasks.where('taskId').equals(task.id).toArray()).sort((a, b) => (a.order < b.order ? -1 : 1));
    expect(rows.map((s) => s.title)).toEqual(['Pull revenue numbers', 'Outline sections']);

    await setSubtaskCompleted(second.id, true);
    expect((await db.tasks.get(task.id))?.lastActivityDay).toBe(DAY);
    await undoLast();
    expect((await db.subtasks.get(second.id))?.completedAt).toBeNull();
    expect((await db.tasks.get(task.id))?.lastActivityDay).toBeNull();

    await deleteSubtask(second.id);
    expect(await db.subtasks.get(second.id)).toBeUndefined();
    await undoLast();
    expect((await db.subtasks.get(second.id))?.title).toBe('Outline sections');
  });
});

describe('channels', () => {
  it('normalises names and reuses an existing channel', async () => {
    const created = await createChannel('  #Deep Work ');
    expect(created.name).toBe('deep-work');
    const again = await createChannel('deep work');
    expect(again.id).toBe(created.id);
    expect((await createChannel('work')).name).toBe('work');
    expect(await db.channels.count()).toBe(3);
  });
});

describe('commands issued back to back', () => {
  it('never give two tasks the same position', async () => {
    // Fire without waiting, as fast typing does.
    await Promise.all(['a', 'b', 'c', 'd', 'e'].map((title) => createTask({ title })));
    const list = await tasksForDay(DAY);
    expect(new Set(list.map((t) => t.order)).size).toBe(5);
    // Each new task went to the top, so the last one issued is first.
    expect(list.map((t) => t.title)).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('create one channel when the same new name arrives twice', async () => {
    const [first, second] = await Promise.all([createChannel('research'), createChannel('research')]);
    expect(first.id).toBe(second.id);
  });

  it('keep running after one of them fails', async () => {
    const results = await Promise.allSettled([createTask({ title: '  ' }), createTask({ title: 'fine' })]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['fine']);
  });
});

describe('undo pressed straight after a command', () => {
  it('waits for the command to finish, then reverses it', async () => {
    // Neither call is awaited before the next is made.
    const adding = createTask({ title: 'quick' });
    const undoing = undoLast();
    await adding;
    expect(await undoing).toBe('Add task');
    expect(await tasksForDay(DAY)).toEqual([]);
  });
});

describe('backlog', () => {
  it('keeps a bucket and folder while in the backlog, and drops the folder when scheduled', async () => {
    const folder = await createFolder('Home');
    const task = await createTask({ title: 'Fix gate', day: BACKLOG, backlogFolderId: folder.id });
    expect((await db.tasks.get(task.id))?.backlogBucket).toBe('someday');

    // Dropped into another bucket.
    await placeTask(task.id, BACKLOG, null, null, 'month');
    let stored = await db.tasks.get(task.id);
    expect([stored?.backlogBucket, stored?.backlogFolderId]).toEqual(['month', folder.id]);

    await moveTask(task.id, DAY);
    stored = await db.tasks.get(task.id);
    expect(stored?.backlogFolderId).toBeNull();
    await undoLast();
    expect((await db.tasks.get(task.id))?.backlogFolderId).toBe(folder.id);
  });

  it('ignores a folder for a task created on a day', async () => {
    const folder = await createFolder('Home');
    const task = await createTask({ title: 'Today thing', backlogFolderId: folder.id });
    expect(task.backlogFolderId).toBeNull();
  });

  it('reuses a folder of the same name, and deleting one frees its tasks', async () => {
    const folder = await createFolder('Home');
    expect((await createFolder(' home ')).id).toBe(folder.id);
    const task = await createTask({ title: 'Fix gate', day: BACKLOG, backlogFolderId: folder.id });
    await deleteFolder(folder.id);
    expect((await db.tasks.get(task.id))?.backlogFolderId).toBeNull();
    await undoLast();
    expect((await db.tasks.get(task.id))?.backlogFolderId).toBe(folder.id);
    expect(await db.backlogFolders.count()).toBe(1);
  });

  it('has its own priority, untouched by daily priority', async () => {
    const task = await createTask({ title: 'a', day: BACKLOG });
    await setBacklogPriority(task.id, 'high');
    const stored = await db.tasks.get(task.id);
    expect([stored?.backlogPriority, stored?.dailyPriority]).toEqual(['high', 'normal']);
  });
});
