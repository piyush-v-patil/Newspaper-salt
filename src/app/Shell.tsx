import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ReferenceDataProvider, useProfile } from '@/data/ReferenceData';
import { NoRoomDialog } from '@/features/calendar/NoRoomDialog';
import { FocusBar } from '@/features/focus/FocusBar';
import { FocusNudges } from '@/features/focus/FocusNudges';
import { ShortcutSheet } from '@/features/help/ShortcutSheet';
import { CommandPalette } from '@/features/palette/CommandPalette';
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const focusing = /^\/(focus|plan|shutdown|weekly|welcome)/.test(pathname);

  // Until the first plan is made, setup is the only way in.
  const navigate = useNavigate();
  const settingUp = useProfile().onboardingCompletedAt === null;
  useEffect(() => {
    if (settingUp && !/^\/(welcome|plan)/.test(pathname)) void navigate({ to: '/welcome', replace: true });
  }, [settingUp, pathname, navigate]);

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
      <CommandPalette />
      <ShortcutSheet />
      <Celebration />
    </div>
  );
}
