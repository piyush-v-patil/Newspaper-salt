import { Minus, Plus, Tally5, X } from 'lucide-react';
import { bumpCounter, setCounter, updateCounter } from '@/data/commands/tasks';
import type { Task } from '@/data/types';

const step = 'grid h-7 w-7 place-items-center rounded-md border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35';

/** A task's counter on the task page: count up or down, set a target and what is being counted. */
export function CounterEditor({ task }: { task: Task }) {
  const counter = task.counter;
  if (!counter) return null;
  const reached = counter.target !== null && counter.count >= counter.target;
  return (
    <section aria-label="Counter" className="flex flex-wrap items-center gap-2 pl-[30px] text-[13.5px]">
      <Tally5 size={15} className="text-ink-3" />
      <button type="button" aria-label="Count one less" disabled={counter.count === 0} onClick={() => void bumpCounter(task.id, -1)} className={step}>
        <Minus size={14} />
      </button>
      <span data-testid="counter-value" className={`tabular min-w-[48px] text-center text-[17px] font-semibold ${reached ? 'text-done' : ''}`}>
        {counter.count}
        {counter.target !== null && <span className="text-[14px] font-normal text-ink-3"> / {counter.target}</span>}
      </span>
      <button type="button" aria-label="Count one more" onClick={() => void bumpCounter(task.id, 1)} className={step}>
        <Plus size={14} />
      </button>
      <label className="ml-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
        Target
        <input
          key={`target-${counter.target}`}
          type="number"
          min={1}
          max={9999}
          aria-label="Target"
          placeholder="none"
          defaultValue={counter.target ?? ''}
          onBlur={(e) => {
            const value = e.currentTarget.value.trim();
            const target = value === '' ? null : Math.max(1, Math.min(9999, Math.round(Number(value)) || 1));
            if (target !== counter.target) void updateCounter(task.id, { target });
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-7 w-[64px] rounded-md border border-line bg-surface px-2 text-[13px] text-ink"
        />
      </label>
      <input
        key={`unit-${counter.unit}`}
        aria-label="What you are counting"
        placeholder="e.g. applications"
        defaultValue={counter.unit}
        onBlur={(e) => {
          const unit = e.currentTarget.value.trim();
          if (unit !== counter.unit) void updateCounter(task.id, { unit });
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-7 w-[150px] rounded-md border border-line bg-surface px-2 text-[13px]"
      />
      <button type="button" aria-label="Remove counter" title="Remove counter" onClick={() => void setCounter(task.id, null)} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-over">
        <X size={14} />
      </button>
    </section>
  );
}
