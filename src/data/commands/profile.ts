import { now, today } from '@/domain/clock';
import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { command, db, getProfile } from '../db';
import type { Profile, Task } from '../types';

async function patchProfile(patch: Partial<Profile>): Promise<Profile> {
  const next = { ...(await getProfile()), ...patch };
  await db.meta.put({ key: 'profile', value: next });
  return next;
}

export const updateProfile = command(patchProfile);

const SETUP_NOTES = [
  '<p>A few things worth a look once your first day is under way.</p>',
  '<ul data-type="taskList">',
  ...[
    'Check your working hours and ritual times in Settings',
    'Add your regular meetings to the calendar so planning works around them',
    'Set this week’s objectives on This week (N)',
    'Start a timer on a task with Space and see focus mode',
    'Press ? to see every keyboard shortcut',
  ].map((item) => `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${item}</p></div></li>`),
  '</ul>',
].join('');

/**
 * Called when a daily plan is finished. Counts down the coached plans and,
 * the first time, completes setup and leaves a getting-started task on today.
 */
export const recordPlanFinished = command(async (): Promise<void> => {
  const profile = await getProfile();
  const patch: Partial<Profile> = { guidedPlansRemaining: Math.max(0, profile.guidedPlansRemaining - 1) };
  if (profile.onboardingCompletedAt === null) {
    patch.onboardingCompletedAt = now();
    const day = today();
    const onDay = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
    const stamp = now();
    const task: Task = {
      id: crypto.randomUUID(),
      title: 'Set up Life Of Pi',
      notes: SETUP_NOTES,
      channelId: null,
      day,
      order: keyAtEdge(onDay.map((t) => t.order).sort(compareKeys), 'bottom'),
      plannedMin: 10,
      dailyPriority: 'normal',
      backlogPriority: 'none',
      backlogBucket: 'someday',
      backlogFolderId: null,
      objectiveId: null,
      completedAt: null,
      completedDay: null,
      rolloverDays: 0,
      lastActivityDay: null,
      state: 'active',
      stateChangedAt: null,
      seriesId: null,
      seriesDay: null,
      edited: false,
      kind: 'task',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.tasks.add(task);
  }
  await patchProfile(patch);
});
