import { format } from 'date-fns';
import { HardDriveDownload } from 'lucide-react';
import { updateBackupStatus, useBackupStatus } from '@/data/autoBackup';
import { exportData } from '@/data/backup';
import { useProfile } from '@/data/ReferenceData';
import { now } from '@/domain/clock';
import { platform } from '@/platform';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Web only: a browser cannot save files on its own, so once a week this
 * asks to download a copy. "Later" puts it off for a week.
 */
export function BackupReminder() {
  const { createdAt } = useProfile();
  const { lastDownloadAt, reminderSnoozedUntil } = useBackupStatus();
  const at = now();
  if (platform.kind !== 'web') return null;
  if (at - createdAt < WEEK) return null;
  if (lastDownloadAt !== null && at - lastDownloadAt < WEEK) return null;
  if (reminderSnoozedUntil !== null && at < reminderSnoozedUntil) return null;

  async function download() {
    const stamp = now();
    if (await platform.saveTextFile(`life-of-pi-backup-${format(stamp, 'yyyy-MM-dd')}.json`, await exportData(stamp), 'application/json')) {
      updateBackupStatus({ lastDownloadAt: stamp, reminderSnoozedUntil: null });
    }
  }

  return (
    <div role="note" aria-label="Back up your data" className="mx-1 mt-auto flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-[12.5px]">
      <p className="flex items-center gap-1.5 font-medium text-ink">
        <HardDriveDownload size={14} /> Back up your data
      </p>
      <p className="leading-relaxed text-ink-3">
        {lastDownloadAt === null ? 'You haven’t saved a copy outside this browser yet.' : `Last copy saved ${format(lastDownloadAt, 'MMM d')}.`}
      </p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => void download()} className="h-7 rounded-md bg-ink px-2.5 font-medium text-canvas hover:opacity-90">
          Download
        </button>
        <button type="button" onClick={() => updateBackupStatus({ reminderSnoozedUntil: now() + WEEK })} className="h-7 rounded-md px-2.5 text-ink-2 hover:bg-hover">
          Later
        </button>
      </div>
    </div>
  );
}
