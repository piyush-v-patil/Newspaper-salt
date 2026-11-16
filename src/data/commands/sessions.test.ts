import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { db } from '../db';
import { clearUndo, undoLast } from '../undo';
import { createEvent } from './events';
import {
  autoScheduleTask,
  changeSession,
  clearSessions,
  scheduleOnNextFreeDay,
  scheduleTaskAnyway,
  scheduleTaskAt,
} from './sessions';
import { createTask, moveTask, setPlannedTime, setTaskCompleted } from './tasks';
import { BACKLOG } from '../types';

const DAY = '2026-11-17';
const TOMORROW = '2026-11-18';
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const at = (hours: number, minutes = 0) => setClock(() => new Date(2026, 10, 17, hours, minutes).getTime());

/** A task's sessions as [day, start, end], in time order. */
async function sessionsOf(taskId: string) {
  const rows = await db.sessions.where('taskId').equals(taskId).toArray();
  return rows.sort((a, b) => (a.day + String(a.startMin).padStart(4, '0') < b.day + String(b.startMin).padStart(4, '0') ? -1 : 1)).map((s) => [s.day, s.startMin, s.endMin]);
}
const planned = async (id: string) => (await db.tasks.get(id))?.plannedMin;

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  at(8, 0);
  return () => resetClock();
});

describe('scheduleTaskAt', () => {
  it('uses the planned time as the session length', async () => {
    const task = await createTask({ title: 'Draft report', plannedMin: 90 });
    await scheduleTaskAt(task.id, DAY, h(9));
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(9), h(10, 30)]]);
    expect(await planned(task.id)).toBe(90);
  });

  it('uses the default length for an unestimated task, and that becomes its estimate', async () => {
    const task = await createTask({ title: 'Quick call' });
    await scheduleTaskAt(task.id, DAY, h(11));
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(11), h(11, 30)]]);
    expect(await planned(task.id)).toBe(30);
  });

  it('brings the task to the day it is scheduled on', async () => {
    const task = await createTask({ title: 'Someday', day: BACKLOG, plannedMin: 30 });
    await scheduleTaskAt(task.id, TOMORROW, h(9));
    expect((await db.tasks.get(task.id))?.day).toBe(TOMORROW);
  });

  it('undoes as one step', async () => {
    const task = await createTask({ title: 'Someday', day: BACKLOG });
    await scheduleTaskAt(task.id, DAY, h(9));
    await undoLast();
    expect(await sessionsOf(task.id)).toEqual([]);
    const restored = await db.tasks.get(task.id);
    expect(restored?.day).toBe(BACKLOG);
    expect(restored?.plannedMin).toBeNull();
  });
});

describe('changeSession', () => {
  it('resizing updates the planned time', async () => {
    const task = await createTask({ title: 'Draft report', plannedMin: 60 });
    const session = await scheduleTaskAt(task.id, DAY, h(9));
    await changeSession(session.id, { day: DAY, startMin: h(9), endMin: h(10, 45) });
    expect(await planned(task.id)).toBe(105);
  });

  it('dropping onto other sessions moves them to the next free time, and undo restores them', async () => {
    const a = await createTask({ title: 'a', plannedMin: 60 });
    const b = await createTask({ title: 'b', plannedMin: 60 });
    const sa = await scheduleTaskAt(a.id, DAY, h(9));
    await scheduleTaskAt(b.id, DAY, h(10));
    await changeSession(sa.id, { day: DAY, startMin: h(9, 30), endMin: h(10, 30) });
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(10, 30), h(11, 30)]]);

    await undoLast();
    expect(await sessionsOf(a.id)).toEqual([[DAY, h(9), h(10)]]);
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(10), h(11)]]);
  });

  it('leaves others alone when rescheduling is skipped', async () => {
    const a = await createTask({ title: 'a', plannedMin: 60 });
    const b = await createTask({ title: 'b', plannedMin: 60 });
    const sa = await scheduleTaskAt(a.id, DAY, h(9));
    await scheduleTaskAt(b.id, DAY, h(10));
    await changeSession(sa.id, { day: DAY, startMin: h(9, 30), endMin: h(10, 30) }, { reschedule: false });
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(10), h(11)]]);
  });

  it('never moves an event, and works around it', async () => {
    await createEvent({ title: 'Standup', day: DAY, startMin: h(11), endMin: h(11, 30) });
    const a = await createTask({ title: 'a', plannedMin: 60 });
    const b = await createTask({ title: 'b', plannedMin: 60 });
    await scheduleTaskAt(b.id, DAY, h(10));
    await scheduleTaskAt(a.id, DAY, h(9, 30));
    // b cannot start at 10:30 for an hour because of the 11:00 event.
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(11, 30), h(12, 30)]]);
    expect((await db.events.toArray())[0].startMin).toBe(h(11));
  });

  it('moving a session to another day takes the task with it', async () => {
    const task = await createTask({ title: 'a', plannedMin: 30 });
    const session = await scheduleTaskAt(task.id, DAY, h(9));
    await changeSession(session.id, { day: TOMORROW, startMin: h(14), endMin: h(14, 30) });
    expect((await db.tasks.get(task.id))?.day).toBe(TOMORROW);
  });
});

