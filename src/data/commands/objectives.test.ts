import { beforeEach, describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/domain/clock';
import { db } from '../db';
import { clearUndo, undoLast } from '../undo';
import { carryOverObjective, createObjective, deleteObjective, linkTask, setObjectiveCompleted } from './objectives';
import { createTask } from './tasks';

const WEEK = '2026-11-16';
const titles = async (week: string) => (await db.objectives.where('weekStart').equals(week).toArray()).sort((a, b) => (a.order < b.order ? -1 : 1)).map((o) => o.title);

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
  setClock(() => new Date(2026, 10, 17, 10).getTime());
  return () => resetClock();
});

describe('objectives', () => {
  it('adds new objectives at the top of their week', async () => {
    await createObjective(WEEK, 'Ship v2 pricing');
    await createObjective(WEEK, ' Hire designer ');
    await createObjective('2026-11-23', 'Next week thing');
    expect(await titles(WEEK)).toEqual(['Hire designer', 'Ship v2 pricing']);
  });

  it('links tasks, completes, and unlinks on delete with undo', async () => {
    const objective = await createObjective(WEEK, 'Ship v2 pricing');
    const task = await createTask({ title: 'Draft the page', objectiveId: objective.id });
    const other = await createTask({ title: 'Unrelated' });
    await linkTask(other.id, objective.id);
    expect(await db.tasks.where('objectiveId').equals(objective.id).count()).toBe(2);

    await setObjectiveCompleted(objective.id, true);
    expect((await db.objectives.get(objective.id))?.completedAt).not.toBeNull();

    await deleteObjective(objective.id);
    expect((await db.tasks.get(task.id))?.objectiveId).toBeNull();
    expect(await db.tasks.count()).toBe(2);
    await undoLast();
    expect((await db.tasks.get(task.id))?.objectiveId).toBe(objective.id);
    expect((await db.objectives.get(objective.id))?.title).toBe('Ship v2 pricing');
  });

  it('carries an objective into another week with its tasks still linked', async () => {
    const objective = await createObjective(WEEK, 'Hire designer');
    const task = await createTask({ title: 'Phone screens', objectiveId: objective.id });
    await createObjective('2026-11-23', 'Already there');
    await carryOverObjective(objective.id, '2026-11-23');
    expect(await titles(WEEK)).toEqual([]);
    expect(await titles('2026-11-23')).toEqual(['Already there', 'Hire designer']);
    expect((await db.tasks.get(task.id))?.objectiveId).toBe(objective.id);
  });
});
