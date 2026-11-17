import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Check, Coffee, Pause, Play, X } from 'lucide-react';
import { useNow } from '@/app/useNow';
import { useRunningTimer, useTask } from '@/data/queries';
import { formatMinutes } from '@/domain/dates';
import { formatElapsed } from '@/domain/time';
import { completeAndAdvance, endBreak, takeBreak, toggleTaskTimer } from './actions';
import { useFocus } from './focusStore';
import { useTaskTime } from './useTaskTime';

const iconButton = 'grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink';

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

  if (!task || task.state !== 'active' || task.completedAt !== null) return null;

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
      <div className="ml-auto flex items-center gap-0.5">
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
