import { format } from 'date-fns';
import { useRef, useState } from 'react';
import { backupTaskCount, exportData, parseBackup, restoreBackup, type Backup } from '@/data/backup';
import { db } from '@/data/db';
import { now } from '@/domain/clock';
import { platform } from '@/platform';

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
    await platform.saveTextFile(`life-of-pi-backup-${format(new Date(stamp), 'yyyy-MM-dd')}.json`, await exportData(stamp), 'application/json');
    setSaved(true);
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
    await restoreBackup(pending);
    location.assign('/');
  }

  async function eraseEverything() {
    db.close();
    await db.delete();
    location.assign('/');
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-[13px] leading-relaxed text-ink-2">
        Everything you add is stored on this device, in this browser. Clearing the browser’s site data deletes it. Export a backup now and then; it is the only copy anywhere else.
      </p>

      <section className="flex flex-col gap-2">
        <h3 className="text-[14px] font-medium">Export a backup</h3>
        <p className="text-[12.5px] text-ink-3">Saves every task, note, time entry and setting to one file.</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void exportNow()} className={button}>
            Export backup
          </button>
          {saved && <span className="text-[12.5px] text-done">Backup saved to your downloads.</span>}
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
              This backup is from {format(new Date(pending.exportedAt), 'MMMM d, yyyy, HH:mm')} and holds {backupTaskCount(pending)} tasks. Restoring it replaces everything currently here. This cannot be undone.
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
            <p className="text-[13.5px]">Everything will be deleted for good. Export a backup first if you might want any of it.</p>
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
