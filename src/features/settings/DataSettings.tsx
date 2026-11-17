import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { runBackup, updateBackupStatus, useBackupStatus } from '@/data/autoBackup';
import type { BackupEntry } from '@/platform/types';
import { backupTaskCount, exportData, parseBackup, restoreBackup, TABLES, type Backup } from '@/data/backup';
import { markEverything } from '@/sync/engine';
import { outbox, unlinkDevice, useSyncStatus } from '@/sync/controller';
import { db } from '@/data/db';
import { now } from '@/domain/clock';
import { platform } from '@/platform';
import { BASE } from '@/app/appPath';

const button = 'h-8 rounded-md border border-line px-3 text-[13px] hover:bg-hover';
const danger = 'h-8 rounded-md bg-over px-3 text-[13px] font-medium text-white';

/** Export, import and erase. Everything lives on this device, so a backup is the only copy elsewhere. */
export function DataSettings() {
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [saved, setSaved] = useState(false);

  async function exportNow() {
    const stamp = now();
    const fileName = `life-of-pi-backup-${format(new Date(stamp), 'yyyy-MM-dd')}.json`;
    const done = await platform.saveTextFile(fileName, await exportData(stamp), 'application/json');
    setSaved(done);
    if (done) updateBackupStatus({ lastDownloadAt: stamp, reminderSnoozedUntil: null });
  }

  async function choose(selected: File | undefined) {
    setProblem(null);
    setPending(null);
    if (!selected) return;
    const result = parseBackup(await selected.text());
    if (result.ok) setPending(result.backup);
    else setProblem(result.reason);
  }

  async function replace() {
    if (!pending) return;
    // What is here now is saved first, so a restore can itself be undone.
    await runBackup('safety');
    // Signed in: everything here now is marked, so what the backup lacks is deleted on other devices too.
    if (useSyncStatus.getState().user) await markEverything(db, outbox, TABLES, now());
    await restoreBackup(pending);
    location.assign(BASE);
  }

  async function eraseEverything() {
    await runBackup('safety');
    // Signed in, this only clears the device: on restart it takes the account's data again.
    unlinkDevice();
    db.close();
    await db.delete();
    location.assign(BASE);
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-[13px] leading-relaxed text-ink-2">
        {platform.kind === 'web'
          ? 'Everything you add is stored on this device, in this browser. Clearing the browser’s site data deletes it, so download a copy now and then.'
          : 'Everything you add is stored on this computer. A backup is saved to a folder every day; point it at a OneDrive or Google Drive folder to keep a copy off this computer too.'}
      </p>

      <AutomaticBackups onRestore={setPending} />

      <section className="flex flex-col gap-2">
        <h3 className="text-[14px] font-medium">{platform.kind === 'web' ? 'Download a copy' : 'Export a backup'}</h3>
        <p className="text-[12.5px] text-ink-3">Saves every task, note, time entry and setting to one file.</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void exportNow()} className={button}>
            Export backup
          </button>
          {saved && <span className="text-[12.5px] text-done">{platform.kind === 'web' ? 'Backup saved to your downloads.' : 'Backup saved.'}</span>}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[14px] font-medium">Restore from a backup</h3>
        <p className="text-[12.5px] text-ink-3">Replaces everything here with the contents of a backup file.</p>
        <input ref={file} type="file" accept="application/json,.json" aria-label="Backup file" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
        <button type="button" onClick={() => file.current?.click()} className={`${button} self-start`}>
          Choose backup file…
        </button>
        {problem && (
          <p role="alert" className="text-[13px] text-over">
            {problem}
          </p>
        )}
        {pending && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-line-strong p-4">
            <p className="text-[13.5px]">
              This backup is from {format(new Date(pending.exportedAt), 'MMMM d, yyyy, HH:mm')} and holds {backupTaskCount(pending)} tasks. Restoring it replaces everything currently here; what is here now is backed up first.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void replace()} className={danger}>
                Replace everything
              </button>
              <button type="button" onClick={() => setPending(null)} className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[14px] font-medium">Erase everything</h3>
        <p className="text-[12.5px] text-ink-3">Deletes all tasks, history and settings on this device and starts setup again.</p>
        {erasing ? (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-over p-4">
            <p className="text-[13.5px]">
              {useSyncStatus.getState().user
                ? 'Everything on this device will be deleted. Your account keeps its copy, and this device downloads it again when it restarts.'
                : 'Everything will be deleted for good. A backup is saved first, just in case.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void eraseEverything()} className={danger}>
                Erase everything
              </button>
              <button type="button" onClick={() => setErasing(false)} className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setErasing(true)} className={`${button} self-start text-over`}>
            Erase everything…
          </button>
        )}
      </section>
    </div>
  );
}

