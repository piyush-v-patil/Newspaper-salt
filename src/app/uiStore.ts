import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskDay } from '@/data/types';
import type { Day } from '@/domain/dates';
import type { TaskFilter } from '@/domain/filter';

export type RightPanelKind = 'calendar' | 'objectives' | 'backlog' | 'archive' | 'search' | 'trash';

interface UiState {
  leftOpen: boolean;
  rightOpen: boolean;
  rightPanel: RightPanelKind;
  /** Limits every view to one channel or context. */
  filter: TaskFilter | null;
  filterMenuOpen: boolean;
  /** The day the current view is centred on; new tasks default to it. Null means today. */
  focusedDay: Day | null;
  /** The add-task window, and the day it will add to. */
  addWindow: { day: TaskDay | null } | null;
  toggleLeft: () => void;
  toggleRight: () => void;
  /** Opens the panel, or closes it if that panel is already showing. */
  showRightPanel: (panel: RightPanelKind) => void;
  setFilter: (filter: TaskFilter | null) => void;
  setFilterMenuOpen: (open: boolean) => void;
  setFocusedDay: (day: Day | null) => void;
  openAddTask: (day?: TaskDay) => void;
  closeAddTask: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      leftOpen: true,
      rightOpen: true,
      rightPanel: 'calendar',
      filter: null,
      filterMenuOpen: false,
      focusedDay: null,
      addWindow: null,
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      showRightPanel: (panel) =>
        set((s) => (s.rightOpen && s.rightPanel === panel ? { rightOpen: false } : { rightOpen: true, rightPanel: panel })),
      setFilter: (filter) => set({ filter }),
      setFilterMenuOpen: (filterMenuOpen) => set({ filterMenuOpen }),
      setFocusedDay: (focusedDay) => set({ focusedDay }),
      openAddTask: (day) => set((s) => ({ addWindow: { day: day ?? s.focusedDay } })),
      closeAddTask: () => set({ addWindow: null }),
    }),
    {
      name: 'pi-ui',
      partialize: (s) => ({ leftOpen: s.leftOpen, rightOpen: s.rightOpen, rightPanel: s.rightPanel, filter: s.filter }),
    },
  ),
);
