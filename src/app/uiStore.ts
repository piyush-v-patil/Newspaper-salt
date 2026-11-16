import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RightPanelKind = 'calendar' | 'objectives' | 'backlog' | 'archive' | 'search' | 'trash';

interface UiState {
  leftOpen: boolean;
  rightOpen: boolean;
  rightPanel: RightPanelKind;
  /** Bumped each time "add task" is requested, so the current view can respond. */
  addTaskRequest: number;
  toggleLeft: () => void;
  toggleRight: () => void;
  /** Opens the panel, or closes it if that panel is already showing. */
  showRightPanel: (panel: RightPanelKind) => void;
  requestAddTask: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      leftOpen: true,
      rightOpen: true,
      rightPanel: 'calendar',
      addTaskRequest: 0,
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      showRightPanel: (panel) =>
        set((s) => (s.rightOpen && s.rightPanel === panel ? { rightOpen: false } : { rightOpen: true, rightPanel: panel })),
      requestAddTask: () => set((s) => ({ addTaskRequest: s.addTaskRequest + 1 })),
    }),
    {
      name: 'pi-ui',
      partialize: (s) => ({ leftOpen: s.leftOpen, rightOpen: s.rightOpen, rightPanel: s.rightPanel }),
    },
  ),
);
