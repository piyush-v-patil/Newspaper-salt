import { Pencil, Plus, Timer, X } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { addTimeEntry, deleteTimeEntry, setActualForDay, updateTimeEntry } from '@/data/commands/timer';
import { useRunningTimer, useSubtasks, useTimeEntries } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import type { Id, Task, TimeEntry } from '@/data/types';
import { now, today } from '@/domain/clock';
import { formatClock, formatMinutes, fromDay, toDay, type Day } from '@/domain/dates';
import { msToMinutes } from '@/domain/time';
import { useTaskTime } from '@/features/focus/useTaskTime';
import { Chip } from './Chip';
import { TimePicker } from './pickers/pickers';

const minuteOfDay = (ms: number) => new Date(ms).getHours() * 60 + new Date(ms).getMinutes();
const clockValue = (ms: number) => formatClock(minuteOfDay(ms), '24h');

/** "09:30" on a day, as a timestamp. */
function at(day: Day, clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return fromDay(day).getTime() + (h * 60 + m) * 60_000;
}

const field = 'h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink';

/** Day, start and end for one stretch of time; used to edit an entry and to log a new one. */
function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { day: Day; start: string; end: string };
  submitLabel: string;
  onSubmit: (start: number, end: number) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [day, setDay] = useState(initial.day);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-1.5 rounded-md bg-hover/60 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(at(day, start), at(day, end)).then(onCancel, (err: Error) => setError(err.message));
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <input type="date" aria-label="Day" value={day} max={today()} onChange={(e) => setDay(e.target.value)} className={field} />
        <input type="time" aria-label="Start" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
        <span className="text-ink-3">–</span>
        <input type="time" aria-label="End" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
      </div>
      {error && <p className="text-[12px] text-over">{error}</p>}
      <div className="flex justify-end gap-1">
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-[12px] text-ink-2 hover:bg-hover">
          Cancel
        </button>
        <button type="submit" className="rounded bg-accent px-2 py-1 text-[12px] font-medium text-white hover:opacity-90">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function EntryRow({ entry, subtaskTitle }: { entry: TimeEntry; subtaskTitle?: string }) {
  const { timeFormat } = useSettings();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li>
        <EntryForm
          initial={{ day: toDay(new Date(entry.start)), start: clockValue(entry.start), end: clockValue(entry.end!) }}
          submitLabel="Save"
          onSubmit={(start, end) => updateTimeEntry(entry.id, start, end)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="group flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-ink-2 hover:bg-hover">
      <span className="w-[46px] shrink-0">{format(new Date(entry.start), 'MMM d')}</span>
      <span className="tabular min-w-0 flex-1 truncate text-ink-3">
        {formatClock(minuteOfDay(entry.start), timeFormat)} – {formatClock(minuteOfDay(entry.end!), timeFormat)}
        {subtaskTitle && <span className="text-ink-2"> · {subtaskTitle}</span>}
      </span>
      <span className="tabular">{formatMinutes(msToMinutes(entry.end! - entry.start))}</span>
      <button
        type="button"
        aria-label="Edit entry"
        onClick={() => setEditing(true)}
        className="grid h-4 w-4 place-items-center rounded text-ink-3 opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Pencil size={11} />
      </button>
      <button
        type="button"
        aria-label="Delete entry"
        onClick={() => void deleteTimeEntry(entry.id)}
        className="grid h-4 w-4 place-items-center rounded text-ink-3 opacity-0 hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={11} />
      </button>
    </li>
  );
}

/** Tracked time on the task page: the total, a way to type today's figure, and the entries behind it. */
export function ActualChip({ task }: { task: Task }) {
  const time = useTaskTime(task.id);
  const entries = useTimeEntries(task.id);
  const running = useRunningTimer();
  const subtasks = useSubtasks([task.id]).get(task.id) ?? [];
  const subtaskTitles = new Map<Id, string>(subtasks.map((s) => [s.id, s.title]));
  const [logging, setLogging] = useState(false);
  const finished = entries.filter((e) => e.end !== null && e.id !== running?.entryId);
  const totalMin = msToMinutes(time.totalMs);
  const end = now();

  return (
    <Chip icon={Timer} name="Actual time" active={totalMin > 0 || time.running} label={totalMin > 0 || time.running ? `${formatMinutes(totalMin)} actual` : 'Actual'}>
      {(close) => (
        <div className="w-[300px]">
          <TimePicker
            value={0}
            clearLabel="Clear today"
            onPick={(minutes) => {
              void setActualForDay(task.id, today(), minutes);
              close();
            }}
          />
          <div className="border-t border-line p-1">
            <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-3">History</span>
              {!logging && (
                <button type="button" onClick={() => setLogging(true)} className="flex items-center gap-1 rounded px-1 text-[12px] text-ink-2 hover:bg-hover hover:text-ink">
                  <Plus size={12} /> Log time
                </button>
              )}
            </div>
            {logging && (
              <EntryForm
                initial={{ day: today(), start: clockValue(Math.max(fromDay(today()).getTime(), end - 30 * 60_000)), end: clockValue(end) }}
                submitLabel="Log"
                onSubmit={(start, finish) => addTimeEntry(task.id, start, finish)}
                onCancel={() => setLogging(false)}
              />
            )}
            {finished.length === 0 && !logging && <p className="px-2 pb-1.5 text-[12px] text-ink-3">No time tracked yet.</p>}
            <ul className="max-h-[200px] overflow-y-auto">
              {[...finished].reverse().map((entry) => (
                <EntryRow key={entry.id} entry={entry} subtaskTitle={entry.subtaskId ? subtaskTitles.get(entry.subtaskId) : undefined} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </Chip>
  );
}
