import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Check, Coffee, Layers, Pause, Play, Square, X } from 'lucide-react';
import { useState } from 'react';
import { toggleParallelTimer } from '@/data/commands/timer';
import { useOpenTasks, useParallelTimers, useTasksById } from '@/data/queries';
import type { ParallelTimer } from '@/data/types';
import { today } from '@/domain/clock';
import { PickerPanel } from '@/features/task/pickers/PickerPanel';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/ui/Popover';
import { useNow } from '@/app/useNow';
import { useRunningTimer, useTask } from '@/data/queries';
import { formatMinutes } from '@/domain/dates';
import { formatElapsed } from '@/domain/time';
import { completeAndAdvance, endBreak, takeBreak, toggleTaskTimer } from './actions';
import { useFocus } from './focusStore';
import { useTaskTime } from './useTaskTime';

const iconButton = 'grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink';

/** A task timed alongside the main one: its name, its running time, and a stop button. */
function AlongsideChip({ timer, title }: { timer: ParallelTimer; title: string }) {
  const nowMs = useNow(1000);
  return (
    <span data-testid="alongside" className="flex h-7 max-w-[200px] items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-1 text-[12.5px]">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
      <span className="min-w-0 truncate">{title}</span>
      <span className="tabular text-accent">{formatElapsed(nowMs - timer.start)}</span>
      <button
        type="button"
        aria-label={`Stop ${title}`}
        onClick={() => void toggleParallelTimer(timer.taskId)}
        className="grid h-5 w-5 place-items-center rounded-full text-ink-2 hover:bg-hover hover:text-ink"
      >
        <Square size={9} fill="currentColor" />
      </button>
    </span>
  );
}

/** Starts timing another task alongside, picked by name (today's first). */
function AlongsideButton({ exclude }: { exclude: string[] }) {
  const [open, setOpen] = useState(false);
  const tasks = useOpenTasks();
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Time another task alongside" title="Time another task alongside" className={iconButton}>
          <Layers size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" label="Time alongside">
        <PickerPanel
          label="Time alongside"
          placeholder="Which task runs alongside?"
          emptyText="No other open tasks match."
          getOptions={(query) => {
            const q = query.trim().toLowerCase();
            return tasks
              .filter((t) => !exclude.includes(t.id) && t.title.toLowerCase().includes(q))
              .sort((a, b) => Number(b.day === today()) - Number(a.day === today()))
              .slice(0, 8)
              .map((t) => ({ key: t.id, label: t.title, value: t.id }));
          }}
          onSelect={(id) => {
            void toggleParallelTimer(id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </PopoverRoot>
  );
}

/**
 * The task being worked on, its timer, and the controls for it. Docked along
 * the bottom of the window; in the Windows app it floats above other apps.
 */
export function FocusBar() {
  const navigate = useNavigate();
  const barTaskId = useFocus((s) => s.barTaskId);
  const breakEndsAt = useFocus((s) => s.breakEndsAt);
  const task = useTask(barTaskId ?? undefined);
  const time = useTaskTime(barTaskId ?? undefined);
  const nowMs = useNow(1000, breakEndsAt !== null);

  // A running timer always shows in the bar, including after a reload.
  const running = useRunningTimer();
  const alongside = useParallelTimers();
  const alongsideTasks = useTasksById(alongside.map((t) => t.taskId));
  const chips = alongside.map((t) => <AlongsideChip key={t.entryId} timer={t} title={alongsideTasks.get(t.taskId)?.title ?? 'Task'} />);
  useEffect(() => {
    if (running && useFocus.getState().barTaskId !== running.taskId) useFocus.setState({ barTaskId: running.taskId });
  }, [running]);

  if (breakEndsAt !== null) {
    return (
      <div role="region" aria-label="Focus bar" className="flex h-11 shrink-0 items-center gap-3 border-t border-line bg-panel px-4 text-[13px]">
        <Coffee size={15} className="text-ink-2" />
        <span className="font-medium">On a break</span>
        <span className="tabular text-ink-2">{formatElapsed(Math.max(0, breakEndsAt - nowMs))} left</span>
        <button type="button" onClick={() => void endBreak(true)} className="ml-auto h-7 rounded-md border border-line px-2.5 text-[12.5px] hover:bg-hover">
          End break
        </button>
      </div>
    );
  }

  if (!task || task.state !== 'active' || task.completedAt !== null) {
    if (alongside.length === 0) return null;
    return (
      <div role="region" aria-label="Focus bar" className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-panel px-3 text-[13px]">
        <span className="text-[12px] text-ink-3">Alongside</span>
        {chips}
        <div className="ml-auto">
          <AlongsideButton exclude={alongside.map((t) => t.taskId)} />
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Focus bar" className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-panel px-3 text-[13px]">
      <button
        type="button"
        aria-label={time.running ? 'Pause timer' : 'Start timer'}
        onClick={() => void toggleTaskTimer(task.id)}
        className={`grid h-7 w-7 place-items-center rounded-full ${time.running ? 'bg-accent text-white' : 'border border-line-strong text-ink-2 hover:bg-hover'}`}
      >
        {time.running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-px" />}
      </button>
      <button
        type="button"
        onClick={() => void navigate({ to: '/focus/$taskId', params: { taskId: task.id } })}
        className="min-w-0 truncate rounded px-1 py-0.5 text-left font-medium hover:bg-hover"
        title="Open in focus mode"
      >
        {task.title}
      </button>
      <span className={`tabular ${time.running ? 'text-accent' : 'text-ink-2'}`} data-testid="focus-bar-time">
        {formatElapsed(time.todayMs)}
        {task.plannedMin !== null && <span className="text-ink-3"> / {formatMinutes(task.plannedMin)}</span>}
      </span>
      {chips.length > 0 && <span className="ml-2 flex min-w-0 items-center gap-1.5 overflow-hidden">{chips}</span>}
      <div className="ml-auto flex items-center gap-0.5">
        <AlongsideButton exclude={[task.id, ...alongside.map((t) => t.taskId)]} />
        <button type="button" aria-label="Complete task" title="Complete" onClick={() => void completeAndAdvance(task.id)} className={iconButton}>
          <Check size={15} />
        </button>
        <button type="button" aria-label="Take a break" title="Take a break  K" onClick={() => void takeBreak()} className={iconButton}>
          <Coffee size={15} />
        </button>
        <button
          type="button"
          aria-label="Hide focus bar"
          title={time.running ? 'Pause the timer to hide the bar' : 'Hide'}
          disabled={time.running}
          onClick={() => useFocus.setState({ barTaskId: null })}
          className={`${iconButton} disabled:opacity-30`}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
