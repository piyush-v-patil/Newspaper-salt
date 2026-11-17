import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { applyToSeries, changeRepeat, deleteIncompleteInstances, makeRecurring, stopRepeating } from '@/data/commands/series';
import { useSettings } from '@/data/ReferenceData';
import { db } from '@/data/db';
import { BACKLOG, type Repeat, type RepeatKind, type Task } from '@/data/types';
import { today } from '@/domain/clock';
import { formatClock, weekdayOf } from '@/domain/dates';
import { describeRepeat } from '@/domain/recurrence';

const KINDS: { id: RepeatKind; label: string; unit: string | null }[] = [
  { id: 'daily', label: 'Daily', unit: 'day' },
  { id: 'weekdays', label: 'Weekdays', unit: null },
  { id: 'weekly', label: 'Weekly', unit: 'week' },
  { id: 'monthly', label: 'Monthly', unit: 'month' },
  { id: 'yearly', label: 'Yearly', unit: 'year' },
];
// Monday first.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const action = 'flex flex-col rounded-lg border border-line px-3 py-2.5 text-left hover:border-line-strong hover:bg-hover';

/** "Every day at about 7:00 AM". */
function useDescribe() {
  const { timeFormat } = useSettings();
  return (repeat: Repeat, atMin: number | null | undefined) =>
    `${describeRepeat(repeat)}${atMin != null ? ` at about ${formatClock(atMin, timeFormat)}` : ''}`;
}

const toClock = (min: number) => formatClock(min, '24h');

interface FormProps {
  task: Task;
  initial?: { repeat: Repeat; atMin: number | null };
  submitLabel: string;
  note: string;
  onSubmit: (repeat: Repeat, atMin: number | null) => void;
  onCancel?: () => void;
}

/** How often, and optionally at roughly what time. Used to start a series and to change one. */
function RepeatForm({ task, initial, submitLabel, note, onSubmit, onCancel }: FormProps) {
  const startWeekday = weekdayOf(task.day === BACKLOG ? today() : task.day);
  const describe = useDescribe();
  const [kind, setKind] = useState<RepeatKind>(initial?.repeat.kind ?? 'daily');
  const [interval, setInterval] = useState(initial?.repeat.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(initial?.repeat.weekdays.length ? initial.repeat.weekdays : [startWeekday]);
  const [atMin, setAtMin] = useState<number | null>(initial?.atMin ?? null);
  const repeat: Repeat = { kind, interval, weekdays };
  const unit = KINDS.find((k) => k.id === kind)?.unit;
  const valid = kind !== 'weekly' || weekdays.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="How often" className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`h-8 rounded-md border px-3 text-[13px] ${kind === k.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {unit && (
        <label className="flex items-center gap-2 text-[13.5px]">
          Every
          <input
            type="number"
            min={1}
            max={52}
            value={interval}
            aria-label="Interval"
            onChange={(e) => setInterval(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
            className="w-[56px] rounded-md border border-line bg-surface px-2 py-1 text-[13.5px]"
          />
          {interval === 1 ? unit : `${unit}s`}
        </label>
      )}

      {kind === 'weekly' && (
        <div role="group" aria-label="On these days" className="flex gap-1">
          {WEEKDAYS.map((d) => {
            const on = weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== d) : [...weekdays, d])}
                className={`h-8 w-11 rounded-md border text-[12.5px] ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'}`}
              >
                {WEEKDAY_LABELS[d]}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-[13.5px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={atMin !== null}
            onChange={(e) => setAtMin(e.target.checked ? 9 * 60 : null)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          At roughly
        </label>
        {atMin !== null && (
          <input
            type="time"
            aria-label="At roughly"
            value={toClock(atMin)}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              if (Number.isFinite(h) && Number.isFinite(m)) setAtMin(h * 60 + m);
            }}
            className="h-8 rounded-md border border-line bg-surface px-2 text-[13px]"
          />
        )}
        {atMin === null && <span className="text-[12.5px] text-ink-3">to put each one on the calendar</span>}
      </div>

      <p className="text-[12.5px] text-ink-3">{valid ? `${describe(repeat, atMin)}, ${note}` : 'Pick at least one day.'}</p>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover">
            Cancel
          </button>
        ) : (
          <Dialog.Close asChild>
            <button type="button" className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover">
              Cancel
            </button>
          </Dialog.Close>
        )}
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSubmit(repeat, atMin)}
          className="h-8 rounded-md bg-ink px-3.5 text-[13px] font-medium text-canvas disabled:opacity-35"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function NewSeries({ task, onDone }: { task: Task; onDone: () => void }) {
  return (
    <RepeatForm
      task={task}
      submitLabel="Repeat"
      note="starting with this task. Its subtasks, notes, channel and planned time are copied to each one."
      onSubmit={(repeat, atMin) => {
        void makeRecurring(task.id, repeat, atMin);
        onDone();
      }}
    />
  );
}

function ExistingSeries({ task, onDone }: { task: Task; onDone: () => void }) {
  const series = useLiveQuery(() => (task.seriesId ? db.series.get(task.seriesId) : undefined), [task.seriesId]);
  const describe = useDescribe();
  const [changing, setChanging] = useState(false);
  if (!series) return null;
  if (changing) {
    return (
      <RepeatForm
        task={task}
        initial={{ repeat: series.repeat, atMin: series.atMin ?? null }}
        submitLabel="Change"
        note="from this one on. Later unfinished instances are replaced to match."
        onCancel={() => setChanging(false)}
        onSubmit={(repeat, atMin) => {
          void changeRepeat(task.id, repeat, atMin);
          onDone();
        }}
      />
    );
  }
  const run = (work: Promise<unknown>) => {
    void work;
    onDone();
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="pb-1 text-[13.5px] text-ink-2">
        {describe(series.repeat, series.atMin)}
        {series.endDay !== null && ' (stopped)'}
      </p>
      <button type="button" className={action} onClick={() => setChanging(true)}>
        <span className="text-[14px] font-medium">Change how often…</span>
        <span className="text-[12.5px] text-ink-3">The days it repeats on, and the time it goes on the calendar.</span>
      </button>
      <button type="button" className={action} onClick={() => run(applyToSeries(task.id))}>
        <span className="text-[14px] font-medium">Update all incomplete instances to match this task</span>
        <span className="text-[12.5px] text-ink-3">Copies its title, notes, channel and planned time.</span>
      </button>
      {series.endDay === null && (
        <button type="button" className={action} onClick={() => run(stopRepeating(series.id))}>
          <span className="text-[14px] font-medium">Stop repeating</span>
          <span className="text-[12.5px] text-ink-3">Keeps today’s and earlier instances; removes later ones.</span>
        </button>
      )}
      <button type="button" className={action} onClick={() => run(deleteIncompleteInstances(series.id))}>
        <span className="text-[14px] font-medium">Delete all incomplete instances and stop repeating</span>
        <span className="text-[12.5px] text-ink-3">Finished ones stay as a record.</span>
      </button>
    </div>
  );
}

/** Makes a task repeat, or manages the series it already belongs to. */
export function RepeatDialog({ task, open, onOpenChange }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void }) {
  const close = () => onOpenChange(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[20%] z-[56] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <Dialog.Title className="text-[16px] font-semibold tracking-tight">{task.seriesId ? 'Repeating task' : 'Repeat this task'}</Dialog.Title>
          {task.seriesId ? <ExistingSeries task={task} onDone={close} /> : <NewSeries task={task} onDone={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
