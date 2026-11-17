import type { Day } from '@/domain/dates';
import { db } from '../db';
import type { Id, Session } from '../types';
import { recordUndo } from '../undo';

/** The rows a command may touch: these tasks, their sessions, and every session on these days. */
export interface Scope {
  taskIds?: Id[];
  days?: Day[];
}

async function sessionsIn(scope: Scope): Promise<Session[]> {
  const found = new Map<Id, Session>();
  if (scope.taskIds?.length) for (const s of await db.sessions.where('taskId').anyOf(scope.taskIds).toArray()) found.set(s.id, s);
  if (scope.days?.length) for (const s of await db.sessions.where('day').anyOf(scope.days).toArray()) found.set(s.id, s);
  return [...found.values()];
}

/**
 * Runs the body of a command that changes tasks and calendar sessions
 * together, and records one undo step that puts everything in scope back as
 * it was. Call it from inside a command; it does not queue by itself.
 */
export async function withSnapshot<T>(
  label: string,
  scope: Scope,
  work: () => Promise<T>,
  announce = false,
  /** Anything else the command did that undo must reverse. */
  alsoUndo?: () => Promise<void>,
): Promise<T> {
  const tasksBefore = (await db.tasks.bulkGet(scope.taskIds ?? [])).filter((t) => t !== undefined);
  const sessionsBefore = await sessionsIn(scope);
  const value = await work();
  recordUndo(
    label,
    async () => {
      await alsoUndo?.();
      const current = await sessionsIn(scope);
      await db.sessions.bulkDelete(current.map((s) => s.id));
      await db.sessions.bulkPut(sessionsBefore);
      await db.tasks.bulkPut(tasksBefore);
    },
    announce,
  );
  return value;
}
