import { db } from './db';

/** Every table that holds the person's data. Bump BACKUP_VERSION if the shape changes. */
const TABLES = [
  'meta',
  'tasks',
  'subtasks',
  'timeEntries',
  'sessions',
  'events',
  'series',
  'contexts',
  'channels',
  'backlogFolders',
  'objectives',
  'days',
  'weeks',
] as const;

export const BACKUP_VERSION = 1;
const APP = 'life-of-pi';

export interface Backup {
  app: typeof APP;
  version: number;
  exportedAt: number;
  tables: Record<(typeof TABLES)[number], unknown[]>;
}

/** Everything, as one JSON document. */
export async function exportData(exportedAt: number): Promise<string> {
  const tables = {} as Backup['tables'];
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLES) tables[name] = await db.table(name).toArray();
  });
  const backup: Backup = { app: APP, version: BACKUP_VERSION, exportedAt, tables };
  return JSON.stringify(backup);
}

/** Reads a backup file. Returns a plain-language reason when it cannot be used. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'This file is not a Life Of Pi backup: it is not valid JSON.' };
  }
  const candidate = data as Partial<Backup> | null;
  if (!candidate || candidate.app !== APP || typeof candidate.tables !== 'object' || candidate.tables === null) {
    return { ok: false, reason: 'This file is not a Life Of Pi backup.' };
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    return { ok: false, reason: 'This backup was made by a newer version of Life Of Pi. Update the app, then try again.' };
  }
  for (const name of TABLES) {
    if (!Array.isArray((candidate.tables as Record<string, unknown>)[name])) {
      return { ok: false, reason: `This backup is incomplete: it has no ${name} list.` };
    }
  }
  return { ok: true, backup: candidate as Backup };
}

/** Replaces everything with the backup's contents, all at once. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLES) {
      const table = db.table(name);
      await table.clear();
      await table.bulkAdd(backup.tables[name]);
    }
  });
}

/** How many tasks a backup holds, for the confirmation message. */
export function backupTaskCount(backup: Backup): number {
  return (backup.tables.tasks as { state?: string }[]).filter((t) => t.state === 'active').length;
}
