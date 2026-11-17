import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_HOUR_PX, HOUR_HEIGHTS, setHourPx } from '@/features/calendar/metrics';
import type { Id, TaskDay } from '@/data/types';
import type { Day } from '@/domain/dates';
import type { TaskFilter } from '@/domain/filter';

export type RightPanelKind = 'calendar' | 'objectives' | 'backlog' | 'archive' | 'search' | 'trash';

export type CalendarSpan = 'day' | '3day' | 'week' | 'month';
/** What the workload counter shows: every task, work tasks only, or actual against planned. */
export type WorkloadMode = 'all' | 'work' | 'actual';

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
  /** The add-task card: the day it adds to, and the row it opened from (to sit over it). */
  addWindow: { day: TaskDay | null; anchor: { top: number; left: number } | null; folderId: Id | null } | null;
  calendarSpan: CalendarSpan;
  workloadMode: WorkloadMode;
  /** The task that auto-scheduling could not fit, while the user decides what to do. */
  noRoomTaskId: Id | null;
  /** The command palette (Ctrl+K) and the keyboard shortcut sheet (?). */
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  /** The navigation opened as a drawer, when it is not docked. */
  navDrawerOpen: boolean;
  /** Desktop: the floating focus bar was put away with its shortcut. */
  floatingBarHidden: boolean;
  /** Calendar zoom: the height of one hour. */
  hourPx: number;
  /** Draw the time actually worked on the calendar, beside the plan. */
  showTracked: boolean;
  toggleTracked: () => void;
  zoomCalendar: (direction: 1 | -1) => void;
  setCalendarSpan: (span: CalendarSpan) => void;
  cycleWorkloadMode: () => void;
  setNoRoomTask: (id: Id | null) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  /** Opens the panel, or closes it if that panel is already showing. */
  showRightPanel: (panel: RightPanelKind) => void;
  setFilter: (filter: TaskFilter | null) => void;
  setFilterMenuOpen: (open: boolean) => void;
  setFocusedDay: (day: Day | null) => void;
  openAddTask: (day?: TaskDay, anchor?: { top: number; left: number }, folderId?: Id | null) => void;
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
      calendarSpan: 'week',
      workloadMode: 'all',
      noRoomTaskId: null,
      paletteOpen: false,
      shortcutsOpen: false,
      navDrawerOpen: false,
      floatingBarHidden: false,
      hourPx: DEFAULT_HOUR_PX,
      showTracked: false,
      toggleTracked: () => set((s) => ({ showTracked: !s.showTracked })),
      zoomCalendar: (direction) =>
        set((s) => {
          const i = HOUR_HEIGHTS.indexOf(s.hourPx);
          const next = HOUR_HEIGHTS[Math.max(0, Math.min(HOUR_HEIGHTS.length - 1, (i === -1 ? 2 : i) + direction))];
          return { hourPx: next };
        }),
      setCalendarSpan: (calendarSpan) => set({ calendarSpan }),
      cycleWorkloadMode: () =>
        set((s) => ({ workloadMode: s.workloadMode === 'all' ? 'work' : s.workloadMode === 'work' ? 'actual' : 'all' })),
      setNoRoomTask: (noRoomTaskId) => set({ noRoomTaskId }),
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      showRightPanel: (panel) =>
        set((s) => (s.rightOpen && s.rightPanel === panel ? { rightOpen: false } : { rightOpen: true, rightPanel: panel })),
      setFilter: (filter) => set({ filter }),
      setFilterMenuOpen: (filterMenuOpen) => set({ filterMenuOpen }),
      setFocusedDay: (focusedDay) => set({ focusedDay }),
      openAddTask: (day, anchor, folderId) => set((s) => ({ addWindow: { day: day ?? s.focusedDay, anchor: anchor ?? null, folderId: folderId ?? null } })),
      closeAddTask: () => set({ addWindow: null }),
    }),
    {
      name: 'pi-ui',
      partialize: (s) => ({
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        rightPanel: s.rightPanel,
        filter: s.filter,
        calendarSpan: s.calendarSpan,
        workloadMode: s.workloadMode,
        hourPx: s.hourPx,
        showTracked: s.showTracked,
      }),
    },
  ),
);

// The calendar's pixel maths reads the zoom from here, including while dragging.
setHourPx(useUi.getState().hourPx);
useUi.subscribe((s) => setHourPx(s.hourPx));
