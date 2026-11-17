import { create } from 'zustand';
import { now } from '@/domain/clock';
import { backupsToDelete, fingerprint, isBackupDue } from '@/domain/backupPolicy';
import { platform } from '@/platform';
import type { BackupStore } from '@/platform/types';
import { exportData } from './backup';

const STATE_KEY = 'pi-backup-state';

export interface BackupStatus {
  /** The last time a scheduled check ran (a backup was saved, or nothing had changed). */
  lastAt: number | null;
  /** The last time a backup was actually saved. */
  lastSavedAt: number | null;
  lastFingerprint: string | null;
  /** Web: the last time a backup was downloaded to a file. */
  lastDownloadAt: number | null;
  reminderSnoozedUntil: number | null;
  /** Why the last attempt failed, if it did. */
  error: string | null;
}

const EMPTY: BackupStatus = { lastAt: null, lastSavedAt: null, lastFingerprint: null, lastDownloadAt: null, reminderSnoozedUntil: null, error: null };

function load(): BackupStatus {
  try {
    return { ...EMPTY, ...(JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as Partial<BackupStatus>) };
  } catch {
    return EMPTY;
  }
}

/** Backup status, kept beside (not inside) the data, so taking a backup never changes what is backed up. */
export const useBackupStatus = create<BackupStatus>(() => load());

export function updateBackupStatus(patch: Partial<BackupStatus>): void {
  useBackupStatus.setState(patch);
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(useBackupStatus.getState()));
  } catch {
    /* the status is a convenience; backups still work */
  }
}

export type BackupReason = 'scheduled' | 'manual' | 'safety';

/**
 * Saves a backup and prunes old ones. A scheduled backup is skipped when
 * nothing has changed since the last one; a manual or safety backup (before
 * an import, restore or erase) is always saved.
 */
export async function runBackup(reason: BackupReason, store: BackupStore = platform.backups): Promise<'saved' | 'unchanged' | 'failed'> {
  const at = now();
  try {
    const text = await exportData(at);
    // The export time changes every run; the contents are what matter.
    const print = fingerprint(text.replace(/"exportedAt":\d+,/, ''));
    if (reason === 'scheduled' && print === useBackupStatus.getState().lastFingerprint) {
      updateBackupStatus({ lastAt: at, error: null });
      return 'unchanged';
    }
    await store.write(at, text);
    updateBackupStatus({ lastAt: at, lastSavedAt: at, lastFingerprint: print, error: null });
    for (const id of backupsToDelete(await store.list(), at)) await store.remove(id);
    return 'saved';
  } catch (error) {
    updateBackupStatus({ error: error instanceof Error ? error.message : String(error) });
    return 'failed';
  }
}

/** Runs a scheduled backup if one is owed. */
export async function backupIfDue(store: BackupStore = platform.backups): Promise<void> {
  if (isBackupDue(useBackupStatus.getState().lastAt, now())) await runBackup('scheduled', store);
}
