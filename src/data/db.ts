import Dexie, { type Table } from 'dexie';
import { keyBetween } from '@/domain/ordering';
import { defaultSettings, newProfile } from './defaults';
import type {
  BacklogFolder,
  CalendarEvent,
  Channel,
  Context,
  DayRecord,
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

interface MetaRow {
  key: 'profile' | 'settings';
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
        { id: work, name: 'Work', color: '#4f5bd5', isPersonal: false, order: first },
        { id: personal, name: 'Personal', color: '#2e9f68', isPersonal: true, order: second },
      ]);
      tx.table('channels').bulkAdd([
        { id: crypto.randomUUID(), contextId: work, name: 'work', color: '#4f5bd5', isDefault: false, enabled: true, order: first },
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
  return (row?.value as Profile) ?? newProfile(Date.now());
}
