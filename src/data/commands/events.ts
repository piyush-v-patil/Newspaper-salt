import type { Day } from '@/domain/dates';
import { db } from '../db';
import type { CalendarEvent, Id } from '../types';
import { recordUndo } from '../undo';

export async function createEvent(input: { title: string; day: Day; startMin: number; endMin: number }): Promise<CalendarEvent> {
  const event: CalendarEvent = { id: crypto.randomUUID(), channelId: null, blocksTime: true, ...input };
  await db.events.add(event);
  recordUndo('Add event', async () => {
    await db.events.delete(event.id);
  });
  return event;
}

export async function updateEvent(id: Id, patch: Partial<Omit<CalendarEvent, 'id'>>, label = 'Change event'): Promise<void> {
  const before = await db.events.get(id);
  if (!before) return;
  await db.events.update(id, patch);
  recordUndo(label, async () => {
    await db.events.put(before);
  });
}

export async function deleteEvent(id: Id): Promise<void> {
  const before = await db.events.get(id);
  if (!before) return;
  await db.events.delete(id);
  recordUndo('Event deleted', async () => db.events.put(before).then(() => undefined), true);
}
