import { today } from '@/domain/clock';
import { shiftDay, type Day } from '@/domain/dates';
import { occurrencesBetween } from '@/domain/recurrence';
import { command, db } from '../db';
import type { CalendarEvent, EventSeries, Id, Repeat, Session, Task } from '../types';
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

/** Repeating events are created this many days ahead, like recurring tasks. */
const EVENT_WINDOW_DAYS = 30;

async function extendEventSeries(series: EventSeries): Promise<void> {
  const horizon = shiftDay(today(), EVENT_WINDOW_DAYS);
  const until = series.endDay !== null && series.endDay < horizon ? series.endDay : horizon;
  const from = shiftDay(series.generatedThrough, 1);
  if (from > until) return;
  // Days that already have an occurrence are skipped, so an extension cut short can safely run again.
  const have = new Set((await db.events.where('seriesId').equals(series.id).toArray()).map((e) => e.day));
  const occurrences = occurrencesBetween(series.repeat, series.startDay, from, until).filter((day) => !have.has(day)).map(
    (day): CalendarEvent => ({ id: crypto.randomUUID(), day, seriesId: series.id, ...series.template }),
  );
  await db.events.bulkAdd(occurrences);
  await db.eventSeries.update(series.id, { generatedThrough: until });
}

/** Tops up every repeating event. Called by the start-of-day housekeeping. */
export async function extendAllEventSeries(): Promise<void> {
  for (const series of await db.eventSeries.toArray()) await extendEventSeries(series);
}

/** Makes an event repeat. The event becomes the first occurrence; the rest are created a month ahead. */
export const makeEventRepeat = command(async (id: Id, repeat: Repeat): Promise<void> => {
  const event = await db.events.get(id);
  if (!event || event.seriesId) return;
  const series: EventSeries = {
    id: crypto.randomUUID(),
    repeat,
    startDay: event.day,
    endDay: null,
    generatedThrough: event.day,
    template: { title: event.title, startMin: event.startMin, endMin: event.endMin, channelId: event.channelId, blocksTime: event.blocksTime },
  };
  await db.eventSeries.add(series);
  await db.events.update(id, { seriesId: series.id });
  await extendEventSeries(series);
  recordUndo('Repeat event', async () => {
    await db.events.where('seriesId').equals(series.id).filter((e) => e.id !== id).delete();
    await db.events.update(id, { seriesId: null });
    await db.eventSeries.delete(series.id);
  });
});

/** Stops a repeating event after this occurrence: later ones are removed. */
export const stopEventSeries = command(async (id: Id): Promise<void> => {
  const event = await db.events.get(id);
  if (!event?.seriesId) return;
  const series = await db.eventSeries.get(event.seriesId);
  if (!series) return;
  const later = await db.events.where('seriesId').equals(series.id).filter((e) => e.day > event.day).toArray();
  await db.events.bulkDelete(later.map((e) => e.id));
  await db.eventSeries.update(series.id, { endDay: event.day });
  recordUndo(
    'Stopped repeating',
    async () => {
      await db.events.bulkPut(later);
      await db.eventSeries.put(series);
    },
    true,
  );
});

/**
 * "Edit all": copies this occurrence's title, time and channel to its series
 * and to every later occurrence. Earlier ones stay as they were.
 */
export const applyEventToSeries = command(async (id: Id): Promise<number> => {
  const event = await db.events.get(id);
  if (!event?.seriesId) return 0;
  const series = await db.eventSeries.get(event.seriesId);
  if (!series) return 0;
  const template = { title: event.title, startMin: event.startMin, endMin: event.endMin, channelId: event.channelId, blocksTime: event.blocksTime };
  const later = await db.events.where('seriesId').equals(series.id).filter((e) => e.day > event.day).toArray();
  await db.eventSeries.update(series.id, { template });
  await db.events.bulkPut(later.map((e) => ({ ...e, ...template })));
  recordUndo(
    'Updated all upcoming',
    async () => {
      await db.events.bulkPut(later);
      await db.eventSeries.put(series);
    },
    true,
  );
  return later.length;
});

/** Deletes this occurrence and every later one, ending the series the day before. */
export const deleteEventAndFollowing = command(async (id: Id): Promise<void> => {
  const event = await db.events.get(id);
  if (!event?.seriesId) return;
  const series = await db.eventSeries.get(event.seriesId);
  if (!series) return;
  const removed = await db.events.where('seriesId').equals(series.id).filter((e) => e.day >= event.day).toArray();
  await db.events.bulkDelete(removed.map((e) => e.id));
  await db.eventSeries.update(series.id, { endDay: shiftDay(event.day, -1) });
  recordUndo(
    removed.length === 1 ? 'Event deleted' : `${removed.length} events deleted`,
    async () => {
      await db.events.bulkPut(removed);
      await db.eventSeries.put(series);
    },
    true,
  );
});
