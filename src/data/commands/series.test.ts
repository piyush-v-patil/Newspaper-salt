import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { db } from '../db';
import { tasksForDay } from '../queries';
import type { Repeat } from '../types';
import { clearUndo, undoLast } from '../undo';
import { runRollover } from './rollover';
import { applyToSeries, deleteIncompleteInstances, makeRecurring, stopRepeating } from './series';
import { addSubtask } from './subtasks';
import { createTask, deleteTask, renameTask, setPlannedTime, setTaskCompleted } from './tasks';

let clock = 0;
const on = (dayOfMonth: number, hour = 9) => (clock = new Date(2026, 10, dayOfMonth, hour).getTime());
const day = (dayOfMonth: number) => `2026-11-${String(dayOfMonth).padStart(2, '0')}`;
const DAILY: Repeat = { kind: 'daily', interval: 1, weekdays: [] };
const titles = async (d: string) => (await tasksForDay(d)).map((t) => t.title);
const instances = async (seriesId: string) => (await db.tasks.where('seriesId').equals(seriesId).toArray()).filter((t) => t.state === 'active');

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  on(17); // a Tuesday
  setClock(() => clock);
  return () => resetClock();
});

describe('makeRecurring', () => {
  it('turns the task into the first instance and creates a month of instances with its details', async () => {
    const task = await createTask({ title: 'Stand-up notes', plannedMin: 15 });
    await addSubtask(task.id, 'Yesterday');
    await addSubtask(task.id, 'Today');
    const series = await makeRecurring(task.id, DAILY);

    const all = await instances(series.id);
    expect(all).toHaveLength(31); // today plus thirty days ahead
    expect((await db.tasks.get(task.id))?.seriesDay).toBe(day(17));
    const tomorrow = (await tasksForDay(day(18)))[0];
    expect([tomorrow.title, tomorrow.plannedMin, tomorrow.seriesDay]).toEqual(['Stand-up notes', 15, day(18)]);
    const subtasks = (await db.subtasks.where('taskId').equals(tomorrow.id).toArray()).sort((a, b) => (a.order < b.order ? -1 : 1));
    expect(subtasks.map((s) => s.title)).toEqual(['Yesterday', 'Today']);
  });

  it('follows the pattern', async () => {
    const task = await createTask({ title: 'Team sync' });
    const series = await makeRecurring(task.id, { kind: 'weekly', interval: 1, weekdays: [2, 4] });
    const days = (await instances(series.id)).map((t) => t.day).sort();
    expect(days.slice(0, 4)).toEqual([day(17), day(19), day(24), day(26)]);
  });

  it('undoes completely', async () => {
    const task = await createTask({ title: 'Stand-up notes' });
    await makeRecurring(task.id, DAILY);
    await undoLast();
    expect(await db.tasks.count()).toBe(1);
    expect(await db.series.count()).toBe(0);
    expect((await db.tasks.get(task.id))?.seriesId).toBeNull();
  });
});

describe('a series over time', () => {
  it('extends as days pass, and never recreates a deleted instance', async () => {
    const task = await createTask({ title: 'Stand-up notes' });
    const series = await makeRecurring(task.id, DAILY);
    const tomorrow = (await tasksForDay(day(18)))[0];
    await deleteTask(tomorrow.id);
    await setTaskCompleted(task.id, true);

    on(18);
    await runRollover();
    expect(await titles(day(18))).toEqual([]);
    expect((await instances(series.id)).map((t) => t.day).sort().at(-1)).toBe('2026-12-18');
  });

  it('drops an untouched instance when it would roll onto the next one', async () => {
    const task = await createTask({ title: 'Water plants' });
    await makeRecurring(task.id, DAILY);
    on(18);
    await runRollover();
    expect(await titles(day(18))).toEqual(['Water plants']);
    expect(await db.tasks.get(task.id)).toBeUndefined();
  });

  it('keeps an instance that was changed by hand, alongside the new one', async () => {
    const task = await createTask({ title: 'Water plants' });
    await makeRecurring(task.id, DAILY);
    await renameTask(task.id, 'Water plants and repot the fern');
    on(18);
    await runRollover();
    expect((await titles(day(18))).sort()).toEqual(['Water plants', 'Water plants and repot the fern']);
  });

  it('rolls an untouched instance forward across days with no instance', async () => {
    const task = await createTask({ title: 'Weekly report' });
    await makeRecurring(task.id, { kind: 'weekly', interval: 1, weekdays: [2] });
    on(19);
    await runRollover();
    expect(await titles(day(19))).toEqual(['Weekly report']);
    on(24); // next Tuesday: meets the next instance
    await runRollover();
    expect(await titles(day(24))).toEqual(['Weekly report']);
    expect(await db.tasks.get(task.id)).toBeUndefined();
  });
});

describe('changing a series', () => {
  it('stop repeating keeps today and the past, removes what is ahead, and can be undone', async () => {
    const task = await createTask({ title: 'Stand-up notes' });
    const series = await makeRecurring(task.id, DAILY);
    await stopRepeating(series.id);
    expect((await instances(series.id)).map((t) => t.day)).toEqual([day(17)]);
    on(18, 9);
    await runRollover();
    // Nothing new is created; the last instance rolls like any task.
    expect(await titles(day(18))).toEqual(['Stand-up notes']);

    on(17);
    await undoLast();
  });

  it('delete all incomplete instances keeps only finished ones', async () => {
    const task = await createTask({ title: 'Stand-up notes' });
    const series = await makeRecurring(task.id, DAILY);
    await setTaskCompleted(task.id, true);
    await deleteIncompleteInstances(series.id);
    expect((await instances(series.id)).map((t) => t.id)).toEqual([task.id]);
    on(20);
    await runRollover();
    expect(await db.tasks.count()).toBe(1);
  });

  it('applies one instance’s details to the rest of the series', async () => {
    const task = await createTask({ title: 'Stand-up notes', plannedMin: 15 });
    const series = await makeRecurring(task.id, DAILY);
    await renameTask(task.id, 'Daily notes');
    await setPlannedTime(task.id, 20);
    expect(await applyToSeries(task.id)).toBe(30);
    const later = (await tasksForDay(day(25)))[0];
    expect([later.title, later.plannedMin]).toEqual(['Daily notes', 20]);
    expect((await db.series.get(series.id))?.template.title).toBe('Daily notes');
    await undoLast();
    expect((await tasksForDay(day(25)))[0].title).toBe('Stand-up notes');
  });
});
