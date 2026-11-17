import { describe, expect, it } from 'vitest';
import type { Task } from '@/data/types';
import { autoSortOrder } from './autoSort';

const task = (id: string, extra: Partial<Task> = {}) => ({ id, title: id, completedAt: null, dailyPriority: 'normal', ...extra }) as Task;

describe('auto-sort', () => {
  it('puts timeboxed tasks first by time, then the rest by priority, then finished ones', () => {
    const tasks = [
      task('done', { completedAt: 1 }),
      task('low', { dailyPriority: 'low' }),
      task('afternoon'),
      task('plain'),
      task('urgent', { dailyPriority: 'urgent' }),
      task('morning'),
    ];
    const sessions = [
      { taskId: 'afternoon', day: 'd', startMin: 840 },
      { taskId: 'morning', day: 'd', startMin: 540 },
      { taskId: 'morning', day: 'other', startMin: 60 },
    ];
    expect(autoSortOrder(tasks, sessions, 'd').map((t) => t.id)).toEqual(['morning', 'afternoon', 'urgent', 'plain', 'low', 'done']);
  });
});
