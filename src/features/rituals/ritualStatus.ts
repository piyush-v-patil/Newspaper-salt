import { create } from 'zustand';
import { useNow } from '@/app/useNow';
import { useToday } from '@/app/useToday';
import { workingWindow } from '@/data/commands/sessions';
import { useDayRecord, useWeekRecord } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { nowMinutes } from '@/domain/clock';
import { weekdayOf, type Day } from '@/domain/dates';
import { isPlanningDue, isShutdownDue, planningTarget } from '@/domain/rituals';
import { planningWeek, reviewWeek, weekStartOf } from '@/domain/weeks';

export type RitualState = 'due' | 'done' | null;

interface Snoozes {
  planSnoozedUntil: number;
  planSkippedFor: Day | null;
  shutdownSnoozedUntil: number;
  shutdownDismissedFor: Day | null;
}

/** "Later" and "Skip today" choices on the ritual prompts. Forgotten on reload, which simply asks again. */
export const useSnoozes = create<Snoozes>(() => ({
  planSnoozedUntil: 0,
  planSkippedFor: null,
  shutdownSnoozedUntil: 0,
  shutdownDismissedFor: null,
}));

/** Where each daily ritual stands right now. Re-checked a few times a minute. */
export function useRitualStatus(): { plan: RitualState; shutdown: RitualState; planDay: Day; today: Day } {
  const settings = useSettings();
  const today = useToday();
  useNow(20_000);
  const planDay = planningTarget(settings.planningMin, today);
  const planRecord = useDayRecord(planDay);
  const todayRecord = useDayRecord(today);
  const minute = nowMinutes();
  const shutdownMin = todayRecord?.shutdownMin ?? (workingWindow(settings, today).endMin || 17 * 60);

  const plan: RitualState = !planRecord ? null : planRecord.planStatus === 'done' ? 'done' : isPlanningDue(minute, settings.planningMin, planRecord.planStatus) ? 'due' : null;
  const shutdown: RitualState = !todayRecord
    ? null
    : todayRecord.shutdownStatus === 'done'
      ? 'done'
      : isShutdownDue(minute, shutdownMin, todayRecord.shutdownStatus)
        ? 'due'
        : null;
  return { plan, shutdown, planDay, today };
}

/** Position of a weekday within the week: 0 for the first day of the week. */
const weekIndex = (weekday: number, weekStartsOn: 0 | 1) => (weekday - weekStartsOn + 7) % 7;

/** Where the weekly rituals stand: due from their set day and time until done. */
export function useWeeklyStatus(): { plan: RitualState; review: RitualState } {
  const settings = useSettings();
  const today = useToday();
  useNow(60_000);
  const planWeek = planningWeek(today, settings.weekStartsOn);
  const thisWeek = weekStartOf(today, settings.weekStartsOn);
  const reviewedWeek = reviewWeek(today, settings.weekStartsOn);
  const planRecord = useWeekRecord(planWeek);
  const reviewRecord = useWeekRecord(reviewedWeek);

  const todayIndex = weekIndex(weekdayOf(today), settings.weekStartsOn);
  const reached = (at: { weekday: number; min: number }) => {
    const index = weekIndex(at.weekday, settings.weekStartsOn);
    return todayIndex > index || (todayIndex === index && nowMinutes() >= at.min);
  };

  const plan: RitualState = !planRecord
    ? null
    : planRecord.planStatus === 'done'
      ? 'done'
      : // Only this week's plan can be overdue; next week's is not due yet.
        planWeek === thisWeek && reached(settings.weeklyPlan)
        ? 'due'
        : null;
  const review: RitualState = !reviewRecord
    ? null
    : reviewRecord.reviewStatus === 'done'
      ? 'done'
      : // Last week's review stays due until done; this week's becomes due at its set time.
        reviewedWeek !== thisWeek || reached(settings.weeklyReview)
        ? 'due'
        : null;
  return { plan, review };
}
