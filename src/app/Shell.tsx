import { Outlet } from '@tanstack/react-router';
import { LeftNav } from './LeftNav';
import { RightPanel } from './RightPanel';
import { UndoToast } from './UndoToast';
import { useTheme } from './theme';
import { useGlobalShortcuts } from './useGlobalShortcuts';

export function Shell() {
  useTheme();
  useGlobalShortcuts();

  return (
    <div className="relative flex h-full overflow-hidden bg-canvas text-ink">
      <LeftNav />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <RightPanel />
      <UndoToast />
    </div>
  );
}
