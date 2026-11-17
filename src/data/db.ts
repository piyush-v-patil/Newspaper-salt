import Dexie, { type Table } from 'dexie';
import { keyBetween } from '@/domain/ordering';
import { defaultSettings, newProfile } from './defaults';
import type {
  BacklogFolder,
  CalendarEvent,
  Channel,
  Context,
  DayRecord,
  EventSeries,
  Objective,
  Profile,
  Series,
  Session,
  Settings,
  Subtask,
  Task,
  TimeEntry,
  WeekRecord,
} from './types';

const OLD_WORK_COLOR = '#4f5bd5';
export const WORK_COLOR = '#f5a623';

interface MetaRow {
  key: 'profile' | 'settings' | 'timer';
  value: unknown;
}

export class PiDatabase extends Dexie {
  meta!: Table<MetaRow, string>;
  tasks!: Table<Task, string>;
  subtasks!: Table<Subtask, string>;
  timeEntries!: Table<TimeEntry, string>;
  sessions!: Table<Session, string>;
  events!: Table<CalendarEvent, string>;
  series!: Table<Series, string>;
  eventSeries!: Table<EventSeries, string>;
  contexts!: Table<Context, string>;
  channels!: Table<Channel, string>;
  backlogFolders!: Table<BacklogFolder, string>;
  objectives!: Table<Objective, string>;
  days!: Table<DayRecord, string>;
  weeks!: Table<WeekRecord, string>;

  constructor(name = 'life-of-pi') {
    super(name);
    this.version(1).stores({
      meta: 'key',
      tasks: 'id, [state+day], state, objectiveId, seriesId',
      subtasks: 'id, taskId',
      timeEntries: 'id, taskId, start',
      sessions: 'id, taskId, day',
      events: 'id, day',
      series: 'id',
      contexts: 'id',
      channels: 'id, contextId',
      backlogFolders: 'id',
      objectives: 'id, weekStart',
      days: 'day',
      weeks: 'weekStart',
    });
    // Version 2: repeating events.
    this.version(2).stores({
      events: 'id, day, seriesId',
      eventSeries: 'id',
    });
    // Version 3: the default work colour moved from indigo to orange.
    this.version(3).stores({}).upgrade(async (tx) => {
      for (const table of ['channels', 'contexts']) {
        await tx.table(table).filter((row) => row.color === OLD_WORK_COLOR).modify({ color: WORK_COLOR });
      }
    });

    this.on('populate', (tx) => {
      const createdAt = Date.now();
      tx.table('meta').bulkAdd([
        { key: 'settings', value: defaultSettings },
        { key: 'profile', value: newProfile(createdAt) },
      ]);
      const work = crypto.randomUUID();
      const personal = crypto.randomUUID();
      const first = keyBetween(null, null);
      const second = keyBetween(first, null);
      tx.table('contexts').bulkAdd([
        { id: work, name: 'Work', color: WORK_COLOR, isPersonal: false, order: first },
        { id: personal, name: 'Personal', color: '#2e9f68', isPersonal: true, order: second },
      ]);
      tx.table('channels').bulkAdd([
        { id: crypto.randomUUID(), contextId: work, name: 'work', color: WORK_COLOR, isDefault: false, enabled: true, order: first },
        { id: crypto.randomUUID(), contextId: personal, name: 'personal', color: '#2e9f68', isDefault: false, enabled: true, order: second },
      ]);
    });
  }
}

export const db = new PiDatabase();

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get('settings');
  return { ...defaultSettings, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function getProfile(): Promise<Profile> {
  const row = await db.meta.get('profile');
  // Older profiles may lack newer fields; fill them from the defaults.
  return { ...newProfile(Date.now()), ...((row?.value as Partial<Profile>) ?? {}) };
}

let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs write commands one at a time, in the order they were issued. Two
 * commands issued back to back therefore never interleave: the second sees
 * everything the first wrote. Without this, two quick adds could read the
 * same list and choose the same position.
 *
 * A command must never call another queued command, or it would wait for
 * itself. Shared steps live in plain functions that commands call directly.
 */
export function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = tail.then(work, work);
  tail = run.catch(() => undefined);
  return run;
}

/** Wraps a command so every call goes through the queue. */
export function command<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return (...args: A) => serial(() => fn(...args));
}
