import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check, Coffee, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNow } from '@/app/useNow';
import { getRunningTimer } from '@/data/commands/timer';
import { db } from '@/data/db';
import { useRunningTimer, useSubtasks, useTask, useTasksForDay } from '@/data/queries';
import { useChannelMap, useSettings } from '@/data/ReferenceData';
import type { Id } from '@/data/types';
import { nowMinutes, today } from '@/domain/clock';
import { formatMinutes } from '@/domain/dates';
import { formatElapsed } from '@/domain/time';
import { CalendarPanel } from '@/features/calendar/CalendarPanel';
import { ChannelTag } from '@/features/task/ChannelTag';
import { NotesEditor } from '@/features/task/NotesEditor';
import { Subtasks } from '@/features/task/Subtasks';
import { CounterEditor } from '@/features/task/CounterEditor';
import { TitleField } from '@/features/task/TaskPage';
import { CheckCircle } from '@/ui/CheckCircle';
import { completeAndAdvance, nextTaskToday, takeBreak, toggleTaskTimer } from './actions';
import { useFocus } from './focusStore';
import { useTaskTime } from './useTaskTime';

/** Which task to focus on when none was named: the one being timed, the one scheduled now, or the first left today. */
async function defaultFocusTask(): Promise<Id | null> {
  const running = await getRunningTimer();
  if (running) return running.taskId;
  const minute = nowMinutes();
  const sessions = await db.sessions.where('day').equals(today()).toArray();
  for (const session of sessions.filter((s) => s.startMin <= minute && minute < s.endMin)) {
    const task = await db.tasks.get(session.taskId);
    if (task?.state === 'active' && task.completedAt === null) return task.id;
  }
  return nextTaskToday(null);
}

