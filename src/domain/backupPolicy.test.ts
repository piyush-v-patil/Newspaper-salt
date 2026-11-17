import { describe, expect, it } from 'vitest';
import { backupFileName, backupsToDelete, fingerprint, isBackupDue } from './backupPolicy';

const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).getTime();

describe('backup policy', () => {
  it('is due with none yet, or after a day', () => {
    expect(isBackupDue(null, at(17))).toBe(true);
    expect(isBackupDue(at(17, 9), at(17, 20))).toBe(false);
    expect(isBackupDue(at(16, 9), at(17, 9))).toBe(true);
  });

  it('keeps two weeks of everything, then one per week, then lets go', () => {
    const now = new Date(2026, 10, 17, 12).getTime();
    // A backup every day from Aug 1 to Nov 17.
    const backups = [];
    for (let t = new Date(2026, 7, 1, 9).getTime(); t <= now; t += 24 * 3600 * 1000) backups.push({ id: String(t), at: t });
    const removed = new Set(backupsToDelete(backups, now));
    const kept = backups.filter((b) => !removed.has(b.id));
    const recent = kept.filter((b) => now - b.at < 14 * 24 * 3600 * 1000);
    expect(recent.length).toBe(14);
    const older = kept.length - recent.length;
    expect(older).toBeGreaterThanOrEqual(8);
    expect(older).toBeLessThanOrEqual(10);
    // Nothing from early August survives.
    expect(kept.some((b) => b.at < new Date(2026, 7, 20).getTime())).toBe(false);
  });

  it('never deletes the only backup, however old', () => {
    expect(backupsToDelete([{ id: 'old', at: at(1) - 365 * 24 * 3600 * 1000 }], at(17))).toEqual([]);
  });

  it('fingerprints change with the contents and names sort by date', () => {
    expect(fingerprint('{"a":1}')).toBe(fingerprint('{"a":1}'));
    expect(fingerprint('{"a":1}')).not.toBe(fingerprint('{"a":2}'));
    expect(backupFileName(new Date(2026, 10, 17, 9, 5).getTime())).toBe('life-of-pi-2026-11-17-0905.json');
  });
});
