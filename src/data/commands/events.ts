import type { Day } from '@/domain/dates';
import { command, db } from '../db';
import type { CalendarEvent, Id, Session, Task } from '../types';
import { buildTask } from './tasks';
import { recordUndo } from '../undo';

export const createEvent = command(async (input: { title: string; day: Day; startMin: number; endMin: number }): Promise<CalendarEvent> => {
  const event: CalendarEvent = { id: crypto.randomUUID(), channelId: null, blocksTime: true, ...input };
  await db.events.add(event);
  recordUndo('Add event', async () => {
    await db.events.delete(event.id);
  });
  return event;
});

export const updateEvent = command(async (id: Id, patch: Partial<Omit<CalendarEvent, 'id'>>, label: string = 'Change event'): Promise<void> => {
  const before = await db.events.get(id);
  if (!before) return;
  await db.events.update(id, patch);
  recordUndo(label, async () => {
    await db.events.put(before);
  });
});

export const deleteEvent = command(async (id: Id): Promise<void> => {
  const before = await db.events.get(id);
  if (!before) return;
  await db.events.delete(id);
  recordUndo('Event deleted', async () => db.events.put(before).then(() => undefined), true);
});

/**
 * Turns an event into a task: same title, planned for the event's length,
 * and timeboxed in the event's slot. One undo puts the event back.
 */
export const convertEventToTask = command(async (id: Id): Promise<Task | null> => {
  const event = await db.events.get(id);
  if (!event) return null;
  const task = await buildTask({
    title: event.title,
    day: event.day,
    channelId: event.channelId,
    plannedMin: event.endMin - event.startMin,
    position: 'bottom',
  });
  const session: Session = { id: crypto.randomUUID(), taskId: task.id, day: event.day, startMin: event.startMin, endMin: event.endMin };
  await db.tasks.add(task);
  await db.sessions.add(session);
  await db.events.delete(id);
  recordUndo(
    'Turned into a task',
    async () => {
      await db.sessions.delete(session.id);
      await db.tasks.delete(task.id);
      await db.events.put(event);
    },
    true,
  );
  return task;
});
