import type { DaySchedule, Profile, Settings } from './types';

const workday: DaySchedule = { available: true, startMin: 9 * 60, endMin: 17 * 60 };

/** Values a new profile starts with. They match the defaults in PLAN.md section 6. */
export const defaultSettings: Settings = {
  darkMode: 'system',
  timeFormat: '24h',
  weekStartsOn: 1,
  defaultView: 'today',
  newTaskPosition: 'top',
  rolloverPosition: 'top',
  workloadThresholdMin: 5 * 60 + 30,
  countPlannedAsActual: false,
  schedule: Array.from({ length: 7 }, () => ({ ...workday })),
  planningMin: 8 * 60 + 30,
  autoPlanning: true,
  autoShutdown: true,
  weeklyPlan: { weekday: 1, min: 8 * 60, auto: true },
  weeklyReview: { weekday: 5, min: 15 * 60, auto: true },
  defaultSessionMin: 30,
  autoScheduleGapMin: 0,
  rescheduleOnConflict: true,
  rescheduleOnEarlyFinish: true,
  focusOnTimerStart: true,
  planSummaryStep: true,
  endOfDayMessage: { kind: 'encouragement', text: '' },
  breakReminders: { on: false, workMin: 25, breakMin: 5 },
  timerSounds: true,
  archiveAfterDays: 4,
  celebrations: true,
};

export function newProfile(createdAt: number): Profile {
  return { name: '', createdAt, onboardingCompletedAt: null, guidedPlansRemaining: 3 };
}
