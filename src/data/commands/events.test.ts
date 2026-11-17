import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { exportData, parseBackup } from '../backup';
import { db } from '../db';
import { clearUndo, undoLast } from '../undo';
import { createEvent, makeEventRepeat, stopEventSeries } from './events';
import { runRollover } from './rollover';

let clock = 0;
const on = (dayOfMonth: number) => (clock = new Date(2026, 10, dayOfMonth, 9).getTime());
const days = async () => (await db.events.toArray()).map((e) => e.day).sort();

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  on(17); // a Tuesday
  setClock(() => clock);
  return () => resetClock();
});

describe('repeating events', () => {
  it('creates occurrences a month ahead, at the same time, and undoes', async () => {
    const standup = await createEvent({ title: 'Standup', day: '2026-11-17', startMin: 570, endMin: 585 });
    await makeEventRepeat(standup.id, { kind: 'weekdays', interval: 1, weekdays: [] });
    const all = await db.events.toArray();
    expect(all.length).toBe(23); // weekdays from Nov 17 to Dec 17 inclusive
    expect(new Set(all.map((e) => `${e.title} ${e.startMin}-${e.endMin}`))).toEqual(new Set(['Standup 570-585']));
    expect((await days()).slice(0, 5)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23']);

    await undoLast();
    expect(await db.events.count()).toBe(1);
    expect(await db.eventSeries.count()).toBe(0);
  });

  it('keeps extending as days pass', async () => {
    const lunch = await createEvent({ title: 'Lunch', day: '2026-11-17', startMin: 750, endMin: 795 });
    await makeEventRepeat(lunch.id, { kind: 'daily', interval: 1, weekdays: [] });
    on(20);
    await runRollover();
    expect((await days()).at(-1)).toBe('2026-12-20');
  });

  it('stops after a chosen occurrence, and undo brings the rest back', async () => {
    const sync = await createEvent({ title: 'Team sync', day: '2026-11-17', startMin: 600, endMin: 660 });
    await makeEventRepeat(sync.id, { kind: 'weekly', interval: 1, weekdays: [2] });
    const nextWeek = (await db.events.toArray()).find((e) => e.day === '2026-11-24')!;
    await stopEventSeries(nextWeek.id);
    expect(await days()).toEqual(['2026-11-17', '2026-11-24']);
    on(30);
    await runRollover();
    expect(await days()).toEqual(['2026-11-17', '2026-11-24']);

    await undoLast();
    expect((await days()).length).toBeGreaterThan(2);
  });

  it('a backup made before repeating events existed still restores', async () => {
    const text = await exportData(1);
    const old = JSON.parse(text);
    delete old.tables.eventSeries;
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.ok).toBe(true);
  });
});