const DAY = 24 * 60 * 60 * 1000;
const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** The daily backups: when the last ran, where they go, a way to make one now, and the list to restore from. */
function AutomaticBackups({ onRestore }: { onRestore: (backup: Backup) => void }) {
  const status = useBackupStatus();
  const [list, setList] = useState<BackupEntry[] | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function refresh() {
    try {
      setList((await platform.backups.list()).sort((a, b) => b.at - a.at));
      setFolder(await platform.backups.location());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setList([]);
    }
  }
  useEffect(() => {
    void refresh();
  }, [status.lastSavedAt]);

  async function backUpNow() {
    setBusy(true);
    await runBackup('manual');
    setBusy(false);
    await refresh();
  }

  async function restore(entry: BackupEntry) {
    setProblem(null);
    const result = parseBackup(await platform.backups.read(entry.id));
    if (result.ok) onRestore(result.backup);
    else setProblem(result.reason);
  }

  async function download(entry: BackupEntry) {
    if (await platform.saveTextFile(entry.id, await platform.backups.read(entry.id), 'application/json')) {
      updateBackupStatus({ lastDownloadAt: now(), reminderSnoozedUntil: null });
    }
  }

  const stale = status.lastSavedAt !== null && now() - status.lastSavedAt > 3 * DAY;
  return (
    <section aria-label="Automatic backups" className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[14px] font-medium">Automatic backups</h3>
          <p data-testid="backup-status" className={`text-[12.5px] ${stale || status.error ? 'text-over' : 'text-ink-3'}`}>
            {status.lastSavedAt === null ? 'No backup yet.' : `Last backup ${format(new Date(status.lastSavedAt), 'MMM d, HH:mm')}.`}
            {status.error && ` The last attempt failed: ${status.error}`}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void backUpNow()} className={`${button} shrink-0 disabled:opacity-50`}>
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-3">
        One a day when something has changed, and one before any restore, import or erase. The last two weeks are kept, then one a week for two months.
        {platform.kind === 'web' && ' These are kept inside this browser: they undo mistakes, but not clearing the browser’s data.'}
      </p>
      {folder && (
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-ink-3">Saved to</span>
          <code className="min-w-0 truncate rounded bg-hover px-1.5 py-0.5 text-ink-2" title={folder}>
            {folder}
          </code>
          {platform.backups.chooseLocation && (
            <button
              type="button"
              onClick={() => void platform.backups.chooseLocation!().then(async (picked) => {
                if (picked) await refresh();
              })}
              className="shrink-0 rounded px-1.5 py-0.5 text-accent hover:bg-accent-soft"
            >
              Change…
            </button>
          )}
        </div>
      )}
      {problem && (
        <p role="alert" className="text-[12.5px] text-over">
          {problem}
        </p>
      )}
      {list && list.length > 0 && (
        <ul aria-label="Backups" className="flex max-h-[220px] flex-col overflow-y-auto rounded-lg border border-line">
          {list.map((entry) => (
            <li key={entry.id} data-testid="backup-entry" className="group flex items-center gap-3 border-b border-line px-3 py-1.5 text-[13px] last:border-0">
              <span className="flex-1">{format(new Date(entry.at), 'EEE, MMM d yyyy, HH:mm')}</span>
              <span className="tabular text-[12px] text-ink-3">{sizeLabel(entry.size)}</span>
              {platform.kind === 'web' && (
                <button type="button" onClick={() => void download(entry)} className="rounded px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-hover">
                  Download
                </button>
              )}
              <button
                type="button"
                aria-label={`Restore the backup from ${format(new Date(entry.at), 'MMM d, HH:mm')}`}
                onClick={() => void restore(entry)}
                className="rounded px-1.5 py-0.5 text-[12px] text-accent hover:bg-accent-soft"
              >
                Restore…
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
