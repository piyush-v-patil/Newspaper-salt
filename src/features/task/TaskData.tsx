import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '@/data/db';
import { useSubtasks } from '@/data/queries';
import type { Id, Session, Subtask, Task } from '@/data/types';

interface TaskData {
  subtasks: Map<Id, Subtask[]>;
  /** Each task's calendar sessions, earliest first. */
  sessions: Map<Id, Session[]>;
}

const Ctx = createContext<TaskData>({ subtasks: new Map(), sessions: new Map() });

/** Loads what task cards need (subtasks, sessions) once for every card on screen, rather than once per card. */
export function TaskDataProvider({ tasks, children }: { tasks: Task[]; children: ReactNode }) {
  const ids = useMemo(() => tasks.map((t) => t.id).sort(), [tasks]);
  const key = ids.join(',');
  const subtasks = useSubtasks(ids);
  const sessionRows = useLiveQuery(() => (ids.length ? db.sessions.where('taskId').anyOf(ids).toArray() : []), [key]);

  const sessions = useMemo(() => {
    const grouped = new Map<Id, Session[]>();
    for (const s of sessionRows ?? []) {
      const list = grouped.get(s.taskId);
      if (list) list.push(s);
      else grouped.set(s.taskId, [s]);
    }
    for (const list of grouped.values()) list.sort((a, b) => (a.day === b.day ? a.startMin - b.startMin : a.day < b.day ? -1 : 1));
    return grouped;
  }, [sessionRows]);

  const value = useMemo(() => ({ subtasks, sessions }), [subtasks, sessions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaskData(): TaskData {
  return useContext(Ctx);
}
