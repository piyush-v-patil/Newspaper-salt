import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { db } from '../db';
import { tasksForDay } from '../queries';
import { clearUndo, undoLast } from '../undo';
import { emptyArchive, restoreTask, runRollover } from './rollover';
import { updateSettings } from './settings';
import { addSubtask, setSubtaskCompleted } from './subtasks';
import { createTask, deleteTask, setDailyPriority, setTaskCompleted } from './tasks';
import { startTimer, stopTimer } from './timer';
import { BACKLOG } from '../types';

let clock = 0;
/** Sets the clock to a day in November 2026, at 09:00 unless told otherwise. */
const on = (dayOfMonth: number, hour = 9) => (clock = new Date(2026, 10, dayOfMonth, hour).getTime());
const day = (dayOfMonth: number) => `2026-11-${String(dayOfMonth).padStart(2, '0')}`;
const titles = async (d: string) => (await tasksForDay(d)).map((t) => t.title);
const get = async (id: string) => (await db.tasks.get(id))!;

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  on(17);
  setClock(() => clock);
  return () => resetClock();
});

describe('rollover', () => {
  it('moves unfinished tasks to today and counts the day', async () => {
    const task = await createTask({ title: 'Draft report' });
    on(18);
    expect(await runRollover()).toEqual({ moved: 1, archived: 0 });
    expect(await titles(day(18))).toEqual(['Draft report']);
    expect(await titles(day(17))).toEqual([]);
    expect((await get(task.id)).rolloverDays).toBe(1);
  });

  it('does nothing when run again on the same day', async () => {
    const task = await createTask({ title: 'a' });
    on(18);
    await runRollover();
    expect(await runRollover()).toEqual({ moved: 0, archived: 0 });
    expect((await get(task.id)).rolloverDays).toBe(1);
  });

  it('leaves completed tasks, the backlog and future days where they are', async () => {
    const done = await createTask({ title: 'done' });
    await setTaskCompleted(done.id, true);
    await createTask({ title: 'someday', day: BACKLOG });
    await createTask({ title: 'friday', day: day(20) });
    on(18);
    await runRollover();
    expect(await titles(day(17))).toEqual(['done']);
    expect(await titles(BACKLOG)).toEqual(['someday']);
    expect(await titles(day(20))).toEqual(['friday']);
    expect(await titles(day(18))).toEqual([]);
  });

  it('counts every day the app was closed', async () => {
    const task = await createTask({ title: 'a' });
    on(20);
    await runRollover();
    expect((await get(task.id)).rolloverDays).toBe(3);
    expect((await get(task.id)).day).toBe(day(20));
  });

  it('puts rolled tasks at the top in their old order, or at the bottom when set', async () => {
    await createTask({ title: 'two' });
    await createTask({ title: 'one' });
    await createTask({ title: 'already here', day: day(18) });
    on(18);
    await runRollover();
    expect(await titles(day(18))).toEqual(['one', 'two', 'already here']);

    await updateSettings({ rolloverPosition: 'bottom' });
    await createTask({ title: 'late', day: day(18) });
    on(19);
    await runRollover();
    expect(await titles(day(19))).toEqual(['late', 'one', 'two', 'already here']);
    await createTask({ title: 'new today', day: day(19), position: 'bottom' });
    on(20);
    await runRollover();
    expect(await titles(day(20))).toEqual(['late', 'one', 'two', 'already here', 'new today']);
  });

  it('resets daily priority', async () => {
    const task = await createTask({ title: 'a' });
    await setDailyPriority(task.id, 'urgent');
    on(18);
    await runRollover();
    expect((await get(task.id)).dailyPriority).toBe('normal');
  });
});

describe('auto-archive', () => {
  it('archives a task once it has rolled over more than four days in a row', async () => {
    const task = await createTask({ title: 'stale' });
    for (const d of [18, 19, 20, 21]) {
      on(d);
      await runRollover();
    }
    expect((await get(task.id)).state).toBe('active');
    expect((await get(task.id)).rolloverDays).toBe(4);

    on(22);
    expect(await runRollover()).toEqual({ moved: 0, archived: 1 });
    expect((await get(task.id)).state).toBe('archived');
    expect(await titles(day(22))).toEqual([]);
  });

  it('keeps a task out of the archive while there is activity on it', async () => {
    const timed = await createTask({ title: 'timed' });
    const stepped = await createTask({ title: 'stepped' });
    const sub = await addSubtask(stepped.id, 'first step');
    for (const d of [18, 19, 20, 21]) {
      on(d);
      await runRollover();
    }
    // Day 21: work on both.
    await startTimer(timed.id);
    clock += 10 * 60_000;
    await stopTimer();
    await setSubtaskCompleted(sub.id, true);

    on(22);
    await runRollover();
    expect((await get(timed.id)).state).toBe('active');
    expect((await get(timed.id)).rolloverDays).toBe(1);
    expect((await get(stepped.id)).rolloverDays).toBe(1);
  });

  it('follows the threshold setting, and can be turned off', async () => {
    await updateSettings({ archiveAfterDays: 1 });
    const quick = await createTask({ title: 'quick' });
    on(18);
    await runRollover();
    expect((await get(quick.id)).state).toBe('active');
    on(19);
    await runRollover();
    expect((await get(quick.id)).state).toBe('archived');

    await updateSettings({ archiveAfterDays: null });
    const patient = await createTask({ title: 'patient' });
    on(30);
    await runRollover();
    expect((await get(patient.id)).state).toBe('active');
    expect((await get(patient.id)).rolloverDays).toBe(11);
  });

  it('archives a long-neglected task straight away when the app has been closed', async () => {
    const task = await createTask({ title: 'forgotten' });
    on(27);
    await runRollover();
    expect((await get(task.id)).state).toBe('archived');
  });

  it('restores an archived task to today with a clean count', async () => {
    const task = await createTask({ title: 'stale' });
    on(27);
    await runRollover();
    await restoreTask(task.id);
    const restored = await get(task.id);
    expect([restored.state, restored.day, restored.rolloverDays]).toEqual(['active', day(27), 0]);
    await undoLast();
    expect((await get(task.id)).state).toBe('archived');
  });

  it('empties the archive into the trash, undoably', async () => {
    const task = await createTask({ title: 'stale' });
    on(27);
    await runRollover();
    await emptyArchive();
    expect((await get(task.id)).state).toBe('deleted');
    await undoLast();
    expect((await get(task.id)).state).toBe('archived');
  });
});

describe('trash', () => {
  it('keeps a deleted task for a week, then removes it and everything attached', async () => {
    const task = await createTask({ title: 'gone' });
    await addSubtask(task.id, 'step');
    await deleteTask(task.id);

    on(23);
    await runRollover();
    expect(await db.tasks.get(task.id)).toBeDefined();

    on(25);
    await runRollover();
    expect(await db.tasks.get(task.id)).toBeUndefined();
    expect(await db.subtasks.count()).toBe(0);
  });
});
