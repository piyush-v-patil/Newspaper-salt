import { Outlet, useRouterState } from '@tanstack/react-router';
import { ReferenceDataProvider } from '@/data/ReferenceData';
import { NoRoomDialog } from '@/features/calendar/NoRoomDialog';
import { FocusBar } from '@/features/focus/FocusBar';
import { FocusNudges } from '@/features/focus/FocusNudges';
import { RitualPrompt } from '@/features/rituals/RitualPrompt';
import { AddTaskWindow } from '@/features/task/AddTaskWindow';
import { TaskDndRoot } from '@/features/task/TaskDnd';
import { TaskPage } from '@/features/task/TaskPage';
import { useTaskShortcuts } from '@/features/task/useTaskShortcuts';
import { Celebration } from '@/ui/Celebration';
import { LeftNav } from './LeftNav';
import { RightPanel } from './RightPanel';
import { UndoToast } from './UndoToast';
import { useTheme } from './theme';
import { useDayChange } from './useToday';
import { useGlobalShortcuts } from './useGlobalShortcuts';

/** Loads shared data first, so everything inside can rely on it being there. */
export function Shell() {
  return (
    <ReferenceDataProvider>
      <TaskDndRoot>
        <ShellBody />
      </TaskDndRoot>
    </ReferenceDataProvider>
  );
}

function ShellBody() {
  useTheme();
  useGlobalShortcuts();
  useTaskShortcuts();
  useDayChange();
  // Focus mode clears the panels away; the navigation still slides in from the left edge.
  // The same goes for the rituals, which bring their own columns.
  const focusing = useRouterState({ select: (s) => /^\/(focus|plan|shutdown)/.test(s.location.pathname) });

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-canvas text-ink">
      <div className="relative flex min-h-0 flex-1">
        <LeftNav hidden={focusing} />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
        {!focusing && <RightPanel />}
        <FocusNudges />
        <UndoToast />
      </div>
      {!focusing && <FocusBar />}
      <AddTaskWindow />
      <TaskPage />
      <NoRoomDialog />
      <RitualPrompt />
      <Celebration />
    </div>
  );
}
