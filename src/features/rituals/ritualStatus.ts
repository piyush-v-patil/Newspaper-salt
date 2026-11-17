import { create } from 'zustand';
import { useNow } from '@/app/useNow';
import { useToday } from '@/app/useToday';
import { workingWindow } from '@/data/commands/sessions';
import { useDayRecord } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { nowMinutes } from '@/domain/clock';
import type { Day } from '@/domain/dates';
import { isPlanningDue, isShutdownDue, planningTarget } from '@/domain/rituals';

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