describe('autoScheduleTask', () => {
  it('books the next free time after now, around what is there', async () => {
    at(9, 52);
    await createEvent({ title: 'Standup', day: DAY, startMin: h(10), endMin: h(10, 30) });
    const task = await createTask({ title: 'Review designs', plannedMin: 45 });
    expect(await autoScheduleTask(task.id)).toBe('scheduled');
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(10, 30), h(11, 15)]]);
  });

  it('schedules only what is left of the estimate', async () => {
    const task = await createTask({ title: 'Long one', plannedMin: 120 });
    const first = await scheduleTaskAt(task.id, DAY, h(9));
    await changeSession(first.id, { day: DAY, startMin: h(9), endMin: h(10) });
    await db.tasks.update(task.id, { plannedMin: 120 });
    expect(await autoScheduleTask(task.id)).toBe('scheduled');
    expect(await sessionsOf(task.id)).toEqual([
      [DAY, h(9), h(10)],
      [DAY, h(10), h(11)],
    ]);
  });

  it('reports no room and changes nothing when the day is full', async () => {
    await createEvent({ title: 'Offsite', day: DAY, startMin: h(9), endMin: h(17) });
    const task = await createTask({ title: 'Squeeze in', plannedMin: 30 });
    expect(await autoScheduleTask(task.id)).toBe('no-room');
    expect(await sessionsOf(task.id)).toEqual([]);
  });

  it('can schedule anyway, after everything else', async () => {
    await createEvent({ title: 'Offsite', day: DAY, startMin: h(9), endMin: h(17) });
    const task = await createTask({ title: 'Squeeze in', plannedMin: 30 });
    await scheduleTaskAnyway(task.id);
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(17), h(17, 30)]]);
  });

  it('can move to the next day with room', async () => {
    await createEvent({ title: 'Offsite', day: DAY, startMin: h(9), endMin: h(17) });
    await createEvent({ title: 'Offsite', day: TOMORROW, startMin: h(9), endMin: h(17) });
    const task = await createTask({ title: 'Squeeze in', plannedMin: 30 });
    expect(await scheduleOnNextFreeDay(task.id)).toBe('2026-11-19');
    expect(await sessionsOf(task.id)).toEqual([['2026-11-19', h(9), h(9, 30)]]);
    expect((await db.tasks.get(task.id))?.day).toBe('2026-11-19');
  });
});

