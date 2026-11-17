import { Timer, X } from 'lucide-react';
import { format } from 'date-fns';
import { deleteTimeEntry, setActualForDay } from '@/data/commands/timer';
import { useRunningTimer, useTimeEntries } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import type { Task } from '@/data/types';
import { today } from '@/domain/clock';
import { formatClock, formatMinutes } from '@/domain/dates';
import { msToMinutes } from '@/domain/time';
import { useTaskTime } from '@/features/focus/useTaskTime';
import { Chip } from './Chip';
import { TimePicker } from './pickers/pickers';

const minuteOfDay = (ms: number) => new Date(ms).getHours() * 60 + new Date(ms).getMinutes();

/** Tracked time on the task page: the total, a way to type today's figure, and the entries behind it. */
export function ActualChip({ task }: { task: Task }) {
  const { timeFormat } = useSettings();
  const time = useTaskTime(task.id);
  const entries = useTimeEntries(task.id);
  const running = useRunningTimer();
  const finished = entries.filter((e) => e.end !== null && e.id !== running?.entryId);
  const totalMin = msToMinutes(time.totalMs);

  return (
    <Chip icon={Timer} name="Actual time" active={totalMin > 0 || time.running} label={totalMin > 0 || time.running ? `${formatMinutes(totalMin)} actual` : 'Actual'}>
      {(close) => (
        <div>
          <TimePicker
            value={0}
            clearLabel="Clear today"
            onPick={(minutes) => {
              void setActualForDay(task.id, today(), minutes);
              close();
            }}
          />
          {finished.length > 0 && (
            <div className="border-t border-line p-1">
              <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-3">History</div>
              <ul className="max-h-[168px] overflow-y-auto">
                {[...finished].reverse().map((entry) => (
                  <li key={entry.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-ink-2 hover:bg-hover">
                    <span className="w-[52px] shrink-0">{format(new Date(entry.start), 'MMM d')}</span>
                    <span className="tabular flex-1 text-ink-3">
                      {formatClock(minuteOfDay(entry.start), timeFormat)} – {formatClock(minuteOfDay(entry.end!), timeFormat)}
                    </span>
                    <span className="tabular">{formatMinutes(msToMinutes(entry.end! - entry.start))}</span>
                    <button
                      type="button"
                      aria-label="Delete entry"
                      onClick={() => void deleteTimeEntry(entry.id)}
                      className="grid h-4 w-4 place-items-center rounded text-ink-3 opacity-0 hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Chip>
  );
}
