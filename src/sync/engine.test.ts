import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { TABLES } from '@/data/backup';
import { PiDatabase } from '@/data/db';
import type { Task } from '@/data/types';
import { Outbox, trackChanges } from './changes';
import { markEverything, replaceWithRemote, syncOnce, type SyncState } from './engine';
import { MemoryTransport } from './transport';

let clock = 0;
let n = 0;

interface Device {
  db: PiDatabase;
  outbox: Outbox;
  state: SyncState;
}

async function device(): Promise<Device> {
  n++;
  const db = new PiDatabase(`device-${n}-${Math.random()}`);
  await db.open();
  const outbox = new Outbox(`outbox-${n}-${Math.random()}`);
  outbox.tracking = true;
  trackChanges(db, TABLES, outbox);
  return { db, outbox, state: { cursor: 0 } };
}

async function sync(d: Device, server: MemoryTransport) {
  const result = await syncOnce(d.db, server, d.outbox, d.state, TABLES);
  d.state = result.state;
  return result;
}

const task = (id: string, title: string): Task =>
  ({ id, title, notes: '', channelId: null, day: '2026-11-17', order: 'a0', plannedMin: null, dailyPriority: 'normal', backlogPriority: 'none', backlogBucket: 'someday', backlogFolderId: null, objectiveId: null, completedAt: null, completedDay: null, rolloverDays: 0, lastActivityDay: null, state: 'active', stateChangedAt: null, seriesId: null, seriesDay: null, edited: false, kind: 'task', createdAt: 0, updatedAt: 0 }) as Task;

beforeEach(() => {
  clock = new Date(2026, 10, 17, 9).getTime();
  setClock(() => clock);
  return () => resetClock();
});

describe('sync between two devices', () => {
  it('carries new and changed records across, and deletions too', async () => {
    const server = new MemoryTransport();
    const laptop = await device();
    const phone = await device();
    // Start from the same account: the laptop uploads its starter data, the phone takes the account's.
    await markEverything(laptop.db, laptop.outbox, TABLES, clock);
    await sync(laptop, server);
    phone.state = await replaceWithRemote(phone.db, server, phone.outbox, TABLES);

    await laptop.db.tasks.add(task('t1', 'Draft report'));
    clock += 1000;
    await sync(laptop, server);
    await sync(phone, server);
    expect((await phone.db.tasks.get('t1'))?.title).toBe('Draft report');
    // Applying it did not queue it to be sent back.
    expect(phone.outbox.size).toBe(0);

    clock += 1000;
    await phone.db.tasks.update('t1', { title: 'Draft Q4 report' });
    await sync(phone, server);
    await sync(laptop, server);
    expect((await laptop.db.tasks.get('t1'))?.title).toBe('Draft Q4 report');

    clock += 1000;
    await laptop.db.tasks.delete('t1');
    await sync(laptop, server);
    await sync(phone, server);
    expect(await phone.db.tasks.get('t1')).toBeUndefined();
    // Both ended with the same channels, settings and profile.
    expect((await phone.db.channels.toArray()).map((c) => c.id).sort()).toEqual((await laptop.db.channels.toArray()).map((c) => c.id).sort());
  });

  it('when both change the same record offline, the later change wins on both', async () => {
    const server = new MemoryTransport();
    const a = await device();
    const b = await device();
    await a.db.tasks.add(task('t1', 'Original'));
    await sync(a, server);
    await sync(b, server);

    clock += 1000;
    await a.db.tasks.update('t1', { title: 'From laptop' });
    clock += 1000;
    await b.db.tasks.update('t1', { title: 'From phone, later' });
    // The earlier change reaches the server last; it still loses.
    await sync(b, server);
    await sync(a, server);
    await sync(b, server);
    expect((await a.db.tasks.get('t1'))?.title).toBe('From phone, later');
    expect((await b.db.tasks.get('t1'))?.title).toBe('From phone, later');
  });

  it('a change made while a newer one waits to be sent is not overwritten by the server', async () => {
    const server = new MemoryTransport();
    const a = await device();
    const b = await device();
    await a.db.tasks.add(task('t1', 'Original'));
    await sync(a, server);
    await sync(b, server);
    clock += 1000;
    await a.db.tasks.update('t1', { title: 'Older edit' });
    await sync(a, server);
    clock += 1000;
    await b.db.tasks.update('t1', { title: 'Newer edit, not yet sent' });
    // Pull only: the server's older version must not replace the newer local one.
    const { pull } = await import('./engine');
    await pull(b.db, server, b.outbox, b.state, TABLES);
    expect((await b.db.tasks.get('t1'))?.title).toBe('Newer edit, not yet sent');
  });
});
