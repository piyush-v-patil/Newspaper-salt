import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { actualByTask, formatElapsed, msToMinutes } from '@/domain/time';
import { db } from '../db';
import { clearUndo, undoLast } from '../undo';
import { createTask, setTaskCompleted } from './tasks';
import { deleteTimeEntry, getRunningTimer, setActualForDay, startTimer, stopTimer, toggleTimer } from './timer';

const DAY = '2026-11-17';
let clock = 0;
const at = (hours: number, minutes = 0, seconds = 0) => (clock = new Date(2026, 10, 17, hours, minutes, seconds).getTime());
const advance = (minutes: number) => (clock += minutes * 60_000);

async function minutesFor(taskId: string, day = DAY) {
  const entries = await db.timeEntries.toArray();
  return msToMinutes(actualByTask(entries, clock).get(taskId)?.byDay.get(day) ?? 0);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  at(9, 0);
  setClock(() => clock);
  return () => resetClock();
});

describe('timer', () => {
  it('tracks time between start and stop', async () => {
    const task = await createTask({ title: 'Draft report' });
    await startTimer(task.id);
    advance(42);
    expect(await minutesFor(task.id)).toBe(42); // counts while running
    await stopTimer();
    advance(10);
    expect(await minutesFor(task.id)).toBe(42);
    expect(await getRunningTimer()).toBeNull();
  });

  it('runs one timer at a time', async () => {
    const a = await createTask({ title: 'a' });
    const b = await createTask({ title: 'b' });
    await startTimer(a.id);
    advance(20);
    await startTimer(b.id);
    advance(15);
    expect(await minutesFor(a.id)).toBe(20);
    expect(await minutesFor(b.id)).toBe(15);
    expect((await getRunningTimer())?.taskId).toBe(b.id);
  });

  it('adds up several sittings', async () => {
    const task = await createTask({ title: 'a' });
    await toggleTimer(task.id);
    advance(25);
    await toggleTimer(task.id);
    advance(60);
    await toggleTimer(task.id);
    advance(10);
    await toggleTimer(task.id);
    expect(await minutesFor(task.id)).toBe(35);
    expect(await db.timeEntries.count()).toBe(2);
  });

  it('leaves no entry for a slip of the key', async () => {
    const task = await createTask({ title: 'a' });
    await startTimer(task.id);
    clock += 400;
    await stopTimer();
    expect(await db.timeEntries.count()).toBe(0);
  });

  it('counts as activity on the task', async () => {
    const task = await createTask({ title: 'a' });
    await startTimer(task.id);
    expect((await db.tasks.get(task.id))?.lastActivityDay).toBe(DAY);
  });

  it('stops when its task is completed, but not when another task is', async () => {
    const a = await createTask({ title: 'a' });
    const b = await createTask({ title: 'b' });
    await startTimer(a.id);
    advance(5);
    await setTaskCompleted(b.id, true);
    expect((await getRunningTimer())?.taskId).toBe(a.id);
    advance(5);
    await setTaskCompleted(a.id, true);
    expect(await getRunningTimer()).toBeNull();
    expect(await minutesFor(a.id)).toBe(10);
  });
});

describe('setActualForDay', () => {
  it('replaces the day with one entry of the typed length, and undoes', async () => {
    const task = await createTask({ title: 'a' });
    await startTimer(task.id);
    advance(12);
    await stopTimer();
    at(15, 0);
    await setActualForDay(task.id, DAY, 45);
    expect(await minutesFor(task.id)).toBe(45);
    expect(await db.timeEntries.count()).toBe(1);

    await undoLast();
    expect(await minutesFor(task.id)).toBe(12);
  });

  it('can log time on a past day without touching today', async () => {
    const task = await createTask({ title: 'a' });
    await setActualForDay(task.id, DAY, 30);
    await setActualForDay(task.id, '2026-11-16', 90);
    expect(await minutesFor(task.id, '2026-11-16')).toBe(90);
    expect(await minutesFor(task.id, DAY)).toBe(30);
  });

  it('clears the day when set to nothing, and leaves a running timer alone', async () => {
    const task = await createTask({ title: 'a' });
    await setActualForDay(task.id, DAY, 30);
    at(9, 30);
    await startTimer(task.id);
    advance(5);
    await setActualForDay(task.id, DAY, null);
    expect(await minutesFor(task.id)).toBe(5);
    expect((await getRunningTimer())?.taskId).toBe(task.id);
  });

  it('will not delete the running entry', async () => {
    const task = await createTask({ title: 'a' });
    await startTimer(task.id);
    await deleteTimeEntry((await getRunningTimer())!.entryId);
    expect(await db.timeEntries.count()).toBe(1);
  });
});

describe('formatElapsed', () => {
  it('shows minutes and seconds, then hours', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(42 * 60_000 + 18_000)).toBe('42:18');
    expect(formatElapsed(62 * 60_000 + 5_000)).toBe('1:02:05');
  });
});

describe('count planned time as actual', () => {
  it('logs the estimate when a task is finished with nothing tracked, and undo removes it', async () => {
    await db.meta.put({ key: 'settings', value: { countPlannedAsActual: true } });
    const task = await createTask({ title: 'Quick call', plannedMin: 20 });
    at(11, 0);
    await setTaskCompleted(task.id, true);
    expect(await minutesFor(task.id)).toBe(20);
    await undoLast();
    expect(await db.timeEntries.count()).toBe(0);
  });

  it('leaves tracked time alone, and does nothing when off', async () => {
    const tracked = await createTask({ title: 'Tracked', plannedMin: 60 });
    const plain = await createTask({ title: 'Plain', plannedMin: 30 });
    await setTaskCompleted(plain.id, true);
    expect(await minutesFor(plain.id)).toBe(0);

    await db.meta.put({ key: 'settings', value: { countPlannedAsActual: true } });
    await startTimer(tracked.id);
    advance(10);
    await setTaskCompleted(tracked.id, true);
    expect(await minutesFor(tracked.id)).toBe(10);
  });
});