function DoneForTheDay() {
  const navigate = useNavigate();
  const done = (useTasksForDay(today()) ?? []).filter((t) => t.completedAt !== null);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight">Done for the day</h1>
        <p className="text-[14px] text-ink-2">
          {done.length === 0 ? 'Nothing left on today’s list.' : `Everything on today’s list is finished: ${done.length} ${done.length === 1 ? 'task' : 'tasks'}.`}
        </p>
      </div>
      <ul className="flex w-full max-w-[380px] flex-col gap-1.5">
        {done.slice(0, 8).map((t) => (
          <li key={t.id} className="flex items-center gap-2.5 text-[14px] text-ink-3">
            <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-done text-white">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="truncate line-through">{t.title}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void navigate({ to: '/today' })} className="h-8 rounded-md border border-line px-3 text-[13px] hover:bg-hover">
        Back to Today
      </button>
    </div>
  );
}

/** One task, its timer, subtasks and notes, with everything else out of the way. */
export function FocusPage({ taskId }: { taskId?: Id }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const channels = useChannelMap();
  const task = useTask(taskId);
  const subtasks = useSubtasks(taskId ? [taskId] : []).get(taskId ?? '') ?? [];
  const time = useTaskTime(taskId);
  const running = useRunningTimer();
  const { pomodoro, nextBreakPromptAt } = useFocus();
  const nowMs = useNow(1000, pomodoro && time.running);
  const [resolved, setResolved] = useState(false);
  const [peekCalendar, setPeekCalendar] = useState(false);

  const goTo = (id: Id | null) => {
    if (id) void navigate({ to: '/focus/$taskId', params: { taskId: id }, replace: true });
    else void navigate({ to: '/focus', replace: true });
  };

  // With no task named, pick one.
  useEffect(() => {
    if (taskId) return;
    let cancelled = false;
    void defaultFocusTask().then((id) => {
      if (cancelled) return;
      if (id) goTo(id);
      else setResolved(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (taskId) useFocus.setState({ barTaskId: taskId });
  }, [taskId]);

  const handlers = useRef({
    complete: async () => {},
    step: async (_direction: 1 | -1) => {},
  });
  handlers.current = {
    complete: async () => {
      if (taskId) goTo(await completeAndAdvance(taskId));
    },
    step: async (direction) => {
      if (!taskId) return;
      const open = (await db.tasks.where('[state+day]').equals(['active', today()]).toArray())
        .filter((t) => t.completedAt === null)
        .sort((a, b) => (a.order < b.order ? -1 : 1));
      const index = open.findIndex((t) => t.id === taskId);
      const next = open[index + direction];
      if (next) goTo(next.id);
    },
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Escape') void navigate({ to: '/today' });
      else if (e.key === ' ' && !e.shiftKey && taskId) {
        e.preventDefault();
        void toggleTaskTimer(taskId);
      } else if (e.key === 'c') void handlers.current.complete();
      else if (e.key === 'ArrowDown') void handlers.current.step(1);
      else if (e.key === 'ArrowUp') void handlers.current.step(-1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [taskId, navigate]);

  if (!taskId) return resolved ? <DoneForTheDay /> : null;
  if (!task) return null;
  if (task.completedAt !== null && running?.taskId !== task.id) return <DoneForTheDay />;

  const channel = task.channelId ? channels.get(task.channelId) : undefined;
  const countdown = pomodoro && time.running && nextBreakPromptAt !== null ? Math.max(0, nextBreakPromptAt - nowMs) : null;
  const tab = (on: boolean) => `h-full rounded px-2.5 text-[12.5px] ${on ? 'bg-hover font-medium text-ink' : 'text-ink-2 hover:text-ink'}`;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-6">
        <button type="button" onClick={() => void navigate({ to: '/today' })} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-hover hover:text-ink">
          <ArrowLeft size={14} /> Today
        </button>
        <div role="group" aria-label="Timer view" className="flex h-7 items-center rounded-md border border-line p-0.5">
          <button type="button" aria-pressed={!pomodoro} className={tab(!pomodoro)} onClick={() => useFocus.setState({ pomodoro: false })}>
            Task timer
          </button>
          <button type="button" aria-pressed={pomodoro} className={tab(pomodoro)} onClick={() => useFocus.setState({ pomodoro: true })}>
            Pomodoro
          </button>
        </div>
        <span className="w-[72px]" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-7 px-6 pb-24 pt-8">
          <div className="flex flex-col gap-3">
            <div className="flex h-5 items-center gap-2 text-[12.5px] text-ink-3">
              {channel && <ChannelTag channel={channel} />}
              {task.plannedMin !== null && <span className="tabular">{formatMinutes(task.plannedMin)} planned</span>}
            </div>
            <div className="flex items-start gap-3">
              <span className="pt-1.5">
                <CheckCircle checked={false} onChange={() => void handlers.current.complete()} label={`Complete ${task.title}`} />
              </span>
              <TitleField task={task} large />
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 pl-[30px]">
            <div className="flex items-baseline gap-3">
              <span data-testid="focus-timer" className={`tabular text-[44px] font-semibold leading-none tracking-tight ${time.running ? 'text-ink' : 'text-ink-2'}`}>
                {countdown !== null ? formatElapsed(countdown) : formatElapsed(time.todayMs)}
              </span>
              {countdown !== null && <span className="text-[13px] text-ink-3">until a {settings.breakReminders.breakMin}-minute break</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleTaskTimer(task.id)}
                className="flex h-9 items-center gap-2 rounded-md bg-ink px-3.5 text-[13.5px] font-medium text-canvas"
              >
                {time.running ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                {time.running ? 'Pause' : time.todayMs > 0 ? 'Resume' : 'Start'}
              </button>
              <button type="button" onClick={() => void handlers.current.complete()} className="flex h-9 items-center gap-2 rounded-md border border-line px-3 text-[13.5px] hover:bg-hover">
                <Check size={14} /> Complete
              </button>
              <button type="button" onClick={() => void takeBreak()} className="flex h-9 items-center gap-2 rounded-md px-3 text-[13.5px] text-ink-2 hover:bg-hover">
                <Coffee size={14} /> Take a break
              </button>
            </div>
          </div>

          <CounterEditor task={task} />
          <section aria-label="Subtasks" className="pl-[26px]">
            <Subtasks taskId={task.id} subtasks={subtasks} />
          </section>
          <section aria-label="Notes" className="border-t border-line pl-[30px] pt-4">
            <NotesEditor key={task.id} taskId={task.id} initial={task.notes} />
          </section>
        </div>
      </div>

      {/* The calendar stays out of sight until the cursor reaches the right edge. */}
      <div className="absolute inset-y-0 right-0 z-20" onMouseEnter={() => setPeekCalendar(true)} onMouseLeave={() => setPeekCalendar(false)}>
        <div className="h-full w-2" />
        <div
          inert={!peekCalendar}
          className={`absolute inset-y-0 right-0 border-l border-line bg-canvas shadow-pop transition-[transform,visibility] duration-200 ease-out-soft ${
            peekCalendar ? 'visible translate-x-0' : 'invisible translate-x-full'
          }`}
        >
          <CalendarPanel />
        </div>
      </div>
    </div>
  );
}
