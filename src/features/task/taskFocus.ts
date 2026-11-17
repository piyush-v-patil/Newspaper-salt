import { create } from 'zustand';
import type { Id } from '@/data/types';

export type TaskActionKind = 'planned' | 'actual' | 'channel' | 'date' | 'priority';

interface TaskFocusState {
  /** The task under the cursor. Shortcuts act on it. */
  hoveredId: Id | null;
  /** The task chosen with the arrow keys. Takes precedence over hover. */
  selectedId: Id | null;
  /** A picker opened on a task card by shortcut or click. */
  action: { taskId: Id; kind: TaskActionKind } | null;
  /** Set when the task page should open with the new-subtask field focused. */
  focusSubtaskOnOpen: boolean;
  setHovered: (id: Id | null) => void;
  select: (id: Id | null) => void;
  openAction: (taskId: Id, kind: TaskActionKind) => void;
  closeAction: () => void;
  setFocusSubtaskOnOpen: (value: boolean) => void;
}

export const useTaskFocus = create<TaskFocusState>((set) => ({
  hoveredId: null,
  selectedId: null,
  action: null,
  focusSubtaskOnOpen: false,
  setHovered: (hoveredId) => set({ hoveredId }),
  select: (selectedId) => set({ selectedId }),
  openAction: (taskId, kind) => set({ action: { taskId, kind } }),
  closeAction: () => set({ action: null }),
  setFocusSubtaskOnOpen: (focusSubtaskOnOpen) => set({ focusSubtaskOnOpen }),
}));

export function activeTaskId(): Id | null {
  const { selectedId, hoveredId } = useTaskFocus.getState();
  return selectedId ?? hoveredId;
}
