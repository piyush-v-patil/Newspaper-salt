import { create } from 'zustand';
import type { Id, Task } from '@/data/types';
import type { Day } from '@/domain/dates';

export type Lists = Record<string, Task[]>;
export type Draft = Record<string, Id[]>;

interface DndState {
  /** Task lists currently on screen, registered by the views that show them. */
  sources: Record<string, Lists>;
  /** Local reordering while a drag is in flight. */
  draft: Draft | null;
  activeId: Id | null;
  /** Where a dragged task would land on the calendar. */
  ghost: { day: Day; startMin: number; durationMin: number } | null;
  setSource: (key: string, lists: Lists | null) => void;
}

export const useDnd = create<DndState>((set) => ({
  sources: {},
  draft: null,
  activeId: null,
  ghost: null,
  setSource: (key, lists) =>
    set((s) => {
      const sources = { ...s.sources };
      if (lists) sources[key] = lists;
      else delete sources[key];
      return { sources };
    }),
}));
