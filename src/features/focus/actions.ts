import { startTimer, stopTimer, getRunningTimer } from '@/data/commands/timer';
import { setTaskCompleted } from '@/data/commands/tasks';
import { getSettings } from '@/data/db';
import { tasksForDay } from '@/data/queries';
import type { Id } from '@/data/types';
import { now, today } from '@/domain/clock';
import { celebrate } from '@/ui/Celebration';
import { useFocus } from './focusStore';

const MINUTE = 60_000;

/** Starts timing a task and puts it in the focus bar. */
export async function beginTimer(taskId: Id): Promise<void> {
  const settings = await getSettings();
  await startTimer(taskId);
  useFocus.setState({
    barTaskId: taskId,
    breakEndsAt: null,
    breakResumeTaskId: null,
    nextBreakPromptAt: now() + settings.breakReminders.workMin * MINUTE,
  });
}

export async function pauseTimer(): Promise<void> {
  await stopTimer();
  useFocus.setState({ nextBreakPromptAt: null });
}

/** Starts the timer on a task, or pauses it if that task is already being timed. Returns whether it is now running. */
export async function toggleTaskTimer(taskId: Id): Promise<boolean> {
  if ((await getRunningTimer())?.taskId === taskId) {
    await pauseTimer();
    return false;
  }
  await beginTimer(taskId);
  return true;
}

/** Pauses the timer and starts a break. */
export async function takeBreak(): Promise<void> {
  const settings = await getSettings();
  const running = await getRunningTimer();
  const resume = running?.taskId ?? useFocus.getState().barTaskId;
  if (running) await stopTimer();
  useFocus.setState({
    breakEndsAt: now() + settings.breakReminders.breakMin * MINUTE,
    breakResumeTaskId: resume,
    nextBreakPromptAt: null,
  });
}

/** Ends the break; with `resume`, goes straight back to timing the task. */
export async function endBreak(resume: boolean): Promise<void> {
  const { breakResumeTaskId } = useFocus.getState();
  useFocus.setState({ breakEndsAt: null, breakResumeTaskId: null });
  if (resume && breakResumeTaskId) await beginTimer(breakResumeTaskId);
}

export function snoozeBreakPrompt(minutes: number): void {
  useFocus.setState({ nextBreakPromptAt: now() + minutes * MINUTE });
}

/** The next unfinished task on today's list after `afterId`, wrapping round to the top. */
export async function nextTaskToday(afterId: Id | null): Promise<Id | null> {
  const open = (await tasksForDay(today())).filter((t) => t.completedAt === null || t.id === afterId);
  const index = open.findIndex((t) => t.id === afterId);
  const candidates = [...open.slice(index + 1), ...open.slice(0, Math.max(index, 0))].filter((t) => t.completedAt === null && t.id !== afterId);
  return candidates[0]?.id ?? null;
}

/**
 * Completes a task and hands back the next one to focus on. If the timer
 * was running it carries straight on with the next task. With nothing left
 * for today, it celebrates and returns null.
 */
export async function completeAndAdvance(taskId: Id): Promise<Id | null> {
  const wasRunning = (await getRunningTimer())?.taskId === taskId;
  const next = await nextTaskToday(taskId);
  await setTaskCompleted(taskId, true);
  if (!next) {
    useFocus.setState({ barTaskId: null, nextBreakPromptAt: null });
    if ((await getSettings()).celebrations) celebrate();
    return null;
  }
  if (wasRunning) await beginTimer(next);
  else useFocus.setState({ barTaskId: next });
  return next;
}
