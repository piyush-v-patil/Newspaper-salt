import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { backupTaskCount, exportData, parseBackup, restoreBackup } from './backup';
import { createChannel, deleteContext, updateChannel } from './commands/channels';
import { recordPlanFinished } from './commands/profile';
import { addSubtask } from './commands/subtasks';
import { createTask } from './commands/tasks';
import { db, getProfile } from './db';
import { tasksForDay } from './queries';
import { clearUndo, undoLast } from './undo';
import { createFromText } from '@/features/task/createFromText';

const DAY = '2026-11-17';

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  setClock(() => new Date(2026, 10, 17, 10).getTime());
  return () => resetClock();
});

describe('backup', () => {
  it('round-trips everything through export and restore', async () => {
    const task = await createTask({ title: 'Draft report', plannedMin: 90 });
    await addSubtask(task.id, 'Outline');
    const text = await exportData(1);

    await createTask({ title: 'Made after the backup' });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(backupTaskCount(parsed.backup)).toBe(1);
    await restoreBackup(parsed.backup);

    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['Draft report']);
    expect(await db.subtasks.count()).toBe(1);
    expect(await db.contexts.count()).toBe(2);
  });

  it('explains why a file cannot be used', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, reason: 'This file is not a Life Of Pi backup: it is not valid JSON.' });
    expect(parseBackup('{"app":"other"}')).toEqual({ ok: false, reason: 'This file is not a Life Of Pi backup.' });
    expect(parseBackup(JSON.stringify({ app: 'life-of-pi', version: 99, tables: {} })).ok).toBe(false);
    const partial = parseBackup(JSON.stringify({ app: 'life-of-pi', version: 1, tables: { tasks: [] } }));
    expect(partial).toEqual({ ok: false, reason: 'This backup is incomplete: it has no meta list.' });
  });
});

describe('profile', () => {
  it('finishing the first plan completes setup and leaves a getting-started task', async () => {
    expect((await getProfile()).onboardingCompletedAt).toBeNull();
    await recordPlanFinished();
    const profile = await getProfile();
    expect(profile.onboardingCompletedAt).not.toBeNull();
    expect(profile.guidedPlansRemaining).toBe(2);
    expect((await tasksForDay(DAY)).map((t) => t.title)).toEqual(['Set up Life Of Pi']);

    await recordPlanFinished();
    expect((await getProfile()).guidedPlansRemaining).toBe(1);
    expect((await tasksForDay(DAY)).length).toBe(1);
  });
});

describe('channels and contexts', () => {
  it('has one default channel at a time, used for new tasks', async () => {
    const deep = await createChannel('deep-work');
    const admin = await createChannel('admin');
    await updateChannel(deep.id, { isDefault: true });
    await updateChannel(admin.id, { isDefault: true });
    expect((await db.channels.get(deep.id))?.isDefault).toBe(false);
    const task = await createFromText('Expenses', { day: DAY });
    expect(task?.channelId).toBe(admin.id);
  });

  it('deleting a context keeps its channels, undoably', async () => {
    const work = (await db.contexts.toArray()).find((c) => c.name === 'Work')!;
    await deleteContext(work.id);
    expect((await db.channels.toArray()).find((c) => c.name === 'work')?.contextId).toBeNull();
    await undoLast();
    expect((await db.channels.toArray()).find((c) => c.name === 'work')?.contextId).toBe(work.id);
  });
});
