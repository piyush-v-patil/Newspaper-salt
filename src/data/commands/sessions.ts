import { now, nowMinutes, today } from '@/domain/clock';
import { shiftDay, weekdayOf, type Day } from '@/domain/dates';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { autoSchedule, displace, scheduleAnyway, type Interval } from '@/domain/scheduling';
import { db, getSettings } from '../db';
import { BACKLOG, type Id, type Session, type Settings, type Task } from '../types';
import { withSnapshot } from './snapshot';

const DAY_END = 24 * 60;
const lengthOf = (s: Interval) => s.endMin - s.startMin;
const total = (list: Interval[]) => list.reduce((sum, s) => sum + lengthOf(s), 0);

async function requireTask(id: Id): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) throw new Error('That task no longer exists.');
  return task;
}

/** Working hours for a day; an empty span if the day is marked unavailable. */
export function workingWindow(settings: Settings, day: Day): Interval {
  const hours = settings.schedule[weekdayOf(day)];
  return hours?.available ? { startMin: hours.startMin, endMin: hours.endMin } : { startMin: 0, endMin: 0 };
}

/** What is already on a day: events that block time, and the sessions of tasks still in play. */
async function dayState(day: Day) {
  const events = (await db.events.where('day').equals(day).toArray()).filter((e) => e.blocksTime);
  const rows = await db.sessions.where('day').equals(day).toArray();
  const tasks = await db.tasks.bulkGet(rows.map((s) => s.taskId));
  const sessions = rows.filter((_, i) => tasks[i]?.state === 'active');
  const open = rows.filter((_, i) => tasks[i]?.state === 'active' && tasks[i]?.completedAt === null);
  return { events, sessions, open };
}

/** Keeps "planned time equals the total of its sessions" true after a session is added or resized. */
async function syncPlanned(taskId: Id): Promise<void> {
  const sessions = await db.sessions.where('taskId').equals(taskId).toArray();
  if (sessions.length) await db.tasks.update(taskId, { plannedMin: total(sessions), updatedAt: now() });
}

/** How long a new session for this task should be: what is left of its estimate, else the default. */
async function nextSessionLength(task: Task, settings: Settings): Promise<number> {
  if (task.plannedMin === null) return settings.defaultSessionMin;
  const scheduled = total(await db.sessions.where('taskId').equals(task.id).toArray());
  const remaining = task.plannedMin - scheduled;
  return remaining > 0 ? remaining : settings.defaultSessionMin;
}

/** A task shows on the day it is scheduled. */
async function bringTaskToDay(task: Task, day: Day): Promise<void> {
  if (task.day === day) return;
  const keys = (await db.tasks.where('[state+day]').equals(['active', day]).toArray()).map((t) => t.order).sort(compareKeys);
  await db.tasks.update(task.id, { day, order: keyAtEdge(keys, 'bottom'), rolloverDays: 0, updatedAt: now() });
}

/** Moves any open sessions the given one landed on to the next free time. Returns how many were affected. */
async function makeRoom(session: Session, settings: Settings): Promise<number> {
  const { events, open } = await dayState(session.day);
  const others = open.filter((s) => s.id !== session.id);
  const { moves, removed } = displace(session, others, events, workingWindow(settings, session.day), settings.autoScheduleGapMin);
  for (const move of moves) await db.sessions.update(move.id, { startMin: move.startMin, endMin: move.endMin });
  await db.sessions.bulkDelete(removed);
  return moves.length + removed.length;
}

interface PlaceOptions {
  /** Move other sessions out of the way. Off when Shift is held. */
  reschedule?: boolean;
}

/** Timeboxes a task at a chosen time (dragging it onto the calendar). */
export async function scheduleTaskAt(taskId: Id, day: Day, startMin: number, options: PlaceOptions = {}): Promise<Session> {
  const task = await requireTask(taskId);
  const settings = await getSettings();
  const duration = await nextSessionLength(task, settings);
  const session: Session = {
    id: crypto.randomUUID(),
    taskId,
    day,
    startMin,
    endMin: Math.min(startMin + duration, DAY_END),
  };
  return withSnapshot('Add to calendar', { taskIds: [taskId], days: [day] }, async () => {
    await db.sessions.add(session);
    await bringTaskToDay(task, day);
    if ((options.reschedule ?? true) && settings.rescheduleOnConflict) await makeRoom(session, settings);
    await syncPlanned(taskId);
    return session;
  });
}

