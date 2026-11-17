import { today } from '@/domain/clock';
import type { Day } from '@/domain/dates';
import { command, db } from '../db';
import { emptyWeekRecord } from '../queries';
import type { WeekRecord } from '../types';
import { addRitualCard, WEEKLY_PLANNING_CARD, WEEKLY_REVIEW_CARD } from './days';

async function patchWeek(weekStart: Day, patch: Partial<WeekRecord>): Promise<void> {
  const current = (await db.weeks.get(weekStart)) ?? emptyWeekRecord(weekStart);
  await db.weeks.put({ ...current, ...patch, weekStart });
}

export const updateWeekRecord = command(patchWeek);

/** Marks the week as planned and leaves a finished card on today. */
export const finishWeeklyPlanning = command(async (weekStart: Day, planText: string): Promise<void> => {
  await patchWeek(weekStart, { planStatus: 'done', planText });
  await addRitualCard(today(), WEEKLY_PLANNING_CARD);
});

/** Marks the week as reviewed and leaves a finished card on today. */
export const finishWeeklyReview = command(async (weekStart: Day, reviewText: string): Promise<void> => {
  await patchWeek(weekStart, { reviewStatus: 'done', reviewText });
  await addRitualCard(today(), WEEKLY_REVIEW_CARD);
});
