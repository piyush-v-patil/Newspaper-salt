import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import type { BackupEntry, BackupStore } from '@/platform/types';
import { backupIfDue, runBackup, updateBackupStatus, useBackupStatus } from './autoBackup';
import { parseBackup } from './backup';
import { createTask } from './commands/tasks';
import { db } from './db';

let clock = 0;
const DAY = 24 * 3600 * 1000;

function memoryStore(): BackupStore & { files: Map<string, { at: number; text: string }> } {
  const files = new Map<string, { at: number; text: string }>();
  return {
    files,
    location: async () => null,
    chooseLocation: null,
    list: async () => [...files].map(([id, f]): BackupEntry => ({ id, at: f.at, size: f.text.length })),
    write: async (at, text) => void files.set(`b-${at}`, { at, text }),
    read: async (id) => files.get(id)!.text,
    remove: async (id) => void files.delete(id),
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  updateBackupStatus({ lastAt: null, lastSavedAt: null, lastFingerprint: null, error: null });
  clock = new Date(2026, 10, 17, 9).getTime();
  setClock(() => clock);
  return () => resetClock();
});

describe('automatic backups', () => {
  it('saves when due, skips unchanged data, and saves again once something changes', async () => {
    const store = memoryStore();
    await createTask({ title: 'Draft report' });
    await backupIfDue(store);
    expect(store.files.size).toBe(1);
    // Not due again the same day.
    clock += 3600 * 1000;
    await backupIfDue(store);
    expect(store.files.size).toBe(1);
    // Due the next day, but nothing changed.
    clock += DAY;
    await backupIfDue(store);
    expect(store.files.size).toBe(1);
    expect(useBackupStatus.getState().lastAt).toBe(clock);
    // A change, a day later: saved.
    await createTask({ title: 'Review designs' });
    clock += DAY;
    await backupIfDue(store);
    expect(store.files.size).toBe(2);
    const latest = [...store.files.values()].sort((a, b) => b.at - a.at)[0];
    const parsed = parseBackup(latest.text);
    expect(parsed.ok && (parsed.backup.tables.tasks as { title: string }[]).map((t) => t.title).sort()).toEqual(['Draft report', 'Review designs']);
  });

  it('always saves a manual or safety backup, and prunes old ones', async () => {
    const store = memoryStore();
    for (let i = 0; i < 40; i++) {
      await runBackup('manual', store);
      clock += DAY;
    }
    // 14 recent days plus a few weekly ones.
    expect(store.files.size).toBeGreaterThanOrEqual(14);
    expect(store.files.size).toBeLessThanOrEqual(20);
    await runBackup('safety', store);
    expect(useBackupStatus.getState().lastSavedAt).toBe(clock);
  });

  it('records why a backup failed', async () => {
    const store = { ...memoryStore(), write: async () => Promise.reject(new Error('Disk full')) };
    expect(await runBackup('manual', store)).toBe('failed');
    expect(useBackupStatus.getState().error).toBe('Disk full');
  });
});
