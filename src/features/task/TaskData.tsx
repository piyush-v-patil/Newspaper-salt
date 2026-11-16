import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSubtasks } from '@/data/queries';
import { useChannelMap } from '@/data/ReferenceData';
import type { Channel, Id, Subtask, Task } from '@/data/types';

interface TaskData {
  channels: Map<Id, Channel>;
  subtasks: Map<Id, Subtask[]>;
}

const Ctx = createContext<TaskData>({ channels: new Map(), subtasks: new Map() });

/** Loads what task cards need (channels, subtasks) once per view rather than once per card. */
export function TaskDataProvider({ tasks, children }: { tasks: Task[]; children: ReactNode }) {
  const channels = useChannelMap();
  const ids = useMemo(() => tasks.map((t) => t.id).sort(), [tasks]);
  const subtasks = useSubtasks(ids);
  const value = useMemo(() => ({ channels, subtasks }), [channels, subtasks]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaskData(): TaskData {
  return useContext(Ctx);
}
