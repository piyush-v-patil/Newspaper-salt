import { differenceInCalendarDays, format, startOfISOWeek } from 'date-fns';

/** A day's worth of backups, then a weekly one for a while longer. */
export const KEEP_DAYS = 14;
export const KEEP_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StoredBackup {
  id: string;
  /** When it was made. */
  at: number;
}

/** Whether a scheduled backup is owed: none yet, or the last is a day old. */
export function isBackupDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= DAY_MS;
}

/**
 * Which backups to delete. Everything from the last fourteen days stays;
 * before that, the newest backup of each week stays for eight more weeks.
 * The newest backup is never deleted, however old.
 */
export function backupsToDelete(backups: StoredBackup[], now: number): string[] {
  const newestFirst = [...backups].sort((a, b) => b.at - a.at);
  const keptWeeks = new Set<string>();
  const remove: string[] = [];
  newestFirst.forEach((backup, index) => {
    if (index === 0) return;
    const age = differenceInCalendarDays(now, backup.at);
    if (age < KEEP_DAYS) return;
    const week = format(startOfISOWeek(backup.at), 'yyyy-MM-dd');
    const weeksOld = Math.floor(differenceInCalendarDays(now, startOfISOWeek(backup.at)) / 7);
    if (weeksOld <= Math.ceil(KEEP_DAYS / 7) + KEEP_WEEKS && !keptWeeks.has(week)) {
      keptWeeks.add(week);
      return;
    }
    remove.push(backup.id);
  });
  return remove;
}

/** A short fingerprint of a backup's contents, to skip saving the same data twice. */
export function fingerprint(text: string): string {
  // FNV-1a, 32-bit: fast and plenty for "did anything change".
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + text.length.toString(16);
}

/** "life-of-pi-2026-11-17-0930.json": sorts by date, readable in a folder. */
export function backupFileName(at: number): string {
  return `life-of-pi-${format(at, 'yyyy-MM-dd-HHmm')}.json`;
}
