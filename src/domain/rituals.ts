import type { RitualStatus } from '@/data/types';
import { shiftDay, type Day } from './dates';

/** From 3 PM on, planning is for tomorrow rather than today. */
export const EVENING_FROM_MIN = 15 * 60;

/** The day a planning session plans: today for a morning planner, tomorrow for an evening one. */
export function planningTarget(planningMin: number, today: Day): Day {
  return planningMin >= EVENING_FROM_MIN ? shiftDay(today, 1) : today;
}

/** Planning is due once its time has come and the target day has no finished plan. */
export function isPlanningDue(nowMin: number, planningMin: number, planStatus: RitualStatus): boolean {
  return planStatus !== 'done' && nowMin >= planningMin;
}

/** Shutdown is due once the day's shutdown time has come and it has not been done. */
export function isShutdownDue(nowMin: number, shutdownMin: number, shutdownStatus: RitualStatus): boolean {
  return shutdownStatus !== 'done' && nowMin >= shutdownMin;
}

/**
 * Which ritual to offer when both are due. If planning and shutdown share a
 * time (an evening planner), shutdown comes first: close today, then plan
 * tomorrow.
 */
export function ritualToOffer(planningDue: boolean, shutdownDue: boolean): 'shutdown' | 'plan' | null {
  if (shutdownDue) return 'shutdown';
  return planningDue ? 'plan' : null;
}
