import { describe, expect, it } from 'vitest';
import type { Subtask, Task, TimeEntry } from '@/data/types';
import { workedOnByDay } from './workedOn';

const at = (day: number, hour: number) => new Date(2026, 10, day, hour).getTime();
const task = (id: string, day: string, extra: Partial<Task> = {}) => ({ id, title: id, day, state: 'active', kind: 'task', completedDay: null, ...extra }) as Task;
const entry = (taskId: string, day: number, minutes: number): TimeEntry => ({ id: `${taskId}-${day}`, taskId, subtaskId: null, start: at(day, 10), end: at(day, 10) + minutes * 60_000 });
const sub = (taskId: string, day: number | null): Subtask => ({ id: `${taskId}-s`, taskId, title: 's', order: 'a0', plannedMin: null, completedAt: day ? at(day, 11) : null });
const DAYS = ['2026-11-15', '2026-11-16', '2026-11-17'];
const TODAY = '2026-11-17';

describe('workedOnByDay', () => {
  it('shows time tracked on a past day for a task that has since moved on', () => {
    const tasks = new Map([['report', task('report', '2026-11-17')]]);
    const result = workedOnByDay([entry('report', 16, 45)], [], tasks, DAYS, TODAY, at(17, 9));
    expect(result.get('2026-11-16')?.map((w) => [w.task.id, w.minutes])).toEqual([['report', 45]]);
  });

  it('counts a subtask checked off that day as progress', () => {
    const tasks = new Map([['report', task('report', '2026-11-17')]]);
    const result = workedOnByDay([], [sub('report', 15)], tasks, DAYS, TODAY, at(17, 9));
    expect(result.get('2026-11-15')?.[0].subtasksDone).toBe(1);
  });

  it('leaves out tasks still on that day, finished that day, today, and deleted ones', () => {
    const tasks = new Map([
      ['stayed', task('stayed', '2026-11-16')],
      ['finished', task('finished', '2026-11-16', { completedDay: '2026-11-16' })],
      ['moved', task('moved', '2026-11-18')],
      ['gone', task('gone', '2026-11-18', { state: 'deleted' })],
    ]);
    const entries = [entry('stayed', 16, 30), entry('finished', 16, 30), entry('moved', 17, 30), entry('gone', 16, 30)];
    expect(workedOnByDay(entries, [], tasks, DAYS, TODAY, at(17, 9)).size).toBe(0);
  });

  it('ignores a slip of under a minute', () => {
    const tasks = new Map([['report', task('report', '2026-11-17')]]);
    const blip: TimeEntry = { id: 'b', taskId: 'report', subtaskId: null, start: at(16, 10), end: at(16, 10) + 20_000 };
    expect(workedOnByDay([blip], [], tasks, DAYS, TODAY, at(17, 9)).size).toBe(0);
  });
});