/** Moves or resizes a session. Its task's planned time follows the new total. */
export async function changeSession(id: Id, next: { day: Day; startMin: number; endMin: number }, options: PlaceOptions = {}): Promise<void> {
  const before = await db.sessions.get(id);
  if (!before) return;
  const task = await requireTask(before.taskId);
  const settings = await getSettings();
  const updated: Session = { ...before, ...next };
  await withSnapshot('Move on calendar', { taskIds: [task.id], days: [before.day, next.day] }, async () => {
    await db.sessions.put(updated);
    if (next.day !== before.day) {
      const stillOnOldDay = await db.sessions.where('taskId').equals(task.id).filter((s) => s.day === before.day).count();
      if (task.day === before.day && stillOnOldDay === 0) await bringTaskToDay(task, next.day);
    }
    if ((options.reschedule ?? true) && settings.rescheduleOnConflict) await makeRoom(updated, settings);
    await syncPlanned(task.id);
  });
}

/** Takes one session off the calendar. The task and its estimate stay. */
export async function removeSession(id: Id): Promise<void> {
  const session = await db.sessions.get(id);
  if (!session) return;
  await withSnapshot('Remove from calendar', { taskIds: [session.taskId] }, async () => {
    await db.sessions.delete(id);
  });
}

/** Takes a task off the calendar for one day (Ctrl+X). */
export async function clearSessions(taskId: Id, day: Day): Promise<void> {
  const ids = (await db.sessions.where('taskId').equals(taskId).toArray()).filter((s) => s.day === day).map((s) => s.id);
  if (ids.length === 0) return;
  await withSnapshot('Remove from calendar', { taskIds: [taskId] }, async () => {
    await db.sessions.bulkDelete(ids);
  });
}

async function addBlocks(task: Task, day: Day, blocks: Interval[], label: string): Promise<void> {
  await withSnapshot(label, { taskIds: [task.id], days: [day] }, async () => {
    await db.sessions.bulkAdd(blocks.map((b) => ({ id: crypto.randomUUID(), taskId: task.id, day, ...b })));
    await bringTaskToDay(task, day);
    await syncPlanned(task.id);
  });
}

async function findRoom(task: Task, day: Day, settings: Settings, allowSplit: boolean): Promise<Interval[] | null> {
  const current = today();
  if (day < current) return null;
  const { events, sessions } = await dayState(day);
  return autoSchedule({
    durationMin: await nextSessionLength(task, settings),
    busy: [...events, ...sessions],
    window: workingWindow(settings, day),
    notBefore: day === current ? nowMinutes() : 0,
    gap: settings.autoScheduleGapMin,
    allowSplit,
  });
}

const dayFor = (task: Task): Day => (task.day === BACKLOG ? today() : task.day);

/**
 * Finds the next free time on the task's day and timeboxes it there (X).
 * Returns 'no-room' without changing anything when the day is full.
 */
export async function autoScheduleTask(taskId: Id, options: { allowSplit?: boolean } = {}): Promise<'scheduled' | 'no-room'> {
  const task = await requireTask(taskId);
  const settings = await getSettings();
  const day = dayFor(task);
  const blocks = await findRoom(task, day, settings, options.allowSplit ?? true);
  if (!blocks) return 'no-room';
  await addBlocks(task, day, blocks, 'Add to calendar');
  return 'scheduled';
}

/** Books the task after everything else on its day, outside working hours if need be. */
export async function scheduleTaskAnyway(taskId: Id): Promise<void> {
  const task = await requireTask(taskId);
  const settings = await getSettings();
  const day = dayFor(task) < today() ? today() : dayFor(task);
  const { events, sessions } = await dayState(day);
  const block = scheduleAnyway(
    await nextSessionLength(task, settings),
    [...events, ...sessions],
    workingWindow(settings, day),
    day === today() ? nowMinutes() : 0,
  );
  if (block) await addBlocks(task, day, [block], 'Add to calendar');
}

/** Moves the task to the next day that has room (looking up to a month ahead) and timeboxes it there. */
export async function scheduleOnNextFreeDay(taskId: Id): Promise<Day | null> {
  const task = await requireTask(taskId);
  const settings = await getSettings();
  const from = dayFor(task) < today() ? today() : dayFor(task);
  for (let offset = 1; offset <= 31; offset++) {
    const day = shiftDay(from, offset);
    const blocks = await findRoom(task, day, settings, true);
    if (blocks) {
      await addBlocks(task, day, blocks, 'Schedule another day');
      return day;
    }
  }
  return null;
}
