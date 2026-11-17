import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { undoLast } from '@/data/undo';
import { takeBreak } from '@/features/focus/actions';
import { activeTaskId } from '@/features/task/taskFocus';
import { toggleDarkMode } from './theme';
import { useUi, type RightPanelKind } from './uiStore';

const goTo = {
  t: '/today',
  n: '/week',
  h: '/board',
  j: '/calendar',
  f: '/focus',
  p: '/plan',
  o: '/shutdown',
  b: '/backlog',
} as const;

const shiftPanels: Record<string, RightPanelKind> = {
  C: 'calendar',
  R: 'objectives',
  B: 'backlog',
  A: 'archive',
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** App-wide keys. View-specific keys are handled by the view itself. */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        void undoLast();
        return;
      }
      // While a window or picker is open, keys belong to it.
      if (mod || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;

      const ui = useUi.getState();
      if (e.key === '<') return ui.toggleLeft();
      if (e.key === '>') return ui.toggleRight();

      if (e.shiftKey) {
        if (e.key === 'L') return void toggleDarkMode();
        if (e.key === 'F') {
          e.preventDefault();
          return ui.setFilterMenuOpen(true);
        }
        const panel = shiftPanels[e.key];
        if (panel) ui.showRightPanel(panel);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        ui.openAddTask();
        return;
      }
      if (key === 'k') return void takeBreak();
      // With a task under the cursor, F focuses that task (handled with the task shortcuts).
      if (key === 'f' && activeTaskId() && !location.pathname.startsWith('/focus')) return;
      if (key in goTo) void navigate({ to: goTo[key as keyof typeof goTo] });
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}
