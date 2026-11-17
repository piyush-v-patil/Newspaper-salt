import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { applyToSeries, deleteIncompleteInstances, makeRecurring, stopRepeating } from '@/data/commands/series';
import { db } from '@/data/db';
import { BACKLOG, type Repeat, type RepeatKind, type Task } from '@/data/types';
import { today } from '@/domain/clock';
import { weekdayOf } from '@/domain/dates';
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

function NewSeries({ task, onDone }: { task: Task; onDone: () => void }) {
  const startWeekday = weekdayOf(task.day === BACKLOG ? today() : task.day);
  const [kind, setKind] = useState<RepeatKind>('daily');
  const [interval, setInterval] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([startWeekday]);
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

      <p className="text-[12.5px] text-ink-3">
        {valid ? `${describeRepeat(repeat)}, starting with this task. Its subtasks, notes, channel and planned time are copied to each one.` : 'Pick at least one day.'}
      </p>
      <div className="flex justify-end gap-2">
        <Dialog.Close asChild>
          <button type="button" className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover">
            Cancel
          </button>
        </Dialog.Close>
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            void makeRecurring(task.id, repeat);
            onDone();
          }}
          className="h-8 rounded-md bg-ink px-3.5 text-[13px] font-medium text-canvas disabled:opacity-35"
        >
          Repeat
        </button>
      </div>
    </div>
  );
}

function ExistingSeries({ task, onDone }: { task: Task; onDone: () => void }) {
  const series = useLiveQuery(() => (task.seriesId ? db.series.get(task.seriesId) : undefined), [task.seriesId]);
  if (!series) return null;
  const run = (work: Promise<unknown>) => {
    void work;
    onDone();
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="pb-1 text-[13.5px] text-ink-2">
        {describeRepeat(series.repeat)}
        {series.endDay !== null && ' (stopped)'}
      </p>
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
