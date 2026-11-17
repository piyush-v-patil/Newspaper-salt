import { useNavigate } from '@tanstack/react-router';
import { notifyIfAway } from '@/app/useDesktop';
import { formatMinutes } from '@/domain/dates';
import { useEffect, useMemo } from 'react';
import { useNow } from '@/app/useNow';
import { useRunningTimer, useSchedule, useTask } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { nowMinutes, today } from '@/domain/clock';
import { beginTimer, endBreak, snoozeBreakPrompt, takeBreak } from './actions';
import { playChime } from './chime';
import { useFocus } from './focusStore';
import { useTaskTime } from './useTaskTime';

const SOON_MIN = 5;
const primary = 'h-7 rounded-md bg-ink px-2.5 text-[12.5px] font-medium text-canvas';
const quiet = 'h-7 rounded-md px-2.5 text-[12.5px] text-ink-2 hover:bg-hover';

function Nudge({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-surface py-2 pl-4 pr-2 text-[13.5px] shadow-pop data-[state=open]:animate-pop">
      <span className="font-medium">{text}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

/**
 * Prompts that appear while a timer runs: time for a break, break over, the
 * next timeboxed task is about to start. Also plays the chime when the
 * task reaches its planned time.
 */
export function FocusNudges() {
  const navigate = useNavigate();
  const settings = useSettings();
  const running = useRunningTimer();
  const { breakEndsAt, nextBreakPromptAt, pomodoro, dismissedSessions, chimedEntryId } = useFocus();
  const active = running !== null || breakEndsAt !== null;
  const nowMs = useNow(1000, active);
  const day = today();
  const days = useMemo(() => [day], [day]);
  const schedule = useSchedule(days);
  const task = useTask(running?.taskId);
  const time = useTaskTime(running?.taskId);

  // Chime once when the running task reaches its planned time.
  const reachedPlan = running !== null && task?.plannedMin != null && time.todayMs >= task.plannedMin * 60_000;
  useEffect(() => {
    if (!reachedPlan || !running || chimedEntryId === running.entryId) return;
    useFocus.setState({ chimedEntryId: running.entryId });
    if (settings.timerSounds) playChime();
    if (task) notifyIfAway('Planned time reached', `${task.title} has reached its ${formatMinutes(task.plannedMin ?? 0)} estimate.`);
  }, [reachedPlan, running, chimedEntryId, settings.timerSounds, task]);

  // A break that comes due while the app is in the background.
  const breakDueNow = running !== null && (settings.breakReminders.on || pomodoro) && nextBreakPromptAt !== null && nowMs >= nextBreakPromptAt;
  useEffect(() => {
    if (breakDueNow) notifyIfAway('Ready for a break?', 'You have been working for a while.');
  }, [breakDueNow]);

  const breakOver = breakEndsAt !== null && nowMs >= breakEndsAt;
  const breakDue = running !== null && (settings.breakReminders.on || pomodoro) && nextBreakPromptAt !== null && nowMs >= nextBreakPromptAt;

  const minute = nowMinutes();
  const soon =
    running &&
    schedule?.sessions.find(
      (s) =>
        s.taskId !== running.taskId &&
        s.task.completedAt === null &&
        s.startMin > minute &&
        s.startMin - minute <= SOON_MIN &&
        !dismissedSessions.includes(s.id),
    );

  if (!breakOver && !breakDue && !soon) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex flex-col items-center gap-2">
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        {breakOver && (
          <Nudge text="Break's over. Ready to get back to it?">
            <button type="button" className={primary} onClick={() => void endBreak(true)}>
              Resume
            </button>
            <button type="button" className={quiet} onClick={() => void endBreak(false)}>
              Not yet
            </button>
          </Nudge>
        )}
        {breakDue && (
          <Nudge text="Ready for a break?">
            <button type="button" className={primary} onClick={() => void takeBreak()}>
              Yes
            </button>
            <button type="button" className={quiet} onClick={() => snoozeBreakPrompt(5)}>
              In 5 min
            </button>
            <button type="button" className={quiet} onClick={() => snoozeBreakPrompt(settings.breakReminders.workMin)}>
              I'm ok
            </button>
          </Nudge>
        )}
        {soon && (
          <Nudge text={`${soon.task.title} starts soon. Shift focus?`}>
            <button
              type="button"
              className={primary}
              onClick={() => {
                useFocus.setState((s) => ({ dismissedSessions: [...s.dismissedSessions, soon.id] }));
                void beginTimer(soon.taskId).then(() => navigate({ to: '/focus/$taskId', params: { taskId: soon.taskId } }));
              }}
            >
              Shift focus
            </button>
            <button type="button" className={quiet} onClick={() => useFocus.setState((s) => ({ dismissedSessions: [...s.dismissedSessions, soon.id] }))}>
              Dismiss
            </button>
          </Nudge>
        )}
      </div>
    </div>
  );
}
