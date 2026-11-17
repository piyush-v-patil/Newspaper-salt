import { now } from '@/domain/clock';
import type { Day } from '@/domain/dates';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { command, db } from '../db';
import { emptyDayRecord } from '../queries';
import type { DayRecord, Task } from '../types';
import { stopRunningTimer } from './timer';

async function patchDay(day: Day, patch: Partial<DayRecord>): Promise<void> {
  const current = (await db.days.get(day)) ?? emptyDayRecord(day);
  await db.days.put({ ...current, ...patch, day });
}

/** Saves progress through a ritual, or any field of the day's record. */
export const updateDayRecord = command(patchDay);

/**
 * Leaves a finished card on the day to show the ritual was done, as a record
 * and a way back to it. One per ritual per day.
 */
async function addRitualCard(day: Day, title: string): Promise<void> {
  const onDay = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
  if (onDay.some((t) => t.kind === 'ritual' && t.title === title)) return;
  const stamp = now();
  const card: Task = {
    id: crypto.randomUUID(),
    title,
    notes: '',
    channelId: null,
    day,
    order: keyAtEdge(onDay.map((t) => t.order).sort(compareKeys), 'top'),
    plannedMin: null,
    dailyPriority: 'normal',
    backlogPriority: 'none',
    backlogBucket: 'someday',
    backlogFolderId: null,
    objectiveId: null,
    completedAt: stamp,
    completedDay: day,
    rolloverDays: 0,
    lastActivityDay: null,
    state: 'active',
    stateChangedAt: null,
    seriesId: null,
    seriesDay: null,
    edited: false,
    kind: 'ritual',
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.tasks.add(card);
}

export const PLANNING_CARD = 'Daily planning';
export const SHUTDOWN_CARD = 'Daily shutdown';

/** Marks the day's plan as done. */
export const finishPlanning = command(async (day: Day, patch: Partial<DayRecord> = {}): Promise<void> => {
  await patchDay(day, { ...patch, planStatus: 'done' });
  await addRitualCard(day, PLANNING_CARD);
});

/** Closes the day: saves highlights and reflection, and stops any running timer. */
export const finishShutdown = command(async (day: Day, patch: Partial<DayRecord>): Promise<void> => {
  await stopRunningTimer();
  await patchDay(day, { ...patch, shutdownStatus: 'done' });
  await addRitualCard(day, SHUTDOWN_CARD);
});

/** Turns a shut-down day back into a draft, so its highlights can be edited again. */
export const reopenShutdown = command((day: Day): Promise<void> => patchDay(day, { shutdownStatus: 'in_progress' }));
