import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { db, getSettings } from '../db';
import { tasksForDay } from '../queries';
import { BACKLOG } from '../types';
import { clearUndo, undoLast, useUndo } from '../undo';
import { updateSettings } from './settings';
import { createTask, deleteTask, moveTask, renameTask, setTaskCompleted } from './tasks';

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
