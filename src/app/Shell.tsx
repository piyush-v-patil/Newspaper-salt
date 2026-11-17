import { Outlet } from '@tanstack/react-router';
import { ReferenceDataProvider } from '@/data/ReferenceData';
import { NoRoomDialog } from '@/features/calendar/NoRoomDialog';
import { AddTaskWindow } from '@/features/task/AddTaskWindow';
import { TaskDndRoot } from '@/features/task/TaskDnd';
import { TaskPage } from '@/features/task/TaskPage';
import { useTaskShortcuts } from '@/features/task/useTaskShortcuts';
import { LeftNav } from './LeftNav';
import { RightPanel } from './RightPanel';
import { UndoToast } from './UndoToast';
import { useTheme } from './theme';
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

  return (
    <div className="relative flex h-full overflow-hidden bg-canvas text-ink">
      <LeftNav />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <RightPanel />
      <UndoToast />
      <AddTaskWindow />
      <TaskPage />
      <NoRoomDialog />
    </div>
  );
}
