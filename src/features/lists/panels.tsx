import { RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { emptyArchive, eraseTask, restoreTask, TRASH_DAYS } from '@/data/commands/rollover';
import { updateSettings } from '@/data/commands/settings';
import { db } from '@/data/db';
import { useTasksInState } from '@/data/queries';
import { useChannelMap, useSettings } from '@/data/ReferenceData';
import { BACKLOG, type Task } from '@/data/types';
import { relativeDayLabel } from '@/domain/dayLabels';
import { ChannelTag } from '@/features/task/ChannelTag';
import { useOpenTask } from '@/features/task/useOpenTask';
import { useToday } from '@/app/useToday';

const shell = 'flex h-full w-[max(300px,100%)] flex-col';
const header = 'flex h-14 shrink-0 items-center gap-2 border-b border-line px-4';
const rowButton = 'grid h-6 w-6 shrink-0 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink';

function Row({ task, meta, children }: { task: Task; meta: string; children: React.ReactNode }) {
  const channel = useChannelMap().get(task.channelId ?? '');
  return (
    <li data-testid="panel-task" className="group flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="break-words text-[13.5px] leading-snug">{task.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-3">
          <span>{meta}</span>
          {channel && <ChannelTag channel={channel} />}
        </div>
      </div>
      <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">{children}</div>
    </li>
  );
}

const when = (ms: number | null) => (ms ? format(new Date(ms), 'MMM d') : '');

/** Tasks that rolled over too many days in a row. Giving one a day brings it back. */
export function ArchivePanel() {
  const settings = useSettings();
  const tasks = useTasksInState('archived');
  const threshold = settings.archiveAfterDays;

  return (
    <div className={shell}>
      <div className={header}>
        <h2 className="text-[13px] font-semibold">Archive</h2>
        {tasks.length > 0 && (
          <button type="button" onClick={() => void emptyArchive()} className="ml-auto rounded px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-hover hover:text-over">
            Delete all
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 text-[12.5px] text-ink-2">
        <label htmlFor="archive-threshold">Archive after</label>
        <select
          id="archive-threshold"
          value={threshold ?? 'off'}
          onChange={(e) => void updateSettings({ archiveAfterDays: e.target.value === 'off' ? null : Number(e.target.value) })}
          className="rounded-md border border-line bg-surface px-1.5 py-1 text-[12.5px] text-ink"
        >
          {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'day' : 'days'} in a row
            </option>
          ))}
          <option value="off">Never</option>
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-3">
            Nothing here. A task that rolls over {threshold === null ? 'day after day stays on your list, because archiving is off' : `more than ${threshold} days in a row with no progress lands here`}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <Row key={task.id} task={task} meta={`Archived ${when(task.stateChangedAt)}`}>
                <button type="button" aria-label={`Move ${task.title} to today`} title="Move to today" onClick={() => void restoreTask(task.id)} className={rowButton}>
                  <RotateCcw size={13} />
                </button>
              </Row>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Deleted tasks, restorable for a week. */
export function TrashPanel() {
  const tasks = useTasksInState('deleted');
  return (
    <div className={shell}>
      <div className={header}>
        <h2 className="text-[13px] font-semibold">Trash</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-3">Nothing here. Deleted tasks stay for {TRASH_DAYS} days, then go for good.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <Row key={task.id} task={task} meta={`Deleted ${when(task.stateChangedAt)}`}>
                <button type="button" aria-label={`Restore ${task.title}`} title="Restore to today" onClick={() => void restoreTask(task.id)} className={rowButton}>
                  <RotateCcw size={13} />
                </button>
                <button type="button" aria-label={`Delete ${task.title} for good`} title="Delete for good" onClick={() => void eraseTask(task.id)} className={`${rowButton} hover:!text-over`}>
                  <Trash2 size={13} />
                </button>
              </Row>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const MAX_RESULTS = 40;

/** Finds tasks by name, across days, the backlog and the archive. */
export function SearchPanel() {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const openTask = useOpenTask();
  const current = useToday();
  const q = query.trim().toLowerCase();

  useEffect(() => input.current?.focus(), []);

  const all = useLiveQuery(() => db.tasks.where('state').anyOf('active', 'archived').toArray(), []);
  const results = useMemo(() => {
    if (!q || !all) return [];
    return all
      .filter((t) => t.kind === 'task' && t.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RESULTS);
  }, [all, q]);

  return (
    <div className={shell}>
      <div className={header}>
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-3"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!q ? (
          <p className="px-1 text-[13px] text-ink-3">Type to find a task by name.</p>
        ) : results.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-3">No task matches “{query.trim()}”.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((task) => {
              const meta = task.state === 'archived' ? 'Archived' : task.day === BACKLOG ? 'Backlog' : relativeDayLabel(task.day, current);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    data-testid="search-result"
                    disabled={task.state !== 'active'}
                    onClick={() => openTask(task.id)}
                    className="flex w-full flex-col rounded-lg border border-line bg-surface px-3 py-2 text-left enabled:hover:border-line-strong"
                  >
                    <span className={`break-words text-[13.5px] leading-snug ${task.completedAt !== null ? 'text-ink-3 line-through' : ''}`}>{task.title}</span>
                    <span className="mt-1 text-[11.5px] text-ink-3">{meta}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