describe('completing a timeboxed task', () => {
  it('ends a session in progress now and pulls back-to-back sessions forward', async () => {
    const a = await createTask({ title: 'a', plannedMin: 60 });
    const b = await createTask({ title: 'b', plannedMin: 30 });
    const c = await createTask({ title: 'c', plannedMin: 30 });
    await scheduleTaskAt(a.id, DAY, h(9));
    await scheduleTaskAt(b.id, DAY, h(10));
    await scheduleTaskAt(c.id, DAY, h(13));
    at(9, 41);
    await setTaskCompleted(a.id, true);
    expect(await sessionsOf(a.id)).toEqual([[DAY, h(9), h(9, 40)]]);
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(9, 40), h(10, 10)]]);
    // c was after a long break, so it stays.
    expect(await sessionsOf(c.id)).toEqual([[DAY, h(13), h(13, 30)]]);
    // The estimate is history now; it is not rewritten.
    expect(await planned(a.id)).toBe(60);

    await undoLast();
    expect(await sessionsOf(a.id)).toEqual([[DAY, h(9), h(10)]]);
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(10), h(10, 30)]]);
    expect((await db.tasks.get(a.id))?.completedAt).toBeNull();
  });

  it('removes a session that had not started, and keeps one already finished', async () => {
    const early = await createTask({ title: 'early', plannedMin: 30 });
    const late = await createTask({ title: 'late', plannedMin: 30 });
    await scheduleTaskAt(early.id, DAY, h(8, 30));
    await scheduleTaskAt(late.id, DAY, h(15));
    at(12, 0);
    await setTaskCompleted(early.id, true);
    await setTaskCompleted(late.id, true);
    expect(await sessionsOf(early.id)).toEqual([[DAY, h(8, 30), h(9)]]);
    expect(await sessionsOf(late.id)).toEqual([]);
  });

  it('does not pull sessions forward when the setting is off', async () => {
    await db.meta.put({ key: 'settings', value: { rescheduleOnEarlyFinish: false } });
    const a = await createTask({ title: 'a', plannedMin: 60 });
    const b = await createTask({ title: 'b', plannedMin: 30 });
    await scheduleTaskAt(a.id, DAY, h(9));
    await scheduleTaskAt(b.id, DAY, h(10));
    at(9, 30);
    await setTaskCompleted(a.id, true);
    expect(await sessionsOf(b.id)).toEqual([[DAY, h(10), h(10, 30)]]);
  });
});

describe('moving a timeboxed task', () => {
  it('to a later day removes upcoming sessions and keeps past ones', async () => {
    const task = await createTask({ title: 'multi', plannedMin: 120 });
    await scheduleTaskAt(task.id, DAY, h(8, 30));
    await db.tasks.update(task.id, { plannedMin: 240 });
    await scheduleTaskAt(task.id, DAY, h(15));
    at(12, 0);
    await moveTask(task.id, TOMORROW);
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(8, 30), h(10, 30)]]);

    await undoLast();
    expect((await sessionsOf(task.id)).length).toBe(2);
    expect((await db.tasks.get(task.id))?.day).toBe(DAY);
  });

  it('to the backlog removes upcoming sessions', async () => {
    const task = await createTask({ title: 'later', plannedMin: 30 });
    await scheduleTaskAt(task.id, DAY, h(15));
    await moveTask(task.id, BACKLOG);
    expect(await sessionsOf(task.id)).toEqual([]);
  });

  it('keeps sessions that are already on the day it moves to', async () => {
    const task = await createTask({ title: 'two days', plannedMin: 30 });
    await scheduleTaskAt(task.id, TOMORROW, h(9));
    await db.tasks.update(task.id, { day: DAY });
    await moveTask(task.id, TOMORROW);
    expect(await sessionsOf(task.id)).toEqual([[TOMORROW, h(9), h(9, 30)]]);
  });
});

describe('estimate and calendar stay in step', () => {
  it('changing the estimate resizes the last session', async () => {
    const task = await createTask({ title: 'a', plannedMin: 60 });
    await scheduleTaskAt(task.id, DAY, h(9));
    await setPlannedTime(task.id, 90);
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(9), h(10, 30)]]);
    await undoLast();
    expect(await sessionsOf(task.id)).toEqual([[DAY, h(9), h(10)]]);
    expect(await planned(task.id)).toBe(60);
  });

  it('Ctrl+X clears the day but keeps the estimate', async () => {
    const task = await createTask({ title: 'a', plannedMin: 60 });
    await scheduleTaskAt(task.id, DAY, h(9));
    await clearSessions(task.id, DAY);
    expect(await sessionsOf(task.id)).toEqual([]);
    expect(await planned(task.id)).toBe(60);
  });
});
