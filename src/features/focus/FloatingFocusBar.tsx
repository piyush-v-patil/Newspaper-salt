import { AppWindow, Check, Pause, Play } from 'lucide-react';
import { useTheme } from '@/app/theme';
import { useCurrentFocusTask } from '@/data/queries';
import { formatMinutes } from '@/domain/dates';
import { formatElapsed } from '@/domain/time';
import { platform } from '@/platform';
import { completeAndAdvance, toggleTaskTimer } from './actions';
import { useTaskTime } from './useTaskTime';

const button = 'grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink';

/**
 * The focus bar in its own small window that floats above other apps
 * (desktop only). Drag it anywhere by its body.
 */
export function FloatingFocusBar() {
  useTheme();
  const task = useCurrentFocusTask();
  const time = useTaskTime(task?.id);

  return (
    <div data-tauri-drag-region className="flex h-full select-none items-center gap-2 overflow-hidden border border-line bg-panel px-2.5 text-[13px]">
      {task ? (
        <>
          <button
            type="button"
            aria-label={time.running ? 'Pause timer' : 'Start timer'}
            onClick={() => void toggleTaskTimer(task.id)}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${time.running ? 'bg-accent text-white' : 'border border-line-strong text-ink-2 hover:bg-hover'}`}
          >
            {time.running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-px" />}
          </button>
          <span data-tauri-drag-region className="min-w-0 flex-1 truncate font-medium">
            {task.title}
          </span>
          <span data-tauri-drag-region className={`tabular shrink-0 ${time.running ? 'text-accent' : 'text-ink-2'}`}>
            {formatElapsed(time.todayMs)}
            {task.plannedMin !== null && <span className="text-ink-3"> / {formatMinutes(task.plannedMin)}</span>}
          </span>
          <button type="button" aria-label="Complete task" title="Complete" onClick={() => void completeAndAdvance(task.id)} className={button}>
            <Check size={15} />
          </button>
        </>
      ) : (
        <span data-tauri-drag-region className="flex-1 text-ink-3">
          Nothing in progress
        </span>
      )}
      <button type="button" aria-label="Open Life Of Pi" title="Open Life Of Pi" onClick={() => void platform.showMainWindow()} className={button}>
        <AppWindow size={15} />
      </button>
    </div>
  );
}
