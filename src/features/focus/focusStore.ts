import { create } from 'zustand';
import type { Id } from '@/data/types';

interface FocusState {
  /** The task shown in the focus bar. Stays after pausing, so the timer can be resumed. */
  barTaskId: Id | null;
  /** When the current break ends, and the task to go back to. */
  breakEndsAt: number | null;
  breakResumeTaskId: Id | null;
  /** When to next suggest a break. */
  nextBreakPromptAt: number | null;
  /** Count down to the next break rather than up from zero. */
  pomodoro: boolean;
  /** Sessions whose "starts soon" prompt has been dismissed. */
  dismissedSessions: string[];
  /** The timer entry the planned-time chime has already played for. */
  chimedEntryId: Id | null;
}

export const useFocus = create<FocusState>(() => ({
  barTaskId: null,
  breakEndsAt: null,
  breakResumeTaskId: null,
  nextBreakPromptAt: null,
  pomodoro: false,
  dismissedSessions: [],
  chimedEntryId: null,
}));
