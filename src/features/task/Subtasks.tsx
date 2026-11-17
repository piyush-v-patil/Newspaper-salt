import { CirclePlus, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNow } from '@/app/useNow';
import { addSubtask, deleteSubtask, renameSubtask, setSubtaskCompleted, setSubtaskPlanned } from '@/data/commands/subtasks';
import { toggleSubtaskTimer } from '@/data/commands/timer';
import { useRunningTimer, useTimeEntries } from '@/data/queries';
import type { Id, RunningTimer, Subtask } from '@/data/types';
import { formatMinutes } from '@/domain/dates';
import { formatHms, msToMinutes } from '@/domain/time';
import { CheckCircle } from '@/ui/CheckCircle';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/ui/Popover';
import { TimePicker } from './pickers/pickers';
import { useTaskFocus } from './taskFocus';

/** Actual time (ticking in green while timed) and planned time, which a click sets. */
function SubtaskTime({ subtask, actualMs, running }: { subtask: Subtask; actualMs: number; running: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="flex shrink-0 items-center">
      <span data-testid="subtask-actual" className={`tabular w-[64px] text-right text-[13px] ${running ? 'text-done' : 'text-ink-2'}`}>
        {running ? formatHms(actualMs) : formatMinutes(msToMinutes(actualMs))}
      </span>
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={subtask.plannedMin === null ? `Set planned time for ${subtask.title}` : `Planned time for ${subtask.title}: ${formatMinutes(subtask.plannedMin)}`}
            className="tabular ml-2 w-[52px] rounded px-1 py-0.5 text-right text-[13px] text-ink-3 hover:bg-surface hover:text-ink"
          >
            {subtask.plannedMin === null ? '--:--' : formatMinutes(subtask.plannedMin)}
          </button>
        </PopoverTrigger>
        <PopoverContent label="Planned time">
          <TimePicker
            value={subtask.plannedMin}
            onPick={(m) => {
              void setSubtaskPlanned(subtask.id, m);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </PopoverRoot>
    </span>
  );
}

function SubtaskRow({ subtask, onEnter, actualMs, timer }: { subtask: Subtask; onEnter: () => void; actualMs: number; timer: RunningTimer | null }) {
  const done = subtask.completedAt !== null;
  const running = timer?.subtaskId === subtask.id;
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-hover">
      <CheckCircle
        size="sm"
        checked={done}
        onChange={(next) => void setSubtaskCompleted(subtask.id, next)}
        label={done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
      />
      <input
        key={subtask.title}
        defaultValue={subtask.title}
        aria-label="Subtask"
        onBlur={(e) => void renameSubtask(subtask.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
            onEnter();
          } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
            e.preventDefault();
            void deleteSubtask(subtask.id);
          }
        }}
        className={`min-w-0 flex-1 bg-transparent text-[14px] outline-none ${done ? 'text-ink-3 line-through' : ''}`}
      />
      <SubtaskTime subtask={subtask} actualMs={actualMs} running={running} />
      {!done && (
        <button
          type="button"
          aria-label={running ? `Pause ${subtask.title}` : `Start ${subtask.title}`}
          onClick={() => void toggleSubtaskTimer(subtask.taskId, subtask.id)}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-surface ${
            running ? 'text-accent' : 'text-ink-3 opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100'
          }`}
        >
          {running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
      )}
      <button
        type="button"
        aria-label={`Delete ${subtask.title}`}
        onClick={() => void deleteSubtask(subtask.id)}
        className="grid h-5 w-5 place-items-center rounded text-ink-3 opacity-0 hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </li>
  );
}

export function Subtasks({ taskId, subtasks }: { taskId: Id; subtasks: Subtask[] }) {
  const [draft, setDraft] = useState('');
  const entries = useTimeEntries(taskId);
  const timer = useRunningTimer();
  const ticking = timer?.taskId === taskId && timer.subtaskId !== null;
  const nowMs = useNow(1000, ticking);
  const actual = new Map<Id, number>();
  for (const e of entries) {
    if (!e.subtaskId) continue;
    actual.set(e.subtaskId, (actual.get(e.subtaskId) ?? 0) + ((e.end ?? nowMs) - e.start));
  }
  const add = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = useTaskFocus.getState();
    if (focus.focusSubtaskOnOpen) {
      focus.setFocusSubtaskOnOpen(false);
      add.current?.focus();
    }
  }, [taskId]);

  async function submit() {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    await addSubtask(taskId, text);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <ul className="flex flex-col gap-0.5">
        {subtasks.map((s) => (
          <SubtaskRow key={s.id} subtask={s} onEnter={() => add.current?.focus()} actualMs={actual.get(s.id) ?? 0} timer={timer ?? null} />
        ))}
      </ul>
      <div className="flex items-center gap-2.5 px-1 py-1 text-ink-3 focus-within:text-ink">
        <CirclePlus size={15} />
        <input
          ref={add}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Add subtask"
          aria-label="Add subtask"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
    </div>
  );
}
